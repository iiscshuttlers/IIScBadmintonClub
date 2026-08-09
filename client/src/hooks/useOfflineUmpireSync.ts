import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
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

  const updateQueueCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const items: QueuedUmpireAction[] = stored ? JSON.parse(stored) : [];
      setQueuedCount(items.length);
    } catch {
      setQueuedCount(0);
    }
  }, []);

  const queueMatchStateUpdate = useCallback((matchState: BwfMatchState) => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const items: QueuedUmpireAction[] = stored ? JSON.parse(stored) : [];
      
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

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
      setQueuedCount(items.length);
    } catch (e) {
      console.error("Failed to queue offline match state update", e);
    }
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!stored) return;
      
      const items: QueuedUmpireAction[] = JSON.parse(stored);
      if (items.length === 0) return;

      toast.info(`Syncing ${items.length} offline score update(s)...`);

      const { data } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .maybeSingle();

      const liveMatches: Record<string, BwfMatchState> = data?.value || {};

      for (const item of items) {
        liveMatches[item.matchId] = item.matchState;
      }

      const { error } = await supabase
        .from("site_data")
        .upsert({ key: "live_matches", value: liveMatches }, { onConflict: "key" });

      if (error) throw error;

      localStorage.removeItem(OFFLINE_QUEUE_KEY);
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

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushOfflineQueue, updateQueueCount]);

  return {
    isOffline,
    queuedCount,
    queueMatchStateUpdate,
    flushOfflineQueue,
  };
}
