/**
 * Display read models: TV next-up, TV head-to-head history, TV draw reveal,
 * and the path-to-final view.
 */
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase-types-auto";

export async function fetchTvNextUpOverview(tournamentId: string) {
  const [{ data: t }, { data: rows, error }] = await Promise.all([
    supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle(),
    supabase
      .from("tournament_matches")
      .select("id, court_number, status, scheduled_at, round, match_number, round_name, category, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, score")
      .eq("tournament_id", tournamentId)
      .not("court_number", "is", null)
      .in("status", ["in_progress", "scheduled", "playing", "ready", "warming_up", "paused"]),
  ]);
  if (error) throw error;
  return { name: t?.name ?? "", rows: rows ?? [] };
}

export async function fetchTvH2hHistory(allPlayerIds: string[]) {
  const or = allPlayerIds.flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`, `player3_id.eq.${id}`, `player4_id.eq.${id}`]).join(",");
  const [{ data: hist }, { data: players }] = await Promise.all([
    supabase
      .from("tournament_matches")
      .select("id, status, winner_side, player1_id, player2_id, player3_id, player4_id, score, ended_at, scheduled_at, tournaments(name)")
      .in("status", ["completed", "walkover"])
      .or(or)
      .limit(500),
    supabase.from("players").select("id, elo_rating").in("id", allPlayerIds),
  ]);
  return { hist: hist ?? [], players: players ?? [] };
}

export async function fetchTvNextUpMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, match_code, category, round, round_name, court_number, scheduled_at, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating)
    `)
    .eq("tournament_id", tournamentId)
    .in("status", ["scheduled", "in_progress", "completed"])
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTvDrawRevealMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, match_code, category, round, round_name, match_number, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating)
    `)
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPathToFinalData(tournamentId: string, category: string) {
  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select("id, match_code, round, round_name, status, winner_side, advances_to_match, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, tie_id")
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .is("tie_id", null);
  if (error) throw error;
  const ids = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id]).filter(Boolean)),
  );
  const { data: players } = ids.length
    ? await supabase.from("players").select("id, tournament_elo, elo_rating").in("id", ids)
    : { data: [] as Array<Pick<Tables<"players">, "id" | "tournament_elo" | "elo_rating">> };
  return { matches: matches ?? [], players: players ?? [] };
}

export async function fetchPathToFinalMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, category, round, round_name, match_number, match_code, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id, team1_label, team2_label,
      advances_to_match, advances_to_position
    `)
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data ?? [];
}
