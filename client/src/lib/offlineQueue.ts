import { supabase } from "./supabase";

const OFFLINE_QUEUE_KEY = "offline_match_queue";

export interface QueuedMatch {
  id: string;
  payload: any;
  timestamp: number;
}

export const getOfflineQueue = (): QueuedMatch[] => {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const enqueueOfflineMatch = (payload: any) => {
  const queue = getOfflineQueue();
  queue.push({
    id: crypto.randomUUID(),
    payload,
    timestamp: Date.now(),
  });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

  // Register a Background Sync tag so the SW can retry when connectivity returns
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((sw) => (sw as any).sync.register("offline-matches"))
      .catch(() => {});
  }
};

export const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
};

export const syncOfflineMatches = async () => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let successCount = 0;
  let failedCount = 0;
  const newQueue: QueuedMatch[] = [];

  for (const item of queue) {
    try {
      // payload expects match details.
      const { error } = await supabase.from("matches").insert(item.payload);
      if (error) {
        // If it's a conflict or hard error that won't resolve, we might still drop it,
        // but for safety, we keep it in the queue for a manual retry if it's network related.
        console.error("Failed to sync match", error);
        newQueue.push(item);
        failedCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      newQueue.push(item);
      failedCount++;
    }
  }

  if (newQueue.length > 0) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
  } else {
    clearOfflineQueue();
  }

  return { success: successCount, failed: failedCount };
};

// Auto-sync when coming online
window.addEventListener("online", () => {
  syncOfflineMatches().then(({ success }) => {
    if (success > 0) {
      window.dispatchEvent(new CustomEvent("offlineSyncComplete", { detail: { count: success } }));
    }
  });
});

// Respond to SW background sync message (when SW wakes the main thread)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SYNC_OFFLINE_MATCHES") {
      syncOfflineMatches().then(({ success }) => {
        if (success > 0) {
          window.dispatchEvent(new CustomEvent("offlineSyncComplete", { detail: { count: success } }));
        }
      });
    }
  });
}
