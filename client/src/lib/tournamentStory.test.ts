import { describe, expect, it } from "vitest";
import {
  buildPublishedStoryRecord,
  buildTournamentStoryDraft,
  createStoryReview,
  parsePublishedStoryRecord,
  publicStoryView,
  storySiteDataKey,
  isStoryInvalidated,
  markStoryReviewed,
  publishStoryReview,
  reconcileStoryReview,
} from "./tournamentStory";
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

  it("does not call every three-game match a thriller", () => {
    const ordinaryDecider = mockMatch({
      id: "m-wide-decider",
      roundName: "Semi-final",
      games: [
        { side1: 21, side2: 12 },
        { side1: 15, side2: 21 },
        { side1: 21, side2: 8 },
      ],
      scoreText: "21-12, 15-21, 21-8",
    });
    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [ordinaryDecider]);
    expect(draft.items.some((item) => item.type === "thriller")).toBe(false);
  });

  it("flags a story as invalidated when its supporting match is corrected", () => {
    const finalMatch = mockMatch({ id: "m-corrected" });
    const draft = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [finalMatch]);
    const item = draft.items[0];

    expect(isStoryInvalidated(item, ["m-different"])).toBe(false);
    expect(isStoryInvalidated(item, ["m-corrected"])).toBe(true);
  });

  it("keeps drafts private and forces corrected facts back through review", () => {
    const original = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [mockMatch({ id: "m-final" })]);
    const privateDraft = createStoryReview(original);
    expect(privateDraft.status).toBe("draft");
    expect(() => publishStoryReview(privateDraft)).toThrow(/must be reviewed/);

    const published = publishStoryReview(markStoryReviewed(privateDraft, "2026-11-14T10:00:00Z"), "2026-11-14T10:01:00Z");
    expect(published.status).toBe("published");

    const corrected = buildTournamentStoryDraft({ id: "t-1", name: "Autumn Cup" }, [
      mockMatch({ id: "m-final", scoreText: "19-21, 21-18, 21-10", games: [
        { side1: 19, side2: 21 },
        { side1: 21, side2: 18 },
        { side1: 21, side2: 10 },
      ] }),
    ]);
    const invalidated = reconcileStoryReview(published, corrected);
    expect(invalidated.status).toBe("needs_review");
    expect(invalidated.invalidatedItemIds).toContain("champ-m-final");
    expect(invalidated.publishedAt).toBeNull();
  });

  describe("publication", () => {
    const tournament = { id: "t-1", name: "Autumn Cup" };
    const draft = buildTournamentStoryDraft(tournament, [mockMatch({ id: "m-final" })]);

    it("publishes only selected items with a trimmed editorial note", () => {
      const record = buildPublishedStoryRecord(draft, ["champ-m-final"], "  Great day of badminton.  ", "2026-11-14T12:00:00Z");
      expect(record.items.map((i) => i.id)).toEqual(["champ-m-final"]);
      expect(record.editorialNote).toBe("Great day of badminton.");
      expect(storySiteDataKey("t-1")).toBe("tournament_story:t-1");
    });

    it("refuses an empty publication", () => {
      expect(() => buildPublishedStoryRecord(draft, [], "")).toThrow(/at least one/);
      expect(() => buildPublishedStoryRecord(draft, ["not-in-draft"], "")).toThrow(/at least one/);
    });

    it("round-trips through JSON and rejects records for another tournament", () => {
      const record = buildPublishedStoryRecord(draft, ["champ-m-final"], "");
      const stored = JSON.parse(JSON.stringify(record));
      expect(parsePublishedStoryRecord(stored, "t-1")).toEqual(record);
      expect(parsePublishedStoryRecord(stored, "t-2")).toBeNull();
      expect(parsePublishedStoryRecord(null, "t-1")).toBeNull();
      expect(parsePublishedStoryRecord({ version: 2 }, "t-1")).toBeNull();
    });

    it("withholds a published champion once the final is corrected", () => {
      const record = buildPublishedStoryRecord(draft, ["champ-m-final"], "");
      expect(publicStoryView(record, draft)).toEqual({ visible: record.items, withheldItemIds: [] });

      const corrected = buildTournamentStoryDraft(tournament, [
        mockMatch({
          id: "m-final",
          sides: [
            { label: "Varun Varma", playerIds: ["p1"], seed: 1, isWinner: false, isTbd: false, isBye: false },
            { label: "Aneesh Varla", playerIds: ["p2"], seed: 2, isWinner: true, isTbd: false, isBye: false },
          ],
        }),
      ]);
      const view = publicStoryView(record, corrected);
      expect(view.visible).toEqual([]);
      expect(view.withheldItemIds).toEqual(["champ-m-final"]);
    });

    it("withholds items whose supporting match disappeared", () => {
      const record = buildPublishedStoryRecord(draft, ["champ-m-final"], "");
      const empty = buildTournamentStoryDraft(tournament, []);
      expect(publicStoryView(record, empty).withheldItemIds).toEqual(["champ-m-final"]);
    });
  });
});

