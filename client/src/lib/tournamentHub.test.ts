import { describe, expect, it } from "vitest";
import {
  DEFAULT_HUB_FILTERS,
  countByStatus,
  displayStatus,
  duplicateNames,
  filterTournaments,
  formatDateRange,
  formatScoreLine,
  groupByStatus,
  hasActiveFilters,
  parseScoreSets,
  pickFeaturedTournament,
  startsInLabel,
} from "./tournamentHub";

const t = (id: string, status: string, startDate?: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `T ${id}`,
  status,
  startDate,
  ...extra,
});

describe("pickFeaturedTournament", () => {
  it("prefers a live tournament", () => {
    const list = [t("a", "upcoming", "2026-12-01"), t("b", "active", "2026-11-20"), t("c", "completed", "2026-10-01")];
    expect(pickFeaturedTournament(list)?.id).toBe("b");
  });

  it("falls back to the soonest dated upcoming tournament", () => {
    const list = [t("late", "upcoming", "2027-02-01"), t("nodate", "upcoming"), t("soon", "upcoming", "2026-12-01")];
    expect(pickFeaturedTournament(list)?.id).toBe("soon");
  });

  it("never features a finished tournament", () => {
    expect(pickFeaturedTournament([t("a", "archived", "2026-10-16"), t("b", "completed", "2026-08-14")])).toBeNull();
    expect(pickFeaturedTournament([])).toBeNull();
  });
});

describe("countByStatus", () => {
  it("counts archived tournaments as completed", () => {
    const list = [t("a", "active"), t("b", "upcoming"), t("c", "completed"), t("d", "archived")];
    expect(countByStatus(list)).toEqual({ all: 4, active: 1, upcoming: 1, completed: 2 });
  });
});

describe("filterTournaments", () => {
  const list = [
    t("a", "completed", "2026-08-14", { name: "Open August", venue: "Gymkhana", categories: ["MS", "WD"], tournament_type: "open", counts_for_elo: true }),
    t("b", "archived", "2026-10-16", { name: "IISM Trials", venue: "C1", categories: ["MS"], tournament_type: "open", counts_for_elo: false }),
    t("c", "upcoming", "2026-12-01", { name: "Team Cup", venue: "Gymkhana", tournament_type: "team", counts_for_elo: false }),
  ];

  it("sorts newest first by default", () => {
    expect(filterTournaments(list, DEFAULT_HUB_FILTERS).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("treats Completed as completed or archived", () => {
    const out = filterTournaments(list, { ...DEFAULT_HUB_FILTERS, status: "completed" });
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("filters by type, ranked and search over name, venue and categories", () => {
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, type: "team" }).map((x) => x.id)).toEqual(["c"]);
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, ranked: "ranked" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, search: "gymkhana" }).map((x) => x.id)).toEqual(["c", "a"]);
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, search: "wd" }).map((x) => x.id)).toEqual(["a"]);
  });

  it("sorts by name or oldest first on request", () => {
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, sort: "name_asc" }).map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(filterTournaments(list, { ...DEFAULT_HUB_FILTERS, sort: "date_asc" }).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("hasActiveFilters", () => {
  it("ignores sort order and blank search", () => {
    expect(hasActiveFilters(DEFAULT_HUB_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_HUB_FILTERS, sort: "name_asc", search: "  " })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_HUB_FILTERS, ranked: "casual" })).toBe(true);
  });
});

describe("groupByStatus and displayStatus", () => {
  it("puts archived tournaments with past results", () => {
    const groups = groupByStatus([t("a", "active"), t("b", "archived"), t("c", "completed"), t("d", "upcoming")]);
    expect(groups.active.map((x) => x.id)).toEqual(["a"]);
    expect(groups.upcoming.map((x) => x.id)).toEqual(["d"]);
    expect(groups.past.map((x) => x.id)).toEqual(["b", "c"]);
    expect(displayStatus("archived")).toBe("completed");
    expect(displayStatus("active")).toBe("active");
  });
});

describe("duplicateNames", () => {
  it("finds names used more than once, ignoring case and spaces", () => {
    const names = duplicateNames([
      { id: "1", name: "Open" },
      { id: "2", name: " open " },
      { id: "3", name: "Trials" },
    ]);
    expect([...names]).toEqual(["open"]);
  });
});

describe("parseScoreSets and formatScoreLine", () => {
  it("reads the string score column", () => {
    expect(parseScoreSets("21-13, 18-21")).toEqual([{ s1: 21, s2: 13 }, { s1: 18, s2: 21 }]);
    expect(formatScoreLine("21-13,18-21")).toBe("21-13, 18-21");
  });

  it("reads older object scores", () => {
    expect(parseScoreSets({ sets: [{ team1: 21, team2: 19 }] })).toEqual([{ s1: 21, s2: 19 }]);
    expect(parseScoreSets({ current: { team1: 5, team2: 3 } })).toEqual([{ s1: 5, s2: 3 }]);
  });

  it("passes free text through and ignores empty scores", () => {
    expect(parseScoreSets(null)).toEqual([]);
    expect(formatScoreLine("Retired")).toBe("Retired");
    expect(formatScoreLine(null)).toBe("");
  });
});

describe("startsInLabel", () => {
  const now = new Date(2026, 10, 23, 15, 0);
  it("counts whole days to the start of an upcoming tournament", () => {
    expect(startsInLabel({ status: "upcoming", startDate: "2026-11-23" }, now)).toBe("Starts today");
    expect(startsInLabel({ status: "upcoming", startDate: "2026-11-24" }, now)).toBe("Starts tomorrow");
    expect(startsInLabel({ status: "upcoming", startDate: "2026-11-28" }, now)).toBe("Starts in 5 days");
  });
  it("says nothing for other statuses or undated tournaments", () => {
    expect(startsInLabel({ status: "active", startDate: "2026-11-23" }, now)).toBeNull();
    expect(startsInLabel({ status: "upcoming" }, now)).toBeNull();
  });
});

describe("formatDateRange", () => {
  it("drops the repeated month and year", () => {
    expect(formatDateRange("2026-10-16", "2026-10-18")).toBe("16–18 Oct 2026");
    expect(formatDateRange("2026-11-28", "2026-12-02")).toBe("28 Nov – 2 Dec 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
  });
  it("handles one-day, one-sided and missing dates", () => {
    expect(formatDateRange("2026-10-16", "2026-10-16")).toBe("16 Oct 2026");
    expect(formatDateRange("2026-10-16", null)).toBe("16 Oct 2026");
    expect(formatDateRange(null, "2026-10-18")).toBe("18 Oct 2026");
    expect(formatDateRange(null, null)).toBeNull();
  });
});
