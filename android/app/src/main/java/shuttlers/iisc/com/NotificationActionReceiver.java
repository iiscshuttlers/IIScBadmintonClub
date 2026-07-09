package shuttlers.iisc.com;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if ("shuttlers.iisc.com.ACTION_ADD_POINT".equals(intent.getAction())) {
            int team = intent.getIntExtra("team", 0);
            if (team > 0 && UmpireBackgroundPlugin.instance != null) {
                UmpireBackgroundPlugin.instance.emitAction(team);
            }
        }
    }
}
