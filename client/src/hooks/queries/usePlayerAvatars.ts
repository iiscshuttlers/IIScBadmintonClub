import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface PlayerFace {
  name: string;
  avatarUrl: string | null;
}

/**
 * id → name and photo for the players on a screen, from public columns only
 * (never contact details). Plain object: the query cache is persisted.
 */
export function usePlayerAvatars(ids: string[]) {
  const sorted = Array.from(new Set(ids.filter(Boolean))).sort();
  return useQuery<Record<string, PlayerFace>>({
    queryKey: ["player-avatars", sorted],
    enabled: sorted.length > 0,
    staleTime: 30 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("id, full_name, avatar_url").in("id", sorted);
      if (error) throw error;
      const out: Record<string, PlayerFace> = {};
      for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
        out[p.id] = { name: p.full_name ?? "", avatarUrl: p.avatar_url };
      }
      return out;
    },
  });
}
