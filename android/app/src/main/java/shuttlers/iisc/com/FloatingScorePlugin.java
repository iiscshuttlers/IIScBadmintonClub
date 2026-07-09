package shuttlers.iisc.com;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatingScore")
public class FloatingScorePlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ret.put("granted", Settings.canDrawOverlays(getContext()));
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                
                JSObject ret = new JSObject();
                ret.put("granted", false);
                call.resolve(ret);
            } else {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("Permission not granted for SYSTEM_ALERT_WINDOW");
            return;
        }
        Intent intent = new Intent(getContext(), FloatingScoreService.class);
        getContext().startService(intent);
        
        String score = call.getString("score", "00 - 00");
        
        // Use a small delay to ensure service has time to start and bind its instance
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (FloatingScoreService.instance != null) {
                FloatingScoreService.instance.updateScore(score);
            }
        }, 500);

        call.resolve();
    }

    @PluginMethod
    public void updateScore(PluginCall call) {
        String score = call.getString("score", "00 - 00");
        if (FloatingScoreService.instance != null) {
            getActivity().runOnUiThread(() -> {
                if (FloatingScoreService.instance != null) {
                    FloatingScoreService.instance.updateScore(score);
                }
            });
            call.resolve();
        } else {
            call.reject("Service not running");
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), FloatingScoreService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
