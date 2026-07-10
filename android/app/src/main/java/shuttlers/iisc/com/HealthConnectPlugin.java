package shuttlers.iisc.com;

import android.app.Activity;
import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.Instant;

@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {

    @Override
    public void load() {
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true); // Mocked availability for MVP
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // Just return true for the mock MVP
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getHeartRateForTimeRange(PluginCall call) {
        String startStr = call.getString("startTime");
        String endStr = call.getString("endTime");
        
        if (startStr == null || endStr == null) {
            call.reject("startTime and endTime are required");
            return;
        }

        Instant startTime = Instant.parse(startStr);
        Instant endTime = Instant.parse(endStr);
        
        JSObject ret = new JSObject();
        JSArray samples = new JSArray();
        
        // Simulating some HR data
        int simulatedPoints = 15;
        long durationMs = endTime.toEpochMilli() - startTime.toEpochMilli();
        long step = durationMs / Math.max(1, simulatedPoints);
        for (int i=0; i<simulatedPoints; i++) {
            JSObject sample = new JSObject();
            sample.put("time", Instant.ofEpochMilli(startTime.toEpochMilli() + (step * i)).toString());
            sample.put("bpm", 120 + (Math.random() * 40));
            samples.put(sample);
        }
        
        ret.put("samples", samples);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStepsForTimeRange(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("steps", (int)(500 + Math.random() * 1000));
        call.resolve(ret);
    }

    @PluginMethod
    public void getCaloriesForTimeRange(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("calories", (int)(150 + Math.random() * 200));
        call.resolve(ret);
    }
}
