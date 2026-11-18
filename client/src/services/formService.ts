import { supabase } from "@/lib/supabase";
import { disciplineOf } from "@/lib/matchView";

/**
 * Recent tournament form (FotMob / BWF "last 5"): each player's latest
 * decided tournament results, newest first. One batched query for every
 * player on a screen; the per-player split happens client-side.
 *
 * Rules: completed and walkover matches count; cancelled matches, BYEs and
 * matches without a recorded winner don't. Doubles results are attributed to
 * each player individually.
 */

export interface FormEntry {
  matchId: string;
  tournamentId: string;
  result: "W" | "L";
  walkover: boolean;
  opponentLabel: string;
  /** e.g. "MS · Quarter-final" */
  eventLabel: string;
  /** ISO date used for ordering (ended, else scheduled, else created). */
  date: string | null;
}

/** playerId → entries, newest first. Plain object: the query cache is persisted. */
export type FormByPlayer = Record<string, FormEntry[]>;

export interface FormRow {
  id: string;
  tournament_id: string;
  category: string | null;
  match_code: string | null;
  round_name: string | null;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  winner_side: number | null;
  status: string;
  ended_at: string | null;
  scheduled_at: string | null;
  created_at: string | null;
}

const FORM_COLUMNS =
  "id, tournament_id, category, match_code, round_name, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, winner_side, status, ended_at, scheduled_at, created_at";

const DECIDED = ["completed", "finished", "walkover"];
const BYE_RE = /\bbye\b/i;

function when(r: FormRow): string | null {
  return r.ended_at ?? r.scheduled_at ?? r.created_at ?? null;
}

function ts(iso: string | null): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** Pure: split rows into per-player form, newest first, at most `n` each. */
export function computeForm(rows: FormRow[], playerIds: string[], n: number): FormByPlayer {
  const out: FormByPlayer = {};
  for (const id of playerIds) out[id] = [];
  const sorted = [...rows].sort((a, b) => ts(when(b)) - ts(when(a)) || a.id.localeCompare(b.id));
  for (const r of sorted) {
    const status = (r.status ?? "").toLowerCase();
    if (!DECIDED.includes(status)) continue;
    if (r.winner_side !== 1 && r.winner_side !== 2) continue;
    if (BYE_RE.test(r.team1_label ?? "") || BYE_RE.test(r.team2_label ?? "")) continue;
    const side1 = [r.player1_id, r.player3_id];
    const side2 = [r.player2_id, r.player4_id];
    const disc = disciplineOf(r.category, r.match_code) ?? r.category ?? "";
    const eventLabel = [disc, r.round_name].filter(Boolean).join(" · ");
    for (const id of playerIds) {
      const list = out[id];
      if (list.length >= n) continue;
      const mySide = side1.includes(id) ? 1 : side2.includes(id) ? 2 : 0;
      if (!mySide) continue;
      list.push({
        matchId: r.id,
        tournamentId: r.tournament_id,
        result: r.winner_side === mySide ? "W" : "L",
        walkover: status === "walkover",
        opponentLabel: ((mySide === 1 ? r.team2_label : r.team1_label) ?? "").trim() || "Opponent",
        eventLabel,
        date: when(r),
      });
    }
  }
  return out;
}

export async function fetchRecentForm(playerIds: string[], n = 5): Promise<FormByPlayer> {
  const ids = Array.from(new Set(playerIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const list = ids.join(",");
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(FORM_COLUMNS)
    .in("status", DECIDED)
    .or(`player1_id.in.(${list}),player2_id.in.(${list}),player3_id.in.(${list}),player4_id.in.(${list})`)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(200, 25 * ids.length));
  if (error) throw error;
  return computeForm((data ?? []) as unknown as FormRow[], ids, n);
}
