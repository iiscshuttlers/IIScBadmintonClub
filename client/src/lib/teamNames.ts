/**
 * Resolving who is on a team, when a partner may not exist as a player record.
 *
 * Tournament entries are frequently typed in by name, so `player3_id`/
 * `player4_id` stay NULL and the joined `partner1`/`partner2` rows come back
 * null. Every surface that rebuilt a team from those joins silently dropped the
 * unlinked partner — the umpire panel, the bracket, the feed card and the
 * scorecard all showed a doubles pair as a single player.
 *
 * `team1_label` / `team2_label` are the source of truth for who is playing
 * ("Bramha Dutt Vishwakarma & Sona Rajkumari"), so they are the fallback here.
 */

export type TeamMember = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  gender?: string;
  /** True when this member was reconstructed from the label, not a player row. */
  isUnlinked?: boolean;
};

/** Split a bracket label into its individual names. */
export function splitTeamLabel(label: string | null | undefined): string[] {
  return (label ?? "")
    .split(/\s*[&,]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fromName(name: string): TeamMember {
  return { id: `unlinked-${name}`, full_name: name, avatar_url: null, isUnlinked: true };
}

/**
 * The members of one team, preferring real player records and falling back to
 * the label for anyone missing.
 *
 * - both linked                  -> [primary, partner]
 * - primary linked, partner not  -> [primary, <the other name in the label>]
 * - neither linked               -> each name in the label, split apart
 */
export function resolveTeamMembers(
  primary: any | null | undefined,
  partner: any | null | undefined,
  label: string | null | undefined,
): TeamMember[] {
  const parts = splitTeamLabel(label);

  if (primary && partner) return [primary, partner];

  if (primary) {
    // Pick the label part that isn't the primary player, so nobody is repeated.
    const primaryName = String(primary.full_name ?? "").trim().toLowerCase();
    const other = parts.find((p) => p.toLowerCase() !== primaryName);
    return other ? [primary, fromName(other)] : [primary];
  }

  if (partner) {
    const partnerName = String(partner.full_name ?? "").trim().toLowerCase();
    const other = parts.find((p) => p.toLowerCase() !== partnerName);
    return other ? [fromName(other), partner] : [partner];
  }

  // Nothing linked — split the label rather than rendering "A & B" as one name.
  return parts.map(fromName);
}

/** One-line display name for a team, e.g. "A & B". */
export function resolveTeamName(
  primary: any | null | undefined,
  partner: any | null | undefined,
  label: string | null | undefined,
  fallback = "TBD",
): string {
  const names = resolveTeamMembers(primary, partner, label).map((m) => m.full_name).filter(Boolean);
  return names.length ? names.join(" & ") : (label || fallback);
}

/** Whether a team has two members once labels are taken into account. */
export function isTeamDoubles(
  primary: any | null | undefined,
  partner: any | null | undefined,
  label: string | null | undefined,
): boolean {
  return resolveTeamMembers(primary, partner, label).length > 1;
}
