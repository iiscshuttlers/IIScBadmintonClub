import { describe, expect, it } from "vitest";
import type { BracketMatch } from "./BracketVisual";
import {
  COL_GAP,
  COL_W,
  MATCH_H,
  MATCH_W,
  PADDING,
  SLOT_H,
  bracketConnectors,
  bracketPathIds,
  computeBracketLayout,
  findInBracket,
  fitScale,
  fuzzyMatch,
  initialHiddenRounds,
  isEliminatedAt,
  isPlayoffMatch,
  playerRoadmap,
  roadmapCardSides,
  segmentSlotRange,
  shortRoundName,
} from "./bracketLayout";

let seq = 0;
const bm = (o: Partial<BracketMatch> & { round: number; match_number: number }): BracketMatch => ({
  id: o.id ?? `m${++seq}`,
  match_code: o.match_code ?? `MS_R${o.round}_${String(o.match_number).padStart(2, "0")}`,
  round_name: o.round_name ?? `Round ${o.round}`,
  team1_label: o.team1_label ?? null,
  team2_label: o.team2_label ?? null,
  winner_side: o.winner_side ?? null,
  score: o.score ?? null,
  sets_history: o.sets_history ?? null,
  status: o.status ?? "pending",
  ...o,
});

/** A full knockout of `size` players: rounds 1..log2(size), "Winner of" labels after round 1. */
function draw(size: number, opts: { thirdPlace?: boolean } = {}): BracketMatch[] {
  const rounds = Math.log2(size);
  const out: BracketMatch[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let n = 1; n <= count; n++) {
      const code = `MS_R${r}_${String(n).padStart(2, "0")}`;
      out.push(bm({
        id: code,
        match_code: code,
        round: r,
        match_number: n,
        round_name: r === rounds ? "Final" : r === rounds - 1 ? "Semi-final" : `Round ${r}`,
        team1_label: r === 1 ? `P${2 * n - 1}` : `Winner of MS_R${r - 1}_${String(2 * n - 1).padStart(2, "0")}`,
        team2_label: r === 1 ? `P${2 * n}` : `Winner of MS_R${r - 1}_${String(2 * n).padStart(2, "0")}`,
      }));
    }
  }
  if (opts.thirdPlace && rounds >= 2) {
    out.push(bm({
      id: "MS_3RD_01",
      match_code: "MS_3RD_01",
      round: rounds - 1,
      match_number: 99,
      round_name: "3rd Place Playoff",
      team1_label: "Loser of SF1",
      team2_label: "Loser of SF2",
    }));
  }
  return out;
}

const roundsOf = (ms: BracketMatch[]) => [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
const cyOf = (layout: ReturnType<typeof computeBracketLayout>, code: string) =>
  layout.roundData.flatMap((r) => [...r.bySlot.values()]).find((p) => p.match.match_code === code)!.cy;

describe("shortRoundName", () => {
  it("abbreviates knockout stage names", () => {
    expect(shortRoundName("Round of 16", 2)).toBe("R16");
    expect(shortRoundName("Quarter-finals", 3)).toBe("QF");
    expect(shortRoundName("Semi-finals", 4)).toBe("SF");
    expect(shortRoundName("Final", 5)).toBe("Final");
  });

  it("keeps unknown names and falls back to the round number", () => {
    expect(shortRoundName("  Group A ", 1)).toBe("Group A");
    expect(shortRoundName(null, 3)).toBe("Round 3");
    expect(shortRoundName("", 2)).toBe("Round 2");
  });
});

describe("fuzzyMatch", () => {
  it("matches exact substrings case-insensitively", () => {
    expect(fuzzyMatch("kum", "Deepak Kumar")).toBe(true);
    expect(fuzzyMatch("KUMAR", "Deepak Kumar")).toBe(true);
  });

  it("tolerates one typo for 4-5 letter terms and two for 6+", () => {
    expect(fuzzyMatch("kumer", "Deepak Kumar")).toBe(true); // 1 substitution
    expect(fuzzyMatch("kuner", "Deepak Kumar")).toBe(false); // 2 substitutions in a 5-letter term
    expect(fuzzyMatch("deepek kumer", "Deepak Kumar")).toBe(true); // 2 substitutions, 12 letters
    expect(fuzzyMatch("deepek kemur", "Deepak Kumar")).toBe(false); // 3 substitutions
  });

  it("never fuzzes short terms and never matches a missing label", () => {
    expect(fuzzyMatch("kxm", "Deepak Kumar")).toBe(false);
    expect(fuzzyMatch("kumar", null)).toBe(false);
    expect(fuzzyMatch("kumar", undefined)).toBe(false);
  });
});

describe("isPlayoffMatch", () => {
  it("recognises the 3rd place playoff by number or name", () => {
    expect(isPlayoffMatch({ match_number: 99, round_name: "Semi-final" })).toBe(true);
    expect(isPlayoffMatch({ match_number: 3, round_name: "3rd Place Playoff" })).toBe(true);
    expect(isPlayoffMatch({ match_number: 1, round_name: "Semi-final" })).toBe(false);
    expect(isPlayoffMatch({ match_number: 1, round_name: null })).toBe(false);
  });
});

describe("initialHiddenRounds", () => {
  const big = (round: number, count: number, status: string) =>
    Array.from({ length: count }, (_, i) => bm({ round, match_number: i + 1, status, winner_side: status === "pending" ? null : 1 }));

  it("hides a leading run of large, fully decided rounds (walkovers count)", () => {
    const matches = [
      ...big(1, 32, "completed").map((m, i) => (i === 0 ? { ...m, status: "walkover" } : m)),
      ...big(2, 16, "completed"),
      ...big(3, 8, "completed"),
    ];
    expect(initialHiddenRounds(matches, [1, 2, 3])).toEqual([1, 2]);
  });

  it("stops at the first round that is still being played", () => {
    const matches = [...big(1, 32, "completed"), ...big(2, 16, "in_progress"), ...big(3, 16, "completed")];
    expect(initialHiddenRounds(matches, [1, 2, 3])).toEqual([1]);
  });

  it("never hides an unfinished first round or a small round", () => {
    expect(initialHiddenRounds([...big(1, 31, "completed"), ...big(1, 1, "scheduled")], [1])).toEqual([]);
    expect(initialHiddenRounds(big(1, 8, "completed"), [1, 2])).toEqual([]);
  });
});

describe("segmentSlotRange", () => {
  it("splits 32 base slots into halves and quarters", () => {
    expect(segmentSlotRange("full", 32)).toEqual({ start: 0, end: 31 });
    expect(segmentSlotRange("top-half", 32)).toEqual({ start: 0, end: 15 });
    expect(segmentSlotRange("bottom-half", 32)).toEqual({ start: 16, end: 31 });
    expect(segmentSlotRange("q1", 32)).toEqual({ start: 0, end: 7 });
    expect(segmentSlotRange("q2", 32)).toEqual({ start: 8, end: 15 });
    expect(segmentSlotRange("q3", 32)).toEqual({ start: 16, end: 23 });
    expect(segmentSlotRange("q4", 32)).toEqual({ start: 24, end: 31 });
  });

  it("never returns an empty window for a tiny draw", () => {
    expect(segmentSlotRange("top-half", 1)).toEqual({ start: 0, end: 0 });
    expect(segmentSlotRange("q1", 2)).toEqual({ start: 0, end: 0 });
  });
});

describe("computeBracketLayout", () => {
  it("puts each first-round match on its own slot and centres parents on their feeders", () => {
    const matches = draw(8);
    const layout = computeBracketLayout(matches, [1, 2, 3], [1, 2, 3], "full");

    expect(layout.baseSlots).toBe(4);
    expect(layout.totalW).toBe(3 * COL_W);
    expect(layout.totalH).toBe(4 * SLOT_H);
    for (let n = 1; n <= 4; n++) {
      expect(cyOf(layout, `MS_R1_0${n}`)).toBe((n - 1) * SLOT_H + SLOT_H / 2);
    }
    expect(cyOf(layout, "MS_R2_01")).toBe((cyOf(layout, "MS_R1_01") + cyOf(layout, "MS_R1_02")) / 2);
    expect(cyOf(layout, "MS_R2_02")).toBe((cyOf(layout, "MS_R1_03") + cyOf(layout, "MS_R1_04")) / 2);
    expect(cyOf(layout, "MS_R3_01")).toBe((cyOf(layout, "MS_R2_01") + cyOf(layout, "MS_R2_02")) / 2);

    const first = layout.roundData[0].positions.find((p) => p.match.match_code === "MS_R1_01")!;
    expect(first.y).toBe(first.cy - MATCH_H / 2);
    expect(layout.roundData.map((r) => r.label)).toEqual(["Round 1", "Semi-final", "Final"]);
  });

  it("places by match_number, so a match missing from the draw leaves a gap instead of shifting the rest", () => {
    const full = computeBracketLayout(draw(8), [1, 2, 3], [1, 2, 3], "full");
    const gappy = draw(8).filter((m) => m.match_code !== "MS_R1_02");
    const layout = computeBracketLayout(gappy, [1, 2, 3], [1, 2, 3], "full");

    for (const code of ["MS_R1_01", "MS_R1_03", "MS_R1_04", "MS_R2_01", "MS_R2_02", "MS_R3_01"]) {
      expect(cyOf(layout, code), code).toBe(cyOf(full, code));
    }
    expect(layout.roundData[0].bySlot.has(1)).toBe(false);
  });

  it("orders the tree by match_number even when the rows arrive shuffled", () => {
    const shuffled = [...draw(8)].reverse();
    const layout = computeBracketLayout(shuffled, [1, 2, 3], [1, 2, 3], "full");
    expect(layout.roundData[0].positions.map((p) => p.match.match_code)).toEqual([
      "MS_R1_01", "MS_R1_02", "MS_R1_03", "MS_R1_04",
    ]);
  });

  it("hangs the 3rd place playoff below the tree without moving the semifinals", () => {
    const without = computeBracketLayout(draw(8), [1, 2, 3], [1, 2, 3], "full");
    const withPlayoff = computeBracketLayout(draw(8, { thirdPlace: true }), [1, 2, 3], [1, 2, 3], "full");

    expect(cyOf(withPlayoff, "MS_R2_01")).toBe(cyOf(without, "MS_R2_01"));
    expect(cyOf(withPlayoff, "MS_R2_02")).toBe(cyOf(without, "MS_R2_02"));
    const sf = withPlayoff.roundData[1];
    expect(sf.bySlot.get(9999)?.match.match_code).toBe("MS_3RD_01");
    expect(cyOf(withPlayoff, "MS_3RD_01")).toBe(4 * SLOT_H + SLOT_H / 2);
    // The column is still named after the tree, not the playoff.
    expect(sf.label).toBe("Semi-final");
    expect(withPlayoff.totalH).toBe(without.totalH + SLOT_H);
  });

  it("only adds the playoff row for segments that reach the bottom of the draw", () => {
    const matches = draw(32, { thirdPlace: true });
    const rounds = roundsOf(matches);
    const top = computeBracketLayout(matches, rounds, rounds, "top-half");
    const bottom = computeBracketLayout(matches, rounds, rounds, "bottom-half");
    expect(top.totalH).toBe(8 * SLOT_H);
    expect(bottom.totalH).toBe(8 * SLOT_H + SLOT_H);
  });

  it("windows a half: the top half shows only its own first-round matches", () => {
    const matches = draw(32);
    const rounds = roundsOf(matches);
    const top = computeBracketLayout(matches, rounds, rounds, "top-half");
    const r1 = top.roundData[0].positions.map((p) => p.match.match_number);
    expect(Math.max(...r1)).toBeLessThanOrEqual(9); // 8 in view, plus at most one bleeding past the edge
    expect(r1).toContain(1);
    expect(r1).not.toContain(16);
  });

  it("shifts the bottom half up so its first match starts at the top", () => {
    const matches = draw(32);
    const rounds = roundsOf(matches);
    const bottom = computeBracketLayout(matches, rounds, rounds, "bottom-half");
    expect(cyOf(bottom, "MS_R1_09")).toBe(SLOT_H / 2);
    expect(bottom.roundData[0].positions.map((p) => p.match.match_number)).not.toContain(1);
  });

  it("re-bases the draw on the first visible round when early rounds are hidden", () => {
    const matches = draw(16);
    const layout = computeBracketLayout(matches, [1, 2, 3, 4], [2, 3, 4], "full");
    expect(layout.baseSlots).toBe(4);
    expect(layout.roundData[0].round).toBe(2);
    expect(layout.roundData[0].ri).toBe(0);
    expect(cyOf(layout, "MS_R2_01")).toBe(SLOT_H / 2);
    expect(cyOf(layout, "MS_R3_01")).toBe((cyOf(layout, "MS_R2_01") + cyOf(layout, "MS_R2_02")) / 2);
  });
});

describe("bracketConnectors", () => {
  it("draws two stubs, a spine and an outgoing line for a full pair", () => {
    const layout = computeBracketLayout(draw(4), [1, 2], [1, 2], "full");
    const lines = bracketConnectors(layout.roundData);
    const xMid = MATCH_W + COL_GAP / 2;
    const sf1 = cyOf(layout, "MS_R1_01");
    const sf2 = cyOf(layout, "MS_R1_02");
    const fin = cyOf(layout, "MS_R2_01");

    expect(lines).toEqual([
      { key: "a-0-0", x1: MATCH_W, y1: sf1, x2: xMid, y2: sf1 },
      { key: "b-0-0", x1: MATCH_W, y1: sf2, x2: xMid, y2: sf2 },
      { key: "c-0-0", x1: xMid, y1: sf1, x2: xMid, y2: sf2 },
      { key: "d-0-0", x1: xMid, y1: fin, x2: COL_W, y2: fin },
    ]);
  });

  it("draws no spine for a missing feeder and nothing into the playoff", () => {
    const matches = draw(4, { thirdPlace: true }).filter((m) => m.match_code !== "MS_R1_02");
    // Put the playoff in the final's column so it would be a "next" slot.
    const playoff = matches.find((m) => m.match_code === "MS_3RD_01")!;
    playoff.round = 2;
    const layout = computeBracketLayout(matches, [1, 2], [1, 2], "full");
    const keys = bracketConnectors(layout.roundData).map((l) => l.key);
    expect(keys).toEqual(["a-0-0", "d-0-0"]);
  });
});

describe("bracketPathIds", () => {
  it("finds every match naming the player, case-insensitively", () => {
    const matches = [
      bm({ id: "a", round: 1, match_number: 1, team1_label: "Anita Rao", team2_label: "Bela" }),
      bm({ id: "b", round: 2, match_number: 1, team1_label: "ANITA RAO", team2_label: "Chitra" }),
      bm({ id: "c", round: 1, match_number: 2, team1_label: "Deepa", team2_label: "Esha" }),
    ];
    expect([...bracketPathIds(matches, "anita rao")].sort()).toEqual(["a", "b"]);
  });

  it("can be searched by match code, which also lights up the match it feeds", () => {
    const matches = draw(8);
    expect([...bracketPathIds(matches, "MS_R2_01")].sort()).toEqual(["MS_R2_01", "MS_R3_01"]);
  });

  it("adds nothing for a player who is not in the draw", () => {
    expect(bracketPathIds(draw(8), "Nobody").size).toBe(0);
  });
});

describe("playerRoadmap", () => {
  it("follows 'Winner of' slots from the player's first match to the final", () => {
    const matches = draw(8);
    const { roadmap } = playerRoadmap(matches, "P3");
    expect(roadmap.map((m) => m.match_code)).toEqual(["MS_R1_02", "MS_R2_01", "MS_R3_01"]);
  });

  it("does not wander into the other half of the draw", () => {
    const { pathMatchIds } = playerRoadmap(draw(8), "P3");
    expect(pathMatchIds.has("MS_R1_03")).toBe(false);
    expect(pathMatchIds.has("MS_R2_02")).toBe(false);
  });

  it("joins the real name once the bracket has advanced the player", () => {
    const matches = draw(8).map((m) =>
      m.match_code === "MS_R1_02" ? { ...m, status: "completed", winner_side: 1 as const }
      : m.match_code === "MS_R2_01" ? { ...m, team2_label: "P3" }
      : m,
    );
    const { roadmap } = playerRoadmap(matches, "P3");
    expect(roadmap.map((m) => m.match_code)).toEqual(["MS_R1_02", "MS_R2_01", "MS_R3_01"]);
  });
});

describe("roadmapCardSides", () => {
  const matches = draw(8);
  const road = playerRoadmap(matches, "P4");

  it("puts the player on their own side and reports a win from side 2", () => {
    const r1 = { ...matches.find((m) => m.match_code === "MS_R1_02")!, status: "completed", winner_side: 2 as const };
    expect(roadmapCardSides(r1, "P4", road)).toEqual({
      playerName: "P4",
      opponentName: "P3",
      effectivePlayerIsT1: false,
      playerWon: true,
      playerLost: false,
    });
  });

  it("treats a walkover against the player as a loss", () => {
    const r1 = { ...matches.find((m) => m.match_code === "MS_R1_02")!, status: "walkover", winner_side: 1 as const };
    const sides = roadmapCardSides(r1, "P4", road);
    expect(sides.playerWon).toBe(false);
    expect(sides.playerLost).toBe(true);
  });

  it("uses the 'Winner of' slot that leads back to the player", () => {
    const sf = matches.find((m) => m.match_code === "MS_R2_01")!;
    const sides = roadmapCardSides(sf, "P4", road);
    expect(sides.playerName).toBe("Winner of MS_R1_02");
    expect(sides.opponentName).toBe("Winner of MS_R1_01");
    expect(sides.effectivePlayerIsT1).toBe(false);
    expect(sides.playerWon).toBe(false);
    expect(sides.playerLost).toBe(false);
  });
});

describe("isEliminatedAt", () => {
  const m = (o: Partial<BracketMatch>) => bm({ round: 1, match_number: 1, team1_label: "P1", team2_label: "P2", ...o });

  it("is true only once the player's last match is decided against them", () => {
    expect(isEliminatedAt(m({ status: "completed", winner_side: 2 }), "P1")).toBe(true);
    expect(isEliminatedAt(m({ status: "completed", winner_side: 1 }), "P1")).toBe(false);
    expect(isEliminatedAt(m({ status: "completed", winner_side: 2 }), "P2")).toBe(false);
    expect(isEliminatedAt(m({ status: "walkover", winner_side: 1 }), "P2")).toBe(true);
  });

  it("is false while the match is still to be played", () => {
    expect(isEliminatedAt(m({ status: "in_progress", winner_side: null }), "P1")).toBe(false);
    expect(isEliminatedAt(m({ status: "scheduled" }), "P1")).toBe(false);
  });
});

describe("findInBracket", () => {
  const layoutOf = (ms: BracketMatch[]) => computeBracketLayout(ms, roundsOf(ms), roundsOf(ms), "full").roundData;

  it("prefers an exact match even when a fuzzy one comes first", () => {
    const ms = [
      bm({ round: 1, match_number: 1, team1_label: "Ravi Kumer", team2_label: "X" }),
      bm({ round: 1, match_number: 2, team1_label: "Y", team2_label: "Ravi Kumar" }),
      bm({ round: 2, match_number: 1 }),
    ];
    const hit = findInBracket(layoutOf(ms), "Kumar");
    expect(hit?.pos.match.match_number).toBe(2);
    expect(hit?.playerName).toBe("Ravi Kumar");
    expect(hit?.ri).toBe(0);
  });

  it("falls back to the first fuzzy match", () => {
    const ms = [
      bm({ round: 1, match_number: 1, team1_label: "Anil", team2_label: "Ravi Kumar" }),
      bm({ round: 1, match_number: 2, team1_label: "Ravi Kumer", team2_label: "Z" }),
      bm({ round: 2, match_number: 1 }),
    ];
    const hit = findInBracket(layoutOf(ms), "kumur");
    expect(hit?.pos.match.match_number).toBe(1);
    expect(hit?.playerName).toBe("Ravi Kumar");
  });

  it("returns no player name for a match-code hit, and null when nothing matches", () => {
    const rd = layoutOf(draw(8));
    const hit = findInBracket(rd, "ms_r2_02");
    expect(hit?.pos.match.match_code).toBe("MS_R2_02");
    expect(hit?.ri).toBe(1);
    expect(hit?.playerName).toBeNull();
    expect(findInBracket(rd, "zzzz")).toBeNull();
  });
});

describe("fitScale", () => {
  it("fits the visible rounds to the width, rounded to 2 decimals", () => {
    const contentW = 4 * COL_W + PADDING * 2;
    expect(fitScale(contentW / 0.97, 4)).toBe(1);
    expect(fitScale(900, 4)).toBe(+((900 * 0.97) / contentW).toFixed(2));
  });

  it("never goes below 70% or above 125%", () => {
    expect(fitScale(100, 7)).toBe(0.7);
    expect(fitScale(5000, 1)).toBe(1.25);
  });
});
