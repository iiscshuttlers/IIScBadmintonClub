import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CourtVisual } from "./CourtVisual";
import { computeAddPoint } from "@/lib/umpire/umpireMutations";
import type { BwfMatchState } from "@/types/umpire";

const NAMES = { t1: "Minakshi", t1p2: "Priya", t2: "Madhuvanthi", t2p2: "Radhika" };

const doublesMatch = (over?: Partial<BwfMatchState>): BwfMatchState => ({
  id: "m",
  t1: { p1Id: "a", p1Name: NAMES.t1, p2Id: "b", p2Name: NAMES.t1p2, score: 0, games: 0 },
  t2: { p1Id: "c", p1Name: NAMES.t2, p2Id: "d", p2Name: NAMES.t2p2, score: 0, games: 0 },
  bestOfSets: 1,
  pointsToWin: 21,
  goldenPoint: 30,
  status: "playing",
  serverTeam: 2,
  serverPlayerIndex: 0,
  receiverPlayerIndex: 0,
  t1LastServedBy: 1,
  t2LastServedBy: 1,
  endsSwapped: false,
  setsHistory: [],
  pointLog: [],
  t1RightCourt: 0,
  t2RightCourt: 0,
  courtId: "c1",
  eventSlug: null,
  isFriendly: true,
  createdAt: 0,
  updatedAt: 0,
  umpireId: "u",
  ...overrideSafe(over),
} as BwfMatchState);

function overrideSafe(over?: Partial<BwfMatchState>) {
  return over ?? {};
}

/** Read each player's drawn row ("TOP" | "BOT") out of the rendered diagram. */
function rowsOf(m: BwfMatchState): Record<string, "TOP" | "BOT"> {
  const { container, unmount } = render(
    <CourtVisual
      serverTeam={m.serverTeam}
      serverPlayerIndex={m.serverPlayerIndex}
      receiverPlayerIndex={m.receiverPlayerIndex}
      t1RightCourt={m.t1RightCourt}
      t2RightCourt={m.t2RightCourt}
      t1Name={m.t1.p1Name}
      t2Name={m.t2.p1Name}
      t1P2Name={m.t1.p2Name}
      t2P2Name={m.t2.p2Name}
      t1Score={m.t1.score}
      t2Score={m.t2.score}
      isDoubles
      endsSwapped={m.endsSwapped}
    />,
  );

  const rows: Record<string, "TOP" | "BOT"> = {};
  container.querySelectorAll<HTMLElement>("[style*='top']").forEach((el) => {
    // The first text node of each overlay is the player's name.
    const name = (el.childNodes[0]?.textContent ?? "").trim();
    if (!name) return;
    rows[name] = el.style.top === "12%" ? "TOP" : "BOT";
  });
  unmount();
  return rows;
}

/** Whoever is labelled RECEIVER in the diagram. */
function receiverIn(m: BwfMatchState): string | undefined {
  const { container, unmount } = render(
    <CourtVisual
      serverTeam={m.serverTeam}
      serverPlayerIndex={m.serverPlayerIndex}
      receiverPlayerIndex={m.receiverPlayerIndex}
      t1RightCourt={m.t1RightCourt}
      t2RightCourt={m.t2RightCourt}
      t1Name={m.t1.p1Name}
      t2Name={m.t2.p1Name}
      t1P2Name={m.t1.p2Name}
      t2P2Name={m.t2.p2Name}
      t1Score={m.t1.score}
      t2Score={m.t2.score}
      isDoubles
      endsSwapped={m.endsSwapped}
    />,
  );
  let found: string | undefined;
  container.querySelectorAll<HTMLElement>("[style*='top']").forEach((el) => {
    if (el.textContent?.includes("RECEIVER")) found = (el.childNodes[0]?.textContent ?? "").trim();
  });
  unmount();
  return found;
}

const play = (m: BwfMatchState, team: 1 | 2): BwfMatchState =>
  ({ ...m, ...computeAddPoint(m, team)! }) as BwfMatchState;

describe("CourtVisual", () => {
  it("holds the receiving pair still through an unanswered run of serves", () => {
    // The regression: the receiving pair swapped rows on every point while the
    // serving side racked up points, because their position was derived from
    // the alternating "active receiver" instead of their court occupancy.
    let m = doublesMatch();
    const start = rowsOf(m);

    for (let i = 0; i < 6; i++) {
      m = play(m, 2); // serving side keeps winning
      const rows = rowsOf(m);
      expect(rows[NAMES.t1]).toBe(start[NAMES.t1]);
      expect(rows[NAMES.t1p2]).toBe(start[NAMES.t1p2]);
    }
    expect(m.t2.score).toBe(6);
  });

  it("swaps the serving pair on every point they win", () => {
    let m = doublesMatch();
    const before = rowsOf(m);
    m = play(m, 2);
    const after = rowsOf(m);

    expect(after[NAMES.t2]).not.toBe(before[NAMES.t2]);
    expect(after[NAMES.t2p2]).not.toBe(before[NAMES.t2p2]);
  });

  it("draws server and receiver diagonally opposite", () => {
    let m = doublesMatch();
    const seq: (1 | 2)[] = [2, 2, 1, 1, 2, 1, 2];
    for (const team of seq) {
      m = play(m, team);
      const rows = rowsOf(m);
      const serverName = m.serverTeam === 1
        ? [m.t1.p1Name, m.t1.p2Name!][m.serverPlayerIndex]
        : [m.t2.p1Name, m.t2.p2Name!][m.serverPlayerIndex];
      const receiverName = m.serverTeam === 1
        ? [m.t2.p1Name, m.t2.p2Name!][m.receiverPlayerIndex]
        : [m.t1.p1Name, m.t1.p2Name!][m.receiverPlayerIndex];
      // Across a vertical net the diagonal is the opposite row.
      expect(rows[receiverName]).not.toBe(rows[serverName]);
    }
  });

  it("labels the receiver the engine chose, not one derived from parity", () => {
    let m = doublesMatch();
    for (const team of [2, 2, 1, 2, 1, 1] as (1 | 2)[]) {
      m = play(m, team);
      const expected = m.serverTeam === 1
        ? [m.t2.p1Name, m.t2.p2Name!][m.receiverPlayerIndex]
        : [m.t1.p1Name, m.t1.p2Name!][m.receiverPlayerIndex];
      expect(receiverIn(m)).toBe(expected);
    }
  });

  it("mirrors both pairs when ends change, keeping their service courts", () => {
    const m = doublesMatch({ t1RightCourt: 0, t2RightCourt: 1 });
    const before = rowsOf(m);
    const after = rowsOf({ ...m, endsSwapped: true } as BwfMatchState);

    // Everyone is drawn on the other row: they walked to the other end but each
    // still stands in the same service court.
    for (const name of Object.values(NAMES)) {
      expect(after[name]).not.toBe(before[name]);
    }
  });

  it("falls back to serve state for matches saved without court positions", () => {
    const legacy = doublesMatch({
      t1RightCourt: undefined,
      t2RightCourt: undefined,
      serverTeam: 2,
      serverPlayerIndex: 1,
      receiverPlayerIndex: 1,
      t2: { p1Id: "c", p1Name: NAMES.t2, p2Id: "d", p2Name: NAMES.t2p2, score: 4, games: 0 },
    });
    const rows = rowsOf(legacy);
    // T2 serves at 4 (even) from their right court, drawn on the top row.
    expect(rows[NAMES.t2p2]).toBe("TOP");
    // The receiver is diagonally opposite.
    expect(rows[NAMES.t1p2]).toBe("BOT");
  });
});
