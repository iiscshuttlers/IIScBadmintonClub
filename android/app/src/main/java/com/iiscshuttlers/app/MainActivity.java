package com.iiscshuttlers.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    createNotificationChannels();
  }

  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager manager = getSystemService(NotificationManager.class);

      // Friendly matches
      NotificationChannel friendly = new NotificationChannel(
        "notify_friendly", "Friendly matches", NotificationManager.IMPORTANCE_HIGH);
      friendly.setDescription("Alerts for friendly match requests");
      manager.createNotificationChannel(friendly);

      // Tournament matches
      NotificationChannel tournament = new NotificationChannel(
        "notify_tournament", "Tournament matches", NotificationManager.IMPORTANCE_HIGH);
      tournament.setDescription("Updates for tournament matches");
      manager.createNotificationChannel(tournament);

      // Challenge invites
      NotificationChannel challenges = new NotificationChannel(
        "notify_challenges", "Challenge invites", NotificationManager.IMPORTANCE_HIGH);
      challenges.setDescription("Alerts for new challenges");
      manager.createNotificationChannel(challenges);

      // Match confirmations
      NotificationChannel confirmation = new NotificationChannel(
        "notify_confirmation", "Match confirmations", NotificationManager.IMPORTANCE_HIGH);
      confirmation.setDescription("Updates when matches are confirmed");
      manager.createNotificationChannel(confirmation);

      // Announcements
      NotificationChannel announcements = new NotificationChannel(
        "notify_announcements", "Announcements", NotificationManager.IMPORTANCE_DEFAULT);
      announcements.setDescription("Important club announcements");
      manager.createNotificationChannel(announcements);

      // Find & Lost
      NotificationChannel findLost = new NotificationChannel(
        "notify_find_lost", "Find & Lost posts", NotificationManager.IMPORTANCE_DEFAULT);
      findLost.setDescription("Updates on lost and found items");
      manager.createNotificationChannel(findLost);

      // ELO milestones
      NotificationChannel eloMilestone = new NotificationChannel(
        "notify_elo_milestone", "ELO milestones", NotificationManager.IMPORTANCE_DEFAULT);
      eloMilestone.setDescription("Alerts for reaching new ELO milestones");
      manager.createNotificationChannel(eloMilestone);

      // Weekly digest
      NotificationChannel weekly = new NotificationChannel(
        "notify_weekly_digest", "Weekly digest", NotificationManager.IMPORTANCE_LOW);
      weekly.setDescription("Weekly platform activity summary");
      manager.createNotificationChannel(weekly);
    }
  }
}
