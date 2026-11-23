/**
 * Warnings before "Make draw" (in-app registration): shared partners,
 * doubles entries without a partner, and seeds that are only sign-up order.
 */
import { entriesNeedingAttention } from "./attention";
import type { EntryRow } from "./partners";

export interface DrawRow {
  id: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  seed?: number | null;
  created_at?: string | null;
}

/** Seeds equal to sign-up order (1, 2, 3… by created_at) were never set by hand. */
export function seedsAreSignUpOrder(rows: DrawRow[]): boolean {
  if (rows.length < 2) return false;
  const byTime = [...rows].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return byTime.every((r, i) => r.seed === i + 1);
}

export function makeDrawWarnings(rows: DrawRow[], categories: string[], opts: { flagOn: boolean }): string[] {
  if (!opts.flagOn) return [];
  const out: string[] = [];
  const entryRows: EntryRow[] = rows.map((r) => ({ id: r.id, category: r.category, playerId: r.player_id, partnerId: r.partner_id }));
  for (const cat of categories) {
    const att = entriesNeedingAttention(entryRows, {}, { category: cat, ignoreGenderRules: true });
    if (att.sharedPartner.length) out.push(`${cat}: ${att.sharedPartner.length} player(s) are in two pairs.`);
    if (att.noPartner.length) out.push(`${cat}: ${att.noPartner.length} doubles entr${att.noPartner.length === 1 ? "y has" : "ies have"} no partner.`);
    if (seedsAreSignUpOrder(rows.filter((r) => r.category === cat))) out.push(`${cat}: seeds are in sign-up order; set seeds first.`);
  }
  return out;
}
