/**
 * Organizer wrap-up report: pure aggregation over a tournament's matches.
 * Rendered by TournamentReportPanel; exported to CSV/PDF there.
 */

export interface ReportMatch {
  id: string;
  match_code?: string | null;
  category: string;
  round?: number | null;
  round_name?: string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
  status: string;
  score?: string | null;
  sets_history?: string[] | null;
  winner_side?: number | null;
  court_number?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  umpired_by?: string | null;
}

export interface CategoryResult {
  category: string;
  winner?: string;
  runnerUp?: string;
  third: string[];
  matches: number;
  players: number;
}

export interface Highlight {
  label: string;
  match: ReportMatch;
  detail: string;
}

export interface TournamentReport {
  totalMatches: number;
  completed: number;
  walkovers: number;
  remaining: number;
  players: number;
  categories: CategoryResult[];
  courtsUsed: string[];
  firstStart?: string;
  lastEnd?: string;
  avgMatchMins?: number;
  totalPoints: number;
  umpires: { id: string; matches: number }[];
  highlights: Highlight[];
}

const isBye = (l?: string | null) => !!l && /\bbye\b/i.test(l);
const DONE = new Set(["completed", "walkover"]);

/** Parse "21-19, 19-21" (or sets_history) into [[21,19],[19,21]]. */
export function parseGames(m: Pick<ReportMatch, "score" | "sets_history">): [number, number][] {
  const parts = m.sets_history?.length ? m.sets_history : (m.score ?? "").split(/[,;]/);
  const games: [number, number][] = [];
  for (const p of parts) {
    const mm = String(p).match(/(\d+)\s*[-–:]\s*(\d+)/);
    if (mm) games.push([Number(mm[1]), Number(mm[2])]);
  }
  return games;
}

export function matchDurationMins(m: ReportMatch): number | null {
  if (!m.started_at || !m.ended_at) return null;
  const mins = (Date.parse(m.ended_at) - Date.parse(m.started_at)) / 60_000;
  // Ignore obviously bogus spans (forgotten "end" taps, clock skew).
  return mins > 0 && mins < 240 ? mins : null;
}

const sideLabel = (m: ReportMatch, side: 1 | 2) => (side === 1 ? m.team1_label : m.team2_label) || "";

function podium(matches: ReportMatch[]) {
  const final = matches.find((m) => /^final$/i.test(m.round_name ?? "") && m.winner_side);
  const third = matches.find((m) => /3rd|third/i.test(m.round_name ?? "") && m.winner_side);
  const semis = matches.filter((m) => /semi/i.test(m.round_name ?? "") && m.winner_side);
  const res: Pick<CategoryResult, "winner" | "runnerUp" | "third"> = { third: [] };
  if (final) {
    res.winner = sideLabel(final, final.winner_side as 1 | 2);
    res.runnerUp = sideLabel(final, final.winner_side === 1 ? 2 : 1);
  }
  if (third) res.third = [sideLabel(third, third.winner_side as 1 | 2)];
  else res.third = semis.map((s) => sideLabel(s, s.winner_side === 1 ? 2 : 1)).filter(Boolean);
  return res;
}

const ids = (m: ReportMatch) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean) as string[];

export function computeReport(all: ReportMatch[]): TournamentReport {
  const matches = all.filter((m) => !isBye(m.team1_label) && !isBye(m.team2_label));
  const done = matches.filter((m) => DONE.has(m.status));
  const players = new Set(matches.flatMap(ids));

  const byCat = new Map<string, ReportMatch[]>();
  for (const m of matches) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m]);
  const categories: CategoryResult[] = Array.from(byCat.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({
      category,
      matches: list.length,
      players: new Set(list.flatMap(ids)).size,
      ...podium(list),
    }));

  const durations = done.map(matchDurationMins).filter((d): d is number => d != null);
  const starts = done.map((m) => m.started_at).filter(Boolean).sort() as string[];
  const ends = done.map((m) => m.ended_at).filter(Boolean).sort() as string[];

  const umpireCounts = new Map<string, number>();
  for (const m of done) if (m.umpired_by) umpireCounts.set(m.umpired_by, (umpireCounts.get(m.umpired_by) ?? 0) + 1);

  let totalPoints = 0;
  let longest: { m: ReportMatch; mins: number } | null = null;
  let closest: { m: ReportMatch; margin: number; games: number } | null = null;
  let biggest: { m: ReportMatch; points: number } | null = null;
  for (const m of done) {
    if (m.status !== "completed") continue;
    const games = parseGames(m);
    const pts = games.reduce((s, [a, b]) => s + a + b, 0);
    totalPoints += pts;
    const mins = matchDurationMins(m);
    if (mins != null && (!longest || mins > longest.mins)) longest = { m, mins };
    if (games.length) {
      const margin = Math.abs(games.reduce((s, [a, b]) => s + a - b, 0));
      // Prefer more games, then smaller point margin.
      if (!closest || games.length > closest.games || (games.length === closest.games && margin < closest.margin)) {
        closest = { m, margin, games: games.length };
      }
      if (!biggest || pts > biggest.points) biggest = { m, points: pts };
    }
  }

  const highlights: Highlight[] = [];
  if (longest) highlights.push({ label: "Longest match", match: longest.m, detail: `${Math.round(longest.mins)} min` });
  if (closest) highlights.push({ label: "Closest match", match: closest.m, detail: `${closest.games} games, ${closest.margin}-point margin` });
  if (biggest && biggest.m !== longest?.m) highlights.push({ label: "Most points", match: biggest.m, detail: `${biggest.points} points` });

  return {
    totalMatches: matches.length,
    completed: done.filter((m) => m.status === "completed").length,
    walkovers: done.filter((m) => m.status === "walkover").length,
    remaining: matches.length - done.length,
    players: players.size,
    categories,
    courtsUsed: Array.from(new Set(matches.map((m) => (m.court_number ?? "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    firstStart: starts[0],
    lastEnd: ends[ends.length - 1],
    avgMatchMins: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined,
    totalPoints,
    umpires: Array.from(umpireCounts.entries())
      .map(([id, n]) => ({ id, matches: n }))
      .sort((a, b) => b.matches - a.matches),
    highlights,
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection from player-entered labels.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function matchesToCsv(matches: ReportMatch[], umpireNames: Record<string, string> = {}): string {
  const header = [
    "Match", "Category", "Round", "Side 1", "Side 2", "Score", "Winner", "Status",
    "Court", "Scheduled", "Started", "Ended", "Duration (min)", "Umpire",
  ];
  const rows = matches
    .filter((m) => !isBye(m.team1_label) && !isBye(m.team2_label))
    .map((m) => {
      const d = matchDurationMins(m);
      return [
        m.match_code, m.category, m.round_name, m.team1_label, m.team2_label, m.score,
        m.winner_side ? sideLabel(m, m.winner_side as 1 | 2) : "", m.status, m.court_number,
        m.scheduled_at, m.started_at, m.ended_at, d != null ? Math.round(d) : "",
        m.umpired_by ? umpireNames[m.umpired_by] ?? "" : "",
      ];
    });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
