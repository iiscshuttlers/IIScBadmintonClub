/**
 * Fallback-form import: skip anyone already entered in the category (same
 * player, same e-mail, or same phone by its last 10 digits). The rest are
 * imported; the conflict trigger reports any shared player to the host.
 */
export interface ImportEntry {
  playerId: string | null;
  partnerId: string | null;
  email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
}

export interface KnownPlayer {
  id: string;
  email?: string | null;
  iisc_email?: string | null;
  contact_number?: string | null;
}

export function last10(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

export function dedupeImport<T extends ImportEntry>(
  entries: T[],
  entered: { player_id: string | null; partner_id: string | null }[],
  players: KnownPlayer[],
): { keep: T[]; skipped: T[] } {
  const ids = new Set(entered.flatMap((r) => [r.player_id, r.partner_id]).filter((x): x is string => !!x));
  const known = players.filter((p) => ids.has(p.id));
  const emails = new Set(known.flatMap((p) => [p.email, p.iisc_email]).filter((x): x is string => !!x).map((e) => e.toLowerCase()));
  const phones = new Set(known.map((p) => last10(p.contact_number)).filter((x): x is string => !!x));
  const keep: T[] = [];
  const skipped: T[] = [];
  for (const e of entries) {
    const dup =
      (!!e.playerId && ids.has(e.playerId)) ||
      (!!e.partnerId && ids.has(e.partnerId)) ||
      (!!e.email && emails.has(e.email.toLowerCase())) ||
      [e.phone1, e.phone2].some((p) => { const k = last10(p); return !!k && phones.has(k); });
    (dup ? skipped : keep).push(e);
  }
  return { keep, skipped };
}
