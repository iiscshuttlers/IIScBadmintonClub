/**
 * Per-round scoring rules (tournament_round_rules) and copying them onto the
 * round's matches.
 */
import { supabase } from "@/lib/supabase";

export async function fetchTournamentRoundRules(tournamentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_round_rules")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertTournamentRoundRule(rule: {
  tournament_id: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}): Promise<void> {
  const { error } = await supabase.from("tournament_round_rules").upsert(rule, {
    onConflict: "tournament_id,category,round",
  });
  if (error) throw error;
}

/**
 * Saves one round's scoring rule and copies it onto that round's matches, in
 * one transaction (set_tournament_round_rule). The host and admins may call
 * it. If the function is not on the database yet, falls back to the two
 * direct writes, which only admins can make.
 */
export async function setTournamentRoundRule(rule: {
  tournament_id: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}): Promise<void> {
  const { error } = await supabase.rpc("set_tournament_round_rule", {
    p_tournament_id: rule.tournament_id,
    p_category: rule.category,
    p_round: rule.round,
    p_round_name: rule.round_name,
    p_points_to_win: rule.points_to_win,
    p_best_of_sets: rule.best_of_sets,
    p_golden_point: rule.golden_point,
  });
  if (!error) return;
  // PGRST202: PostgREST has no such function (migration not applied yet).
  if (error.code !== "PGRST202") throw error;
  await upsertTournamentRoundRule(rule);
  await updateMatchesScoringRule(rule.tournament_id, rule.category, rule.round, {
    points_to_win: rule.points_to_win,
    best_of_sets: rule.best_of_sets,
    golden_point: rule.golden_point,
  });
}

export async function updateMatchesScoringRule(
  tournamentId: string,
  category: string,
  round: number,
  vals: { points_to_win: number; best_of_sets: number; golden_point: number }
): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update(vals)
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .eq("round", round);
  if (error) throw error;
}

export async function fetchTournamentMatchesForRounds(tournamentId: string): Promise<Array<{ category: string; round: number; round_name: string | null }>> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("category, round, round_name")
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data ?? [];
}

/** Round rules of the given tournaments. Returns null on error. */
export async function fetchRoundRulesForTournaments(tournamentIds: string[]) {
  const { data } = await supabase
    .from("tournament_round_rules")
    .select("*")
    .in("tournament_id", tournamentIds);
  return data;
}
