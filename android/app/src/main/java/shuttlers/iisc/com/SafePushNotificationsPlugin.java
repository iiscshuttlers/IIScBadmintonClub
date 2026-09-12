package shuttlers.iisc.com;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

/**
 * Wraps {@link PushNotificationsPlugin} to guard against the NPE in
 * {@code Plugin.getPermissionStates()} on Android 16 (and some Android 13+ ROMs)
 * where {@code getActivity()} can return null when the bridge dispatches the
 * checkPermissions call before the Activity has fully attached.
 *
 * Sentry issue: JAVASCRIPT-REACT-3
 * Root cause:   com.getcapacitor.c0.getPermissionStates → getActivity() == null
 *
 * Strategy:
 * - checkPermissions(): If Activity is null, return current PackageManager state.
 * - requestPermissions(): If Activity is null, wait up to 5s for it to attach,
 *   then delegate to super. This prevents the dialog from being silently swallowed
 *   when the JS layer calls requestPermissions immediately after app start.
 *
 * IMPORTANT: @CapacitorPlugin is NOT inherited in Java. We must re-declare it here
 * with the exact same name and permissions so the Capacitor bridge routes
 * JS calls for "PushNotifications" to this safe subclass.
 */
@CapacitorPlugin(
    name = "PushNotifications",
    permissions = @Permission(
        strings = { Manifest.permission.POST_NOTIFICATIONS },
        alias = "receive"
    )
)
public class SafePushNotificationsPlugin extends PushNotificationsPlugin {

    private static final int MAX_WAIT_MS = 5000;
    private static final int RETRY_INTERVAL_MS = 200;

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            // Activity not yet attached — derive permission state without calling
            // getPermissionStates() which would NPE inside Capacitor's Plugin base class.
            call.resolve(buildPermissionResult());
            return;
        }
        // Activity is ready — delegate to the real implementation.
        try {
            super.checkPermissions(call);
        } catch (Exception e) {
            // Last-resort fallback: if the super still NPEs somehow, resolve gracefully.
            call.resolve(buildPermissionResult());
        }
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // Save the call so it survives across Handler posts (Capacitor may GC it otherwise)
        call.save();
        waitForActivityAndRequest(call, 0);
    }

    /**
     * Polls for the Activity to become non-null, then delegates requestPermissions to super.
     * If the Activity is never available within MAX_WAIT_MS, falls back to resolving
     * with the PackageManager state (better than hanging the call forever).
     */
    private void waitForActivityAndRequest(final PluginCall call, final int elapsedMs) {
        Activity activity = getActivity();
        if (activity != null) {
            // Activity is ready — show the real permission dialog.
            try {
                super.requestPermissions(call);
            } catch (Exception e) {
                // Still failed somehow — resolve gracefully so JS isn't stuck.
                call.resolve(buildPermissionResult());
            }
            return;
        }

        if (elapsedMs >= MAX_WAIT_MS) {
            // Gave up waiting. Resolve with the current state so JS isn't hung.
            android.util.Log.w("SafePushPlugin",
                "requestPermissions: Activity never attached after " + MAX_WAIT_MS + "ms. " +
                "Resolving with PackageManager state (no dialog shown).");
            call.resolve(buildPermissionResult());
            return;
        }

        // Activity is still null — retry after RETRY_INTERVAL_MS
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            waitForActivityAndRequest(call, elapsedMs + RETRY_INTERVAL_MS);
        }, RETRY_INTERVAL_MS);
    }

    /**
     * Builds a JSObject with the push "receive" permission state derived
     * directly from PackageManager — no Capacitor Activity required.
     */
    private JSObject buildPermissionResult() {
        String state;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ requires POST_NOTIFICATIONS runtime permission
            int result = ContextCompat.checkSelfPermission(
                    getContext(), Manifest.permission.POST_NOTIFICATIONS);
            state = (result == PackageManager.PERMISSION_GRANTED) ? "granted" : "prompt";
        } else {
            // Below Android 13 push notifications don't need a runtime permission
            state = "granted";
        }
        JSObject ret = new JSObject();
        ret.put("receive", state);
        return ret;
    }
}
