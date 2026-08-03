package shuttlers.iisc.com;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;

import java.io.IOException;
import java.security.GeneralSecurityException;

@CapacitorPlugin(
    name = "Geofence",
    permissions = {
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location"),
        @Permission(strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}, alias = "backgroundLocation")
    }
)
public class GeofencePlugin extends Plugin {

    static final String PREFS_NAME = "geofence_auth_prefs";
    static final String KEY_PLAYER_ID = "player_id";
    static final String KEY_ACCESS_TOKEN = "access_token";
    static final String KEY_REFRESH_TOKEN = "refresh_token";
    static final String KEY_SUPABASE_URL = "supabase_url";
    static final String KEY_SUPABASE_ANON_KEY = "supabase_anon_key";

    private static final String TAG = "GeofencePlugin";

    private GeofencingClient geofencingClient;
    private PendingIntent geofencePendingIntent;

    @Override
    public void load() {
        super.load();
        geofencingClient = LocationServices.getGeofencingClient(getContext());
    }

    /**
     * Auth tokens are sensitive and long-lived, so they're stored Keystore-encrypted rather than
     * in plain SharedPreferences. Falls back to plain prefs only if the Keystore itself is
     * unavailable (shouldn't happen on supported API levels).
     */
    static SharedPreferences getAuthPrefs(Context context) {
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (GeneralSecurityException | IOException e) {
            Log.e(TAG, "Failed to open encrypted auth prefs, failing closed", e);
            return null;
        }
    }

    private PendingIntent getGeofencePendingIntent() {
        if (geofencePendingIntent != null) {
            return geofencePendingIntent;
        }
        Intent intent = new Intent(getContext(), GeofenceReceiver.class);
        intent.setAction("shuttlers.iisc.com.ACTION_GEOFENCE_TRANSITION");
        geofencePendingIntent = PendingIntent.getBroadcast(
                getContext(), 
                0, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        return geofencePendingIntent;
    }

    @PluginMethod
    public void setupGymkhanaGeofence(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        ensureBackgroundLocation(call);
    }

    @PluginMethod
    public void setAuthContext(PluginCall call) {
        String playerId = call.getString("playerId");
        String accessToken = call.getString("accessToken");
        String refreshToken = call.getString("refreshToken");
        String supabaseUrl = call.getString("supabaseUrl");
        String anonKey = call.getString("anonKey");

        SharedPreferences prefs = getAuthPrefs(getContext());
        if (prefs == null) {
            call.reject("Keystore encryption failed");
            return;
        }
        prefs.edit()
                .putString(KEY_PLAYER_ID, playerId)
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putString(KEY_SUPABASE_URL, supabaseUrl)
                .putString(KEY_SUPABASE_ANON_KEY, anonKey)
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void clearAuthContext(PluginCall call) {
        SharedPreferences prefs = getAuthPrefs(getContext());
        if (prefs != null) {
            prefs.edit().clear().apply();
        }
        call.resolve();
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission not granted");
            return;
        }
        ensureBackgroundLocation(call);
    }

    /**
     * Android 10+ rejects a combined foreground+background location request outright, so
     * background access must be requested as a separate, later step after foreground is granted.
     * Background is nice-to-have for reliable exit events; we still add the geofence in the
     * foreground-only case rather than blocking setup on it.
     */
    private void ensureBackgroundLocation(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && getPermissionState("backgroundLocation") != PermissionState.GRANTED) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundLocationPermissionCallback");
            return;
        }
        addGeofence(call);
    }

    @PermissionCallback
    private void backgroundLocationPermissionCallback(PluginCall call) {
        // Proceed regardless of outcome: foreground-only geofencing still works, just less
        // reliably in the background, which is an acceptable degradation.
        addGeofence(call);
    }

    @SuppressLint("MissingPermission")
    private void addGeofence(PluginCall call) {
        // IISc Gymkhana coordinates
        double lat = call.getDouble("lat", 13.018642901278326);
        double lng = call.getDouble("lng", 77.56470563726191);
        float radius = call.getFloat("radius", 50.0f); // 50 meters

        Geofence geofence = new Geofence.Builder()
                .setRequestId("GYMKHANA_GEOFENCE")
                .setCircularRegion(lat, lng, radius)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                .build();

        GeofencingRequest request = new GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                .addGeofence(geofence)
                .build();

        geofencingClient.addGeofences(request, getGeofencePendingIntent())
                .addOnSuccessListener(aVoid -> call.resolve())
                .addOnFailureListener(e -> call.reject("Failed to add geofence", e));
    }
}
