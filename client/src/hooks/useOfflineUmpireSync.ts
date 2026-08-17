import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";
import type { BwfMatchState } from "@/types/umpire";

const OFFLINE_QUEUE_KEY = "umpire_offline_queue_v1";

export interface QueuedUmpireAction {
  id: string;
  matchId: string;
  timestamp: number;
  matchState: BwfMatchState;
}

export function useOfflineUmpireSync() {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState<number>(0);

  const updateQueueCount = useCallback(async () => {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      const items: QueuedUmpireAction[] = value ? JSON.parse(value) : [];
      setQueuedCount(items.length);
    } catch {
      setQueuedCount(0);
    }
  }, []);

  const queueMatchStateUpdate = useCallback(async (matchState: BwfMatchState) => {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      const items: QueuedUmpireAction[] = value ? JSON.parse(value) : [];
      
      const index = items.findIndex(i => i.matchId === matchState.id);
      const action: QueuedUmpireAction = {
        id: crypto.randomUUID(),
        matchId: matchState.id,
        timestamp: Date.now(),
        matchState,
      };

      if (index >= 0) {
        items[index] = action;
      } else {
        items.push(action);
      }

      await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: JSON.stringify(items) });
      setQueuedCount(items.length);
    } catch (e) {
      console.error("Failed to queue offline match state update", e);
    }
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
      if (!value) return;
      
      const items: QueuedUmpireAction[] = JSON.parse(value);
      if (items.length === 0) return;

      toast.info(`Syncing ${items.length} offline score update(s)...`);

      const { data } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .maybeSingle();

      const liveMatches: Record<string, BwfMatchState> = (data?.value as any) || {};

      for (const item of items) {
        liveMatches[item.matchId] = item.matchState;
      }

      const { error } = await supabase
        .from("site_data")
        .upsert({ key: "live_matches", value: liveMatches }, { onConflict: "key" });

      if (error) throw error;

      await Preferences.remove({ key: OFFLINE_QUEUE_KEY });
      setQueuedCount(0);
      toast.success("Offline scores successfully synced!");
    } catch (e: any) {
      console.error("Failed to flush offline umpire queue", e);
      toast.error("Offline sync error: " + (e?.message || "Check connection"));
    }
  }, []);

  useEffect(() => {
    updateQueueCount();

    const handleOnline = () => {
      setIsOffline(false);
      flushOfflineQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Network connection lost. Scores will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const appStateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && navigator.onLine) {
        flushOfflineQueue();
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      appStateListener.then(listener => listener.remove());
    };
  }, [flushOfflineQueue, updateQueueCount]);

  return {
    isOffline,
    queuedCount,
    queueMatchStateUpdate,
    flushOfflineQueue,
  };
}
