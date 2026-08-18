import { supabase } from "@/lib/supabase";
import { generateSingleElimBracket } from "@/lib/bracketGenerator";

/**
 * Re-derives Round 1 bracket placements from the current participants list and
 * writes the refreshed names/ids onto `tournament_matches`.
 *
 * Bracket rows carry denormalized copies of the team composition
 * (`player1_id` / `player3_id` / `team1_label`, and the team 2 equivalents), so
 * editing `tournament_participants` alone never reaches the bracket, the
 * umpire panel, or anything else reading match rows. This closes that gap.
 *
 * `onlyScheduled` is the safety valve. Automatic callers pass `true` so a late
 * partner edit can never rewrite a match that has already started or finished;
 * the explicit admin "Sync Names" button passes `false` to sweep everything.
 */
export type SyncBracketNamesOptions = {
  tournamentId: string;
  category: string;
  /** When true, only rows still in `scheduled` status are touched. */
  onlyScheduled: boolean;
  /** Fallback name lookup for participants with no display_name. */
  resolvePlayerName?: (playerId: string | null) => string | undefined;
};

export type SyncBracketNamesResult = {
  updated: number;
  /** True when the participant set can't form a valid draw — nothing was written. */
  invalidDraw: boolean;
};

export async function syncBracketNames({
  tournamentId,
  category,
  onlyScheduled,
  resolvePlayerName,
}: SyncBracketNamesOptions): Promise<SyncBracketNamesResult> {
  const { data: pData, error: pErr } = await supabase
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("category", category);

  if (pErr) throw new Error(pErr.message);

  const parts = (pData as any[]) ?? [];
  const mapped = parts.map((p) => ({
    playerId: p.player_id,
    partnerId: p.partner_id,
    displayName: p.display_name ?? resolvePlayerName?.(p.player_id) ?? "Unknown",
    seed: p.seed ?? 99,
    entryRound: p.entry_round,
  }));

  const newRows = generateSingleElimBracket(mapped, category, tournamentId, false);
  if (!newRows.length) return { updated: 0, invalidDraw: true };

  let updated = 0;
  for (const row of newRows) {
    // Only sync real placements — never overwrite "Winner of ..." placeholders,
    // which are owned by the advancement logic rather than the participant list.
    const isT1Initial =
      row.team1_label !== "TBD" &&
      !row.team1_label.startsWith("Winner of") &&
      !row.team1_label.startsWith("Loser of");
    const isT2Initial =
      row.team2_label !== "TBD" &&
      !row.team2_label.startsWith("Winner of") &&
      !row.team2_label.startsWith("Loser of");

    if (!isT1Initial && !isT2Initial) continue;

    const updatePayload: {
      player1_id?: string | null;
      player3_id?: string | null;
      team1_label?: string | null;
      player2_id?: string | null;
      player4_id?: string | null;
      team2_label?: string | null;
    } = {};
    if (isT1Initial) {
      updatePayload.player1_id = row.player1_id;
      updatePayload.team1_label = row.team1_label;
      updatePayload.player3_id = row.player3_id;
    }
    if (isT2Initial) {
      updatePayload.player2_id = row.player2_id;
      updatePayload.team2_label = row.team2_label;
      updatePayload.player4_id = row.player4_id;
    }

    let query = supabase
      .from("tournament_matches")
      .update(updatePayload)
      .eq("tournament_id", tournamentId)
      .eq("match_code", row.match_code);

    if (onlyScheduled) query = query.eq("status", "scheduled");

    const { error } = await query;
    if (!error) updated++;
  }

  return { updated, invalidDraw: false };
}
