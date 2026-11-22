/**
 * Doubles pairs in a head-to-head: two men (MD), two women (WD) or one of
 * each (XD), and both pairs in one comparison must be the same kind. The
 * first (left) pair sets the kind; the other pair's pickers only offer
 * players who fit it. A player whose gender isn't recorded fits any slot,
 * so nobody disappears from the pickers for missing data.
 */

export type PairKind = "MD" | "WD" | "XD";
export type Gender = "male" | "female" | null;

const KINDS: readonly PairKind[] = ["MD", "WD", "XD"];
const SLOTS: Record<PairKind, { male: number; female: number }> = {
  MD: { male: 2, female: 0 },
  WD: { male: 0, female: 2 },
  XD: { male: 1, female: 1 },
};

export const PAIR_KIND_LABELS: Record<PairKind, string> = {
  MD: "Men's doubles",
  WD: "Women's doubles",
  XD: "Mixed doubles",
};

/** What the other pair has to be, as a short instruction. */
export const PAIR_KIND_NEEDS: Record<PairKind, string> = {
  MD: "two men",
  WD: "two women",
  XD: "a man and a woman",
};

export function genderOf(player: { gender?: string | null } | null | undefined): Gender {
  const g = (player?.gender ?? "").trim().toLowerCase();
  if (g === "male" || g === "m") return "male";
  if (g === "female" || g === "f") return "female";
  return null;
}

/** Whether these players (one pair, so at most two) can make up a `kind` pair. */
export function fitsKind(kind: PairKind, genders: readonly Gender[]): boolean {
  if (genders.length > 2) return false;
  const males = genders.filter((g) => g === "male").length;
  const females = genders.filter((g) => g === "female").length;
  return males <= SLOTS[kind].male && females <= SLOTS[kind].female;
}

/** The kinds both pairs can still be, given the players picked so far. */
export function possibleKinds(a: readonly Gender[], b: readonly Gender[]): PairKind[] {
  return KINDS.filter((k) => fitsKind(k, a) && fitsKind(k, b));
}

/** The one kind left for the two pairs, or null while it's still open. */
export function settledKind(a: readonly Gender[], b: readonly Gender[]): PairKind | null {
  const kinds = possibleKinds(a, b);
  return kinds.length === 1 ? kinds[0] : null;
}

/**
 * The second pair's picks that no longer fit the first pair: "player" (drop
 * both, as a new player means a new pair), "partner", or null when all fit.
 */
export function misfitOnSecondSide(
  first: readonly Gender[],
  secondPlayer: Gender | undefined,
  secondPartner: Gender | undefined,
): "player" | "partner" | null {
  if (secondPlayer !== undefined && possibleKinds(first, [secondPlayer]).length === 0) return "player";
  const second = [secondPlayer, secondPartner].filter((g): g is Gender => g !== undefined);
  if (secondPartner !== undefined && possibleKinds(first, second).length === 0) return "partner";
  return null;
}
