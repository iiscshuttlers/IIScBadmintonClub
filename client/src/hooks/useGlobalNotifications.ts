import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { showWebNotification } from "./usePushNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { playWhistleSound, playVictorySound, playServeSound } from "@/lib/sounds";
import { toast } from "sonner";

export function useGlobalNotifications() {
  const lastAnnouncementRef = useRef<string | null>(null);
  const knownMatchesRef = useRef<Set<string>>(new Set());
  const lastAdminPushRef = useRef<number | null>(null);
  const { profile } = useAuth();
  
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const channel = supabase.channel("global-notifications");

    // 1. Postgres Changes (Broadcasts)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "site_data",
      },
      async (payload) => {
        const row = payload.new as any;
        if (!row) return;

        if (row.key === "announcements") {
          try {
            const data = row.value;
            if (data && data.recent && data.recent.length > 0) {
              const latest = data.recent[0];
              if (latest.title && latest.title !== lastAnnouncementRef.current) {
                lastAnnouncementRef.current = latest.title;
                playWhistleSound();
                if (Capacitor.isNativePlatform()) {
                  try {
                    const permStatus = await LocalNotifications.checkPermissions();
                    if (permStatus.display === "prompt") {
                      await LocalNotifications.requestPermissions();
                    }
                    if (permStatus.display === "granted" || permStatus.display === "prompt") {
                      await LocalNotifications.schedule({
                        notifications: [
                          {
                            title: "📢 Club Update!",
                            body: latest.title,
                            id: Math.floor(Math.random() * 1000000),
                            schedule: { at: new Date(Date.now() + 100) },
                            channelId: "notify_whistle",
                            extra: { type: "announcement" },
                          },
                        ],
                      });
                    }
                  } catch (e) {
                    console.warn("Failed to schedule local notification", e);
                  }
                } else {
                  showWebNotification("📢 Club Update!", latest.title, () => {
                    window.location.href = `${import.meta.env.BASE_URL || "/"}announcements`;
                  });
                }
              }
            }
          } catch (e) {
             console.error("Failed to parse announcement data", e);
          }
        } else if (row.key === "live_matches") {
          try {
            const liveMatches = row.value || {};
            Object.values(liveMatches).forEach((match: any) => {
              if (match.status === "playing" && !knownMatchesRef.current.has(match.id)) {
                knownMatchesRef.current.add(match.id);
                playWhistleSound();
                
                const notifyFriendly = localStorage.getItem("iisc_notify_friendly_matches") !== "false";
                const notifyTourney = localStorage.getItem("iisc_notify_tournament_matches") !== "false";
                
                if (match.isFriendly && !notifyFriendly) return;
                if (!match.isFriendly && !notifyTourney) return;

                if (match.isFriendly) {
                  const currentProfile = profileRef.current;
                  if (!currentProfile) return;
                  const participants = [match.t1?.p1Id, match.t1?.p2Id, match.t2?.p1Id, match.t2?.p2Id].filter(Boolean);
                  if (participants.includes(currentProfile.id)) return;
                  const buddies = currentProfile.buddies || [];
                  const following = currentProfile.following || [];
                  const isConnected = participants.some(pid => buddies.includes(pid) || following.includes(pid));
                  if (!isConnected) return;
                }

                const title = match.isFriendly ? "🏸 Live Friendly Match!" : "🏆 Live Tournament Match!";
                const body = `${match.t1?.p1Name} vs ${match.t2?.p1Name} is now live!`;

                if (Capacitor.isNativePlatform()) {
                  LocalNotifications.schedule({
                    notifications: [{
                      title,
                      body,
                      id: Math.floor(Math.random() * 1000000),
                      schedule: { at: new Date(Date.now() + 100) },
                      channelId: "notify_whistle",
                    }]
                  }).catch(console.warn);
                } else {
                  showWebNotification(title, body, () => {
                    window.location.href = `${import.meta.env.BASE_URL || "/"}feed`;
                  });
                }
              }
            });
          } catch (e) {
            console.error("Failed to parse live matches for notifications", e);
          }
        } else if (row.key === "latest_buddy_acceptance") {
          try {
            const data = row.value;
            const currentProfile = profileRef.current;
            if (data && currentProfile && data.senderId === currentProfile.id) {
              playVictorySound();
              const title = "🤝 Buddy Request Accepted!";
              const body = `${data.accepterName} accepted your buddy request!`;
              
              if (Capacitor.isNativePlatform()) {
                LocalNotifications.schedule({
                  notifications: [{
                    title,
                    body,
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 100) },
                    channelId: "notify_victory",
                    extra: { type: "buddy_acceptance" }
                  }]
                }).catch(console.warn);
              } else {
                showWebNotification(title, body, () => {
                  window.location.href = `${import.meta.env.BASE_URL || "/"}player/${data.accepterId}`;
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse buddy notification", e);
          }
        } else if (row.key === "admin_push") {
          try {
            const data = row.value;
            if (data && data.title && data.timestamp && data.timestamp !== lastAdminPushRef.current) {
              lastAdminPushRef.current = data.timestamp;
              playWhistleSound();
              
              if (Capacitor.isNativePlatform()) {
                LocalNotifications.schedule({
                  notifications: [{
                    title: data.title,
                    body: data.body || "",
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 100) },
                    channelId: "notify_whistle",
                  }]
                }).catch(console.warn);
              } else {
                showWebNotification(data.title, data.body || "", () => {
                  if (data.url) window.location.href = data.url;
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse admin push", e);
          }
        } else if (row.key === "match_alert") {
          try {
            const data = row.value;
            if (data && data.message && data.time && data.time !== lastAdminPushRef.current) {
              if (data.time !== lastAdminPushRef.current) {
                lastAdminPushRef.current = data.time;
                playWhistleSound();
                const matchTitle = data.title || "🏆 Live Match Update";
                toast.success(matchTitle, { 
                  description: data.message,
                  action: {
                    label: "View",
                    onClick: () => window.location.href = `${import.meta.env.BASE_URL || "/"}pulse`
                  },
                  className: "bg-background border-primary text-foreground shadow-lg dark:bg-slate-800 dark:border-sky-500 dark:text-sky-50",
                });
                
                if (Capacitor.isNativePlatform()) {
                  LocalNotifications.schedule({
                    notifications: [{
                      title: matchTitle,
                      body: data.message,
                      id: Math.floor(Math.random() * 1000000),
                      schedule: { at: new Date(Date.now() + 100) },
                      channelId: "notify_whistle",
                    }]
                  }).catch(console.warn);
                } else {
                  showWebNotification(matchTitle, data.message, () => {
                    window.location.href = `${import.meta.env.BASE_URL || "/"}pulse`;
                  });
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse match alert push", e);
          }
        }
      }
    );

    // 2. Realtime Broadcasts (Pings)
    if (profile?.id) {
      channel.on(
        "broadcast",
        { event: "ping" },
        async (payload) => {
          if (payload.payload?.target_id === profile.id) {
            const senderName = payload.payload.sender_name || "A player";
            const message = `${senderName} is looking to play a match with you!`;
            playServeSound();

            if (Capacitor.isNativePlatform()) {
              try {
                const permStatus = await LocalNotifications.checkPermissions();
                if (permStatus.display === "prompt") {
                  await LocalNotifications.requestPermissions();
                }
                if (permStatus.display === "granted" || permStatus.display === "prompt") {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        title: "🏸 Match Request!",
                        body: message,
                        id: Math.floor(Math.random() * 1000000),
                        schedule: { at: new Date(Date.now() + 100) },
                        channelId: "notify_serve",
                        extra: { type: "ping" },
                      },
                    ],
                  });
                }
              } catch (e) {
                console.warn("Failed to schedule local notification", e);
              }
            } else {
              showWebNotification("🏸 Match Request!", message, () => {
                window.location.href = `${import.meta.env.BASE_URL || "/"}players`;
              });
            }
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);
}
