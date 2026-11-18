import { supabase } from "@/lib/supabase";
import type { ComparisonRow, ComparisonSide } from "@/lib/comparison";

/**
 * Every recorded match containing all players of both sides (no "latest N"
 * cap, so totals reconcile), from the friendly and tournament tables.
 * Classification/eligibility is done by lib/comparison.
 */

const MAX_ROWS = 1000;

const anyOf = (id: string, cols: readonly string[]) => cols.map((c) => `${c}.eq.${id}`).join(",");

export interface ComparisonData {
  rows: ComparisonRow[];
  players: Record<string, { id: string; full_name: string | null; gender: string | null; avatar_url: string | null }>;
  truncated: boolean;
}

export async function fetchComparisonRows(a: ComparisonSide, b: ComparisonSide): Promise<ComparisonData> {
  const ids = Array.from(new Set([...a.ids, ...b.ids]));
  const fCols = ["player1_id", "player2_id", "team1_partner_id", "team2_partner_id"] as const;
  const tCols = ["player1_id", "player2_id", "player3_id", "player4_id"] as const;

  let fq = supabase
    .from("matches")
    .select("id, status, category, player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id, score, date, created_at")
    .limit(MAX_ROWS);
  let tq = supabase
    .from("tournament_matches")
    .select("id, tournament_id, status, category, match_code, round_name, player1_id, player2_id, player3_id, player4_id, winner_side, winner_id, score, sets_history, ended_at, scheduled_at, created_at, tournaments!inner(name, status)")
    .neq("tournaments.status", "deleted")
    .limit(MAX_ROWS);
  // One OR group per required player: the row must contain every player.
  for (const id of ids) {
    fq = fq.or(anyOf(id, fCols));
    tq = tq.or(anyOf(id, tCols));
  }

  const [f, t, p] = await Promise.all([
    fq,
    tq,
    supabase.from("players").select("id, full_name, gender, avatar_url").in("id", ids),
  ]);
  if (f.error) throw f.error;
  if (t.error) throw t.error;
  if (p.error) throw p.error;

  // Genders of every participant (to place friendly rows in a discipline).
  const participantIds = new Set<string>();
  for (const m of f.data ?? []) for (const c of fCols) if (m[c]) participantIds.add(m[c]);
  for (const m of t.data ?? []) for (const c of tCols) if (m[c]) participantIds.add(m[c]);
  const extra = [...participantIds].filter((id) => !ids.includes(id));
  const g = extra.length
    ? await supabase.from("players").select("id, gender").in("id", extra)
    : { data: [] as { id: string; gender: string | null }[], error: null };
  const genders: Record<string, string | null> = {};
  for (const row of [...(p.data ?? []), ...(g.data ?? [])]) genders[row.id] = row.gender ?? null;

  const rows: ComparisonRow[] = [
    ...(f.data ?? []).map((m) => ({
      id: m.id,
      source: "friendly" as const,
      status: m.status,
      winnerSide: null,
      winnerId: m.winner_id ?? null,
      side1: [m.player1_id, m.team1_partner_id].filter(Boolean),
      side2: [m.player2_id, m.team2_partner_id].filter(Boolean),
      category: m.category ?? null,
      genders,
      date: m.date ?? m.created_at ?? null,
      score: m.score ?? null,
      round: null,
      event: "Friendly",
    })),
    ...(t.data ?? []).map((m) => ({
      id: m.id,
      source: "tournament" as const,
      status: m.status,
      winnerSide: m.winner_side === 1 || m.winner_side === 2 ? (m.winner_side as 1 | 2) : null,
      winnerId: m.winner_id ?? null,
      side1: [m.player1_id, m.player3_id].filter(Boolean),
      side2: [m.player2_id, m.player4_id].filter(Boolean),
      category: m.category ?? null,
      matchCode: m.match_code ?? null,
      genders,
      date: m.ended_at ?? m.scheduled_at ?? m.created_at ?? null,
      score: m.score ?? (Array.isArray(m.sets_history) && m.sets_history.length ? m.sets_history.join(", ") : null),
      round: m.round_name ?? null,
      event: m.tournaments?.name ?? null,
      tournamentId: m.tournament_id ?? null,
    })),
  ];

  const players: ComparisonData["players"] = {};
  for (const row of p.data ?? []) players[row.id] = row;
  return {
    rows,
    players,
    truncated: (f.data?.length ?? 0) >= MAX_ROWS || (t.data?.length ?? 0) >= MAX_ROWS,
  };
}
