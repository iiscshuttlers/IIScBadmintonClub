import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { showWebNotification } from "./usePushNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { playSmashSound, playPointSound, playVictorySound } from "@/lib/sounds";

/**
 * Subscribes to realtime INSERT events on the `matches` table.
 * When a match involving the current user is created (by someone else),
 * triggers a blinking shuttle animation and plays a smash sound.
 */
export function useMatchNotification() {
  const { profile } = useAuth();
  const [notification, setNotification] = useState<{
    id: string;
    opponentName?: string;
  } | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel("match-alert-overlay")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        async (payload) => {
          const match = payload.new as any;
          if (!match) return;

          // Only alert if this match involves the current player
          const isInvolved =
            match.player1_id === profile.id ||
            match.player2_id === profile.id ||
            match.team1_partner_id === profile.id ||
            match.team2_partner_id === profile.id;

          if (!isInvolved) return;

          // Determine who the opponent is (the submitter)
          const challengerId = match.submitted_by;
          const isSubmitter = match.submitted_by === profile.id;
          const isUmpire = challengerId !== match.player1_id && challengerId !== match.player2_id && challengerId !== match.team1_partner_id && challengerId !== match.team2_partner_id;

          if (payload.eventType === "UPDATE") {
            const oldMatch = payload.old as any;
            if (oldMatch.status === "pending" && match.status === "confirmed" && !isSubmitter) {
              // Match confirmed
              if (Capacitor.isNativePlatform()) {
                try {
                  const permStatus = await LocalNotifications.checkPermissions();
                  if (permStatus.display === "prompt") await LocalNotifications.requestPermissions();
                  if (permStatus.display === "granted" || permStatus.display === "prompt") {
                    await LocalNotifications.schedule({
                      notifications: [{
                        title: "✅ Match Confirmed!",
                        body: "Your recent match has been confirmed. Check your new ELO!",
                        id: Math.floor(Math.random() * 1000000),
                        schedule: { at: new Date(Date.now() + 100) },
                        channelId: "notify_point",
                      }],
                    });
                  }
                } catch(e){}
              } else {
                showWebNotification("✅ Match Confirmed!", "Your recent match has been confirmed. Check your new ELO!", () => {});
              }
              playPointSound();
            }
            return;
          }

          if (payload.eventType !== "INSERT") return;

          // Deduplicate
          if (shownRef.current.has(match.id)) return;
          shownRef.current.add(match.id);



          // Fetch opponent name for the notification
          let opponentName = "Someone";
          if (challengerId && !isSubmitter) {
            const { data } = await supabase
              .from("players")
              .select("full_name")
              .eq("id", challengerId)
              .single();
            if (data) opponentName = data.full_name;
          }

          // Play smash sound (in-app)
          playSmashSound();

          // Fire browser notification ONLY for the receiver(s)
          if (!isSubmitter) {
            const alertName = opponentName || "Someone";
            const isFriendly = !!match.is_friendly;
            
            const notifTitle = isUmpire ? "📺 Match Logged by Umpire" : (isFriendly ? "🏸 Friendly Match Logged!" : "🏸 New Tournament Match!");
            const notifBody = isUmpire
              ? `Umpire ${alertName} logged your match. Tap to view.`
              : (isFriendly
                  ? `You've been challenged by ${alertName}! 🏸`
                  : `${alertName} logged a tournament match against you. Tap to confirm.`);

            if (Capacitor.isNativePlatform()) {
              try {
                // Check permissions first
                const permStatus = await LocalNotifications.checkPermissions();
                if (permStatus.display === "prompt") {
                  await LocalNotifications.requestPermissions();
                }
                if (
                  permStatus.display === "granted" ||
                  permStatus.display === "prompt"
                ) {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        title: notifTitle,
                        body: notifBody,
                        id: Math.floor(Math.random() * 1000000),
                        schedule: { at: new Date(Date.now() + 100) },
                        channelId: "notify_smash",
                        actionTypeId: "",
                        extra: { matchId: match.id },
                      },
                    ],
                  });
                }
              } catch (e) {
                console.warn("Failed to schedule local notification", e);
              }
            } else {
              showWebNotification(notifTitle, notifBody, () => {
                window.location.href = `${import.meta.env.BASE_URL || "/"}matches`;
              });
            }
          }

          // Show in-app overlay notification (for everyone involved)
          // For submitter, we just say "Match Logged!" instead of "Opponent logged"
          setNotification({
            id: match.id,
            opponentName: isSubmitter ? "Success! Match logged" : opponentName,
          });

          // Auto-dismiss after 2 seconds
          setTimeout(() => {
            setNotification(null);
          }, 2000);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `id=eq.${profile.id}`
        },
        async (payload) => {
          const oldPlayer = payload.old as any;
          const newPlayer = payload.new as any;
          
          if (newPlayer.elo_rating > oldPlayer.elo_rating) {
            // Check if entered top 10
            const { data } = await supabase
              .from("players")
              .select("id")
              .order("elo_rating", { ascending: false })
              .limit(10);
              
            if (data && data.some((p: any) => p.id === profile.id)) {
              // They are in top 10!
              if (!localStorage.getItem("notified_top10")) {
                localStorage.setItem("notified_top10", "true");
                playVictorySound();
                if (Capacitor.isNativePlatform()) {
                  try {
                    const permStatus = await LocalNotifications.checkPermissions();
                    if (permStatus.display === "prompt") await LocalNotifications.requestPermissions();
                    if (permStatus.display === "granted" || permStatus.display === "prompt") {
                      await LocalNotifications.schedule({
                        notifications: [{
                          title: "🎉 Top 10 Reached!",
                          body: "You've just entered the Top 10! Keep up the great work!",
                          id: Math.floor(Math.random() * 1000000),
                          schedule: { at: new Date(Date.now() + 100) },
                          channelId: "notify_victory",
                        }],
                      });
                    }
                  } catch(e){}
                } else {
                  showWebNotification("🎉 Top 10 Reached!", "You've just entered the Top 10! Keep up the great work!", () => {});
                }
              }
            } else {
              localStorage.removeItem("notified_top10");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  return notification;
}

