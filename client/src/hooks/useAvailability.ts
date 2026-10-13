import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

// player_availability is new; the generated types regenerate after the
// migration is applied (npx supabase db push). Cast until then.
const sb = supabase as any;

/**
 * #31 "Available to play now" — a manual, location-free presence signal.
 * A player toggles availability, which writes a row with an expiry. Everyone
 * sees who is currently available. RealtimeProvider invalidates ["presence"].
 */

export interface AvailabilityRow {
  player_id: string;
  available_until: string;
  note: string | null;
}

/** Map of player_id → availability row, for players available right now. */
export function useAvailablePlayers() {
  // NOTE: the query cache is persisted to localStorage (PersistQueryClient).
  // A Map does not survive JSON serialization — it rehydrates as a plain {}
  // and crashes on .get/.has. So we cache a plain array and build the Map
  // in-memory (memoized) instead.
  const query = useQuery({
    queryKey: ["presence"],
    queryFn: async (): Promise<AvailabilityRow[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await sb
        .from("player_availability")
        .select("player_id, available_until, note")
        .gt("available_until", nowIso);
      if (error) throw error;
      return (data || []) as AvailabilityRow[];
    },
    // availability is time-sensitive; refetch on focus and every 2 min
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  const availableMap = useMemo(() => {
    const map = new Map<string, AvailabilityRow>();
    // Guard against a rehydrated non-array (older persisted cache shape).
    if (Array.isArray(query.data)) {
      for (const row of query.data) map.set(row.player_id, row);
    }
    return map;
  }, [query.data]);
  return { availableMap, isLoading: query.isLoading };
}

/** Controls for the current player's own availability. */
export function useMyAvailability(myPlayerId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { availableMap } = useAvailablePlayers();
  const myRow = myPlayerId ? availableMap.get(myPlayerId) : undefined;
  const isAvailable = !!myRow;

  const setAvailable = useCallback(
    async (durationMinutes = 120, note?: string) => {
      if (!myPlayerId) return;
      const availableUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const { error } = await sb
        .from("player_availability")
        .upsert({ player_id: myPlayerId, available_until: availableUntil, note: note ?? null, updated_at: new Date().toISOString() });
      if (error) {
        toast.error("Couldn't update availability");
        return;
      }
      toast.success(`You're marked available for ${Math.round(durationMinutes / 60) || 1}h 🏸`);
      track("availability_set", { minutes: durationMinutes });
      queryClient.invalidateQueries({ queryKey: ["presence"] });
    },
    [myPlayerId, queryClient],
  );

  const clearAvailable = useCallback(async () => {
    if (!myPlayerId) return;
    const { error } = await sb.from("player_availability").delete().eq("player_id", myPlayerId);
    if (error) {
      toast.error("Couldn't update availability");
      return;
    }
    toast.success("You're no longer marked available");
    queryClient.invalidateQueries({ queryKey: ["presence"] });
  }, [myPlayerId, queryClient]);

  return { isAvailable, availableUntil: myRow?.available_until, setAvailable, clearAvailable };
}
