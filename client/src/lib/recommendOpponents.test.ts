import { describe, expect, it } from "vitest";
import { recommendOpponents } from "@/lib/recommendOpponents";

type P = Parameters<typeof recommendOpponents>[0][number];

function player(id: string, elo: number, extra: Partial<P> = {}): P {
  return {
    id,
    full_name: id,
    elo_rating: elo,
    win_loss_record: "3-2",
    status: null,
    is_retired: false,
    gender: null,
    ...extra,
  };
}

const me = { id: "me", elo_rating: 1200 };
const none = { blockedIds: new Set<string>(), availableNowIds: new Set<string>() };
const ids = (r: { opponents: P[] }) => r.opponents.map((p) => p.id);

describe("recommendOpponents", () => {
  it("orders by closest rating, not by name", () => {
    const players = [player("aaron", 1340), player("bea", 1190), player("zed", 1205), player("cal", 1260)];
    expect(ids(recommendOpponents(players, me, none))).toEqual(["zed", "bea", "cal", "aaron"]);
  });

  it("puts players available right now first", () => {
    const players = [player("close", 1201), player("free", 1300)];
    const opts = { ...none, availableNowIds: new Set(["free"]) };
    expect(ids(recommendOpponents(players, me, opts))).toEqual(["free", "close"]);
  });

  it("skips players marked playing, resting or injured, unless they tapped available now", () => {
    const players = (["playing", "resting", "injured"] as const).map((s) => player(s, 1210, { status: s }));
    expect(ids(recommendOpponents(players, me, none))).toEqual([]);
    expect(ids(recommendOpponents(players, me, { ...none, availableNowIds: new Set(["resting"]) }))).toEqual(["resting"]);
  });

  it("treats a missing status as not unavailable", () => {
    expect(ids(recommendOpponents([player("old", 1210, { status: null })], me, none))).toEqual(["old"]);
  });

  it("skips players with fewer than 3 rated matches", () => {
    const players = [
      player("new", 1200, { win_loss_record: "0-0" }),
      player("blank", 1200, { win_loss_record: null }),
      player("one", 1193, { win_loss_record: "0W - 1L" }),
      player("two", 1207, { win_loss_record: "1W - 1L" }),
      player("three", 1193, { win_loss_record: "1W - 2L" }),
    ];
    expect(ids(recommendOpponents(players, me, none))).toEqual(["three"]);
  });

  it("on an equal rating gap, prefers the player with more matches", () => {
    const players = [player("few", 1193, { win_loss_record: "1-2" }), player("many", 1207, { win_loss_record: "6-6" })];
    expect(ids(recommendOpponents(players, me, none))).toEqual(["many", "few"]);
  });

  it("skips you, blocked, retired and out-of-band players", () => {
    const players = [
      player("me", 1200),
      player("blocked", 1200),
      player("retired", 1200, { is_retired: true }),
      player("far", 1351),
      player("edge", 1050),
    ];
    const opts = { ...none, blockedIds: new Set(["blocked"]) };
    expect(ids(recommendOpponents(players, me, opts))).toEqual(["edge"]);
  });

  describe("widening when nobody is close", () => {
    it("keeps the band, and says so, when someone is inside it", () => {
      const r = recommendOpponents([player("near", 1290), player("further", 1400)], me, none);
      expect([ids(r), r.widened]).toEqual([["near"], false]);
    });

    it("gives a woman with no other woman within 150 points the nearest ones", () => {
      const players = [
        player("man-close", 1490, { gender: "Male" }),
        player("w-200", 1300, { gender: "Female" }),
        player("w-260", 1760, { gender: "Female" }),
        player("w-400", 1100, { gender: "Female" }),
      ];
      const r = recommendOpponents(players, { id: "me", elo_rating: 1500, gender: "Female" }, none);
      expect([ids(r), r.widened]).toEqual([["w-200", "w-260"], true]);
    });

    it("drops the limit entirely when nobody is within twice the band", () => {
      const players = [player("w-600", 1200, { gender: "Female" }), player("w-550", 1250, { gender: "Female" })];
      const r = recommendOpponents(players, { id: "me", elo_rating: 1800, gender: "Female" }, none);
      expect([ids(r), r.widened]).toEqual([["w-550", "w-600"], true]);
    });

    it("still applies the other rules when widening", () => {
      const players = [
        player("w-retired", 1300, { gender: "Female", is_retired: true }),
        player("w-new", 1300, { gender: "Female", win_loss_record: "1-0" }),
        player("w-resting", 1300, { gender: "Female", status: "resting" }),
      ];
      const r = recommendOpponents(players, { id: "me", elo_rating: 1500, gender: "Female" }, none);
      expect([ids(r), r.widened]).toEqual([[], false]);
    });
  });

  it("caps the list and breaks ties by name", () => {
    const players = ["e", "d", "c", "b", "a"].map((id) => player(id, 1210));
    expect(ids(recommendOpponents(players, me, none))).toEqual(["a", "b", "c", "d"]);
  });

  describe("gender", () => {
    const mixed = [
      player("ushnaa", 1246, { gender: "Female" }),
      player("vivek", 1230, { gender: "Male" }),
      player("anon", 1201, { gender: null }),
      player("kota", 1260, { gender: "Male" }),
      player("riya", 1190, { gender: "Female" }),
    ];

    it("recommends only your recorded gender and leaves out players with none", () => {
      expect(ids(recommendOpponents(mixed, { ...me, gender: "Male" }, none))).toEqual(["vivek", "kota"]);
      expect(ids(recommendOpponents(mixed, { ...me, gender: "Female" }, none))).toEqual(["riya", "ushnaa"]);
    });

    it("ignores case and spacing in the recorded value", () => {
      expect(ids(recommendOpponents(mixed, { ...me, gender: " male " }, none))).toEqual(["vivek", "kota"]);
    });

    it("doesn't filter by gender when yours isn't recorded", () => {
      expect(ids(recommendOpponents(mixed, { ...me, gender: null }, none))).toEqual(["anon", "riya", "vivek", "ushnaa"]);
    });
  });

  it("treats your own missing rating as the 1200 start", () => {
    const players = [player("near", 1250), player("far", 1400)];
    expect(ids(recommendOpponents(players, { id: "me", elo_rating: 0 }, none))).toEqual(["near"]);
  });
});
