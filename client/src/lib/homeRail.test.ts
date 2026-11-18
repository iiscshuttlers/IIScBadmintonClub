import { describe, expect, it } from "vitest";
import { buildHomeRail, buildMyTournamentSummary, type RailContext } from "@/lib/homeRail";
import type { MatchView } from "@/lib/matchView";

const NOW = Date.parse("2026-11-15T12:00:00Z");

function v(id: string, p: { a?: string[]; b?: string[]; state?: MatchView["state"]; at?: string; ended?: string; t?: string }): MatchView {
  return {
    id,
    tournamentId: p.t ?? "t1",
    discipline: "MS",
    categoryLabel: "Men's Singles",
    roundName: "R1",
    round: 1,
    matchNumber: 1,
    matchCode: null,
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "A", playerIds: p.a ?? ["x"], seed: null, isWinner: false, isTbd: false, isBye: false },
      { label: "B", playerIds: p.b ?? ["y"], seed: null, isWinner: false, isTbd: false, isBye: false },
    ],
    state: p.state ?? "scheduled",
    statusLabel: "",
    games: [],
    scoreText: null,
    court: null,
    scheduledAt: p.at ?? null,
    startedAt: null,
    endedAt: p.ended ?? null,
    nextMatchCode: null,
  };
}

const ctx: RailContext = { myId: "me", followedPlayers: { f: "Asha" }, followedTournaments: ["t9"], now: NOW };

describe("buildHomeRail", () => {
  it("orders by reason priority and keeps only my earliest upcoming match", () => {
    const rail = buildHomeRail(
      [
        v("recent", { a: ["f"], state: "completed", ended: "2026-11-15T09:00:00Z" }),
        v("fNext", { a: ["f"], at: "2026-11-15T15:00:00Z" }),
        v("tLive", { t: "t9", state: "live" }),
        v("myNext2", { a: ["me"], at: "2026-11-16T10:00:00Z" }),
        v("myNext", { a: ["me"], at: "2026-11-15T13:00:00Z" }),
        v("fLive", { b: ["f"], state: "live" }),
        v("myLive", { b: ["me"], state: "live" }),
      ],
      ctx,
    );
    expect(rail.map((r) => [r.view.id, r.reason])).toEqual([
      ["myLive", "my-live"],
      ["myNext", "my-next"],
      ["fLive", "player-live"],
      ["tLive", "tournament-live"],
      ["fNext", "player-next"],
      ["recent", "recent"],
    ]);
    expect(rail[2].label).toBe("Following Asha");
  });

  it("deduplicates a match from several sources under its best reason", () => {
    const rail = buildHomeRail([v("m", { a: ["me"], b: ["f"], state: "live", t: "t9" })], ctx);
    expect(rail).toHaveLength(1);
    expect(rail[0].reason).toBe("my-live");
  });

  it("drops old results and unrelated matches, and caps the rail", () => {
    const rail = buildHomeRail(
      [
        v("old", { a: ["me"], state: "completed", ended: "2026-11-10T09:00:00Z" }),
        v("other", { state: "live" }),
        ...Array.from({ length: 10 }, (_, i) => v(`f${i}`, { a: ["f"], at: `2026-11-1${(i % 9) + 1}T10:00:00Z` })),
      ],
      ctx,
    );
    expect(rail.some((r) => r.view.id === "old" || r.view.id === "other")).toBe(false);
    expect(rail).toHaveLength(6);
  });
});

describe("buildMyTournamentSummary", () => {
  it("prioritises a live match and preserves every other upcoming discipline", () => {
    const live = v("live", { a: ["me"], state: "live", t: "t1" });
    live.discipline = "XD";
    const next = v("next", { a: ["me"], at: "2026-11-15T13:00:00Z", t: "t1" });
    next.discipline = "MS";
    const unscheduled = v("unscheduled", { a: ["me"], state: "unscheduled", t: "t2" });
    unscheduled.discipline = "MD";
    const summary = buildMyTournamentSummary([next, unscheduled, live], "me")!;
    expect(summary.primary.id).toBe("live");
    expect(summary.otherMatches.map((m) => [m.id, m.discipline])).toEqual([["next", "MS"], ["unscheduled", "MD"]]);
  });

  it("uses the earliest scheduled match before an unassigned-time match", () => {
    const summary = buildMyTournamentSummary([
      v("unknown", { a: ["me"], state: "unscheduled" }),
      v("later", { a: ["me"], at: "2026-11-16T10:00:00Z" }),
      v("next", { a: ["me"], at: "2026-11-15T13:00:00Z" }),
    ], "me")!;
    expect(summary.primary.id).toBe("next");
    expect(summary.otherMatches.map((m) => m.id)).toEqual(["later", "unknown"]);
  });

  it("returns no summary when only completed matches exist", () => {
    expect(buildMyTournamentSummary([v("done", { a: ["me"], state: "completed", ended: "2026-11-15T10:00:00Z" })], "me")).toBeNull();
  });
});
