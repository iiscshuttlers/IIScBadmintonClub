import type { Tables } from "@/lib/supabase-types-auto";

type FeedingTie = Pick<Tables<"tournament_ties">, "id" | "tie_code" | "advances_to_tie" | "advances_to_slot" | "loser_advances_to_tie" | "loser_advances_to_slot">;

/**
 * Labels for knockout sides that have no team yet, from the ties that feed
 * them: "Winner of SF1" / "Loser of SF2" (tournament_ties stores the links,
 * not the labels). Keyed by tie id, then side "A" or "B".
 */
export function feederLabels(
  ties: ReadonlyArray<FeedingTie>,
): Map<string, { A?: string; B?: string }> {
  const labels = new Map<string, { A?: string; B?: string }>();
  const put = (tieId: string | null, slot: string | null, label: string) => {
    if (!tieId || (slot !== 'A' && slot !== 'B')) return;
    const entry = labels.get(tieId) ?? {};
    if (!entry[slot]) entry[slot] = label;
    labels.set(tieId, entry);
  };
  for (const t of ties) {
    put(t.advances_to_tie, t.advances_to_slot, `Winner of ${t.tie_code}`);
    put(t.loser_advances_to_tie, t.loser_advances_to_slot, `Loser of ${t.tie_code}`);
  }
  return labels;
}
