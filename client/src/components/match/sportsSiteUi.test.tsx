import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MatchView } from "@/lib/matchView";

/**
 * Render tests for the sports-site plan surfaces that need a signed-in user or
 * a live match to appear in the app: live ticker, form chips, Pulse items,
 * Points tab and rank movement badges.
 */

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const liveViews = vi.hoisted(() => ({ views: [] as MatchView[] }));
vi.mock("@/hooks/queries/useMatchViews", () => ({
  COMPLETED_PAGE_SIZE: 30,
  STALE_AFTER_MS: 120000,
  useOpenMatchViews: () => ({ views: liveViews.views, status: "ready", updatedAt: 0, refreshFailed: false, retry: () => {}, online: true }),
  useFinishedMatchViews: () => ({ views: [], status: "ready", updatedAt: 0, refreshFailed: false, retry: () => {}, hasMore: false }),
}));

import { LiveScoreTicker } from "@/components/match/LiveScoreTicker";
import { FormChips } from "@/components/match/MatchPrimitives";
import { PulseMatchItem } from "@/components/pulse/PulseMatchItem";
import { MatchPointsTab } from "@/components/match/MatchPointsTab";
import { RankMovementBadge } from "@/components/players-directory/RankMovementBadge";
import { MatchCentre } from "@/components/match/MatchCentre";

function view(p: Partial<MatchView> = {}): MatchView {
  return {
    id: "m1",
    tournamentId: "t1",
    discipline: "MS",
    categoryLabel: "Men's Singles",
    roundName: "Final",
    round: 3,
    matchNumber: 1,
    matchCode: "MS_F_1",
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "Asha", playerIds: ["a"], seed: 1, isWinner: false, isTbd: false, isBye: false },
      { label: "Bala", playerIds: ["b"], seed: null, isWinner: false, isTbd: false, isBye: false },
    ],
    state: "live",
    statusLabel: "Live",
    games: [
      { side1: 21, side2: 18 },
      { side1: 7, side2: 9 },
    ],
    scoreText: null,
    court: "2",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    nextMatchCode: null,
    ...p,
  };
}

describe("LiveScoreTicker", () => {
  it("renders nothing when no match is live", () => {
    liveViews.views = [view({ state: "scheduled" })];
    const { container } = render(<LiveScoreTicker tournamentId="t1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current game score, games won and links to the match", () => {
    liveViews.views = [view()];
    render(<LiveScoreTicker tournamentId="t1" heading={<span>Live now · Open</span>} />);
    const link = screen.getByRole("link", { name: /Live: Asha 7, Bala 9, MS · Court 2/ });
    expect(link).toHaveAttribute("href", "/tournaments/t1/matches/m1");
    expect(screen.getByText("Live now · Open")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument(); // Asha won game 1
  });
});

describe("FormChips", () => {
  it("shows letters newest-first with a spoken summary and walkover marks", () => {
    render(
      <FormChips
        entries={[
          { matchId: "x", tournamentId: "t", result: "W", walkover: false, opponentLabel: "Bala", eventLabel: "MS · Final", date: "2026-08-23T10:00:00Z" },
          { matchId: "y", tournamentId: "t", result: "L", walkover: true, opponentLabel: "Chitra", eventLabel: "MS · SF", date: null },
        ]}
      />,
    );
    expect(screen.getByText("Won 1 of last 2 tournament matches.")).toBeInTheDocument();
    const chips = screen.getAllByRole("link");
    // A walkover keeps its result letter and colour, with "w/o" under it (no made-up "L/O").
    expect(chips.map((c) => c.textContent)).toEqual(["W", "Lw/o"]);
    expect(chips[1].className).toContain("bg-rose-600");
    expect(chips[0]).toHaveAccessibleName(/^Won vs Bala, MS · Final, 23 Aug$/);
    expect(chips[1]).toHaveAccessibleName(/^Lost \(walkover\) vs Chitra, MS · SF$/);
  });

  it("has an empty state", () => {
    render(<FormChips entries={[]} />);
    expect(screen.getByText("No completed tournament matches yet")).toBeInTheDocument();
  });
});

describe("PulseMatchItem", () => {
  const row = {
    id: "m9",
    tournament_id: "t1",
    category: "XD",
    match_code: "XD_R1_M1",
    round: 1,
    round_name: "Round 1",
    match_number: 1,
    team1_label: "Alpha / Beta",
    team2_label: "Gamma / Delta",
    player1_id: "p1",
    player2_id: "p2",
    player3_id: "p3",
    player4_id: "p4",
    court_number: "C1",
    status: "completed",
    score: "21-15, 21-17",
    sets_history: ["21-15", "21-17"],
    scheduled_at: null,
    started_at: null,
    ended_at: null,
    winner_side: 1,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
  };

  it("uses the shared scorecard with badges, the poll outside the link, and the old anchor id", () => {
    const { container } = render(
      <PulseMatchItem match={row} isMatchOfTheDay upsetDiff={180} prediction={<p>poll</p>} />,
    );
    expect(container.querySelector("#match-card-m9")).not.toBeNull();
    expect(screen.getByText("Match of the day")).toBeInTheDocument();
    expect(screen.getByText("Upset +180")).toBeInTheDocument();
    expect(screen.getByText("XD")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Like this match/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Share result/ })).toBeInTheDocument();
    expect(screen.getByText("poll").closest("a")).toBeNull();
  });
});

describe("MatchPointsTab", () => {
  const points = [
    ...Array.from({ length: 11 }, (_, i) => [1, 1, i + 1, 0, 1, 1_700_000_000_000 + i * 20_000]),
    [1, 0, 11, 0, 1, 0], // let: ignored
    [1, 2, 11, 1, 2, 1_700_000_300_000],
  ];

  it("shows key moments, a chart per game and a table view", () => {
    render(
      <MatchPointsTab
        view={view({ state: "live", games: [{ side1: 11, side2: 1 }] })}
        log={{ points, pointCount: points.length, final: false, supersededByCorrection: false, updatedAt: "" }}
      />,
    );
    expect(screen.getByText("Asha won 11 rallies in a row")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Live point history · 12 scoring rallies recorded so far.");
    expect(screen.getByRole("img", { name: /Game 1 points progression over 12 rallies, final score 11–1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // last row: after rally 12
  });

  it("warns when the result was corrected after play", () => {
    render(
      <MatchPointsTab view={view()} log={{ points, pointCount: 13, final: true, supersededByCorrection: true, updatedAt: "" }} />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(/Corrected result/);
  });

  it("uses the configured halfway interval for a 30-point game", () => {
    const thirtyPointLog = Array.from({ length: 15 }, (_, i) => [1, 1, i + 1, 0, 1, 1_700_000_000_000 + i * 20_000]);
    render(
      <MatchPointsTab
        view={view({ state: "live", pointsToWin: 30 })}
        log={{ points: thirtyPointLog, pointCount: thirtyPointLog.length, final: false, supersededByCorrection: false, updatedAt: "" }}
        rules={{ pointsToWin: 30, goldenPoint: 30, bestOf: 1 }}
      />,
    );
    expect(screen.getByText("Interval 15")).toBeInTheDocument();
    expect(screen.queryByText("Interval 11")).not.toBeInTheDocument();
  });

  it("labels a completed contiguous history as complete", () => {
    const complete = Array.from({ length: 21 }, (_, i) => [1, 1, i + 1, 0, 1, 1_700_000_000_000 + i * 20_000]);
    render(
      <MatchPointsTab
        view={view({ state: "completed", games: [{ side1: 21, side2: 0 }] })}
        log={{ points: complete, pointCount: complete.length, final: true, supersededByCorrection: false, updatedAt: "" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Complete point history · 21 scoring rallies.");
  });

  it("labels a truncated history as partial and avoids unsupported completeness", () => {
    const partial = Array.from({ length: 11 }, (_, i) => [1, 1, i + 1, 0, 1, 1_700_000_000_000 + i * 20_000]);
    render(
      <MatchPointsTab
        view={view({ state: "completed", games: [{ side1: 21, side2: 0 }] })}
        log={{ points: partial, pointCount: partial.length, final: true, supersededByCorrection: false, updatedAt: "" }}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("Partial point history");
    expect(screen.queryByText(/Complete point history/)).not.toBeInTheDocument();
  });
});

describe("RankMovementBadge", () => {
  it("shows an arrow with words for screen readers, and nothing before comparisons exist", () => {
    const { rerender, container } = render(
      <RankMovementBadge movement={{ rank: 3, previousRank: 5, delta: 2, status: "moved", since: "2026-11-16", peakRank: 3 }} />,
    );
    expect(screen.getByText("▲2")).toBeInTheDocument();
    expect(screen.getByText(/Up 2 places since/)).toBeInTheDocument();
    rerender(<RankMovementBadge movement={{ rank: 3, previousRank: null, delta: null, status: "none", since: null, peakRank: 3 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MatchCentre", () => {
  it("groups court matches into playing now and next", () => {
    liveViews.views = [
      view({ id: "m1", court: "1", state: "live" }),
      view({ id: "m2", court: "1", state: "scheduled", scheduledAt: "2026-11-14T11:00:00Z" }),
    ];
    render(<MatchCentre tournamentId="t1" mode="live" />);
    // Switch to Courts view
    const courtsTab = screen.getByRole("tab", { name: /Courts/i });
    fireEvent.click(courtsTab);

    expect(screen.getByRole("heading", { name: "Court 1" })).toBeInTheDocument();
    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("warns when multiple matches are marked live on the same court simultaneously", () => {
    liveViews.views = [
      view({ id: "m1", court: "1", state: "live" }),
      view({ id: "m2", court: "1", state: "live" }),
    ];
    render(<MatchCentre tournamentId="t1" mode="live" />);
    fireEvent.click(screen.getByRole("tab", { name: /Courts/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Court conflict: 2 matches marked live simultaneously/);
  });

  it("marks unassigned fixtures in a dedicated section", () => {
    liveViews.views = [
      view({ id: "m1", court: "1", state: "live" }),
      view({ id: "m-unassigned", court: null, state: "scheduled" }),
    ];
    render(<MatchCentre tournamentId="t1" mode="live" />);
    fireEvent.click(screen.getByRole("tab", { name: /Courts/i }));

    expect(screen.getByRole("heading", { name: "Unassigned fixtures" })).toBeInTheDocument();
    expect(screen.getByText("1 fixture")).toBeInTheDocument();
  });

  it("opens on Upcoming when live broadcast cards are already shown above", () => {
    window.history.replaceState({}, "", "/");
    liveViews.views = [
      view({ id: "m1", court: "1", state: "live" }),
      view({ id: "m2", court: "2", state: "scheduled", scheduledAt: "2026-11-14T11:00:00Z" }),
    ];
    render(<MatchCentre tournamentId="t1" mode="live" liveShownAbove />);
    expect(screen.getByRole("tab", { name: /Upcoming/i })).toHaveAttribute("aria-selected", "true");

    // The viewer can still pick Live, and that choice sticks.
    fireEvent.click(screen.getByRole("tab", { name: /^Live/i }));
    expect(screen.getByRole("tab", { name: /^Live/i })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on Live when nothing is shown above", () => {
    window.history.replaceState({}, "", "/");
    liveViews.views = [view({ id: "m1", court: "1", state: "live" })];
    render(<MatchCentre tournamentId="t1" mode="live" />);
    expect(screen.getByRole("tab", { name: /^Live/i })).toHaveAttribute("aria-selected", "true");
  });
});
