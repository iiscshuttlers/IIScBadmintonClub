import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BracketVisual, type BracketMatch } from '@/components/tournament/BracketVisual';
import { generateSingleElimBracket, type BracketParticipant } from '@/lib/bracketGenerator';

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

const toBracketMatches = (participants: BracketParticipant[], thirdPlace = false): BracketMatch[] =>
  generateSingleElimBracket(participants, 'MS', 't1', thirdPlace).map((r, i) => ({
    id: `m${i}`,
    match_code: r.match_code,
    round: r.round,
    round_name: r.round_name,
    match_number: r.match_number,
    team1_label: r.team1_label,
    team2_label: r.team2_label,
    winner_side: null,
    score: null,
    sets_history: null,
    status: 'pending',
  }));

/** Reads each rendered card's absolute position, keyed by match_code. */
function renderPositions(matches: BracketMatch[]) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const { container } = render(<BracketVisual matches={matches} rounds={rounds} />);

  expect(container.textContent).not.toContain('BracketVisual Crash');

  const byCode = new Map<string, { left: number; top: number }>();
  for (const m of matches) {
    const header = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === m.match_code,
    );
    expect(header, `card missing for ${m.match_code}`).toBeTruthy();
    const card = header!.closest('div[style*="position: absolute"]') as HTMLElement;
    byCode.set(m.match_code, {
      left: parseFloat(card.style.left),
      top: parseFloat(card.style.top),
    });
  }
  return { byCode, container };
}

const MATCH_H = 90;

/** A parent must sit vertically centred between the feeders that exist. */
function expectCentredOnFeeders(
  byCode: Map<string, { top: number }>,
  parent: string,
  feeders: string[],
) {
  const present = feeders.filter((f) => byCode.has(f));
  expect(present.length).toBeGreaterThan(0);
  const centres = present.map((f) => byCode.get(f)!.top + MATCH_H / 2);
  const parentCentre = byCode.get(parent)!.top + MATCH_H / 2;

  if (present.length === 2) {
    expect(parentCentre).toBeCloseTo((centres[0] + centres[1]) / 2, 5);
  } else {
    // Single feeder: parent still sits on the midpoint of the pair's slot span,
    // so it must stay within one slot of that feeder rather than jumping.
    expect(Math.abs(parentCentre - centres[0])).toBeLessThanOrEqual(MATCH_H + 20);
  }
}

describe('BracketVisual layout', () => {
  it('centres every parent between its feeders in a clean 16 draw', () => {
    const matches = toBracketMatches(makeParticipants(16));
    const { byCode } = renderPositions(matches);

    for (const m of matches) {
      if (m.round === 1) continue;
      expectCentredOnFeeders(byCode, m.match_code, [
        matches.find((x) => x.round === m.round - 1 && x.match_number === m.match_number * 2 - 1)!.match_code,
        matches.find((x) => x.round === m.round - 1 && x.match_number === m.match_number * 2)!.match_code,
      ]);
    }
  });

  it('keeps alignment when a double bye removes a match from round 1', () => {
    // Seed 1 enters at the round of 32, so MS_R1_02 is never created.
    const matches = toBracketMatches(makeParticipants(105, { 1: 3 }));
    expect(matches.filter((m) => m.round === 1)).toHaveLength(63);
    expect(matches.find((m) => m.match_code === 'MS_R1_02')).toBeUndefined();

    const { byCode } = renderPositions(matches);

    // Every surviving round-1 match must sit on its own structural slot.
    const r1 = matches.filter((m) => m.round === 1);
    const slotH = byCode.get('MS_R1_03')!.top - byCode.get('MS_R1_01')!.top;
    expect(slotH).toBeGreaterThan(0);
    for (const m of r1) {
      const expectedTop = byCode.get('MS_R1_01')!.top + (m.match_number - 1) * (slotH / 2);
      expect(byCode.get(m.match_code)!.top, `slot for ${m.match_code}`).toBeCloseTo(expectedTop, 5);
    }

    // And parents stay centred on the feeders that still exist. Round codes use
    // QF/SF/F near the end, so resolve feeders from the data rather than by name.
    for (const m of matches) {
      if (m.round === 1) continue;
      const feeders = [m.match_number * 2 - 1, m.match_number * 2]
        .map((n) => matches.find((x) => x.round === m.round - 1 && x.match_number === n))
        .filter(Boolean)
        .map((x) => x!.match_code);
      expectCentredOnFeeders(byCode, m.match_code, feeders);
    }
  });

  it('does not let the 3rd place playoff squeeze the semifinal column', () => {
    const withPlayoff = toBracketMatches(makeParticipants(16), true);
    const without = toBracketMatches(makeParticipants(16), false);

    const a = renderPositions(withPlayoff).byCode;
    const b = renderPositions(without).byCode;

    // Semifinal placement must be identical with or without the playoff.
    for (const code of ['MS_SF_01', 'MS_SF_02', 'MS_F_01']) {
      expect(a.get(code)!.top, code).toBeCloseTo(b.get(code)!.top, 5);
    }

    // The playoff renders below the tree, not inside it.
    expect(a.get('MS_3RD_01')!.top).toBeGreaterThan(a.get('MS_SF_02')!.top);
  });

  it('renders a 128 draw without crashing and puts round 1 in the first column', () => {
    const matches = toBracketMatches(makeParticipants(105));
    const { byCode } = renderPositions(matches);
    expect(byCode.get('MS_R1_01')!.left).toBeLessThan(byCode.get('MS_R2_01')!.left);
    expect(byCode.get('MS_F_01')!.left).toBeGreaterThan(byCode.get('MS_SF_01')!.left);
  });
});
