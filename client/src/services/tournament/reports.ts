/**
 * Composite read models: organiser report data, player certificates, and the
 * Elo stakes context for a player's matches.
 */
import { supabase } from "@/lib/supabase";

export async function fetchPlayerCertificatesMatchesAndOfficials(tournamentId: string, playerId: string) {
  const ors = ["player1_id", "player2_id", "player3_id", "player4_id"]
    .map((c) => `${c}.eq.${playerId}`)
    .join(",");
  const [{ data: matches, error: mErr }, { data: officials, error: oErr }] = await Promise.all([
    supabase
      .from("tournament_matches")
      .select("category, round_name, match_code, status, winner_side, player1_id, player2_id, player3_id, player4_id")
      .eq("tournament_id", tournamentId)
      .or(ors),
    supabase
      .from("tournament_officials")
      .select("role")
      .eq("tournament_id", tournamentId)
      .eq("user_id", playerId),
  ]);
  if (mErr) throw mErr;
  if (oErr) throw oErr;
  return { matches: matches ?? [], officials: officials ?? [] };
}

export async function fetchTournamentReportPanelData(tournamentId: string, requireAppRegistration: boolean) {
  const { data: matches, error: mErr } = await supabase
    .from("tournament_matches")
    .select(
      "id, match_code, category, round, round_name, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, status, score, sets_history, winner_side, court_number, scheduled_at, started_at, ended_at, umpired_by",
    )
    .eq("tournament_id", tournamentId)
    .order("category", { ascending: true })
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  if (mErr) throw mErr;

  const rows = matches ?? [];
  const umpIds = Array.from(new Set(rows.map((m) => m.umpired_by).filter(Boolean))) as string[];
  let umpireMap: Record<string, string> = {};
  if (umpIds.length) {
    const { data: ump } = await supabase.from("players").select("id, full_name").in("id", umpIds);
    umpireMap = Object.fromEntries((ump ?? []).map((p) => [p.id, p.full_name] as const));
  }

  const { data: fb } = await supabase
    .from("tournament_feedback")
    .select("rating, tags, comment")
    .eq("tournament_id", tournamentId);

  let regCount: number | null = null;
  if (requireAppRegistration) {
    const { count } = await supabase
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("status", "approved");
    regCount = count ?? null;
  }

  return { matches: rows, umpireNames: umpireMap, feedback: fb ?? [], registered: regCount };
}

export async function fetchTournamentReportData(tournamentId: string) {
  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (tErr) throw tErr;

  const { data: matches, error: mErr } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId);
  if (mErr) throw mErr;

  const { data: fb } = await supabase
    .from("tournament_feedback")
    .select("rating, tags, comment")
    .eq("tournament_id", tournamentId);

  const { count: participantCount } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  return {
    tournament: tourney,
    matches: matches ?? [],
    feedback: fb ?? [],
    participantCount: participantCount ?? 0,
  };
}

export async function fetchEloStakesContext(playerId: string, playerIds: string[]) {
  const [{ data: players, error: errPlayers }, { count, error: errCount }, { data: cfgRow, error: errCfg }] = await Promise.all([
    supabase.from("players").select("id, tournament_elo, elo_rating").in("id", playerIds),
    supabase
      .from("tournament_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`),
    supabase.from("site_data").select("value").eq("key", "elo_config").maybeSingle(),
  ]);
  if (errPlayers) throw errPlayers;
  if (errCount) throw errCount;
  if (errCfg) throw errCfg;
  return {
    players: players || [],
    completedCount: count ?? 0,
    eloConfig: (cfgRow?.value ?? {}) as Record<string, any>,
  };
}
