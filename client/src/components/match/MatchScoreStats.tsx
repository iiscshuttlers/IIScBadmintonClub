import { useMemo } from "react";
import type { MatchView } from "@/lib/matchView";
import { shortNames } from "@/lib/pointLog";
import { scoreInsights, scoreStats, type ScoredGame } from "@/lib/scoreStats";
import { CompareList, PointsHeadline, SplitBar, Takeaways, VizVars, type Row } from "@/components/match/MatchStatsPanel";

/**
 * Stats tab for a match with game scores but no point-by-point log: points
 * won, takeaways, each game as a split bar, and the head-to-head numbers the
 * scores support. Says plainly that rally-by-rally detail isn't available.
 */

function GameBars({ games, names }: { games: ScoredGame[]; names: [string, string] }) {
  return (
    <section aria-labelledby="games-heading">
      <h2 id="games-heading" className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
        Game by game
      </h2>
      <ul className="divide-y divide-border">
        {games.map((g) => (
          <li key={g.game} className="py-2.5">
            <p className="sr-only">
              Game {g.game}: {names[0]} {g.score[0]}, {names[1]} {g.score[1]}
              {g.extraPoints ? ", went to extra points" : ""}.
            </p>
            <div aria-hidden>
              <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
                <span className={`text-lg tabular-nums leading-none ${g.winner === 1 ? "font-black" : "font-semibold text-muted-foreground"}`}>{g.score[0]}</span>
                <span className="text-center text-[11px] font-black uppercase tracking-wide text-soft">
                  Game {g.game}
                  {g.extraPoints && <span className="ml-1.5 normal-case tracking-normal font-semibold text-muted-foreground">· extra points</span>}
                </span>
                <span className={`text-right text-lg tabular-nums leading-none ${g.winner === 2 ? "font-black" : "font-semibold text-muted-foreground"}`}>{g.score[1]}</span>
              </div>
              <div className="mt-2">
                <SplitBar a={g.score[0]} b={g.score[1]} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchScoreStats({ view, pointsToWin = 21 }: { view: MatchView; pointsToWin?: number }) {
  const names: [string, string] = [view.sides[0].label, view.sides[1].label];
  const short = useMemo(() => shortNames(names), [names[0], names[1]]);
  const stats = useMemo(() => scoreStats(view.games, pointsToWin), [view.games, pointsToWin]);
  const matchWinner = view.sides[0].isWinner ? 1 : view.sides[1].isWinner ? 2 : null;
  const takeaways = useMemo(() => scoreInsights(stats, short, matchWinner), [stats, short, matchWinner]);

  const played = stats.games.length || 1;
  const rows: Row[] = [
    { label: "Games won", left: { main: String(stats.gamesWon[0]) }, right: { main: String(stats.gamesWon[1]) }, a: stats.gamesWon[0], b: stats.gamesWon[1] },
    {
      label: "Points per game",
      left: { main: (stats.points[0] / played).toFixed(1) },
      right: { main: (stats.points[1] / played).toFixed(1) },
      a: stats.points[0],
      b: stats.points[1],
    },
    { label: "Biggest game win", left: { main: stats.biggestWin[0] ? `+${stats.biggestWin[0]}` : "—" }, right: { main: stats.biggestWin[1] ? `+${stats.biggestWin[1]}` : "—" }, a: stats.biggestWin[0], b: stats.biggestWin[1] },
  ];

  return (
    <div className="worm-root mt-4 space-y-6">
      <VizVars />
      <p className="text-xs font-semibold text-muted-foreground" role="note">
        Only the game scores were recorded for this match, so these stats come from them.
      </p>
      <PointsHeadline points={stats.points} names={names} />
      <Takeaways lines={takeaways} />
      <GameBars games={stats.games} names={short} />
      <CompareList rows={rows} names={short} />
    </div>
  );
}
