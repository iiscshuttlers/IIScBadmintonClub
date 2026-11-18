/**
 * Knockout round ordering for result lists: Final first, then 3rd place,
 * Semi-finals, Quarter-finals, Round of 16, … down to the first round.
 *
 * Round numbers alone can't do this across events: round 4 is the Final of a
 * 16-player draw but the Round of 32 in a 128-player draw. So the stage comes
 * from the round name when it says which stage it is, and otherwise from how
 * far the round sits below the last round of its own event.
 *
 * Bracket trees (left → right) keep ascending order; this is for lists.
 */

export interface RoundStage {
  /** 0 = Final, 0.5 = 3rd place, 1 = Semi-finals, 2 = Quarter-finals, 3 = R16 … */
  rank: number;
  /** Stable grouping key. */
  key: string;
  /** Section heading, e.g. "Semi-finals". */
  label: string;
  /** Chip label, e.g. "SF". */
  short: string;
}

interface RoundLike {
  round?: number | null;
  round_name?: string | null;
  roundName?: string | null;
}

const THIRD_RE = /3rd|third|bronze/i;
const FINAL_RE = /^\s*(grand\s+)?finals?\s*$/i;
const SEMI_RE = /semi/i;
const QUARTER_RE = /quarter/i;
const ROUND_OF_RE = /round\s+of\s+(\d+)/i;

function named(rank: number, key: string, label: string, short: string): RoundStage {
  return { rank, key, label, short };
}

function roundOfStage(n: number): RoundStage | null {
  if (!Number.isFinite(n) || n < 2) return null;
  if (n === 2) return named(0, "final", "Final", "Final");
  if (n === 4) return named(1, "sf", "Semi-finals", "SF");
  if (n === 8) return named(2, "qf", "Quarter-finals", "QF");
  return named(Math.log2(n) - 1, `r${n}`, `Round of ${n}`, `R${n}`);
}

/**
 * Stage of one match. `lastRound` is the highest round number in the match's
 * own event; it is only used when the round name doesn't name a stage.
 */
export function stageOf(m: RoundLike, lastRound?: number | null): RoundStage {
  const name = (m.round_name ?? m.roundName ?? "").trim();
  if (THIRD_RE.test(name)) return named(0.5, "3rd", "3rd place", "3rd");
  if (FINAL_RE.test(name)) return named(0, "final", "Final", "Final");
  if (SEMI_RE.test(name)) return named(1, "sf", "Semi-finals", "SF");
  if (QUARTER_RE.test(name)) return named(2, "qf", "Quarter-finals", "QF");
  const roundOf = ROUND_OF_RE.exec(name);
  if (roundOf) {
    const s = roundOfStage(Number(roundOf[1]));
    if (s) return s;
  }
  // Unnamed or non-knockout rounds ("Round 1", "Group A"): order by distance
  // from the event's last round, and keep the organiser's name as the label.
  const round = m.round ?? 0;
  const fromLast = lastRound != null && lastRound >= round ? lastRound - round : 0;
  const label = name || `Round ${round}`;
  return named(fromLast, `n:${label.toLowerCase()}`, label, label.replace(/^round\s+/i, "R"));
}

/** Highest round number per event key. */
export function lastRoundByEvent<T extends RoundLike>(items: T[], eventOf: (m: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of items) {
    const ev = eventOf(m);
    const r = m.round ?? 0;
    if (r > (out.get(ev) ?? Number.NEGATIVE_INFINITY)) out.set(ev, r);
  }
  return out;
}

export interface StageGroup<T> {
  stage: RoundStage;
  items: T[];
}

/**
 * Groups matches by stage, Final first. Inside a stage the input order is
 * kept, so callers sort items (event, match number) beforehand.
 */
export function groupByStageDesc<T extends RoundLike>(items: T[], eventOf: (m: T) => string): StageGroup<T>[] {
  const last = lastRoundByEvent(items, eventOf);
  const groups = new Map<string, StageGroup<T>>();
  for (const m of items) {
    const stage = stageOf(m, last.get(eventOf(m)));
    let g = groups.get(stage.key);
    if (!g) {
      g = { stage, items: [] };
      groups.set(stage.key, g);
    } else if (stage.rank < g.stage.rank) {
      // Same named stage reached from different events: keep the earliest rank.
      g.stage = stage;
    }
    g.items.push(m);
  }
  return Array.from(groups.values()).sort((a, b) => a.stage.rank - b.stage.rank);
}

/**
 * Comparator for one event's round numbers, latest round first. Use when a
 * list groups a single category by `round` (all rounds share one draw).
 */
export function compareRoundDesc(a: number, b: number): number {
  return b - a;
}
