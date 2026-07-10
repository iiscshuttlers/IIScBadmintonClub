package shuttlers.iisc.com;

import android.app.AppOpsManager;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Rational;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Pip")
public class PipPlugin extends Plugin {

    @PluginMethod
    public void enterPipMode(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            
            AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
            if (appOps != null) {
                int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_PICTURE_IN_PICTURE, android.os.Process.myUid(), getContext().getPackageName());
                if (mode != AppOpsManager.MODE_ALLOWED) {
                    try {
                        Intent intent = new Intent("android.settings.PICTURE_IN_PICTURE_SETTINGS", Uri.parse("package:" + getContext().getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        call.reject("Permission denied. Opened settings.");
                    } catch (Exception e) {
                        call.reject("Permission denied. Could not open settings.");
                    }
                    return;
                }
            }

            int width = call.getInt("width", 16);
            int height = call.getInt("height", 9);
            
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder();
            pipBuilder.setAspectRatio(new Rational(width, height));
            
            try {
                boolean success = getActivity().enterPictureInPictureMode(pipBuilder.build());
                if (success) {
                    call.resolve();
                } else {
                    call.reject("Failed to enter PiP mode.");
                }
            } catch (Exception e) {
                call.reject("Error entering PiP mode: " + e.getMessage());
            }
        } else {
            call.reject("PiP is not supported on this Android version.");
        }
    }

    // Called from MainActivity#onPictureInPictureModeChanged so JS can hide app
    // chrome and show only the video while the Activity is shrunk into PiP.
    public void notifyPipModeChanged(boolean isInPipMode) {
        JSObject ret = new JSObject();
        ret.put("isInPipMode", isInPipMode);
        notifyListeners("pipModeChanged", ret);
    }
}
