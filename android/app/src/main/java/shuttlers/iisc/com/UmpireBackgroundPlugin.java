package shuttlers.iisc.com;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UmpireBackground")
public class UmpireBackgroundPlugin extends Plugin {
    public static UmpireBackgroundPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, UmpireBackgroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, UmpireBackgroundService.class);
        context.stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void updateScore(PluginCall call) {
        String score = call.getString("score", "00 - 00");
        String teams = call.getString("teams", "Match Active");
        
        if (UmpireBackgroundService.instance != null) {
            UmpireBackgroundService.instance.updateScore(score, teams);
        }
        call.resolve();
    }

    public void emitAction(int team) {
        JSObject ret = new JSObject();
        ret.put("team", team);
        notifyListeners("umpireAction", ret);
    }
}
