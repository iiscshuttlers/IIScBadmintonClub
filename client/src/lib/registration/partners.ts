/**
 * Partner rules for in-app registration (pure; SQL twin in
 * save_my_tournament_entries / request_partner, migration 20261123150100).
 *
 * - A pair is one participant row: playerId + partnerId. Both members have
 *   equal rights on it.
 * - Taken = the player is in another row of that category (either column) or
 *   on that category's waitlist.
 * - B picks C:
 *     C free                 -> B's row gets C as partner ("free")
 *     C entered alone        -> B joins C's row; B's own solo row is removed ("join_alone")
 *     C in a pair with A     -> refused: "C is already entered with A" ("taken"), B may Ask C
 *     C already with B       -> nothing new ("already_pair")
 * - Whoever B was paired with before is "left behind": they stay entered alone.
 */
import { disciplineOf } from "@/lib/matchView";

export interface EntryRow {
  id: string;
  category: string;
  playerId: string | null;
  partnerId: string | null;
  lookingForPartner?: boolean;
}

export interface WaitlistRow {
  id: string;
  category: string;
  playerId: string;
  partnerId: string | null;
}

export type TakenResult =
  | { kind: "free" }
  | { kind: "entry"; row: EntryRow; withPlayerId: string | null }
  | { kind: "waitlist"; row: WaitlistRow };

/** True for MD / WD / XD and categories whose label says doubles or mixed. */
export function isDoublesCategory(category: string | null | undefined): boolean {
  const d = disciplineOf(category ?? "");
  if (d) return d === "MD" || d === "WD" || d === "XD";
  return /doubles|mixed/i.test(category ?? "");
}

export function rowHas(row: { playerId: string | null; partnerId: string | null }, playerId: string): boolean {
  return row.playerId === playerId || row.partnerId === playerId;
}

/** The other member of a row, from one member's point of view. */
export function otherMember(row: { playerId: string | null; partnerId: string | null }, playerId: string): string | null {
  if (row.playerId === playerId) return row.partnerId;
  if (row.partnerId === playerId) return row.playerId;
  return null;
}

export function findTaken(
  rows: EntryRow[],
  waitlist: WaitlistRow[],
  category: string,
  playerId: string,
  excludeRowIds: string[] = [],
): TakenResult {
  const row = rows.find((r) => r.category === category && !excludeRowIds.includes(r.id) && rowHas(r, playerId));
  if (row) return { kind: "entry", row, withPlayerId: otherMember(row, playerId) };
  const w = waitlist.find((r) => r.category === category && rowHas(r, playerId));
  if (w) return { kind: "waitlist", row: w };
  return { kind: "free" };
}

export type PickOutcome =
  | { kind: "self" }
  | { kind: "already_pair"; rowId: string }
  | { kind: "free"; myRowId: string | null; leftBehind: string | null }
  | { kind: "join_alone"; targetRowId: string; removeMyRowId: string | null; leftBehind: string | null }
  | { kind: "taken"; rowId: string; withPlayerId: string }
  | { kind: "waitlisted"; rowId: string };

/** What happens when `me` picks `partner` in `category`. */
export function pickPartner(
  rows: EntryRow[],
  waitlist: WaitlistRow[],
  category: string,
  me: string,
  partner: string,
): PickOutcome {
  if (me === partner) return { kind: "self" };
  const mine = rows.find((r) => r.category === category && rowHas(r, me)) ?? null;
  if (mine && rowHas(mine, partner)) return { kind: "already_pair", rowId: mine.id };

  const myOld = mine ? otherMember(mine, me) : null;
  const theirs = findTaken(rows, waitlist, category, partner, mine ? [mine.id] : []);

  if (theirs.kind === "waitlist") return { kind: "waitlisted", rowId: theirs.row.id };
  if (theirs.kind === "entry") {
    if (theirs.withPlayerId) return { kind: "taken", rowId: theirs.row.id, withPlayerId: theirs.withPlayerId };
    // Partner entered alone: join their row.
    return {
      kind: "join_alone",
      targetRowId: theirs.row.id,
      removeMyRowId: mine && !myOld ? mine.id : null,
      leftBehind: myOld,
    };
  }
  return { kind: "free", myRowId: mine?.id ?? null, leftBehind: myOld };
}

/**
 * Column swap: when the stored partner acts on a row (changes partner), the
 * columns swap so the caller becomes playerId.
 */
export function swapForCaller<T extends { playerId: string | null; partnerId: string | null }>(row: T, callerId: string): T {
  if (row.partnerId === callerId) return { ...row, playerId: callerId, partnerId: row.playerId };
  return row;
}

export type Gender = "Male" | "Female" | null | undefined;
export type GenderCheck = "ok" | "mismatch" | "unknown";

/**
 * MD = two Male, WD = two Female, XD = one each. NULL = unknown: allowed, but
 * flagged. Skipped with ignoreGenderRules and for singles.
 */
export function genderCheck(
  category: string,
  a: Gender,
  b: Gender,
  ignoreGenderRules = false,
): GenderCheck {
  if (ignoreGenderRules) return "ok";
  const d = disciplineOf(category);
  if (d !== "MD" && d !== "WD" && d !== "XD") return "ok";
  // `b === undefined` means "no partner yet": only the entrant is checked.
  const present: Gender[] = b === undefined ? [a] : [a, b];
  const known = present.filter((g): g is "Male" | "Female" => g === "Male" || g === "Female");
  const bad =
    (d === "MD" && known.some((g) => g !== "Male")) ||
    (d === "WD" && known.some((g) => g !== "Female")) ||
    (d === "XD" && known.length === 2 && known[0] === known[1]);
  if (bad) return "mismatch";
  if (known.length < present.length) return "unknown";
  return "ok";
}

/** display_name exactly like addParticipant: "P1 & P2", singles = name. */
export function pairDisplayName(p1: string | null | undefined, p2: string | null | undefined): string {
  const a = (p1 ?? "").trim();
  const b = (p2 ?? "").trim();
  if (a && b) return `${a} & ${b}`;
  return a || b;
}
