import { describe, expect, it } from "vitest";
import { buildRatingStory, ratingBucket, type EloLogRow } from "./ratingStory";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const log = (id: string, category: string, daysAgo: number, change: number, newElo: number): EloLogRow => ({
  id,
  category,
  created_at: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  elo_change: change,
  new_elo: newElo,
  previous_elo: newElo - change,
  match_uuid: `m-${id}`,
});

describe("ratingBucket mirrors the database rule", () => {
  it.each([
    ["MS", "singles"], ["WS", "singles"], ["Singles", "singles"], ["Men's Singles", "singles"],
    ["MD", "doubles"], ["WD", "doubles"], ["Doubles", "doubles"],
    ["XD", "mixed"], ["Mixed", "mixed"], [null, "mixed"],
  ])("%s → %s", (cat, bucket) => {
    expect(ratingBucket(cat as string | null)).toBe(bucket);
  });
});

describe("buildRatingStory", () => {
  const logs = [
    log("1", "MS", 90, 20, 1220),
    log("2", "Singles", 40, 30, 1250),
    log("3", "MS", 10, -15, 1235),
    log("4", "MS", 2, 10, 1245),
    log("5", "XD", 5, 12, 1212),
  ];

  it("derives movement, recent contributions and career best from logs only", () => {
    const [singles, doubles, mixed] = buildRatingStory(logs, { singles: 1245, doubles: 1200, mixed: 1212 }, { now: NOW });
    expect(singles.movement).toBe(-5);
    expect(singles.recent.map((r) => r.id)).toEqual(["4", "3", "2", "1"]);
    expect(singles.careerBest).toMatchObject({ rating: 1250 });
    expect(singles.historyStart).toBe(logs[0].created_at);
    expect(singles.outOfStep).toBe(false);
    expect(doubles).toMatchObject({ logged: 0, movement: null, careerBest: null, historyStart: null });
    expect(mixed.movement).toBe(12);
  });

  it("keeps XD separate from doubles", () => {
    const [, doubles, mixed] = buildRatingStory([log("x", "XD", 1, 5, 1205)], {}, { now: NOW });
    expect(doubles.logged).toBe(0);
    expect(mixed.logged).toBe(1);
  });

  it("flags a current rating that no longer matches the latest logged change", () => {
    const [singles] = buildRatingStory(logs, { singles: 1300 }, { now: NOW });
    expect(singles.outOfStep).toBe(true);
  });

  it("reports no movement when nothing changed inside the window", () => {
    const [singles] = buildRatingStory([log("old", "MS", 200, 40, 1240)], { singles: 1240 }, { now: NOW });
    expect(singles.movement).toBeNull();
    expect(singles.careerBest?.rating).toBe(1240);
  });
});
