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
    private Sensor gyroscopeSensor;
    private boolean isListening = false;
    private boolean hasGyro = false;
    
    // Fallback variables
    private float lastAccelMagnitude = 0;
    private float lastGyroMagnitude = 0;
    
    // Store latest values
    private float lastGyroX = 0, lastGyroY = 0, lastGyroZ = 0;
    private float lastAccelX = 0, lastAccelY = 0, lastAccelZ = 0;

    @Override
    public void load() {
        super.load();
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            linearAccelerationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
            gyroscopeSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
            hasGyro = (gyroscopeSensor != null);
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
            if (hasGyro) {
                sensorManager.registerListener(this, gyroscopeSensor, SensorManager.SENSOR_DELAY_GAME);
            }
            isListening = true;
        }
        
        JSObject ret = new JSObject();
        ret.put("hasGyro", hasGyro);
        call.resolve(ret);
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
            lastAccelX = event.values[0];
            lastAccelY = event.values[1];
            lastAccelZ = event.values[2];
            processMotion();
        } else if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE) {
            lastGyroX = event.values[0];
            lastGyroY = event.values[1];
            lastGyroZ = event.values[2];
            // Don't call processMotion here to avoid duplicate events, process on accel
        }
    }

    private void processMotion() {
        // Calculate scalar magnitude of acceleration
        double accelMagnitude = Math.sqrt(lastAccelX * lastAccelX + lastAccelY * lastAccelY + lastAccelZ * lastAccelZ);
        double gyroMagnitude = Math.sqrt(lastGyroX * lastGyroX + lastGyroY * lastGyroY + lastGyroZ * lastGyroZ);
        
        // Determine movement intensity
        String intensity = "idle";
        if (accelMagnitude > 15.0) {
            intensity = "smash_sprint";
        } else if (accelMagnitude > 7.0) {
            intensity = "running";
        } else if (accelMagnitude > 2.0) {
            intensity = "walking";
        }

        // Determine Swing Type
        boolean swingDetected = false;
        String swingType = null;
        
        if (hasGyro) {
            if (gyroMagnitude > 12 && accelMagnitude > 18 && Math.abs(lastGyroZ) > 8) {
                swingDetected = true;
                swingType = "smash";
            } else if (gyroMagnitude > 8 && accelMagnitude > 12) {
                swingDetected = true;
                swingType = "clear";
            } else if (gyroMagnitude > 5 && accelMagnitude > 8) {
                swingDetected = true;
                swingType = "drive";
            } else if (gyroMagnitude > 2 && accelMagnitude > 3 && accelMagnitude < 8) {
                // Subtle net shot
                swingDetected = true;
                swingType = "net_shot";
            }
        } else {
            // Fallback swing detection using just accelerometer spikes
            if (accelMagnitude > 20) {
                swingDetected = true;
                swingType = "smash";
            } else if (accelMagnitude > 15) {
                swingDetected = true;
                swingType = "clear";
            }
        }

        JSObject ret = new JSObject();
        ret.put("x", lastAccelX);
        ret.put("y", lastAccelY);
        ret.put("z", lastAccelZ);
        ret.put("magnitude", accelMagnitude);
        ret.put("intensity", intensity);
        
        ret.put("hasGyro", hasGyro);
        if (hasGyro) {
            ret.put("gyroX", lastGyroX);
            ret.put("gyroY", lastGyroY);
            ret.put("gyroZ", lastGyroZ);
            ret.put("rotationRate", gyroMagnitude);
        }
        
        ret.put("swingDetected", swingDetected);
        if (swingDetected) {
            ret.put("swingType", swingType);
        }
        
        notifyListeners("onMotionUpdate", ret);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Ignored
    }
}
