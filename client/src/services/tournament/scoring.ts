/**
 * Match-day officiating RPCs: checked start, revisioned result submission,
 * conflict context, corrections, reasoned schedule overrides, undo,
 * walkovers, and the match-notifier / call-to-court edge functions.
 */
import { supabase } from "@/lib/supabase";
import type { ScoreConflictState, ScoreCorrectionResult } from "@/types/umpire";

export interface TournamentResultSubmission {
  applied: boolean;
  revision: number;
  operation_id: string | null;
  reason: "applied" | "already_applied";
}

export interface TournamentStartReceipt {
  applied: boolean;
  reason: "started" | "already_started";
  started_at: string | null;
}

export async function startTournamentMatchChecked(params: {
  p_match_id: string;
  p_expected_court?: string | null;
  p_expected_scheduled_at?: string | null;
}): Promise<TournamentStartReceipt> {
  const { data, error } = await supabase.rpc("start_tournament_match_checked", {
    p_match_id: params.p_match_id,
    p_expected_court: params.p_expected_court ?? null,
    p_expected_scheduled_at: params.p_expected_scheduled_at ?? null,
  });
  if (error) throw error;
  return data as unknown as TournamentStartReceipt;
}

export async function submitTournamentMatch(params: {
  p_match_id: string;
  p_winner_side: number;
  p_score: string;
  p_sets?: string[];
  p_umpire_id?: string | null;
  p_expected_revision?: number;
  p_operation_id?: string;
}): Promise<TournamentResultSubmission> {
  const { data, error } = await supabase.rpc("submit_tournament_match_v2", {
    p_match_id: params.p_match_id,
    p_winner_side: params.p_winner_side,
    p_score: params.p_score,
    p_sets: params.p_sets || [],
    p_umpire_id: params.p_umpire_id ?? null,
    p_expected_revision: params.p_expected_revision ?? 0,
    p_operation_id: params.p_operation_id ?? crypto.randomUUID(),
  });
  if (error) throw error;
  return data as unknown as TournamentResultSubmission;
}

export async function fetchTournamentMatchConflictContext(params: {
  matchId: string;
  localRevision: number;
  localWinnerSide: 1 | 2;
  localScore: string;
  localSets: string[];
  operationId?: string;
  team1Label?: string;
  team2Label?: string;
}): Promise<ScoreConflictState> {
  const { data: match, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, tournament_id, category, round, match_code, match_number, status,
      winner_side, winner_id, score, sets_history,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label, umpired_by, scored_by, scored_at,
      advances_to_match, advances_to_match_loser,
      result_revision, result_operation_id
    `)
    .eq("id", params.matchId)
    .single();

  if (error || !match) {
    throw error || new Error("Match not found on server");
  }

  // Look up last actor name if available
  let lastActorName: string | undefined;
  const actorId = match.scored_by || match.umpired_by;
  if (actorId) {
    const { data: actor } = await supabase
      .from("players")
      .select("full_name")
      .eq("id", actorId)
      .maybeSingle();
    lastActorName = actor?.full_name;
  }

  // Check if downstream match has started
  let downstreamStarted = false;
  let downstreamMatchCode: string | undefined;
  const nextCodes = [match.advances_to_match, match.advances_to_match_loser].filter(Boolean) as string[];
  if (nextCodes.length > 0 && match.tournament_id) {
    const { data: downstreamMatches } = await supabase
      .from("tournament_matches")
      .select("id, match_code, status, score, started_at")
      .eq("tournament_id", match.tournament_id)
      .in("match_code", nextCodes);

    const activeDownstream = downstreamMatches?.find(
      (m) =>
        m.status === "in_progress" ||
        m.status === "live" ||
        m.status === "completed" ||
        m.status === "walkover" ||
        Boolean(m.score) ||
        Boolean(m.started_at)
    );
    if (activeDownstream) {
      downstreamStarted = true;
      downstreamMatchCode = activeDownstream.match_code || undefined;
    }
  }

  return {
    matchId: params.matchId,
    tournamentId: match.tournament_id || undefined,
    matchNumber: match.match_number ? String(match.match_number) : undefined,
    category: match.category || undefined,
    team1Label: match.team1_label || params.team1Label || "Team 1",
    team2Label: match.team2_label || params.team2Label || "Team 2",
    localRevision: params.localRevision,
    serverRevision: Number(match.result_revision ?? 0),
    localWinnerSide: params.localWinnerSide,
    localScore: params.localScore,
    localSets: params.localSets,
    serverWinnerSide: (match.winner_side as 1 | 2 | null) ?? null,
    serverScore: match.score,
    serverSets: match.sets_history,
    serverStatus: match.status,
    operationId: params.operationId,
    lastActorName,
    lastActorId: actorId || undefined,
    lastUpdatedAt: match.scored_at || undefined,
    downstreamStarted,
    downstreamMatchCode,
  };
}

export async function applyTournamentMatchCorrection(params: {
  matchId: string;
  winnerSide: 1 | 2;
  score: string;
  sets: string[];
  expectedRevision: number;
  reason: string;
  operationId?: string;
}): Promise<ScoreCorrectionResult> {
  const { data, error } = await supabase.rpc("apply_tournament_match_correction", {
    p_match_id: params.matchId,
    p_winner_side: params.winnerSide,
    p_score: params.score,
    p_sets: params.sets,
    p_expected_revision: params.expectedRevision,
    p_reason: params.reason,
    p_operation_id: params.operationId ?? crypto.randomUUID(),
  });

  if (error) throw error;
  return data as unknown as ScoreCorrectionResult;
}

export async function overrideTournamentSchedule(params: {
  tournamentId: string;
  matchId: string;
  court: string;
  scheduledAt: string;
  reason: string;
  conflictType?: string;
  conflictingId?: string;
}): Promise<{ applied: boolean; match_id: string; court_number: string; scheduled_at: string }> {
  const { data, error } = await supabase.rpc("override_tournament_schedule", {
    p_tournament_id: params.tournamentId,
    p_match_id: params.matchId,
    p_court: params.court,
    p_scheduled_at: params.scheduledAt,
    p_reason: params.reason,
    p_conflict_type: params.conflictType ?? "warning",
    p_conflicting_id: params.conflictingId ?? null,
  });

  if (error) throw error;
  return data as unknown as { applied: boolean; match_id: string; court_number: string; scheduled_at: string };
}

export async function undoTournamentMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc("undo_tournament_match", { p_match_id: matchId });
  if (error) throw error;
}

export async function recordTournamentWalkover(params: {
  p_match_id: string;
  p_winner_side: number;
  p_umpire_id?: string | null;
  p_is_double_walkover?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("record_tournament_walkover", {
    p_match_id: params.p_match_id,
    p_winner_side: params.p_winner_side,
    p_scored_by: params.p_umpire_id ?? undefined,
  });
  if (error) throw error;
}

export async function notifyTournamentMatch(matchId: string, type: string = "manual"): Promise<void> {
  const { error } = await supabase.functions.invoke("match-notifier", {
    body: { match_id: matchId, type },
  });
  if (error) throw error;
}

export async function invokeCallToCourt(payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("call-to-court", {
    body: payload,
  });
  if (error) throw error;
  return data;
}
