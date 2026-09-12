package shuttlers.iisc.com;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
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
 * Strategy: override checkPermissions() so we never call the super implementation
 * when the Activity is null. Instead we check the POST_NOTIFICATIONS permission
 * directly via PackageManager and return the appropriate state.
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
        Activity activity = getActivity();
        if (activity == null) {
            // Can't show a permission dialog without an Activity.
            call.resolve(buildPermissionResult());
            return;
        }
        try {
            super.requestPermissions(call);
        } catch (Exception e) {
            call.resolve(buildPermissionResult());
        }
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
