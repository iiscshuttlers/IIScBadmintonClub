import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AUTO_FEED_TOURNAMENT_COLUMNS, type AutoFeedTournament } from "@/lib/autoAnnouncements";

/**
 * Tournaments the Pulse Feed turns into automatic posts, with their Final
 * matches. Drafts and trashed tournaments are excluded here as well as by
 * RLS, because admins can read drafts.
 *
 * Returns the raw rows (plain JSON, safe for the persisted cache); the posts
 * are built at render time so stage changes follow the clock.
 */
export async function fetchAutoFeedTournaments(): Promise<AutoFeedTournament[]> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `${AUTO_FEED_TOURNAMENT_COLUMNS}, tournament_matches(category, match_code, round_name, winner_side, team1_label, team2_label)`,
    )
    .not("status", "in", "(draft,deleted)")
    // Narrows the embedded matches to Finals (LIKE's `_` also lets SF/QF through;
    // winnersFromFinals keeps only real Finals).
    .or("round_name.eq.Final,match_code.like.*_F_*", { referencedTable: "tournament_matches" })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AutoFeedTournament[];
}

export function useAutoFeedTournaments() {
  // Under the ["tournaments"] prefix so visibility changes broadcast by
  // RealtimeProvider refresh it too.
  return useQuery({
    queryKey: ["tournaments", "feed-auto"],
    queryFn: fetchAutoFeedTournaments,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.error ? false : 120_000),
  });
}
