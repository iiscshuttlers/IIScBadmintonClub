/**
 * Realtime subscriptions on tournament matches and ties; each returns its
 * cleanup.
 */
import { supabase } from "@/lib/supabase";

/**
 * Referee dashboard realtime: one channel with changes to the tournament's
 * matches and ties; both call `onChange`. Returns the cleanup.
 */
export function subscribeToRefereeBoard(tournamentId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`referee_matches_${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * Order-of-play realtime: one channel with changes to the tournament's
 * matches and ties; both call `onChange`. Returns the cleanup.
 */
export function subscribeToOrderOfPlay(tournamentId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`oop_matches_${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Umpire tab: calls `onChange` on any change to tournament_matches (unfiltered). Returns the cleanup. */
export function subscribeToUmpireTournamentMatches(onChange: () => void): () => void {
  const channel = supabase
    .channel("umpire_tournament_matches")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_matches" },
      () => { onChange(); },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
