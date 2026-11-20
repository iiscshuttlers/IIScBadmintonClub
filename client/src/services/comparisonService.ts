import { supabase } from "@/lib/supabase";
import { isByeLabel, type ComparisonRow, type ComparisonSide } from "@/lib/comparison";

/**
 * Every recorded tournament match containing all players of both sides (no
 * "latest N" cap, so totals reconcile). Classification/eligibility is done by
 * lib/comparison.
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
  const tCols = ["player1_id", "player2_id", "player3_id", "player4_id"] as const;

  let tq = supabase
    .from("tournament_matches")
    .select("id, tournament_id, status, category, match_code, round_name, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, winner_side, winner_id, score, sets_history, ended_at, scheduled_at, created_at, tournaments!inner(name, status)")
    .neq("tournaments.status", "deleted")
    .limit(MAX_ROWS);
  // One OR group per required player: the row must contain every player.
  for (const id of ids) {
    tq = tq.or(anyOf(id, tCols));
  }

  const [t, p] = await Promise.all([
    tq,
    supabase.from("players").select("id, full_name, gender, avatar_url").in("id", ids),
  ]);
  if (t.error) throw t.error;
  if (p.error) throw p.error;

  // Genders of every participant (to place rows in a discipline).
  const participantIds = new Set<string>();
  for (const m of t.data ?? []) for (const c of tCols) if (m[c]) participantIds.add(m[c]);
  const extra = [...participantIds].filter((id) => !ids.includes(id));
  const g = extra.length
    ? await supabase.from("players").select("id, gender").in("id", extra)
    : { data: [] as { id: string; gender: string | null }[], error: null };
  const genders: Record<string, string | null> = {};
  for (const row of [...(p.data ?? []), ...(g.data ?? [])]) genders[row.id] = row.gender ?? null;

  const rows: ComparisonRow[] = [
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
      bye: isByeLabel(m.team1_label) || isByeLabel(m.team2_label),
    })),
  ];

  const players: ComparisonData["players"] = {};
  for (const row of p.data ?? []) players[row.id] = row;
  return {
    rows,
    players,
    truncated: (t.data?.length ?? 0) >= MAX_ROWS,
  };
}
