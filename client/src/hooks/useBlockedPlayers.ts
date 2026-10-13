import { useMemo } from "react";
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
  // NOTE: the query cache is persisted to localStorage (PersistQueryClient),
  // and a Set does not survive JSON serialization — it rehydrates as {} and
  // crashes on .has. So cache a plain string[] and build the Set in-memory.
  const { data } = useQuery({
    queryKey: ["blocked-players", myId],
    enabled: !!myId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from("user_blocks").select("blocked_id").eq("blocker_id", myId);
      if (error) throw error;
      return (data || []).map((r: any) => r.blocked_id as string);
    },
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(() => new Set<string>(Array.isArray(data) ? data : []), [data]);
}
