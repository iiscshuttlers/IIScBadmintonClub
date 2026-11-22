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
 * The label name belonging to the missing teammate of `known`, who sits at
 * `knownAt` in the label ("player & partner": the player is 0, the partner 1).
 *
 * A label with a single name has no teammate in it: it is the known player's
 * own entry name, which can differ from the profile name (a singles entry
 * "Piyush Tiwary Lalit Kumar" for player "Piyush Tiwary", or a team name).
 * Treating it as a partner showed singles players as a pair.
 */
function missingTeammate(known: any, parts: string[], knownAt: 0 | 1): string | null {
  if (parts.length < 2) return null;
  const knownName = String(known.full_name ?? "").trim().toLowerCase();
  const mine = parts.findIndex((p) => p.toLowerCase() === knownName);
  if (mine >= 0) return parts.find((_, i) => i !== mine) ?? null;
  // The known player's name is spelled differently in the label: go by position.
  return parts[knownAt === 0 ? 1 : 0] ?? null;
}

/**
 * The members of one team, preferring real player records and falling back to
 * the label for anyone missing.
 *
 * - both linked                  -> [primary, partner]
 * - primary linked, partner not  -> [primary, <the other name in the label>],
 *                                   or [primary] when the label has one name
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
    const other = missingTeammate(primary, parts, 0);
    return other ? [primary, fromName(other)] : [primary];
  }

  if (partner) {
    const other = missingTeammate(partner, parts, 1);
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
