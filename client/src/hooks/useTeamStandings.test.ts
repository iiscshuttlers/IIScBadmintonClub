import { describe, it, expect } from 'vitest';

// Dummy representation of the sorting logic from useTeamStandings.ts
function sortStandings(data: any[]) {
  return [...data].sort((a: any, b: any) => {
    if (b.tie_points !== a.tie_points) return b.tie_points - a.tie_points;
    const diffA = a.rubbers_for - a.rubbers_against;
    const diffB = b.rubbers_for - b.rubbers_against;
    if (diffA !== diffB) return diffB - diffA;
    return a.played - b.played;
  });
}

describe('Team Standings Sorting', () => {
  it('sorts primarily by tie points', () => {
    const teams = [
      { id: 'A', tie_points: 2, rubbers_for: 5, rubbers_against: 5, played: 2 },
      { id: 'B', tie_points: 5, rubbers_for: 2, rubbers_against: 8, played: 2 },
      { id: 'C', tie_points: 4, rubbers_for: 5, rubbers_against: 5, played: 2 },
    ];
    
    const sorted = sortStandings(teams);
    expect(sorted[0].id).toBe('B'); // 5 points
    expect(sorted[1].id).toBe('C'); // 4 points
    expect(sorted[2].id).toBe('A'); // 2 points
  });

  it('sorts secondarily by rubber difference', () => {
    const teams = [
      { id: 'A', tie_points: 4, rubbers_for: 6, rubbers_against: 4, played: 2 }, // Diff +2
      { id: 'B', tie_points: 4, rubbers_for: 8, rubbers_against: 2, played: 2 }, // Diff +6
      { id: 'C', tie_points: 4, rubbers_for: 4, rubbers_against: 6, played: 2 }, // Diff -2
    ];
    
    const sorted = sortStandings(teams);
    expect(sorted[0].id).toBe('B');
    expect(sorted[1].id).toBe('A');
    expect(sorted[2].id).toBe('C');
  });

  it('sorts tertiarily by fewest matches played if points and rubber difference are equal', () => {
    const teams = [
      { id: 'A', tie_points: 4, rubbers_for: 5, rubbers_against: 5, played: 3 }, // Diff 0, played 3
      { id: 'B', tie_points: 4, rubbers_for: 5, rubbers_against: 5, played: 2 }, // Diff 0, played 2
    ];
    
    const sorted = sortStandings(teams);
    expect(sorted[0].id).toBe('B'); // B played fewer matches for the same points/diff
    expect(sorted[1].id).toBe('A');
  });
});
