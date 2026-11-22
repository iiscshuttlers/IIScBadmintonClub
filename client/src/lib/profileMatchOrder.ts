import { matchState } from "@/lib/matchView";

type StateInput = Parameters<typeof matchState>[0];

type Orderable = { [K in keyof StateInput]?: StateInput[K] | null } & {
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
};

/** live → upcoming → finished → anything else (cancelled, unknown). */
function phaseOf(m: Orderable): number {
  const row = { status: m.status ?? null, scheduled_at: m.scheduled_at ?? null, court_number: m.court_number ?? null } as StateInput;
  switch (matchState(row)) {
    case "live":
      return 0;
    case "scheduled":
    case "unscheduled":
      return 1;
    case "completed":
    case "walkover":
      return 2;
    default:
      return 3;
  }
}

const ms = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : t;
};

/** When it finished (or would have been played), for latest-first ordering. */
const finishedAt = (m: Orderable) => ms(m.ended_at) ?? ms(m.scheduled_at) ?? ms(m.created_at) ?? 0;

/**
 * Orders a player's matches for the profile Matches list: grouped by format
 * (in `formatOrder`), and within a format live first, then upcoming (soonest
 * first, unscheduled last), then finished (latest first).
 */
export function orderProfileMatches<M extends Orderable>(
  matches: readonly M[],
  formatOf: (m: M) => string,
  formatOrder: readonly string[],
): M[] {
  const formatRank = (m: M) => {
    const i = formatOrder.indexOf(formatOf(m));
    return i === -1 ? formatOrder.length : i;
  };
  const byTime = (a: M, b: M, phase: number) => {
    if (phase === 2) return finishedAt(b) - finishedAt(a);
    const ta = (phase === 0 ? ms(a.started_at) : null) ?? ms(a.scheduled_at) ?? Infinity;
    const tb = (phase === 0 ? ms(b.started_at) : null) ?? ms(b.scheduled_at) ?? Infinity;
    return ta === tb ? 0 : ta < tb ? -1 : 1;
  };
  return [...matches].sort((a, b) => {
    const f = formatRank(a) - formatRank(b);
    if (f) return f;
    const pa = phaseOf(a);
    const p = pa - phaseOf(b);
    if (p) return p;
    return byTime(a, b, pa);
  });
}
