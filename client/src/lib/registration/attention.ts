/**
 * Who needs the organiser's attention (pure; SQL twin
 * `public.registration_attention(p_tournament_id)`, migration 20261123150200).
 *
 * Feeds the organiser filters, the manual reminder, the 24 h reminder, the
 * evening summary, the Make-draw warning and the duplicate alert.
 */
import { genderCheck, isDoublesCategory, otherMember, type EntryRow, type Gender } from "./partners";

export interface AttentionPlayer {
  id: string;
  isGuest?: boolean | null;
  gender?: Gender;
}

export interface NoPartnerItem { rowId: string; category: string; playerId: string; lookingForPartner: boolean }
export interface SharedPartnerItem {
  category: string;
  /** The player who is in two or more rows. */
  sharedPlayerId: string;
  rowIds: string[];
  /** The other member of each of those rows (same order as rowIds). */
  otherPlayerIds: (string | null)[];
}
export interface RowItem { rowId: string; category: string }
export interface PartnerNotOnAppItem extends RowItem { partnerId: string }
export interface GenderUnknownItem extends RowItem { playerIds: string[] }

export interface Attention {
  noPartner: NoPartnerItem[];
  sharedPartner: SharedPartnerItem[];
  partnerNotOnApp: PartnerNotOnAppItem[];
  genderMismatch: RowItem[];
  genderUnknown: GenderUnknownItem[];
}

export function entriesNeedingAttention(
  rows: EntryRow[],
  players: Record<string, AttentionPlayer>,
  opts: { ignoreGenderRules?: boolean; category?: string | null } = {},
): Attention {
  const scoped = opts.category ? rows.filter((r) => r.category === opts.category) : rows;
  const out: Attention = { noPartner: [], sharedPartner: [], partnerNotOnApp: [], genderMismatch: [], genderUnknown: [] };

  for (const r of scoped) {
    if (!isDoublesCategory(r.category) || !r.playerId) continue;
    if (!r.partnerId) {
      out.noPartner.push({ rowId: r.id, category: r.category, playerId: r.playerId, lookingForPartner: !!r.lookingForPartner });
    } else if (players[r.partnerId]?.isGuest) {
      out.partnerNotOnApp.push({ rowId: r.id, category: r.category, partnerId: r.partnerId });
    }
    const g1 = players[r.playerId]?.gender ?? null;
    const g2 = r.partnerId ? players[r.partnerId]?.gender ?? null : undefined;
    const check = genderCheck(r.category, g1, g2, opts.ignoreGenderRules);
    if (check === "mismatch") out.genderMismatch.push({ rowId: r.id, category: r.category });
    else if (check === "unknown") {
      const ids = [r.playerId, r.partnerId].filter((id): id is string => !!id && !players[id]?.gender);
      out.genderUnknown.push({ rowId: r.id, category: r.category, playerIds: ids });
    }
  }

  // Shared partner: a player in two or more rows of one category.
  const byKey = new Map<string, EntryRow[]>();
  for (const r of scoped) {
    for (const id of [r.playerId, r.partnerId]) {
      if (!id) continue;
      const key = `${r.category}\u0000${id}`;
      const list = byKey.get(key) ?? [];
      if (!list.includes(r)) list.push(r);
      byKey.set(key, list);
    }
  }
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const [category, sharedPlayerId] = key.split("\u0000");
    out.sharedPartner.push({
      category,
      sharedPlayerId,
      rowIds: list.map((r) => r.id),
      otherPlayerIds: list.map((r) => otherMember(r, sharedPlayerId)),
    });
  }
  out.sharedPartner.sort((a, b) => a.category.localeCompare(b.category) || a.sharedPlayerId.localeCompare(b.sharedPlayerId));
  return out;
}

/** Players a "no partner" / "shared partner" reminder would reach. */
export function reminderAudience(att: Attention, kind: "no_partner" | "shared_partner" | "all_incomplete"): string[] {
  const ids = new Set<string>();
  if (kind !== "shared_partner") att.noPartner.forEach((n) => ids.add(n.playerId));
  if (kind !== "no_partner") {
    for (const s of att.sharedPartner) {
      ids.add(s.sharedPlayerId);
      s.otherPlayerIds.forEach((o) => o && ids.add(o));
    }
  }
  return [...ids];
}
