package shuttlers.iisc.com;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetManager")
public class WidgetManagerPlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String title = call.getString("title", "IISc Badminton");
        String team1 = call.getString("team1", "");
        String score1 = call.getString("score1", "");
        String team2 = call.getString("team2", "");
        String score2 = call.getString("score2", "");
        String upcoming = call.getString("upcoming", "");

        LiveScoreWidget.title = title;
        LiveScoreWidget.team1 = team1;
        LiveScoreWidget.score1 = score1;
        LiveScoreWidget.team2 = team2;
        LiveScoreWidget.score2 = score2;
        LiveScoreWidget.upcoming = upcoming;

        Context context = getContext();
        Intent intent = new Intent(context, LiveScoreWidget.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        
        int[] ids = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(new ComponentName(context, LiveScoreWidget.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);

        call.resolve();
    }
}
