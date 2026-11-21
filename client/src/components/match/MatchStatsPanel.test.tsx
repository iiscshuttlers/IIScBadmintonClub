import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { MatchView } from "@/lib/matchView";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/hooks/queries/usePlayerAvatars", () => ({
  usePlayerAvatars: () => ({ data: { a: { name: "Asha Rao", avatarUrl: null } } }),
}));

import { MatchPointsTab, rallyTicks } from "@/components/match/MatchPointsTab";
import { MatchStickyHeader } from "@/components/match/MatchStickyHeader";
import { MatchScoreStats } from "@/components/match/MatchScoreStats";

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
      { label: "Asha", playerIds: ["a"], seed: 1, isWinner: true, isTbd: false, isBye: false },
      { label: "Bala", playerIds: ["b"], seed: null, isWinner: false, isTbd: false, isBye: false },
    ],
    state: "completed",
    statusLabel: "Completed",
    games: [
      { side1: 21, side2: 15 },
      { side1: 18, side2: 21 },
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

/** Stored entries ([game, side, t1, t2, server, ts]) from a winner sequence per game. */
function log(games: string[]) {
  const out: number[][] = [];
  let ts = 1_700_000_000_000;
  games.forEach((seq, gi) => {
    let a = 0;
    let b = 0;
    for (const c of seq) {
      if (c === "1") a++;
      else b++;
      ts += 20_000;
      out.push([gi + 1, Number(c), a, b, Number(c), ts]);
    }
  });
  return out;
}

// Game 1: 21–15 (Asha), game 2: 18–21 (Bala).
const G1 = "12".repeat(15) + "1".repeat(6);
const G2 = "12".repeat(18) + "2".repeat(3);

describe("rallyTicks", () => {
  it("labels every 5, 10 or 20 rallies", () => {
    expect(rallyTicks(12)).toEqual([5, 10]);
    expect(rallyTicks(40)).toEqual([10, 20, 30, 40]);
    expect(rallyTicks(70)).toEqual([20, 40, 60]);
  });
});

describe("MatchPointsTab stats", () => {
  const points = log([G1, G2]);
  const render2 = () =>
    render(<MatchPointsTab view={view()} log={{ points, pointCount: points.length, final: true, supersededByCorrection: false, updatedAt: "" }} />);

  it("shows points won, head-to-head rows, who was ahead and game by game for the match", () => {
    render2();
    expect(screen.getByText("Asha won 39 points (52%), Bala won 36 (48%), out of 75.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Who led after each point/ })).toBeInTheDocument();
    expect(screen.getByText(/^Won on serve: Asha/)).toBeInTheDocument();
    expect(screen.getByText(/^Most points in a row: Asha 6, Bala 4\.$/)).toBeInTheDocument();
    const flow = screen.getByRole("table");
    expect(within(flow).getAllByRole("row")).toHaveLength(3); // header + 2 games
  });

  it("scopes everything to one game", () => {
    render2();
    const group = screen.getByRole("group", { name: "Show stats for" });
    fireEvent.click(within(group).getByRole("button", { name: /Game 2/ }));
    expect(within(group).getByRole("button", { name: /Game 2/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Asha won 18 points .* Bala won 21/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Game by game" })).toBeNull();
    expect(screen.getAllByRole("img", { name: /points progression/ })).toHaveLength(1);
  });

  it("points out a winner who scored fewer points", () => {
    // Asha wins 21–19 twice; Bala wins the middle game 21–0.
    const pts = log(["12".repeat(19) + "11", "2".repeat(21), "12".repeat(19) + "11"]);
    render(
      <MatchPointsTab
        view={view({ games: [{ side1: 21, side2: 19 }, { side1: 0, side2: 21 }, { side1: 21, side2: 19 }] })}
        log={{ points: pts, pointCount: pts.length, final: true, supersededByCorrection: false, updatedAt: "" }}
      />,
    );
    expect(screen.getByText("Bala won more points (59–42), but Asha won the match.")).toBeInTheDocument();
  });
});

describe("MatchStickyHeader", () => {
  it("shows the live game score, the server's shuttle and initials when there's no photo", () => {
    const ref = { current: null };
    render(
      <MatchStickyHeader
        view={view({ state: "live", statusLabel: "Live", sides: [view().sides[0], { ...view().sides[1], isWinner: false }], games: [{ side1: 21, side2: 15 }, { side1: 7, side2: 9 }] })}
        watch={ref}
        serving={2}
      />,
    );
    const bar = screen.getByTestId("match-sticky-header");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveTextContent("G2 · Live");
    expect(bar).toHaveTextContent("7–9");
    expect(bar).toHaveTextContent("AR"); // Asha Rao, no photo
    expect(bar.querySelectorAll("svg")).toHaveLength(1); // one shuttle, on Bala's side
  });

  it("shows games won once decided", () => {
    render(<MatchStickyHeader view={view()} watch={{ current: null }} serving={null} />);
    expect(screen.getByTestId("match-sticky-header")).toHaveTextContent("1–1");
  });
});

describe("MatchScoreStats (no point log)", () => {
  it("shows points won, takeaways, each game and head-to-head from the scores", () => {
    render(<MatchScoreStats view={view({ games: [{ side1: 24, side2: 22 }, { side1: 21, side2: 17 }] })} />);
    expect(screen.getByRole("note")).toHaveTextContent("Only the game scores were recorded for this match, so these stats come from them.");
    expect(screen.getByText("Asha won 45 points (54%), Bala won 39 (46%), out of 84.")).toBeInTheDocument();
    expect(screen.getByText("Asha won in straight games.")).toBeInTheDocument();
    expect(screen.getByText("Game 1: Asha 24, Bala 22, went to extra points.")).toBeInTheDocument();
    expect(screen.getByText("Games won: Asha 2, Bala 0.")).toBeInTheDocument();
    // Rally-by-rally sections need a point log.
    expect(screen.queryByRole("img", { name: /Who led after each point/ })).toBeNull();
  });
});
