package shuttlers.iisc.com;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;

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

@CapacitorPlugin(
    name = "Geofence",
    permissions = {
        @Permission(strings = {Manifest.permission.ACCESS_FINE_LOCATION}, alias = "location"),
        @Permission(strings = {Manifest.permission.ACCESS_BACKGROUND_LOCATION}, alias = "backgroundLocation")
    }
)
public class GeofencePlugin extends Plugin {

    private GeofencingClient geofencingClient;
    private PendingIntent geofencePendingIntent;

    @Override
    public void load() {
        super.load();
        geofencingClient = LocationServices.getGeofencingClient(getContext());
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
        addGeofence(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission not granted");
            return;
        }
        addGeofence(call);
    }

    @SuppressLint("MissingPermission")
    private void addGeofence(PluginCall call) {
        // IISc Gymkhana coordinates
        double lat = call.getDouble("lat", 13.016601274233912);
        double lng = call.getDouble("lng", 77.56285452175143);
        float radius = call.getFloat("radius", 50.0f); // 50 meters

        Geofence geofence = new Geofence.Builder()
                .setRequestId("GYMKHANA_GEOFENCE")
                .setCircularRegion(lat, lng, radius)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
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
