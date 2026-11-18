import type { MatchView } from "@/lib/matchView";

export type StoryType = "champions" | "upset" | "thriller" | "day_summary";

export interface FactualStoryItem {
  id: string;
  type: StoryType;
  headline: string;
  body: string;
  discipline?: string | null;
  supportingMatchIds: string[];
  facts: {
    winnerLabel?: string;
    runnerUpLabel?: string;
    score?: string;
    round?: string;
    details?: string;
  };
}

export interface TournamentStoryDraft {
  tournamentId: string;
  tournamentName: string;
  generatedAt: string;
  items: FactualStoryItem[];
}

/**
 * Builds factual stories from verified completed match records.
 * Follows WC-08 deterministic facts without invented commentary.
 */
export function buildTournamentStoryDraft(
  tournament: { id: string; name: string },
  matches: MatchView[]
): TournamentStoryDraft {
  const completed = matches.filter((m) => m.state === "completed" && m.sides.some((s) => s.isWinner));
  const items: FactualStoryItem[] = [];

  // 1. Champions & Finalists
  const finals = completed.filter((m) => /final\b/i.test(m.roundName) && !/semi|quarter/i.test(m.roundName));
  for (const m of finals) {
    const winner = m.sides.find((s) => s.isWinner);
    const runnerUp = m.sides.find((s) => !s.isWinner && !s.isBye);
    if (!winner || !runnerUp) continue;

    const disc = m.discipline ?? m.categoryLabel ?? "Event";
    const scoreStr = m.scoreText || m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");

    items.push({
      id: `champ-${m.id}`,
      type: "champions",
      headline: `${winner.label} crowned ${disc} Champion`,
      body: `${winner.label} defeated ${runnerUp.label} in the ${disc} final (${scoreStr}).`,
      discipline: m.discipline,
      supportingMatchIds: [m.id],
      facts: {
        winnerLabel: winner.label,
        runnerUpLabel: runnerUp.label,
        score: scoreStr,
        round: m.roundName,
      },
    });
  }

  // 2. Seed Upsets
  for (const m of completed) {
    const winner = m.sides.find((s) => s.isWinner);
    const loser = m.sides.find((s) => !s.isWinner && !s.isBye);
    if (!winner || !loser) continue;

    // Upset condition: winner is unseeded beating seed <= 4, or winner seed > loser seed
    const isUpset =
      (winner.seed === null && loser.seed !== null && loser.seed <= 4) ||
      (winner.seed !== null && loser.seed !== null && winner.seed > loser.seed);

    if (isUpset) {
      const disc = m.discipline ?? m.categoryLabel ?? "Event";
      const scoreStr = m.scoreText || m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");
      const loserSeedStr = loser.seed ? `[Seed ${loser.seed}]` : "";
      const winnerSeedStr = winner.seed ? `[Seed ${winner.seed}]` : "Unseeded";

      items.push({
        id: `upset-${m.id}`,
        type: "upset",
        headline: `Seed Upset: ${winner.label} defeats ${loser.label}`,
        body: `${winnerSeedStr} ${winner.label} secured victory over ${loserSeedStr} ${loser.label} in the ${m.roundName} (${scoreStr}).`,
        discipline: m.discipline,
        supportingMatchIds: [m.id],
        facts: {
          winnerLabel: winner.label,
          runnerUpLabel: loser.label,
          score: scoreStr,
          round: m.roundName,
          details: `${winnerSeedStr} def. ${loserSeedStr}`,
        },
      });
    }
  }

  // 3. Thrillers / Deciding 3rd Games with tight margins
  for (const m of completed) {
    if (m.games.length === 3) {
      const g3 = m.games[2];
      const diff = Math.abs(g3.side1 - g3.side2);
      if (diff <= 2 || Math.max(g3.side1, g3.side2) >= 21) {
        const winner = m.sides.find((s) => s.isWinner);
        const loser = m.sides.find((s) => !s.isWinner);
        if (!winner || !loser) continue;

        const scoreStr = m.games.map((g) => `${g.side1}-${g.side2}`).join(", ");
        items.push({
          id: `thriller-${m.id}`,
          type: "thriller",
          headline: `Three-game thriller: ${winner.label} edges ${loser.label}`,
          body: `A tightly contested 3-game battle concluded with ${winner.label} winning ${scoreStr}.`,
          discipline: m.discipline,
          supportingMatchIds: [m.id],
          facts: {
            winnerLabel: winner.label,
            runnerUpLabel: loser.label,
            score: scoreStr,
            round: m.roundName,
          },
        });
      }
    }
  }

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    generatedAt: new Date().toISOString(),
    items,
  };
}

/**
 * Checks whether an existing story item is invalidated by a match score correction.
 */
export function isStoryInvalidated(
  item: FactualStoryItem,
  correctedMatchIds: string[]
): boolean {
  return item.supportingMatchIds.some((id) => correctedMatchIds.includes(id));
}

