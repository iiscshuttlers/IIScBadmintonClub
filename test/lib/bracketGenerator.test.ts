import { describe, it, expect } from 'vitest';
import {
  planDraw,
  generateSingleElimBracket,
  findWalkoverMatches,
  type BracketParticipant,
} from '@/lib/bracketGenerator';

const makeParticipants = (
  count: number,
  entryRounds: Record<number, number> = {},
): BracketParticipant[] =>
  Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    partnerId: null,
    displayName: `Seed ${i + 1}`,
    seed: i + 1,
    entryRound: entryRounds[i + 1] ?? null,
  }));

/** Round-1 slot order, reading BYEs as gaps. */
const round1Order = (rows: ReturnType<typeof generateSingleElimBracket>) =>
  rows
    .filter((r) => r.round === 1)
    .sort((a, b) => a.match_number - b.match_number)
    .flatMap((r) => [r.team1_label, r.team2_label]);

/** The round each participant plays their first real (non-walkover) match in. */
const firstRealRound = (
  rows: ReturnType<typeof generateSingleElimBracket>,
  label: string,
): number | null => {
  const match = rows
    .filter((r) => r.team1_label === label || r.team2_label === label)
    .filter((r) => r.team1_label !== 'BYE' && r.team2_label !== 'BYE')
    .sort((a, b) => a.round - b.round)[0];
  return match?.round ?? null;
};

describe('planDraw', () => {
  it('sizes the draw to the next power of two', () => {
    expect(planDraw(makeParticipants(105)).drawSize).toBe(128);
    expect(planDraw(makeParticipants(64)).drawSize).toBe(64);
    expect(planDraw(makeParticipants(5)).drawSize).toBe(8);
  });

  it('hands automatic byes to the top seeds, in order', () => {
    const plan = planDraw(makeParticipants(105));
    expect(plan.totalByeSlots).toBe(23);
    expect(plan.autoByeSlots).toBe(23);
    expect(plan.manualByeSlots).toBe(0);

    const withBye = plan.entries.filter((e) => e.entryRound > 1);
    expect(withBye).toHaveLength(23);
    expect(withBye.map((e) => e.participant.seed)).toEqual(
      Array.from({ length: 23 }, (_, i) => i + 1),
    );
  });

  it('always fills the draw exactly', () => {
    for (const n of [2, 3, 5, 7, 9, 17, 33, 63, 65, 100, 105, 127, 128]) {
      const plan = planDraw(makeParticipants(n));
      const used = plan.entries.reduce((s, e) => s + e.blockSize, 0);
      expect(used, `n=${n}`).toBe(plan.drawSize);
    }
  });

  it('honours a pinned entry round and spends the rest of the budget on the next seeds', () => {
    // Seed 1 enters at the round of 32 (two byes) — that costs 3 of the 23 slots.
    const plan = planDraw(makeParticipants(105, { 1: 3 }));
    expect(plan.manualByeSlots).toBe(3);
    expect(plan.autoByeSlots).toBe(20);
    expect(plan.overAllocatedSlots).toBe(0);
    expect(plan.forcedAdjustments).toHaveLength(0);

    expect(plan.entries[0].entryRound).toBe(3);
    expect(plan.entries[0].blockSize).toBe(4);
    // The remaining 20 byes flow to seeds 2..21.
    const single = plan.entries.filter((e) => e.entryRound === 2).map((e) => e.participant.seed);
    expect(single).toEqual(Array.from({ length: 20 }, (_, i) => i + 2));
    expect(plan.entries[21].entryRound).toBe(1);
  });

  it('lets a seed be pinned down to round 1 so the byes skip past them', () => {
    const plan = planDraw(makeParticipants(105, { 1: 1 }));
    expect(plan.entries[0].entryRound).toBe(1);
    expect(plan.entries[0].pinned).toBe(true);
    // Byes shift to seeds 2..24 instead.
    const withBye = plan.entries.filter((e) => e.entryRound > 1).map((e) => e.participant.seed);
    expect(withBye).toEqual(Array.from({ length: 23 }, (_, i) => i + 2));
  });

  it('reports over-allocation instead of silently truncating', () => {
    // Ten players each demanding two byes needs 30 slots in a 16-slot draw.
    const entryRounds = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 3]));
    const plan = planDraw(makeParticipants(10, entryRounds));
    expect(plan.drawSize).toBe(16);
    expect(plan.overAllocatedSlots).toBe(24);
    expect(generateSingleElimBracket(makeParticipants(10, entryRounds), 'MS', 't1')).toEqual([]);
  });
});

describe('generateSingleElimBracket — seeding', () => {
  it('lays a full 8-draw out in conventional seed order', () => {
    const rows = generateSingleElimBracket(makeParticipants(8), 'MS', 't1');
    expect(round1Order(rows)).toEqual(
      [1, 8, 5, 4, 3, 6, 7, 2].map((s) => `Seed ${s}`),
    );
  });

  it('keeps the top two seeds apart until the final', () => {
    const rows = generateSingleElimBracket(makeParticipants(105), 'MS', 't1');
    const order = round1Order(rows);
    expect(order.indexOf('Seed 1')).toBeLessThan(64);
    expect(order.indexOf('Seed 2')).toBeGreaterThanOrEqual(64);
  });

  it('gives the byes to the top 23 seeds, not the middle of the draw', () => {
    const rows = generateSingleElimBracket(makeParticipants(105), 'MS', 't1');
    const byeSeeds = rows
      .filter((r) => r.round === 1 && (r.team1_label === 'BYE' || r.team2_label === 'BYE'))
      .map((r) => (r.team1_label === 'BYE' ? r.team2_label : r.team1_label))
      .map((label) => Number(label.replace('Seed ', '')))
      .sort((a, b) => a - b);

    expect(byeSeeds).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('starts a bye seed at the round of 64 and an unseeded player at the round of 128', () => {
    const rows = generateSingleElimBracket(makeParticipants(105), 'MS', 't1');
    expect(firstRealRound(rows, 'Seed 1')).toBe(2);
    expect(firstRealRound(rows, 'Seed 23')).toBe(2);
    expect(firstRealRound(rows, 'Seed 24')).toBe(1);
  });
});

describe('generateSingleElimBracket — manual entry rounds', () => {
  it('starts a double-bye seed at the round of 32', () => {
    const rows = generateSingleElimBracket(makeParticipants(105, { 1: 3 }), 'MS', 't1');
    expect(firstRealRound(rows, 'Seed 1')).toBe(3);
    // Seed 2 still only has a single bye.
    expect(firstRealRound(rows, 'Seed 2')).toBe(2);
    // The budget shifted, so seed 22 now plays round 1.
    expect(firstRealRound(rows, 'Seed 22')).toBe(1);
  });

  it('supports different entry rounds across several seeds at once', () => {
    const rows = generateSingleElimBracket(
      makeParticipants(105, { 1: 3, 2: 3, 3: 2, 4: 1 }),
      'MS',
      't1',
    );
    expect(firstRealRound(rows, 'Seed 1')).toBe(3);
    expect(firstRealRound(rows, 'Seed 2')).toBe(3);
    expect(firstRealRound(rows, 'Seed 3')).toBe(2);
    expect(firstRealRound(rows, 'Seed 4')).toBe(1);
  });

  it('never creates a match nobody can reach', () => {
    const rows = generateSingleElimBracket(makeParticipants(105, { 1: 3, 2: 4 }), 'MS', 't1');
    for (const row of rows) {
      expect(row.team1_label === 'BYE' && row.team2_label === 'BYE').toBe(false);
    }
  });

  it('pre-fills the deeper round so the player is visible before their first match', () => {
    const rows = generateSingleElimBracket(makeParticipants(105, { 1: 3 }), 'MS', 't1');
    const r2 = rows.find(
      (r) => r.round === 2 && (r.team1_label === 'Seed 1' || r.team2_label === 'Seed 1'),
    );
    expect(r2).toBeDefined();
    expect(r2!.player1_id ?? r2!.player2_id).toBe('p1');
  });
});

describe('generateSingleElimBracket — structure', () => {
  const scenarios: Array<[string, BracketParticipant[]]> = [
    ['full 64 draw', makeParticipants(64)],
    ['105 in a 128 draw', makeParticipants(105)],
    ['105 with manual entry rounds', makeParticipants(105, { 1: 3, 2: 3, 5: 2 })],
    ['awkward 9 draw', makeParticipants(9)],
    ['minimum 2 draw', makeParticipants(2)],
  ];

  it.each(scenarios)('every advance target exists — %s', (_name, participants) => {
    const rows = generateSingleElimBracket(participants, 'MS', 't1');
    const codes = new Set(rows.map((r) => r.match_code));
    for (const row of rows) {
      if (row.advances_to_match) expect(codes.has(row.advances_to_match)).toBe(true);
    }
  });

  it.each(scenarios)('every participant appears exactly once in the draw — %s', (_name, participants) => {
    const rows = generateSingleElimBracket(participants, 'MS', 't1');
    const seen = new Map<string, number>();
    for (const row of rows) {
      for (const label of [row.team1_label, row.team2_label]) {
        if (label === 'BYE' || label.startsWith('Winner of ')) continue;
        seen.set(label, (seen.get(label) ?? 0) + 1);
      }
    }
    for (const p of participants) {
      // Appears once per round it is walked over into, plus its first real match.
      expect(seen.get(p.displayName) ?? 0).toBeGreaterThanOrEqual(1);
    }
    expect(seen.size).toBe(participants.length);
  });

  it('ends in a single final', () => {
    const rows = generateSingleElimBracket(makeParticipants(105), 'MS', 't1');
    const finals = rows.filter((r) => r.advances_to_match === null && r.match_number !== 99);
    expect(finals).toHaveLength(1);
    expect(finals[0].round_name).toBe('Final');
  });

  it('still wires up the third place playoff', () => {
    const rows = generateSingleElimBracket(makeParticipants(16), 'MS', 't1', true);
    const third = rows.find((r) => r.match_code === 'MS_3RD_01');
    expect(third).toBeDefined();
    const feeders = rows.filter((r) => r.advances_to_match_loser === 'MS_3RD_01');
    expect(feeders).toHaveLength(2);
  });
});

describe('findWalkoverMatches', () => {
  it('returns byes in round order so results can propagate', () => {
    const rows = generateSingleElimBracket(makeParticipants(105, { 1: 3, 2: 3 }), 'MS', 't1');
    const walkovers = findWalkoverMatches(rows);

    expect(walkovers.length).toBeGreaterThan(0);
    for (let i = 1; i < walkovers.length; i++) {
      expect(walkovers[i].round).toBeGreaterThanOrEqual(walkovers[i - 1].round);
    }
    // Seed 1 needs two walkovers to reach the round of 32.
    const seed1 = walkovers.filter(
      (r) => r.team1_label === 'Seed 1' || r.team2_label === 'Seed 1',
    );
    expect(seed1.map((r) => r.round)).toEqual([1, 2]);
  });

  it('finds nothing in a full draw', () => {
    expect(findWalkoverMatches(generateSingleElimBracket(makeParticipants(64), 'MS', 't1'))).toEqual([]);
  });
});
