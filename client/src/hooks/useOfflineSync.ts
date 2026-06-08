import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useOfflineSync() {
  useEffect(() => {
    const syncOfflineMatches = async () => {
      try {
        const queue = JSON.parse(localStorage.getItem('offline_matches') || '[]');
        if (queue.length > 0) {
          toast.info("Back online! Syncing queued matches...");
          
          let successCount = 0;
          const failedQueue = [];

          for (const payload of queue) {
            const { error } = await supabase.rpc("submit_friendly_match", payload);
            if (!error) {
              successCount++;
            } else {
              // Legacy fallback
              const { error: legacyError } = await supabase.rpc("submit_friendly_match", {
                submitter_id: payload.submitter_id,
                opponent_id: payload.opponent_id,
                match_winner_id: payload.match_winner_id,
                match_score: payload.match_score,
              });
              if (!legacyError) {
                successCount++;
              } else {
                failedQueue.push(payload);
              }
            }
          }

          if (successCount > 0) {
            toast.success(`Successfully synced ${successCount} offline match(es)!`);
          }
          if (failedQueue.length > 0) {
            toast.error(`Failed to sync ${failedQueue.length} match(es).`);
          }
          
          localStorage.setItem('offline_matches', JSON.stringify(failedQueue));
        }
      } catch (err) {
        console.error("Offline sync error:", err);
      }
    };

    window.addEventListener('online', syncOfflineMatches);
    
    // Check once on mount in case they started app online with queued items
    if (navigator.onLine) {
      syncOfflineMatches();
    }

    return () => {
      window.removeEventListener('online', syncOfflineMatches);
    };
  }, []);
}
