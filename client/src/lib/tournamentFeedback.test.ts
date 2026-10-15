import { describe, it, expect } from "vitest";
import { summariseFeedback } from "./tournamentFeedback";

describe("summariseFeedback", () => {
  it("averages, distributes and ranks tags", () => {
    const s = summariseFeedback([
      { rating: 5, tags: ["Umpiring", "Format"], comment: " Great! " },
      { rating: 3, tags: ["Umpiring"], comment: null },
      { rating: 4, tags: null, comment: "" },
    ]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4);
    expect(s.distribution).toEqual([0, 0, 1, 1, 1]);
    expect(s.tags[0]).toEqual({ tag: "Umpiring", count: 2 });
    expect(s.comments).toEqual(["Great!"]);
  });

  it("handles no feedback", () => {
    expect(summariseFeedback([]).average).toBeNull();
  });
});
