package shuttlers.iisc.com;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

public class GeofenceReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "geofence_channel";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null || geofencingEvent.hasError()) {
            return;
        }

        int transition = geofencingEvent.getGeofenceTransition();
        if (transition == Geofence.GEOFENCE_TRANSITION_ENTER) {
            sendNotification(context, "Welcome to Gymkhana!", "Tap to see today's matches.");
        }
    }

    private void sendNotification(Context context, String title, String message) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Location Notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            nm.createNotificationChannel(channel);
        }

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent pLaunchIntent = PendingIntent.getActivity(context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(title)
                .setContentText(message)
                .setContentIntent(pLaunchIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        if (nm != null) {
            nm.notify(1001, builder.build());
        }
    }
}
