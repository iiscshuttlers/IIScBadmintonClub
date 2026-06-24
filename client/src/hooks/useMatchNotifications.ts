import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Badge } from "@capawesome/capacitor-badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function useMatchNotifications(profileId?: string | null) {
  useEffect(() => {
    if (!profileId) return;

    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .neq("submitted_by", profileId)
          .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`);

        if (!error && count !== null && Capacitor.isNativePlatform()) {
          try {
            if (count > 0) {
              await Badge.set({ count });
            } else {
              await Badge.clear();
            }
          } catch (e) {
            console.warn("Failed to set app badge", e);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    fetchPendingCount();

    const channel = supabase
      .channel("realtime_matches")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `player2_id=eq.${profileId}`,
        },
        async (payload) => {
          if (payload.new.status === "pending") {
            fetchPendingCount();
            try {
              // Fetch the opponent's name for a better notification
              const { data } = await supabase
                .from("players")
                .select("full_name")
                .eq("id", payload.new.player1_id)
                .single();
              const challengerName = data?.full_name || "Someone";
              
              let description = `${challengerName} just logged a match against you!`;
              let title = "🏸 New Match Request";

              if (payload.new.submitted_by && payload.new.submitted_by !== payload.new.player1_id && payload.new.submitted_by !== payload.new.player2_id) {
                 const { data: umpireData } = await supabase.from("players").select("full_name").eq("id", payload.new.submitted_by).single();
                 if (umpireData) {
                     title = "📺 Match Logged by Umpire";
                     description = `Umpire ${umpireData.full_name} logged your match: ${payload.new.match_score}`;
                 }
              }

              toast.info(title, {
                description,
                action: {
                  label: "View",
                  onClick: () =>
                    (window.location.href = `${import.meta.env.BASE_URL}feed/my-matches`),
                },
                duration: 10000,
              });
            } catch (err) {
              // Fallback
              toast.info("🏸 New Match Request", {
                description: "Someone just logged a match against you!",
              });
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
        },
        () => {
           fetchPendingCount();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "matches",
        },
        () => {
           fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);
}
