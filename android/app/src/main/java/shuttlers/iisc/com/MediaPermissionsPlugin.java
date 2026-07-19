package shuttlers.iisc.com;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MediaPermissions",
    permissions = {
        @Permission(strings = {Manifest.permission.READ_MEDIA_VIDEO}, alias = "video"),
        @Permission(strings = {Manifest.permission.READ_EXTERNAL_STORAGE}, alias = "storage")
    }
)
public class MediaPermissionsPlugin extends Plugin {

    @PluginMethod
    public void requestVideoPermission(PluginCall call) {
        String alias = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ? "video" : "storage";

        if (getPermissionState(alias) == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias(alias, call, "permissionCallback");
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        String alias = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ? "video" : "storage";
        boolean granted = getPermissionState(alias) == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }
}
