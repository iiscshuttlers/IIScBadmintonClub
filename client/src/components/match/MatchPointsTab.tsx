import { useMemo, useState } from "react";
import type { MatchView } from "@/lib/matchView";
import {
  assessPointLogCoverage,
  DEFAULT_RULES,
  decodePoints,
  gameFlows,
  gameMinutes,
  keyMoments,
  progression,
  rallyStats,
  shortNames,
  splitGames,
  statInsights,
  type GameSeries,
  type ScoringRules,
} from "@/lib/pointLog";
import type { StoredPointLog } from "@/hooks/queries/useMatchPointLog";
import { CompareRows, GameFlowTable, LeadTracker, PointsHeadline, Takeaways } from "@/components/match/MatchStatsPanel";

/**
 * Stats tab, all from the stored point log: points won, takeaways, who was
 * ahead rally by rally, head-to-head numbers, the points progression (worm)
 * per game, game by game, and key moments. One switch scopes everything to
 * the whole match or one game. Side 1 is a solid line / left, side 2 a
 * dashed line / right, so identity never rests on colour.
 * Palette: the theme's scoreboard side tokens (team-1 / team-2).
 */

const W = 320;
const H = 162;
const PAD = { l: 26, r: 34, t: 16, b: 24 };

/** Rally-number ticks for a game of `n` rallies: every 5, 10 or 20. */
export function rallyTicks(n: number): number[] {
  const step = n <= 25 ? 5 : n <= 60 ? 10 : 20;
  const out: number[] = [];
  for (let v = step; v <= n; v += step) out.push(v);
  return out;
}

function Worm({ g, names, rules }: { g: GameSeries; names: [string, string]; rules: ScoringRules }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = g.rallies.length;
  const yMax = Math.max(rules.pointsToWin, g.final[0], g.final[1]);
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / n) * (W - PAD.l - PAD.r));
  const y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const path = (side: 0 | 1) =>
    [`M${x(0)},${y(0)}`, ...g.rallies.map((r, i) => `L${x(i + 1)},${y(side === 0 ? r.t1 : r.t2)}`)].join(" ");
  const deuceY = y(rules.pointsToWin - 1);
  const reachedDeuce = g.final[0] >= rules.pointsToWin - 1 && g.final[1] >= rules.pointsToWin - 1;
  const intervalPoint = Math.ceil(rules.pointsToWin / 2);
  const interval = g.rallies.findIndex((r) => r.t1 === intervalPoint || r.t2 === intervalPoint);
  const gridTicks = Array.from(new Set([0, intervalPoint, rules.pointsToWin]));
  const hovered = hover != null ? g.rallies[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * n) - 1;
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <figure className="worm relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none"
        role="img"
        aria-label={`Game ${g.game} points progression over ${n} rallies, final score ${g.final[0]}–${g.final[1]}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {reachedDeuce && (
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={deuceY - PAD.t} fill="var(--worm-deuce)" />
        )}
        {gridTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--worm-grid)" strokeWidth={1} />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--worm-muted)">
              {v}
            </text>
          </g>
        ))}
        {/* Rally numbers along the bottom (BWF-style x axis). */}
        {rallyTicks(n).map((v) => (
          <g key={`x${v}`}>
            <line x1={x(v)} x2={x(v)} y1={H - PAD.b} y2={H - PAD.b + 3} stroke="var(--worm-muted)" strokeWidth={1} />
            <text x={x(v)} y={H - PAD.b + 13} textAnchor="middle" fontSize={9} fill="var(--worm-muted)">
              {v}
            </text>
          </g>
        ))}
        <text x={W - PAD.r + 4} y={H - PAD.b + 13} fontSize={9} fill="var(--worm-muted)">
          rally
        </text>
        {interval >= 0 && (
          <g>
            <line x1={x(interval + 1)} x2={x(interval + 1)} y1={PAD.t} y2={H - PAD.b} stroke="var(--worm-grid)" strokeDasharray="2 3" />
            <text x={x(interval + 1)} y={PAD.t - 5} textAnchor="middle" fontSize={9} fill="var(--worm-muted)">
              Interval {intervalPoint}
            </text>
          </g>
        )}
        <path d={path(0)} fill="none" stroke="var(--worm-s1)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path(1)} fill="none" stroke="var(--worm-s2)" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" />
        {/* Direct labels at the line ends, in text ink. */}
        <text x={W - PAD.r + 4} y={y(g.final[0]) + 3} fontSize={10} fontWeight={800} fill="var(--worm-ink)">
          {g.final[0]}
        </text>
        <text x={W - PAD.r + 4} y={y(g.final[1]) + (g.final[1] === g.final[0] ? 13 : 3)} fontSize={10} fontWeight={800} fill="var(--worm-ink)">
          {g.final[1]}
        </text>
        {hovered && hover != null && (
          <g>
            <line x1={x(hover + 1)} x2={x(hover + 1)} y1={PAD.t} y2={H - PAD.b} stroke="var(--worm-muted)" strokeWidth={1} />
            <circle cx={x(hover + 1)} cy={y(hovered.t1)} r={4} fill="var(--worm-s1)" stroke="var(--worm-surface)" strokeWidth={2} />
            <circle cx={x(hover + 1)} cy={y(hovered.t2)} r={4} fill="var(--worm-s2)" stroke="var(--worm-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg bg-foreground text-background text-[11px] font-semibold px-2 py-1 shadow">
          Rally {hover! + 1}: {hovered.t1}–{hovered.t2} · {names[hovered.side - 1]} won it
        </div>
      )}
    </figure>
  );
}

type Scope = "match" | number;

export function MatchPointsTab({
  view,
  log,
  rules = DEFAULT_RULES,
}: {
  view: MatchView;
  log: StoredPointLog;
  rules?: ScoringRules;
}) {
  const [asTable, setAsTable] = useState(false);
  const [scope, setScope] = useState<Scope>("match");
  const names: [string, string] = [view.sides[0].label, view.sides[1].label];
  // First names everywhere except the points-won headline, which shows full names.
  const short = useMemo(() => shortNames(names), [names[0], names[1]]);
  const rallies = useMemo(() => decodePoints(log.points), [log.points]);
  const games = useMemo(() => splitGames(rallies), [rallies]);
  const moments = useMemo(() => keyMoments(rallies, rules, short), [rallies, rules, short]);
  const coverage = useMemo(
    () => assessPointLogCoverage(rallies, view.games, {
      finished: view.state === "completed",
      final: log.final,
      supersededByCorrection: log.supersededByCorrection,
      storedEntryCountMatches: Array.isArray(log.points) && log.pointCount === log.points.length,
    }),
    [rallies, view.games, view.state, log.final, log.supersededByCorrection, log.points, log.pointCount],
  );
  // A game that vanished (e.g. a corrected log) falls back to the whole match.
  const activeScope: Scope = scope !== "match" && !games.some((g) => g.game === scope) ? "match" : scope;
  const stats = useMemo(() => rallyStats(rallies, rules, activeScope === "match" ? null : activeScope), [rallies, rules, activeScope]);
  const flows = useMemo(() => gameFlows(rallies, rules), [rallies, rules]);
  const matchWinner = view.sides[0].isWinner ? 1 : view.sides[1].isWinner ? 2 : null;
  const takeaways = useMemo(
    () => statInsights(stats, short, { scope: activeScope === "match" ? "match" : "game", matchWinner }),
    [stats, short, activeScope, matchWinner],
  );
  const shownGames = activeScope === "match" ? games : games.filter((g) => g.game === activeScope);
  const shownMoments = activeScope === "match" ? moments : moments.filter((m) => m.game === activeScope);

  if (rallies.length === 0) return <p className="mt-4 text-sm text-muted-foreground">No points recorded yet.</p>;

  const scopeOptions: Array<{ value: Scope; label: string; sub?: string }> = [
    { value: "match", label: "Match" },
    ...games.map((g) => ({ value: g.game as Scope, label: `Game ${g.game}`, sub: `${g.final[0]}–${g.final[1]}` })),
  ];

  return (
    <div className="worm-root mt-4 space-y-6">
      <style>{`
        .worm-root { --worm-s1:var(--team-1); --worm-s2:var(--team-2); --worm-grid:var(--border); --worm-muted:var(--muted-foreground); --worm-ink:var(--foreground); --worm-surface:var(--card); --worm-deuce:color-mix(in srgb, var(--warning) 10%, transparent); }
      `}</style>

      {coverage === "corrected" && (
        <p className="text-xs font-semibold text-warning" role="note">
          The score was corrected after the match, so these stats may not match it.
        </p>
      )}
      {coverage === "partial" && (
        <p className="text-xs font-semibold text-warning" role="note">
          Some points weren't recorded, so these stats are incomplete.
        </p>
      )}
      {coverage === "complete" && (
        <p className="text-xs font-semibold text-success" role="status">
          All {rallies.length} {rallies.length === 1 ? "point" : "points"} recorded.
        </p>
      )}
      {coverage === "live" && (
        <p className="text-xs font-semibold text-info" role="status">
          Live · {rallies.length} {rallies.length === 1 ? "point" : "points"} so far.
        </p>
      )}

      {games.length > 1 && (
        <div role="group" aria-label="Show stats for" className="flex flex-wrap gap-1.5">
          {scopeOptions.map((o) => {
            const on = activeScope === o.value;
            return (
              <button
                key={String(o.value)}
                type="button"
                aria-pressed={on}
                onClick={() => setScope(o.value)}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  on ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {o.label}
                {o.sub && <span className="ml-1 font-mono font-semibold opacity-80 tabular-nums">{o.sub}</span>}
              </button>
            );
          })}
        </div>
      )}

      <PointsHeadline stats={stats} names={names} />
      <Takeaways lines={takeaways} />
      <LeadTracker rallies={rallies} names={short} gameNumbers={shownGames.map((g) => g.game)} />
      <CompareRows stats={stats} names={short} />

      <section aria-labelledby="worm-heading">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="worm-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Score progression
          </h2>
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="min-h-[44px] px-3 text-xs font-black underline underline-offset-2"
          >
            {asTable ? "View as chart" : "View as table"}
          </button>
        </div>
        {/* Legend: colour + line style + name. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold mb-2" aria-hidden={asTable}>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="0" x2="22" y1="3" y2="3" stroke="var(--worm-s1)" strokeWidth="2" /></svg>
            {short[0]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="0" x2="22" y1="3" y2="3" stroke="var(--worm-s2)" strokeWidth="2" strokeDasharray="5 3" /></svg>
            {short[1]}
          </span>
        </div>

        <div className="space-y-5">
          {shownGames.map((g) => {
            const mins = gameMinutes(g);
            return (
              <div key={g.game}>
                <p className="text-sm font-black mb-1">
                  Game {g.game} · {g.final[0]}–{g.final[1]}
                  {mins ? <span className="font-semibold text-muted-foreground text-xs"> · {mins} min</span> : null}
                </p>
                {asTable ? (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Game {g.game} score every five rallies</caption>
                    <thead>
                      <tr className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        <th scope="col" className="text-left py-1">After rally</th>
                        <th scope="col" className="text-right py-1">{short[0]}</th>
                        <th scope="col" className="text-right py-1">{short[1]}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono tabular-nums">
                      {progression(g).map((p) => (
                        <tr key={p.rally}>
                          <td className="py-1">{p.rally}</td>
                          <td className="py-1 text-right">{p.t1}</td>
                          <td className="py-1 text-right">{p.t2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Worm g={g} names={short} rules={rules} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {activeScope === "match" && <GameFlowTable flows={flows} names={short} intervalPoint={Math.ceil(rules.pointsToWin / 2)} />}

      <section aria-labelledby="moments-heading">
        <h2 id="moments-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
          Key moments
        </h2>
        {shownMoments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing stood out{activeScope === "match" ? " yet" : " in this game"}.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {shownMoments.map((m, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-xs font-black text-muted-foreground tabular-nums pt-0.5">G{m.game}</span>
                <span>{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
