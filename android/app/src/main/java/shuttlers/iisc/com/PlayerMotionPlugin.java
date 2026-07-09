package shuttlers.iisc.com;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PlayerMotion")
public class PlayerMotionPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor linearAccelerationSensor;
    private boolean isListening = false;

    @Override
    public void load() {
        super.load();
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            linearAccelerationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
        }
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (linearAccelerationSensor == null) {
            call.reject("Linear acceleration sensor not available on this device.");
            return;
        }
        if (!isListening) {
            sensorManager.registerListener(this, linearAccelerationSensor, SensorManager.SENSOR_DELAY_GAME);
            isListening = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        if (isListening) {
            sensorManager.unregisterListener(this);
            isListening = false;
        }
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
            float x = event.values[0];
            float y = event.values[1];
            float z = event.values[2];
            
            // Calculate scalar magnitude of acceleration
            double magnitude = Math.sqrt(x*x + y*y + z*z);
            
            // Determine movement intensity
            String intensity = "idle";
            if (magnitude > 15.0) {
                intensity = "smash_sprint";
            } else if (magnitude > 7.0) {
                intensity = "running";
            } else if (magnitude > 2.0) {
                intensity = "walking";
            }

            JSObject ret = new JSObject();
            ret.put("x", x);
            ret.put("y", y);
            ret.put("z", z);
            ret.put("magnitude", magnitude);
            ret.put("intensity", intensity);
            
            notifyListeners("onMotionUpdate", ret);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Ignored
    }
}
