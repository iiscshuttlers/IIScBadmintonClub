package shuttlers.iisc.com;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

public class GeofenceWorker extends Worker {
    private static final String TAG = "GeofenceWorker";

    public GeofenceWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        String eventType = getInputData().getString("event_type");
        if (eventType == null) return Result.failure();

        SharedPreferences prefs = GeofencePlugin.getAuthPrefs(getApplicationContext());
        if (prefs == null) return Result.failure();

        String playerId = prefs.getString(GeofencePlugin.KEY_PLAYER_ID, null);
        String accessToken = prefs.getString(GeofencePlugin.KEY_ACCESS_TOKEN, null);
        String supabaseUrl = prefs.getString(GeofencePlugin.KEY_SUPABASE_URL, null);
        String anonKey = prefs.getString(GeofencePlugin.KEY_SUPABASE_ANON_KEY, null);

        if (playerId == null || accessToken == null || supabaseUrl == null || anonKey == null) {
            return Result.failure();
        }

        try {
            int code = sendInsert(supabaseUrl, anonKey, accessToken, playerId, eventType);
            if (code == 401) {
                // Token expired. Refresh and retry.
                Log.d(TAG, "Access token expired. Refreshing...");
                if (refreshSupabaseToken(prefs)) {
                    String newAccessToken = prefs.getString(GeofencePlugin.KEY_ACCESS_TOKEN, null);
                    if (newAccessToken != null) {
                        int retryCode = sendInsert(supabaseUrl, anonKey, newAccessToken, playerId, eventType);
                        if (retryCode >= 200 && retryCode < 300) {
                            return Result.success();
                        }
                    }
                }
                // If refresh failed or retry failed, use backoff policy
                return Result.retry();
            } else if (code >= 200 && code < 300) {
                return Result.success();
            } else if (code == 403) {
                // RLS or Authorization failure, do not retry
                return Result.failure();
            } else {
                return Result.retry();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to post venue presence event via Worker", e);
            return Result.retry();
        }
    }

    private boolean refreshSupabaseToken(SharedPreferences prefs) {
        String supabaseUrl = prefs.getString(GeofencePlugin.KEY_SUPABASE_URL, null);
        String anonKey = prefs.getString(GeofencePlugin.KEY_SUPABASE_ANON_KEY, null);
        String refreshToken = prefs.getString(GeofencePlugin.KEY_REFRESH_TOKEN, null);

        if (supabaseUrl == null || anonKey == null || refreshToken == null) return false;

        HttpURLConnection conn = null;
        try {
            URL url = new URL(supabaseUrl + "/auth/v1/token?grant_type=refresh_token");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("apikey", anonKey);
            conn.setRequestProperty("Content-Type", "application/json");

            String json = "{\"refresh_token\":\"" + refreshToken + "\"}";
            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                try (Scanner s = new Scanner(conn.getInputStream(), "UTF-8").useDelimiter("\\A")) {
                    String response = s.hasNext() ? s.next() : "";
                    JSONObject obj = new JSONObject(response);
                    String newAccess = obj.getString("access_token");
                    String newRefresh = obj.getString("refresh_token");

                    prefs.edit()
                            .putString(GeofencePlugin.KEY_ACCESS_TOKEN, newAccess)
                            .putString(GeofencePlugin.KEY_REFRESH_TOKEN, newRefresh)
                            .apply();
                    Log.d(TAG, "Successfully refreshed Supabase JWT in background");
                    return true;
                }
            } else {
                Log.w(TAG, "Failed to refresh token, status: " + conn.getResponseCode());
            }
        } catch (Exception e) {
            Log.w(TAG, "Exception during token refresh", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return false;
    }

    private int sendInsert(String supabaseUrl, String anonKey, String accessToken, String playerId, String eventType) throws Exception {
        URL url = new URL(supabaseUrl + "/rest/v1/venue_presence_events");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("apikey", anonKey);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "return=minimal");

            String json = "{\"player_id\":\"" + playerId + "\",\"event_type\":\"" + eventType + "\"}";
            try (OutputStream os = conn.getOutputStream()) {
                os.write(json.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, "Venue presence insert failed with status " + code);
            }
            return code;
        } finally {
            conn.disconnect();
        }
    }
}
