import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const NOTIFICATION_IDS = [9991, 9992, 9993, 9994];

export function useEngagementReminders() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupReminders = async () => {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== "granted") {
            // We won't aggressively prompt for engagement notifications 
            // if they haven't granted it yet, to avoid annoying them early on.
            return; 
        }

        const pending = await LocalNotifications.getPending();
        const hasReminders = pending.notifications.some(n => NOTIFICATION_IDS.includes(n.id));

        if (!hasReminders) {
          // Schedule 4 reminders spaced roughly 6 hours apart
          await LocalNotifications.schedule({
            notifications: [
              {
                title: "Time for Badminton! 🏸",
                body: "See what's happening at the courts! Check today's live scores and player pulses.",
                id: NOTIFICATION_IDS[0],
                schedule: { on: { hour: 9, minute: 0 }, repeats: true }, // 9 AM
                channelId: "notify_whistle",
              },
              {
                title: "Afternoon Check-in ☀️",
                body: "Are you playing today? Log your matches or see who is at the Gymkhana.",
                id: NOTIFICATION_IDS[1],
                schedule: { on: { hour: 15, minute: 0 }, repeats: true }, // 3 PM
                channelId: "notify_whistle",
              },
              {
                title: "Evening Action 🌙",
                body: "The courts are heating up! Check the leaderboard to see who's dominating tonight.",
                id: NOTIFICATION_IDS[2],
                schedule: { on: { hour: 21, minute: 0 }, repeats: true }, // 9 PM
                channelId: "notify_whistle",
              },
            ]
          });
        }
      } catch (error) {
        console.error("Failed to setup engagement reminders:", error);
      }
    };

    setupReminders();
  }, []);
}
