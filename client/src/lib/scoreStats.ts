import type { GameScore } from "@/lib/matchView";

/**
 * Stats from game scores alone, for matches with no point-by-point log
 * (anything scored before point logs were saved, or entered as a final
 * score). Only what the scores prove: points and games won, margins and
 * games that went past the target. Pure functions only.
 */

export interface ScoredGame {
  game: number;
  score: [number, number];
  winner: 1 | 2 | null;
  margin: number;
  /** Went past the target score, e.g. 24–22 in a game to 21. */
  extraPoints: boolean;
}

export interface ScoreStats {
  points: [number, number];
  gamesWon: [number, number];
  games: ScoredGame[];
  /** Largest margin each side won a game by (0 if it won none). */
  biggestWin: [number, number];
}

export function scoreStats(games: GameScore[], pointsToWin = 21): ScoreStats {
  const scored: ScoredGame[] = games.map((g, i) => {
    const winner = g.side1 > g.side2 ? 1 : g.side2 > g.side1 ? 2 : null;
    return {
      game: i + 1,
      score: [g.side1, g.side2],
      winner,
      margin: Math.abs(g.side1 - g.side2),
      extraPoints: Math.max(g.side1, g.side2) > pointsToWin,
    };
  });
  const points: [number, number] = [0, 0];
  const gamesWon: [number, number] = [0, 0];
  const biggestWin: [number, number] = [0, 0];
  for (const g of scored) {
    points[0] += g.score[0];
    points[1] += g.score[1];
    if (g.winner) {
      gamesWon[g.winner - 1] += 1;
      biggestWin[g.winner - 1] = Math.max(biggestWin[g.winner - 1], g.margin);
    }
  }
  return { points, gamesWon, games: scored, biggestWin };
}

function listGames(nums: number[]): string {
  if (nums.length === 1) return `Game ${nums[0]}`;
  return `Games ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;
}

/**
 * Short takeaways from the scores, most telling first. Names only, no
 * pronouns. `matchWinner` is the side that won the match, when decided.
 */
export function scoreInsights(stats: ScoreStats, names: [string, string], matchWinner: 1 | 2 | null, max = 4): string[] {
  const out: string[] = [];
  const g = stats.games;
  if (g.length === 0) return out;

  if (matchWinner) {
    const w = matchWinner - 1;
    const l = 1 - w;
    if (stats.points[l] > stats.points[w]) {
      out.push(`${names[l]} won more points (${stats.points[l]}–${stats.points[w]}), but ${names[w]} won the match.`);
    }
    const lostGames = g.filter((x) => x.winner && x.winner !== matchWinner).map((x) => x.game);
    if (lostGames.length === 0 && g.length >= 2) {
      out.push(`${names[w]} won in straight games.`);
    } else if (lostGames[0] === 1) {
      out.push(`${names[w]} lost the first game but came back to win.`);
    } else if (g.length >= 3 && lostGames.length > 0) {
      const last = g[g.length - 1];
      out.push(`${names[w]} won the deciding game ${last.score[w]}–${last.score[l]}.`);
    }
  }

  const extra = g.filter((x) => x.extraPoints).map((x) => x.game);
  if (extra.length > 0) {
    const one = g.find((x) => x.game === extra[0])!;
    out.push(
      extra.length === 1
        ? `Game ${one.game} went to extra points (${one.score[0]}–${one.score[1]}).`
        : `${listGames(extra)} went to extra points.`,
    );
  }

  const closest = [...g].filter((x) => x.winner).sort((a, b) => a.margin - b.margin)[0];
  if (closest && closest.margin === 2 && !closest.extraPoints && g.length > 1) {
    out.push(`Game ${closest.game} was won by just 2 points (${closest.score[0]}–${closest.score[1]}).`);
  }

  const k = stats.biggestWin[0] >= stats.biggestWin[1] ? 0 : 1;
  if (stats.biggestWin[k] >= 10) {
    const game = g.find((x) => x.winner === k + 1 && x.margin === stats.biggestWin[k])!;
    out.push(`${names[k]}'s biggest win was ${game.score[k]}–${game.score[1 - k]} in Game ${game.game}.`);
  }

  return out.slice(0, max);
}
