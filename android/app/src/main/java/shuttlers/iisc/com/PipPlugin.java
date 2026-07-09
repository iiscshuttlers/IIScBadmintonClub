package shuttlers.iisc.com;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.util.Rational;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Pip")
public class PipPlugin extends Plugin {

    @PluginMethod
    public void enterPipMode(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            int width = call.getInt("width", 16);
            int height = call.getInt("height", 9);
            
            PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder();
            pipBuilder.setAspectRatio(new Rational(width, height));
            
            boolean success = getActivity().enterPictureInPictureMode(pipBuilder.build());
            if (success) {
                call.resolve();
            } else {
                call.reject("Failed to enter PiP mode.");
            }
        } else {
            call.reject("PiP is not supported on this Android version.");
        }
    }
}
