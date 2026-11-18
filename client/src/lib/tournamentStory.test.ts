import { describe, expect, it } from "vitest";
import { buildTournamentStoryDraft, isStoryInvalidated } from "./tournamentStory";
import type { MatchView } from "@/lib/matchView";

function mockMatch(overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: "m-1",
    tournamentId: "t-1",
    discipline: "MS",
    categoryLabel: "Men's Singles",
    roundName: "Final",
    round: 4,
    matchNumber: 1,
    matchCode: "MS_F_1",
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "Varun Varma", playerIds: ["p1"], seed: 1, isWinner: true, isTbd: false, isBye: false },
      { label: "Aneesh Varla", playerIds: ["p2"], seed: 2, isWinner: false, isTbd: false, isBye: false },
    ],
    state: "completed",
    statusLabel: "Completed",
    games: [
      { side1: 21, side2: 18 },
      { side1: 21, side2: 19 },
    ],
    scoreText: "21-18, 21-19",
    court: "1",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    nextMatchCode: null,
    ...overrides,
  };
}

describe("tournamentStory", () => {
  it("generates champion stories from final matches", () => {
    const finalMatch = mockMatch();
    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [finalMatch]);

    expect(draft.items).toHaveLength(1);
    const item = draft.items[0];
    expect(item.type).toBe("champions");
    expect(item.headline).toContain("Varun Varma crowned MS Champion");
    expect(item.body).toContain("defeated Aneesh Varla in the MS final (21-18, 21-19)");
    expect(item.supportingMatchIds).toEqual(["m-1"]);
  });

  it("identifies seed upsets correctly", () => {
    const upsetMatch = mockMatch({
      id: "m-upset",
      roundName: "Quarter-final",
      sides: [
        { label: "Challenger", playerIds: ["p3"], seed: null, isWinner: true, isTbd: false, isBye: false },
        { label: "Top Seed", playerIds: ["p4"], seed: 1, isWinner: false, isTbd: false, isBye: false },
      ],
      games: [{ side1: 21, side2: 15 }, { side1: 21, side2: 12 }],
      scoreText: "21-15, 21-12",
    });

    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [upsetMatch]);
    const upsetItem = draft.items.find((i) => i.type === "upset");
    expect(upsetItem).toBeDefined();
    expect(upsetItem?.headline).toContain("Seed Upset: Challenger defeats Top Seed");
    expect(upsetItem?.body).toContain("Unseeded Challenger secured victory over [Seed 1] Top Seed");
  });

  it("detects tight three-game thrillers", () => {
    const thrillerMatch = mockMatch({
      id: "m-thriller",
      roundName: "Semi-final",
      sides: [
        { label: "Player A", playerIds: ["p5"], seed: null, isWinner: true, isTbd: false, isBye: false },
        { label: "Player B", playerIds: ["p6"], seed: null, isWinner: false, isTbd: false, isBye: false },
      ],
      games: [
        { side1: 19, side2: 21 },
        { side1: 21, side2: 18 },
        { side1: 22, side2: 20 },
      ],
      scoreText: "19-21, 21-18, 22-20",
    });

    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [thrillerMatch]);
    const thriller = draft.items.find((i) => i.type === "thriller");
    expect(thriller).toBeDefined();
    expect(thriller?.headline).toContain("Three-game thriller: Player A edges Player B");
  });

  it("flags a story as invalidated when its supporting match is corrected", () => {
    const finalMatch = mockMatch({ id: "m-corrected" });
    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [finalMatch]);
    const item = draft.items[0];

    expect(isStoryInvalidated(item, ["m-different"])).toBe(false);
    expect(isStoryInvalidated(item, ["m-corrected"])).toBe(true);
  });
});

