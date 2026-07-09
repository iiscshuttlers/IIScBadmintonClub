package shuttlers.iisc.com;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(FloatingScorePlugin.class);
    super.onCreate(savedInstanceState);
    createNotificationChannels();
  }

  private Uri soundUri(String filename) {
    return Uri.parse("android.resource://" + getPackageName() + "/raw/" + filename);
  }

  private AudioAttributes audioAttrs() {
    return new AudioAttributes.Builder()
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .build();
  }

  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationManager mgr = getSystemService(NotificationManager.class);
    AudioAttributes attrs = audioAttrs();

    // Smash sound — match logged by opponent
    NotificationChannel smash = new NotificationChannel(
      "notify_smash", "Match notifications", NotificationManager.IMPORTANCE_HIGH);
    smash.setDescription("New matches logged against you");
    smash.setSound(soundUri("smash"), attrs);
    mgr.createNotificationChannel(smash);

    // Point sound — match confirmed
    NotificationChannel point = new NotificationChannel(
      "notify_point", "Match confirmations", NotificationManager.IMPORTANCE_HIGH);
    point.setDescription("When your match result is confirmed");
    point.setSound(soundUri("point"), attrs);
    mgr.createNotificationChannel(point);

    // Serve sound — match request / ping
    NotificationChannel serve = new NotificationChannel(
      "notify_serve", "Match requests", NotificationManager.IMPORTANCE_HIGH);
    serve.setDescription("Pings and match requests from other players");
    serve.setSound(soundUri("serve"), attrs);
    mgr.createNotificationChannel(serve);

    // Whistle sound — announcements, live matches, admin push
    NotificationChannel whistle = new NotificationChannel(
      "notify_whistle", "Announcements", NotificationManager.IMPORTANCE_DEFAULT);
    whistle.setDescription("Club announcements and live match alerts");
    whistle.setSound(soundUri("whistle"), attrs);
    mgr.createNotificationChannel(whistle);

    // Victory sound — top-10, buddy accepted, ELO milestone
    NotificationChannel victory = new NotificationChannel(
      "notify_victory", "Achievements", NotificationManager.IMPORTANCE_DEFAULT);
    victory.setDescription("ELO milestones, top-10, buddy requests");
    victory.setSound(soundUri("victory"), attrs);
    mgr.createNotificationChannel(victory);

    // Weekly digest — silent (low importance, no sound)
    NotificationChannel weekly = new NotificationChannel(
      "notify_weekly", "Weekly digest", NotificationManager.IMPORTANCE_LOW);
    weekly.setDescription("Weekly platform activity summary");
    mgr.createNotificationChannel(weekly);

    // Find & Lost — whistle
    NotificationChannel findLost = new NotificationChannel(
      "notify_find_lost", "Find & Lost posts", NotificationManager.IMPORTANCE_DEFAULT);
    findLost.setDescription("Updates on lost and found items");
    findLost.setSound(soundUri("whistle"), attrs);
    mgr.createNotificationChannel(findLost);
  }
}
