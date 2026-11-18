import { describe, expect, it } from "vitest";
import {
  canonicalForLiveSubTab,
  canonicalFromHubQuery,
  canonicalFromPulse,
  defaultTabForStatus,
  isLiveTabOffered,
  liveSubTabFor,
  mapLegacySubTab,
  matchPath,
  parseMatchTab,
  matchShortPath,
  parseDiscipline,
  parseMatchListStatus,
  parseTournamentRouteFilters,
  parseTournamentTab,
  tournamentLink,
  tournamentPath,
} from "./tournamentRoutes";

const TID = "3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";
const MID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

describe("tournamentPath", () => {
  it("builds the bare canonical path", () => {
    expect(tournamentPath(TID)).toBe(`/tournaments/${TID}`);
  });

  it("adds tab and filters in a stable order", () => {
    expect(tournamentPath(TID, "results", { cat: "XD", court: "3", date: "2026-11-14", status: "completed" })).toBe(
      `/tournaments/${TID}/results?cat=XD&court=3&date=2026-11-14&status=completed`,
    );
  });

  it("drops invalid discipline and date filters", () => {
    expect(tournamentPath(TID, "live", { cat: "ALL" as any, date: "14/11/2026" })).toBe(`/tournaments/${TID}/live`);
  });

  it("carries a panel", () => {
    expect(tournamentPath(TID, null, { panel: "umpire" })).toBe(`/tournaments/${TID}?panel=umpire`);
  });
});

describe("match paths", () => {
  it("nests matches under their tournament", () => {
    expect(matchPath(TID, MID)).toBe(`/tournaments/${TID}/matches/${MID}`);
  });
  it("offers a short form", () => {
    expect(matchShortPath(MID)).toBe(`/matches/${MID}`);
  });
});

describe("parsers", () => {
  it("accepts every discipline including XD, case-insensitively", () => {
    for (const d of ["MS", "WS", "MD", "WD", "XD", "xd"]) expect(parseDiscipline(d)).toBe(d.toUpperCase());
    expect(parseDiscipline("ALL")).toBeNull();
    expect(parseDiscipline("mixed")).toBeNull();
  });

  it("rejects unknown tabs", () => {
    expect(parseTournamentTab("draw")).toBe("draw");
    expect(parseTournamentTab("brackets")).toBeNull();
    expect(parseTournamentTab(undefined)).toBeNull();
  });

  it("accepts only canonical match-list statuses", () => {
    expect(parseMatchListStatus("upcoming")).toBe("upcoming");
    expect(parseMatchListStatus("completed")).toBe("completed");
    expect(parseMatchListStatus("live")).toBeNull();
  });

  it("parses and sanitizes the complete route filter set", () => {
    expect(parseTournamentRouteFilters("?panel=umpire&cat=xd&court=2&date=2026-11-14&status=upcoming")).toEqual({
      panel: "umpire",
      cat: "XD",
      court: "2",
      date: "2026-11-14",
      status: "upcoming",
    });
    expect(parseTournamentRouteFilters("?panel=nope&cat=all&date=14-11-2026&status=live")).toEqual({
      panel: null,
      cat: null,
      court: null,
      date: null,
      status: null,
    });
  });
});

describe("lifecycle defaults", () => {
  it.each([
    ["upcoming", "overview"],
    ["draft", "overview"],
    ["active", "live"],
    ["completed", "results"],
    ["archived", "results"],
    [undefined, "overview"],
  ])("%s → %s", (status, tab) => {
    expect(defaultTabForStatus(status)).toBe(tab);
  });

  it("only offers Live while active unless the URL asked for it", () => {
    expect(isLiveTabOffered("active", "overview")).toBe(true);
    expect(isLiveTabOffered("completed", "results")).toBe(false);
    expect(isLiveTabOffered("completed", "live")).toBe(true);
  });
});

describe("tournamentLink", () => {
  it("uses the canonical route for DB tournaments regardless of slug", () => {
    expect(tournamentLink({ id: TID, slug: "invicta-2026" })).toBe(`/tournaments/${TID}`);
  });
  it("keeps /events/:slug for legacy archive records", () => {
    expect(tournamentLink({ id: "invicta-2019", slug: "invicta-2019" })).toBe("/events/invicta-2019");
  });
});

describe("mapLegacySubTab", () => {
  it.each([
    ["details", null, "active", { tab: "overview", panel: null }],
    ["brackets", null, "active", { tab: "draw", panel: null }],
    ["ties", null, "active", { tab: "draw", panel: null }],
    ["standings", null, "active", { tab: "draw", panel: null }],
    ["schedule", null, "upcoming", { tab: "schedule", panel: null }],
    ["matches", "completed", "active", { tab: "results", panel: null }],
    ["matches", "upcoming", "active", { tab: "live", panel: null }],
    ["matches", "upcoming", "upcoming", { tab: "schedule", panel: null }],
    ["matches", null, "completed", { tab: "results", panel: null }],
    ["matches", null, null, { tab: null, panel: null }],
    ["matches", "upcoming", null, { tab: "live", panel: null }],
    [null, null, "active", { tab: null, panel: null }],
    ["umpire", null, "active", { tab: null, panel: "umpire" }],
    ["my-matches", null, "active", { tab: null, panel: "my-matches" }],
    ["referee", null, "active", { tab: null, panel: "referee" }],
    ["organizer", null, "active", { tab: null, panel: "organizer" }],
    ["polls", null, "active", { tab: null, panel: "polls" }],
  ] as const)("%s/%s (%s)", (sub, status, tStatus, expected) => {
    expect(mapLegacySubTab(sub, status, tStatus)).toEqual(expected);
  });
});

describe("canonicalFromHubQuery", () => {
  it("returns null without an id", () => {
    expect(canonicalFromHubQuery("?subtab=details")).toBeNull();
  });

  it("maps a plain hub selection to the lifecycle default", () => {
    expect(canonicalFromHubQuery(`?id=${TID}`)).toBe(`/tournaments/${TID}`);
  });

  it("preserves tab, status and XD filter", () => {
    expect(canonicalFromHubQuery(`?id=${TID}&subtab=matches&m_status=completed&m_cat=XD`)).toBe(
      `/tournaments/${TID}/results?cat=XD`,
    );
  });

  it("maps official tabs to panels", () => {
    expect(canonicalFromHubQuery(`?id=${TID}&subtab=referee`)).toBe(`/tournaments/${TID}?panel=referee`);
  });

  it("accepts tournament_id as an alias", () => {
    expect(canonicalFromHubQuery(`tournament_id=${TID}&subtab=schedule`)).toBe(`/tournaments/${TID}/schedule`);
  });
});

describe("canonicalFromPulse", () => {
  it("leaves club-wide Pulse URLs alone", () => {
    expect(canonicalFromPulse("", "#live")).toBeNull();
    expect(canonicalFromPulse("?dir_q=raj", "#directory")).toBeNull();
  });

  it("sends a tournament-scoped Pulse link to the live tab", () => {
    expect(canonicalFromPulse(`?id=${TID}`, "#live")).toBe(`/tournaments/${TID}/live`);
  });

  it("honours legacy subtabs on Pulse", () => {
    expect(canonicalFromPulse(`?id=${TID}&subtab=brackets`, "#live")).toBe(`/tournaments/${TID}/draw`);
  });

  it("sends match-card anchors to the short match route", () => {
    expect(canonicalFromPulse("?tab=matches&m_status=completed&m_cat=ALL", `#match-card-${MID}`)).toBe(
      `/matches/${MID}`,
    );
  });
});

describe("LiveTab sub-tab bridge", () => {
  it("maps canonical tabs to the embedded LiveTab view", () => {
    expect(liveSubTabFor("overview", null, false)).toBe("details");
    expect(liveSubTabFor("draw", null, false)).toBe("brackets");
    expect(liveSubTabFor("draw", null, true)).toBe("ties");
    expect(liveSubTabFor("results", null, false)).toBe("matches");
    expect(liveSubTabFor("live", "umpire", false)).toBe("umpire");
  });

  it("round-trips LiveTab clicks back to canonical tabs", () => {
    expect(canonicalForLiveSubTab("brackets", "overview")).toEqual({ tab: "draw", panel: null });
    expect(canonicalForLiveSubTab("matches", "results")).toEqual({ tab: "results", panel: null });
    expect(canonicalForLiveSubTab("matches", "overview")).toEqual({ tab: "live", panel: null });
    expect(canonicalForLiveSubTab("organizer", "schedule")).toEqual({ tab: "schedule", panel: "organizer" });
  });
});

describe("match page tabs", () => {
  it("builds tab URLs, keeping Summary on the bare match URL", () => {
    expect(matchPath(TID, MID, "summary")).toBe(`/tournaments/${TID}/matches/${MID}`);
    expect(matchPath(TID, MID, "h2h")).toBe(`/tournaments/${TID}/matches/${MID}/h2h`);
    expect(matchPath(TID, MID, "info")).toBe(`/tournaments/${TID}/matches/${MID}/info`);
  });
  it("falls back to Summary for unknown or missing tabs", () => {
    expect(parseMatchTab(undefined)).toBe("summary");
    expect(parseMatchTab("bogus")).toBe("summary");
    expect(parseMatchTab("POINTS")).toBe("points");
  });
});
