package shuttlers.iisc.com;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class LiveScoreWidget extends AppWidgetProvider {

    // Default static states
    public static String title = "IISc Badminton";
    public static String team1 = "T1";
    public static String score1 = "0";
    public static String team2 = "T2";
    public static String score2 = "0";
    public static String upcoming = "No upcoming matches.";

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_live_score);

        views.setTextViewText(R.id.widget_title, title);
        views.setTextViewText(R.id.widget_team1, team1);
        views.setTextViewText(R.id.widget_score1, score1);
        views.setTextViewText(R.id.widget_team2, team2);
        views.setTextViewText(R.id.widget_score2, score2);
        views.setTextViewText(R.id.widget_upcoming, upcoming);

        // Click on widget to open app
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_title, pendingIntent);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }
}
