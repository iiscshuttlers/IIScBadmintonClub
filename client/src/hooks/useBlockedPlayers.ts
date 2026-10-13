import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// user_blocks is new; generated types regenerate after the migration is
// applied (npx supabase db push). Cast until then.
const sb = supabase as any;

/**
 * #29 Set of player ids the current user has blocked. Used to hide blocked
 * players from the directory. RLS only ever returns the caller's own rows.
 */
export function useBlockedPlayers(myId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["blocked-players", myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await sb.from("user_blocks").select("blocked_id").eq("blocker_id", myId);
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => r.blocked_id));
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? new Set<string>();
}
