import { supabase } from "@/lib/supabase";
import { isUuid } from "@/lib/tournamentRoutes";

/** Resolve a short match link only when its parent tournament is visible to this viewer. */
export async function fetchVisibleTournamentIdForMatch(matchId: string): Promise<string | null> {
  if (!isUuid(matchId)) return null;
  const { data: match, error: matchError } = await supabase
    .from("tournament_matches")
    .select("tournament_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw matchError;
  const tournamentId = match?.tournament_id as string | undefined;
  if (!tournamentId) return null;

  // This second RLS-protected lookup prevents the redirect URL itself from
  // confirming the parent ID when a match policy is ever relaxed or misconfigured.
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .neq("status", "deleted")
    .maybeSingle();
  if (tournamentError) throw tournamentError;
  return tournament ? tournamentId : null;
}
