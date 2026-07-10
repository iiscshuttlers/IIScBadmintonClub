package shuttlers.iisc.com;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class UmpireBackgroundService extends Service {
    public static final String CHANNEL_ID = "umpire_service_channel";
    public static final int NOTIFICATION_ID = 101;
    public static UmpireBackgroundService instance;

    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification("00 - 00", "Match Active"), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification("00 - 00", "Match Active"));
            }
        } catch (Exception e) {
            // Some ROMs or Android versions may reject foreground service; don't crash
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Live Match Umpire",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the app alive while umpiring and shows the live score.");
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public void updateScore(String score, String teams) {
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, buildNotification(score, teams));
        }
    }

    private Notification buildNotification(String score, String teams) {
        Intent t1Intent = new Intent(this, NotificationActionReceiver.class);
        t1Intent.setAction("shuttlers.iisc.com.ACTION_ADD_POINT");
        t1Intent.putExtra("team", 1);
        PendingIntent p1Intent = PendingIntent.getBroadcast(this, 1, t1Intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent t2Intent = new Intent(this, NotificationActionReceiver.class);
        t2Intent.setAction("shuttlers.iisc.com.ACTION_ADD_POINT");
        t2Intent.putExtra("team", 2);
        PendingIntent p2Intent = PendingIntent.getBroadcast(this, 2, t2Intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // AuthenticationRequired forces unlock if the screen is locked
        NotificationCompat.Action action1 = new NotificationCompat.Action.Builder(
                0, "+1 T1", p1Intent
        ).setAuthenticationRequired(true).build();

        NotificationCompat.Action action2 = new NotificationCompat.Action.Builder(
                0, "+1 T2", p2Intent
        ).setAuthenticationRequired(true).build();

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pLaunchIntent = PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(teams)
                .setContentText(score)
                // Use a default android icon since we don't know the exact mipmap names
                .setSmallIcon(android.R.drawable.ic_menu_compass) 
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pLaunchIntent)
                .addAction(action1)
                .addAction(action2)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }
}
