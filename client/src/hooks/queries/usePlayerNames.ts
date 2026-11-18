import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * id → full name for a set of players, from public columns only. Team labels
 * ("A & B") can't be split reliably (the label order doesn't always match
 * player1/player3), so leader tables name people by id.
 */
export function usePlayerNames(ids: string[]) {
  const sorted = Array.from(new Set(ids.filter(Boolean))).sort();
  return useQuery<Record<string, string>>({
    queryKey: ["player-names", sorted],
    enabled: sorted.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const out: Record<string, string> = {};
      for (let i = 0; i < sorted.length; i += 150) {
        const { data, error } = await supabase.from("players").select("id, full_name").in("id", sorted.slice(i, i + 150));
        if (error) throw error;
        for (const p of (data ?? []) as Array<{ id: string; full_name: string | null }>) if (p.full_name) out[p.id] = p.full_name;
      }
      return out;
    },
  });
}
