import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";
import type { BwfMatchState } from "@/types/umpire";
import { umpireService } from "@/services/umpireService";
import {
  enqueueLatestSnapshot,
  parseOfflineQueue,
  removeAcknowledgedSnapshots,
  removeSnapshotsForMatch,
  type QueuedUmpireAction,
} from "@/lib/umpire/offlineQueue";

const OFFLINE_QUEUE_KEY = "umpire_offline_queue_v1";

export type OfflineSyncStatus = "idle" | "saved-locally" | "syncing" | "confirmed" | "error";

export function useOfflineUmpireSync(ownerId: string) {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>("idle");
  const mutationChainRef = useRef<Promise<void>>(Promise.resolve());
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const readQueue = useCallback(async () => {
    const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
    return parseOfflineQueue(value);
  }, []);

  const writeQueue = useCallback(async (items: QueuedUmpireAction[]) => {
    if (items.length === 0) await Preferences.remove({ key: OFFLINE_QUEUE_KEY });
    else await Preferences.set({ key: OFFLINE_QUEUE_KEY, value: JSON.stringify(items) });
    setQueuedCount(items.filter((item) => item.ownerId === ownerId).length);
  }, [ownerId]);

  const mutateQueue = useCallback((mutate: (items: QueuedUmpireAction[]) => QueuedUmpireAction[]) => {
    const operation = mutationChainRef.current.then(async () => {
      const items = await readQueue();
      await writeQueue(mutate(items));
    });
    mutationChainRef.current = operation.catch(() => undefined);
    return operation;
  }, [readQueue, writeQueue]);

  const updateQueueCount = useCallback(async () => {
    try {
      const items = await readQueue();
      // Persist the quarantine marker when upgrading unattributed legacy entries.
      await writeQueue(items);
    } catch {
      setQueuedCount(0);
    }
  }, [readQueue, writeQueue]);

  const queueMatchStateUpdate = useCallback(async (matchId: string, matchState: BwfMatchState) => {
    try {
      const action: QueuedUmpireAction = {
        id: crypto.randomUUID(),
        matchId,
        ownerId,
        timestamp: Date.now(),
        matchState,
      };
      await mutateQueue((items) => enqueueLatestSnapshot(items, action));
      setSyncStatus("saved-locally");
    } catch (e) {
      console.error("Failed to queue offline match state update", e);
      setSyncStatus("error");
      throw e;
    }
  }, [mutateQueue, ownerId]);

  const clearMatchFromQueue = useCallback(async (matchId: string) => {
    try {
      await mutateQueue((items) => removeSnapshotsForMatch(items, matchId, ownerId));
    } catch (e) {
      console.error("Failed to clear match from offline queue", e);
    }
  }, [mutateQueue, ownerId]);

  const flushOfflineQueue = useCallback(async () => {
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const flush = (async () => {
      try {
        await mutationChainRef.current;
        const snapshot = (await readQueue()).filter((item) => item.ownerId === ownerId);
        if (snapshot.length === 0) {
          setSyncStatus("idle");
          return;
        }

        setSyncStatus("syncing");
        toast.info(`Syncing ${snapshot.length} offline score update(s)...`);
        const acknowledgedIds = new Set<string>();
        for (const item of snapshot) {
          await umpireService.upsertLiveMatch(item.matchId, item.matchState);
          acknowledgedIds.add(item.id);
        }

        await mutateQueue((current) => removeAcknowledgedSnapshots(current, acknowledgedIds));
        setSyncStatus("confirmed");
        toast.success("Offline scores confirmed by the server");
      } catch (e: any) {
        console.error("Failed to flush offline umpire queue", e);
        setSyncStatus("error");
        toast.error("Offline sync error: " + (e?.message || "Check connection"));
      } finally {
        flushPromiseRef.current = null;
      }
    })();

    flushPromiseRef.current = flush;
    return flush;
  }, [mutateQueue, ownerId, readQueue]);

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
    syncStatus,
    queueMatchStateUpdate,
    clearMatchFromQueue,
    flushOfflineQueue,
  };
}
