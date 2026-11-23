/**
 * Pure layout and search logic for BracketVisual: which slot each match sits
 * in, where the connector lines go, which rounds start hidden, and how a
 * player's path through the draw is traced. Kept free of React so it can be
 * tested directly (a wrong slot here puts a player in the wrong half of the
 * printed draw).
 */
import { matchOutcome } from "@/lib/matchView";
import type { BracketMatch } from "./BracketVisual";

export const MATCH_W = 180;
// A match box holds a header plus two player rows. MATCH_H was hardcoded to 90
// with no relationship to the row height it has to contain, so on mobile
// (20 + 44 + 44 = 108) the second player's name was sliced in half by the
// box's overflow-hidden. Derived from the same numbers so they cannot drift.
export const HEADER_H = 20;
export const PLAYER_ROW_H_MOBILE = 44; // >=44 keeps the mobile touch target usable
export const PLAYER_ROW_H_DESKTOP = 36;
// Sized for the taller (mobile) case; the box is vertically centred, so desktop
// simply gets a little extra breathing room rather than clipping.
export const MATCH_H = HEADER_H + PLAYER_ROW_H_MOBILE * 2;
export const COL_GAP = 40;
export const COL_W = MATCH_W + COL_GAP;
export const PADDING = 16;
export const LABEL_H = 26;
/** Height of one first-round slot. */
export const SLOT_H = Math.max(MATCH_H + 20, 90);

/** Short round name for the "From" picker: Round of 16 → R16, Quarterfinal → QF. */
export function shortRoundName(name: string | null | undefined, round: number): string {
  const n = (name ?? "").toLowerCase();
  const of = n.match(/round of (\d+)/);
  if (of) return `R${of[1]}`;
  if (n.includes("quarter")) return "QF";
  if (n.includes("semi")) return "SF";
  if (n.includes("final")) return "Final";
  return name?.trim() || `Round ${round}`;
}

/**
 * Typo-tolerant substring test for the "Find player" box. Exact substrings
 * always match; terms of 4+ characters may differ in 1 character (2 from 6+).
 */
export function fuzzyMatch(term: string, target: string | null | undefined): boolean {
  if (!target) return false;
  const t = term.toLowerCase();
  const tgt = target.toLowerCase();
  if (tgt.includes(t)) return true;

  if (t.length < 4) return false; // Require at least 4 chars for fuzzy matching

  const maxDiff = t.length >= 6 ? 2 : 1;

  for (let i = 0; i <= tgt.length - t.length; i++) {
    const sub = tgt.substring(i, i + t.length);
    let diff = 0;
    for (let j = 0; j < t.length; j++) {
      if (t[j] !== sub[j]) {
        diff++;
        if (diff > maxDiff) break;
      }
    }
    if (diff <= maxDiff) return true;
  }
  return false;
}

/**
 * The 3rd place playoff shares a round number with the semifinal but sits
 * outside the knockout tree, so it must not take part in the slot layout.
 */
export const isPlayoffMatch = (m: Pick<BracketMatch, "match_number" | "round_name">): boolean =>
  m.match_number >= 99 || (m.round_name ?? "").toLowerCase().includes("3rd");

/**
 * Early rounds that start collapsed: a leading run of rounds with 16+ matches,
 * every one of them decided. Stops at the first round that doesn't qualify.
 */
export function initialHiddenRounds(matches: BracketMatch[], rounds: number[]): number[] {
  const toHide: number[] = [];
  for (const r of rounds) {
    const matchesInRound = matches.filter((m) => m.round === r);
    if (
      matchesInRound.length >= 16 &&
      matchesInRound.every((m) => matchOutcome(m).decided)
    ) {
      toHide.push(r);
    } else {
      break;
    }
  }
  return toHide;
}

/** First and last base slot (inclusive) shown for a bracket segment. */
export function segmentSlotRange(segment: string, baseSlots: number): { start: number; end: number } {
  let start = 0;
  let end = baseSlots - 1;

  if (segment === "top-half") { end = Math.floor(baseSlots / 2) - 1; }
  else if (segment === "bottom-half") { start = Math.floor(baseSlots / 2); }
  else if (segment === "q1") { end = Math.floor(baseSlots / 4) - 1; }
  else if (segment === "q2") { start = Math.floor(baseSlots / 4); end = Math.floor(baseSlots / 2) - 1; }
  else if (segment === "q3") { start = Math.floor(baseSlots / 2); end = Math.floor((baseSlots * 3) / 4) - 1; }
  else if (segment === "q4") { start = Math.floor((baseSlots * 3) / 4); }

  end = Math.max(start, end);
  return { start, end };
}

/** Segments that end at the bottom of the tree, so the playoff rows show. */
export const isBottomSegment = (segment: string): boolean =>
  segment === "full" || segment === "bottom-half" || segment === "q4";

export type BracketPos = { match: BracketMatch; y: number; cy: number };

export interface BracketRoundLayout {
  round: number;
  /** Column index among the visible rounds. */
  ri: number;
  /** Positions that fall inside the current segment's viewport. */
  positions: BracketPos[];
  /** Every position by slot (tree slot, or 9999 + i for playoffs). */
  bySlot: Map<number, BracketPos>;
  label: string;
}

export interface BracketLayout {
  roundData: BracketRoundLayout[];
  /** Slots in the first visible round. */
  baseSlots: number;
  totalW: number;
  totalH: number;
}

/**
 * Places every visible match on its structural slot.
 *
 * Matches are placed by their structural slot (match_number), never by array
 * index: a player with more than one bye leaves a match out of the draw
 * entirely, and indexing would then shift everything below the gap upwards.
 */
export function computeBracketLayout(
  matches: BracketMatch[],
  rounds: number[],
  visibleRounds: number[],
  segment: string,
): BracketLayout {
  const totalW = visibleRounds.length * COL_W;

  const roundShapes = visibleRounds.map((round, ri) => {
    const originalRi = rounds.indexOf(round);
    const inRound = matches.filter((m) => m.round === round);
    const tree = inRound.filter((m) => !isPlayoffMatch(m)).sort((a, b) => a.match_number - b.match_number);
    const slots = Math.max(
      Math.pow(2, rounds.length - 1 - originalRi),
      ...tree.map((m) => m.match_number),
      1
    );
    return { round, ri, tree, playoffs: inRound.filter(isPlayoffMatch), slots };
  });

  const baseSlots = roundShapes[0]?.slots ?? 1;
  const { start: viewStartSlot, end: viewEndSlot } = segmentSlotRange(segment, baseSlots);

  const pixelStart = viewStartSlot * SLOT_H;
  const pixelEnd = (viewEndSlot + 1) * SLOT_H;
  const viewH = pixelEnd - pixelStart;

  const treeH = baseSlots * SLOT_H;
  const playoffRows = Math.max(0, ...roundShapes.map((r) => r.playoffs.length));

  const totalH = viewH + (isBottomSegment(segment) ? playoffRows * SLOT_H : 0);

  const roundData = roundShapes.map(({ round, ri, tree, playoffs, slots }) => {
    const slotH = treeH / slots;
    const bySlot = new Map<number, BracketPos>();
    const positions: BracketPos[] = [];
    for (const m of tree) {
      const slot = Math.min(Math.max(m.match_number - 1, 0), slots - 1);
      const cy = slot * slotH + slotH / 2 - pixelStart;
      const pos = { match: m, y: cy - MATCH_H / 2, cy };
      bySlot.set(slot, pos);
      if (cy >= -MATCH_H && cy <= totalH + MATCH_H) {
        positions.push(pos);
      }
    }
    // Playoffs hang below the tree so they can't disturb its spacing.
    playoffs.forEach((m, i) => {
      const cy = treeH + SLOT_H / 2 + i * SLOT_H - pixelStart;
      const pos = { match: m, y: cy - MATCH_H / 2, cy };
      bySlot.set(9999 + i, pos);
      if (cy >= -MATCH_H && cy <= totalH + MATCH_H) {
        positions.push(pos);
      }
    });
    const label = tree[0]?.round_name ?? playoffs[0]?.round_name ?? `R${round}`;
    return { round, ri, positions, bySlot, label };
  });

  return { roundData, baseSlots, totalW, totalH };
}

export interface ConnectorLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * SVG connector lines — driven by the next round's slots, so a missing feeder
 * simply draws no stub instead of pulling the whole column out of alignment.
 * Slot s in the next round is fed by slots 2s and 2s + 1.
 */
export function bracketConnectors(roundData: Pick<BracketRoundLayout, "bySlot">[]): ConnectorLine[] {
  const lines: ConnectorLine[] = [];
  for (let ri = 0; ri < roundData.length - 1; ri++) {
    const cur = roundData[ri];
    const next = roundData[ri + 1];
    const x1 = ri * COL_W + MATCH_W;
    const xMid = x1 + COL_GAP / 2;
    const x2 = ri + 1 < roundData.length - 1 ? (ri + 1) * COL_W : xMid + COL_GAP / 2;
    for (const [slot, nm] of next.bySlot) {
      const c1 = cur.bySlot.get(slot * 2);
      const c2 = cur.bySlot.get(slot * 2 + 1);
      if (!c1 && !c2) continue;
      if (c1) lines.push({ key: `a-${ri}-${slot}`, x1, y1: c1.cy, x2: xMid, y2: c1.cy });
      if (c2) lines.push({ key: `b-${ri}-${slot}`, x1, y1: c2.cy, x2: xMid, y2: c2.cy });
      if (c1 && c2) lines.push({ key: `c-${ri}-${slot}`, x1: xMid, y1: c1.cy, x2: xMid, y2: c2.cy });
      lines.push({ key: `d-${ri}-${slot}`, x1: xMid, y1: nm.cy, x2, y2: nm.cy });
    }
  }
  return lines;
}

/** Lower-case, trimmed, single-spaced. */
function normName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The player names in a side label: "A & B", "A / B", "A, B" or "A and B". */
function sideNames(label: string): string[] {
  return normName(label)
    .split(/\s*(?:&|\/|,|\+|\band\b)\s*/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Whether a side label is the selected player or pair: whole names compared
 * case-insensitively, so "Amit" matches "Amit" and "Amit & Ravi" but not
 * "Amit Kumar", and a pair matches in either order.
 */
export function labelMatchesPlayer(label: string | null | undefined, player: string): boolean {
  const l = normName(label);
  const p = normName(player);
  if (!l || !p) return false;
  if (l === p) return true;
  const names = sideNames(l);
  const wanted = sideNames(p);
  return wanted.length > 0 && wanted.every((w) => names.includes(w));
}

/** Whether a match is the selected match code, or a slot fed by it ("Winner of <code>"). */
function matchesCodeSelection(m: BracketMatch, selection: string): boolean {
  const code = normName(selection);
  if (!code) return false;
  if (normName(m.match_code) === code) return true;
  const fedBy = (label: string | null | undefined) => {
    const ref = (label ?? "").match(/(?:Winner|Loser) of (\S+)/i);
    return !!ref && normName(ref[1]) === code;
  };
  return fedBy(m.team1_label) || fedBy(m.team2_label);
}

/** A match that names the selected player, pair or match code. */
function matchHasSelection(m: BracketMatch, selection: string): boolean {
  return (
    labelMatchesPlayer(m.team1_label, selection) ||
    labelMatchesPlayer(m.team2_label, selection) ||
    matchesCodeSelection(m, selection)
  );
}

/**
 * Matches highlighted for a selected player: every match whose side labels
 * name the player (whole names, case-insensitive) or that is the selected
 * match code or fed by it, plus matches that player won into.
 */
export function bracketPathIds(matches: BracketMatch[], selectedPlayer: string): Set<string> {
  const path = new Set<string>();
  matches.forEach((m) => {
    if (matchHasSelection(m, selectedPlayer)) path.add(m.id);
  });
  let changed = true;
  while (changed) {
    changed = false;
    matches.forEach((m) => {
      if (path.has(m.id)) return;
      const winner = m.winner_side === 1 ? m.team1_label : m.winner_side === 2 ? m.team2_label : null;
      if (labelMatchesPlayer(winner, selectedPlayer)) { path.add(m.id); changed = true; }
    });
  }
  return path;
}

export interface Roadmap {
  /** The player's matches plus every later match fed by them, by round. */
  roadmap: BracketMatch[];
  pathMatchIds: Set<string>;
  byCode: Map<string, BracketMatch>;
}

/**
 * A player's road through the draw: the matches they appear in, then every
 * match whose slot reads "Winner of <code>" for a match already on the road.
 */
export function playerRoadmap(matches: BracketMatch[], player: string): Roadmap {
  const byCode = new Map<string, BracketMatch>();
  matches.forEach((m) => byCode.set(m.match_code, m));

  // Seed path with matches where player appears directly
  const pathMatchIds = new Set<string>(
    matches.filter((m) => matchHasSelection(m, player)).map((m) => m.id)
  );

  // Trace forward via "Winner of <code>" references
  let changed = true;
  while (changed) {
    changed = false;
    matches.forEach((m) => {
      if (pathMatchIds.has(m.id)) return;
      const refs = (label: string) => {
        const ref = label.match(/Winner of (\S+)/i);
        if (!ref) return false;
        const refM = byCode.get(ref[1]);
        return !!refM && pathMatchIds.has(refM.id);
      };
      if (refs(m.team1_label ?? "") || refs(m.team2_label ?? "")) {
        pathMatchIds.add(m.id);
        changed = true;
      }
    });
  }

  const roadmap = matches
    .filter((m) => pathMatchIds.has(m.id))
    .sort((a, b) => a.round - b.round);

  return { roadmap, pathMatchIds, byCode };
}

export interface RoadmapCardSides {
  playerName: string;
  opponentName: string;
  /** The player (or the path slot that leads to them) is side 1. */
  effectivePlayerIsT1: boolean;
  playerWon: boolean;
  playerLost: boolean;
}

/** Which side of one roadmap card is the player's, and whether they won it. */
export function roadmapCardSides(m: BracketMatch, player: string, rm: Pick<Roadmap, "byCode" | "pathMatchIds">): RoadmapCardSides {
  const isCompleted = matchOutcome(m).decided;
  const t1 = m.team1_label ?? "TBD";
  const t2 = m.team2_label ?? "TBD";
  const playerIsT1 = labelMatchesPlayer(t1, player);
  const playerIsT2 = !playerIsT1 && labelMatchesPlayer(t2, player);

  const slotRefersToPath = (label: string) => {
    const ref = label.match(/Winner of (\S+)/i);
    if (!ref) return false;
    const refM = rm.byCode.get(ref[1]);
    return !!refM && rm.pathMatchIds.has(refM.id);
  };
  const pathIsT1 = !playerIsT1 && !playerIsT2 && slotRefersToPath(t1);
  const pathIsT2 = !playerIsT1 && !playerIsT2 && slotRefersToPath(t2);

  const playerName = playerIsT1 ? t1 : playerIsT2 ? t2 : pathIsT1 ? t1 : pathIsT2 ? t2 : player;
  const opponentName = playerIsT1 ? t2 : playerIsT2 ? t1 : pathIsT1 ? t2 : pathIsT2 ? t1 : "TBD";
  const effectivePlayerIsT1 = playerIsT1 || pathIsT1;

  const playerWon = isCompleted && ((effectivePlayerIsT1 && m.winner_side === 1) || (!effectivePlayerIsT1 && m.winner_side === 2));
  const playerLost = isCompleted && !playerWon;

  return { playerName, opponentName, effectivePlayerIsT1, playerWon, playerLost };
}

/**
 * Whether the player's road ends at `last` (it is decided and they did not
 * win it). Only meaningful when `last` is not the Final.
 */
export function isEliminatedAt(last: BracketMatch, player: string): boolean {
  return matchOutcome(last).decided && (() => {
    const t1 = last.team1_label ?? "";
    const t2 = last.team2_label ?? "";
    const playerIsT1 = labelMatchesPlayer(t1, player);
    return !((playerIsT1 && last.winner_side === 1) || (!playerIsT1 && last.winner_side === 2 && labelMatchesPlayer(t2, player)));
  })();
}

export interface BracketSearchHit {
  pos: BracketPos;
  /** Column index of the hit. */
  ri: number;
  /** The side label that matched, or null when only the match code did. */
  playerName: string | null;
}

/**
 * First card matching the search box: an exact substring of a side label or
 * match code wins (column by column, top to bottom); otherwise the first
 * fuzzy side-label match.
 */
export function findInBracket(roundData: Pick<BracketRoundLayout, "positions">[], value: string): BracketSearchHit | null {
  const lowerVal = value.toLowerCase();
  let foundPos: BracketPos | null = null;
  let foundRi = 0;
  let exactPlayerName: string | null = null;

  let fuzzyFoundPos: BracketPos | null = null;
  let fuzzyFoundRi = 0;
  let fuzzyExactPlayerName: string | null = null;

  for (let ri = 0; ri < roundData.length; ri++) {
    for (const pos of roundData[ri].positions) {
      const t1Match = pos.match.team1_label?.toLowerCase().includes(lowerVal);
      const t2Match = pos.match.team2_label?.toLowerCase().includes(lowerVal);
      const codeMatch = pos.match.match_code?.toLowerCase().includes(lowerVal);

      if (t1Match || t2Match || codeMatch) {
        foundPos = pos;
        foundRi = ri;
        if (t1Match) exactPlayerName = pos.match.team1_label;
        else if (t2Match) exactPlayerName = pos.match.team2_label;
        break;
      }

      if (!fuzzyFoundPos) {
        const f1 = fuzzyMatch(lowerVal, pos.match.team1_label);
        const f2 = fuzzyMatch(lowerVal, pos.match.team2_label);
        if (f1 || f2) {
          fuzzyFoundPos = pos;
          fuzzyFoundRi = ri;
          fuzzyExactPlayerName = f1 ? pos.match.team1_label : pos.match.team2_label;
        }
      }
    }
    if (foundPos) break;
  }

  if (!foundPos && fuzzyFoundPos) {
    foundPos = fuzzyFoundPos;
    foundRi = fuzzyFoundRi;
    exactPlayerName = fuzzyExactPlayerName;
  }

  return foundPos ? { pos: foundPos, ri: foundRi, playerName: exactPlayerName } : null;
}

/**
 * Zoom that fits the visible rounds to the container width. Hidden early
 * rounds don't count (they used to, which shrank a 4-round view to ~40%).
 * Never below a readable 70% — past that the draw scrolls sideways — and up
 * to 125% when there is room.
 */
export function fitScale(containerWidth: number, visibleCount: number): number {
  const contentW = visibleCount * COL_W + PADDING * 2;
  const fit = (containerWidth * 0.97) / contentW;
  return +Math.min(1.25, Math.max(0.7, fit)).toFixed(2);
}
