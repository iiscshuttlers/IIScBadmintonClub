import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";

type OfflineAction =
  | { type: "confirm"; matchId: string; confirmerId: string }
  | { type: "reject"; matchId: string; rejecterId: string }
  | { type: "withdraw"; matchId: string };

export async function queueOfflineAction(action: OfflineAction) {
  let queue: OfflineAction[] = [];
  try {
    const { value } = await Preferences.get({ key: "offline_match_actions" });
    queue = JSON.parse(value || "[]");
  } catch (e) {}
  queue.push(action);
  await Preferences.set({ key: "offline_match_actions", value: JSON.stringify(queue) });
}

export function useOfflineSync() {
  useEffect(() => {
    const syncAll = async () => {
      await syncMatches();
      await syncActions();
    };

    const syncMatches = async () => {
      try {
        const { value } = await Preferences.get({ key: "offline_matches" });
        const queue = JSON.parse(value || "[]");
        if (queue.length === 0) return;

        toast.info("Back online! Syncing queued matches...");
        let successCount = 0;
        const failedQueue = [];

        for (const payload of queue) {
          const { error } = await supabase.rpc("submit_friendly_match", {
            submitter_id: payload.submitter_id,
            opponent_id: payload.opponent_id,
            match_winner_id: payload.match_winner_id,
            match_score: payload.match_score,
            submitter_partner_id: payload.submitter_partner_id || null,
            opponent_partner_id: payload.opponent_partner_id || null,
          });
          if (!error) { successCount++; } else { failedQueue.push(payload); }
        }

        if (successCount > 0) toast.success(`Synced ${successCount} offline match(es)!`);
        if (failedQueue.length > 0) toast.error(`Failed to sync ${failedQueue.length} match(es).`);
        await Preferences.set({ key: "offline_matches", value: JSON.stringify(failedQueue) });
      } catch (err) {
        console.error("Offline match sync error:", err);
      }
    };

    const syncActions = async () => {
      try {
        const { value } = await Preferences.get({ key: "offline_match_actions" });
        const queue: OfflineAction[] = JSON.parse(value || "[]");
        if (queue.length === 0) return;

        let successCount = 0;
        const failedQueue: OfflineAction[] = [];

        for (const action of queue) {
          let error: any = null;
          if (action.type === "confirm") {
            ({ error } = await supabase.rpc("confirm_friendly_match", {
              match_uuid: action.matchId,
              confirmer_id: action.confirmerId,
            }));
          } else if (action.type === "reject") {
            ({ error } = await supabase.rpc("reject_friendly_match", {
              match_uuid: action.matchId,
              rejecter_id: action.rejecterId,
            }));
          } else if (action.type === "withdraw") {
            ({ error } = await supabase.from("matches").delete().eq("id", action.matchId));
          }

          if (!error) { successCount++; } else { failedQueue.push(action); }
        }

        if (successCount > 0) toast.success(`Synced ${successCount} queued match action(s)!`);
        if (failedQueue.length > 0) toast.error(`Failed to sync ${failedQueue.length} action(s).`);
        await Preferences.set({ key: "offline_match_actions", value: JSON.stringify(failedQueue) });
      } catch (err) {
        console.error("Offline action sync error:", err);
      }
    };

    window.addEventListener("online", syncAll);
    
    // Resume listener for mobile native apps
    const appStateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && navigator.onLine) {
        syncAll();
      }
    });

    // Check once on mount in case they started app online with queued items
    if (navigator.onLine) syncAll();

    return () => {
      window.removeEventListener("online", syncAll);
      appStateListener.then(listener => listener.remove());
    };
  }, []);
}
