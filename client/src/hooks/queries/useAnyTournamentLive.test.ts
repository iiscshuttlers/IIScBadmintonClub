import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { liveHref, summariseLive } from "@/hooks/queries/useAnyTournamentLive";

describe("summariseLive", () => {
  it("counts matches and lists distinct tournaments in order", () => {
    expect(
      summariseLive([{ tournament_id: "b" }, { tournament_id: "a" }, { tournament_id: "b" }, { tournament_id: null }]),
    ).toEqual({ count: 4, tournamentIds: ["b", "a"] });
  });
  it("is empty when nothing is live", () => {
    expect(summariseLive([])).toEqual({ count: 0, tournamentIds: [] });
  });
});

describe("liveHref", () => {
  it("goes straight to the Live tab when one tournament is live", () => {
    expect(liveHref({ count: 2, tournamentIds: ["t1"] })).toBe("/tournaments/t1/live");
  });
  it("goes to the tournaments list when several are live", () => {
    expect(liveHref({ count: 3, tournamentIds: ["t1", "t2"] })).toBe("/tournaments");
  });
});
