/**
 * Team Tournament Bracket & Pool Fixture Generator
 * Supports:
 * - Direct Knockout (with optional 3rd place match, SF, QF, Finals)
 * - Multi-Pool Round Robin (1, 2, 3, 4+ pools) using the Berger Circle Algorithm
 * - Seeded Snake, Random, or Manual Pool assignments
 * - Playoff Knockout Trees (Pool winners/runners-up -> QF/SF/Finals + 3rd place)
 */

export interface TeamParticipant {
  id: string;
  name: string;
  short_name: string;
  seed?: number | null;
  pool?: string | null;
  logo_url?: string | null;
}

export interface GeneratedTie {
  tie_code: string;
  stage: 'POOL' | 'KNOCKOUT';
  round_name: string;
  round_number: number;
  pool?: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_label?: string;
  team_b_label?: string;
  state: 'SCHEDULED';
  advances_to_tie_code?: string | null;
  advances_to_slot?: 'A' | 'B' | null;
  loser_advances_to_tie_code?: string | null;
  loser_advances_to_slot?: 'A' | 'B' | null;
}

export type PoolAssignmentMethod = 'SEEDED_SNAKE' | 'RANDOM' | 'MANUAL';

export interface PoolConfig {
  numPools: number;
  assignmentMethod: PoolAssignmentMethod;
  manualAssignments?: Record<string, string>; // teamId -> pool letter ('A', 'B', etc.)
  advancingPerPool: number; // 1 or 2 teams advancing to knockouts
  includeThirdPlaceMatch: boolean;
}

export interface KnockoutConfig {
  includeThirdPlaceMatch: boolean;
}

/**
 * Distribute teams into pools based on chosen method
 */
export function assignTeamsToPools(
  teams: TeamParticipant[],
  numPools: number,
  method: PoolAssignmentMethod,
  manualAssignments?: Record<string, string>
): Record<string, TeamParticipant[]> {
  const poolLetters = Array.from({ length: numPools }, (_, i) => String.fromCharCode(65 + i)); // ['A', 'B', 'C', ...]
  const pools: Record<string, TeamParticipant[]> = {};
  poolLetters.forEach(p => { pools[p] = []; });

  if (method === 'MANUAL' && manualAssignments) {
    teams.forEach(team => {
      const assignedPool = manualAssignments[team.id] || poolLetters[0];
      if (!pools[assignedPool]) pools[assignedPool] = [];
      pools[assignedPool].push({ ...team, pool: assignedPool });
    });
    return pools;
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const sA = a.seed != null ? a.seed : 999;
    const sB = b.seed != null ? b.seed : 999;
    return sA - sB;
  });

  if (method === 'RANDOM') {
    const shuffled = [...sortedTeams].sort(() => Math.random() - 0.5);
    shuffled.forEach((team, index) => {
      const p = poolLetters[index % numPools];
      pools[p].push({ ...team, pool: p });
    });
    return pools;
  }

  // Default: SEEDED_SNAKE
  // Pool A gets 1, Pool B gets 2, Pool B gets 3, Pool A gets 4, etc.
  sortedTeams.forEach((team, index) => {
    const round = Math.floor(index / numPools);
    const posInRound = index % numPools;
    const poolIndex = round % 2 === 0 ? posInRound : numPools - 1 - posInRound;
    const p = poolLetters[poolIndex];
    pools[p].push({ ...team, pool: p });
  });

  return pools;
}

/**
 * Berger Round-Robin Pairing Algorithm (Circle Method)
 * Generates balanced fixtures for a pool of teams.
 */
export function generateRoundRobinFixtures(
  poolTeams: TeamParticipant[],
  poolLetter: string,
  startRoundNumber: number = 1
): GeneratedTie[] {
  const ties: GeneratedTie[] = [];
  const n = poolTeams.length;
  if (n < 2) return ties;

  // If odd number of teams, add a dummy bye team (null)
  const isOdd = n % 2 !== 0;
  const list: (TeamParticipant | null)[] = [...poolTeams];
  if (isOdd) list.push(null);

  const totalTeams = list.length;
  const rounds = totalTeams - 1;
  const matchesPerRound = totalTeams / 2;

  let matchCounter = 1;

  for (let r = 0; r < rounds; r++) {
    const roundNumber = startRoundNumber + r;
    const roundName = `Pool ${poolLetter} - Round ${r + 1}`;

    for (let m = 0; m < matchesPerRound; m++) {
      let t1 = list[m];
      let t2 = list[totalTeams - 1 - m];

      // If either is null, it's a bye - skip match
      if (!t1 || !t2) continue;

      // Alternate home/away for fair serving/roster advantage
      if (r % 2 === 1 && m === 0) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }

      const tieCode = `POOL_${poolLetter}_R${r + 1}_${String(matchCounter).padStart(2, '0')}`;
      ties.push({
        tie_code: tieCode,
        stage: 'POOL',
        round_name: roundName,
        round_number: roundNumber,
        pool: poolLetter,
        team_a_id: t1.id,
        team_b_id: t2.id,
        team_a_label: t1.short_name || t1.name,
        team_b_label: t2.short_name || t2.name,
        state: 'SCHEDULED'
      });
      matchCounter++;
    }

    // Rotate elements for next round: keep index 0 fixed, rotate others
    const fixed = list[0];
    const rest = list.slice(1);
    const last = rest.pop()!;
    rest.unshift(last);
    list.length = 0;
    list.push(fixed, ...rest);
  }

  return ties;
}

/**
 * Generate Direct Knockout Bracket for Teams
 */
export function generateDirectKnockoutBracket(
  teams: TeamParticipant[],
  includeThirdPlace: boolean
): GeneratedTie[] {
  const ties: GeneratedTie[] = [];
  const n = teams.length;
  if (n < 2) return ties;

  // Next power of 2
  let drawSize = 1;
  while (drawSize < n) drawSize <<= 1;
  const totalRounds = Math.log2(drawSize);

  // Standard seeding position lookup for power of 2
  const seedSlots = buildSeedSlots(drawSize);

  // Seed-sorted teams
  const sorted = [...teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
  const seededTeams: (TeamParticipant | null)[] = Array(drawSize).fill(null);
  sorted.forEach((team, i) => {
    if (i < seedSlots.length) {
      seededTeams[seedSlots[i] - 1] = team;
    }
  });

  // Round 1 ties
  let currentRoundMatches: GeneratedTie[] = [];
  const r1MatchesCount = drawSize / 2;
  const r1Name = getRoundName(totalRounds, 1);

  for (let i = 0; i < r1MatchesCount; i++) {
    const tA = seededTeams[i * 2];
    const tB = seededTeams[i * 2 + 1];
    const code = getKnockoutTieCode(1, totalRounds, i + 1);

    const tie: GeneratedTie = {
      tie_code: code,
      stage: 'KNOCKOUT',
      round_name: r1Name,
      round_number: 1,
      team_a_id: tA?.id ?? null,
      team_b_id: tB?.id ?? null,
      team_a_label: tA ? (tA.short_name || tA.name) : 'TBD',
      team_b_label: tB ? (tB.short_name || tB.name) : 'TBD',
      state: 'SCHEDULED'
    };
    ties.push(tie);
    currentRoundMatches.push(tie);
  }

  // Subsequent knockout rounds (QF -> SF -> Finals)
  for (let r = 2; r <= totalRounds; r++) {
    const nextRoundCount = currentRoundMatches.length / 2;
    const nextRoundMatches: GeneratedTie[] = [];
    const rName = getRoundName(totalRounds, r);

    for (let i = 0; i < nextRoundCount; i++) {
      const code = getKnockoutTieCode(r, totalRounds, i + 1);
      const parentA = currentRoundMatches[i * 2];
      const parentB = currentRoundMatches[i * 2 + 1];

      const tie: GeneratedTie = {
        tie_code: code,
        stage: 'KNOCKOUT',
        round_name: rName,
        round_number: r,
        team_a_id: null,
        team_b_id: null,
        team_a_label: `Winner of ${parentA.tie_code}`,
        team_b_label: `Winner of ${parentB.tie_code}`,
        state: 'SCHEDULED'
      };

      // Link parents forward
      parentA.advances_to_tie_code = code;
      parentA.advances_to_slot = 'A';
      parentB.advances_to_tie_code = code;
      parentB.advances_to_slot = 'B';

      ties.push(tie);
      nextRoundMatches.push(tie);
    }

    // 3rd Place Match (If Semifinal round and includeThirdPlace is true)
    if (includeThirdPlace && r === totalRounds && currentRoundMatches.length === 2) {
      const sf1 = currentRoundMatches[0];
      const sf2 = currentRoundMatches[1];
      const thirdPlaceCode = '3RD_PLACE';

      const thirdPlaceTie: GeneratedTie = {
        tie_code: thirdPlaceCode,
        stage: 'KNOCKOUT',
        round_name: '3rd Place Playoff',
        round_number: r,
        team_a_id: null,
        team_b_id: null,
        team_a_label: `Loser of ${sf1.tie_code}`,
        team_b_label: `Loser of ${sf2.tie_code}`,
        state: 'SCHEDULED'
      };

      sf1.loser_advances_to_tie_code = thirdPlaceCode;
      sf1.loser_advances_to_slot = 'A';
      sf2.loser_advances_to_tie_code = thirdPlaceCode;
      sf2.loser_advances_to_slot = 'B';

      ties.push(thirdPlaceTie);
    }

    currentRoundMatches = nextRoundMatches;
  }

  return ties;
}

/**
 * Generate League Stage (Pools) + Knockout Playoffs
 */
export function generatePoolAndPlayoffTournament(
  teams: TeamParticipant[],
  poolConfig: PoolConfig
): { poolTies: GeneratedTie[]; playoffTies: GeneratedTie[]; allTies: GeneratedTie[] } {
  const pools = assignTeamsToPools(
    teams,
    poolConfig.numPools,
    poolConfig.assignmentMethod,
    poolConfig.manualAssignments
  );

  const poolTies: GeneratedTie[] = [];
  let maxPoolRound = 1;

  Object.entries(pools).forEach(([poolLetter, pTeams]) => {
    const fixtures = generateRoundRobinFixtures(pTeams, poolLetter, 1);
    fixtures.forEach(f => {
      if (f.round_number > maxPoolRound) maxPoolRound = f.round_number;
    });
    poolTies.push(...fixtures);
  });

  const playoffTies: GeneratedTie[] = [];
  const startPlayoffRound = maxPoolRound + 1;

  if (poolConfig.numPools === 1) {
    // 1 Pool
    if (poolConfig.advancingPerPool === 2) {
      // Direct Final: Pool 1st vs Pool 2nd
      playoffTies.push({
        tie_code: 'FINAL',
        stage: 'KNOCKOUT',
        round_name: 'Championship Final',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool A 1st Place',
        team_b_label: 'Pool A 2nd Place',
        state: 'SCHEDULED'
      });
    } else if (poolConfig.advancingPerPool >= 4) {
      // Semifinals (1 vs 4, 2 vs 3) -> Final
      const sf1: GeneratedTie = {
        tie_code: 'SF_01',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 1',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool A 1st Place',
        team_b_label: 'Pool A 4th Place',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'A'
      };
      const sf2: GeneratedTie = {
        tie_code: 'SF_02',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 2',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool A 2nd Place',
        team_b_label: 'Pool A 3rd Place',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'B'
      };
      const finalTie: GeneratedTie = {
        tie_code: 'FINAL',
        stage: 'KNOCKOUT',
        round_name: 'Championship Final',
        round_number: startPlayoffRound + 1,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Winner of SF 1',
        team_b_label: 'Winner of SF 2',
        state: 'SCHEDULED'
      };
      playoffTies.push(sf1, sf2, finalTie);

      if (poolConfig.includeThirdPlaceMatch) {
        sf1.loser_advances_to_tie_code = '3RD_PLACE';
        sf1.loser_advances_to_slot = 'A';
        sf2.loser_advances_to_tie_code = '3RD_PLACE';
        sf2.loser_advances_to_slot = 'B';
        playoffTies.push({
          tie_code: '3RD_PLACE',
          stage: 'KNOCKOUT',
          round_name: '3rd Place Playoff',
          round_number: startPlayoffRound + 1,
          team_a_id: null,
          team_b_id: null,
          team_a_label: 'Loser of SF 1',
          team_b_label: 'Loser of SF 2',
          state: 'SCHEDULED'
        });
      }
    }
  } else if (poolConfig.numPools === 2) {
    // 2 Pools: Top 2 from each -> Semifinals (A1 vs B2, B1 vs A2) -> Final
    const sf1: GeneratedTie = {
      tie_code: 'SF_01',
      stage: 'KNOCKOUT',
      round_name: 'Semifinal 1',
      round_number: startPlayoffRound,
      team_a_id: null,
      team_b_id: null,
      team_a_label: 'Pool A Winner (1st)',
      team_b_label: 'Pool B Runner-up (2nd)',
      state: 'SCHEDULED',
      advances_to_tie_code: 'FINAL',
      advances_to_slot: 'A'
    };
    const sf2: GeneratedTie = {
      tie_code: 'SF_02',
      stage: 'KNOCKOUT',
      round_name: 'Semifinal 2',
      round_number: startPlayoffRound,
      team_a_id: null,
      team_b_id: null,
      team_a_label: 'Pool B Winner (1st)',
      team_b_label: 'Pool A Runner-up (2nd)',
      state: 'SCHEDULED',
      advances_to_tie_code: 'FINAL',
      advances_to_slot: 'B'
    };
    const finalTie: GeneratedTie = {
      tie_code: 'FINAL',
      stage: 'KNOCKOUT',
      round_name: 'Championship Final',
      round_number: startPlayoffRound + 1,
      team_a_id: null,
      team_b_id: null,
      team_a_label: 'Winner of SF 1',
      team_b_label: 'Winner of SF 2',
      state: 'SCHEDULED'
    };
    playoffTies.push(sf1, sf2, finalTie);

    if (poolConfig.includeThirdPlaceMatch) {
      sf1.loser_advances_to_tie_code = '3RD_PLACE';
      sf1.loser_advances_to_slot = 'A';
      sf2.loser_advances_to_tie_code = '3RD_PLACE';
      sf2.loser_advances_to_slot = 'B';
      playoffTies.push({
        tie_code: '3RD_PLACE',
        stage: 'KNOCKOUT',
        round_name: '3rd Place Playoff',
        round_number: startPlayoffRound + 1,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Loser of SF 1',
        team_b_label: 'Loser of SF 2',
        state: 'SCHEDULED'
      });
    }
  } else if (poolConfig.numPools >= 3) {
    // 3 or 4 Pools -> Quarterfinals (or Semifinals if top 1)
    if (poolConfig.advancingPerPool === 1) {
      // Top 1 from each pool -> SF
      const sf1: GeneratedTie = {
        tie_code: 'SF_01',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 1',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool A Winner',
        team_b_label: 'Pool B Winner',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'A'
      };
      const sf2: GeneratedTie = {
        tie_code: 'SF_02',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 2',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool C Winner',
        team_b_label: poolConfig.numPools >= 4 ? 'Pool D Winner' : 'Best Runner-up',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'B'
      };
      const finalTie: GeneratedTie = {
        tie_code: 'FINAL',
        stage: 'KNOCKOUT',
        round_name: 'Championship Final',
        round_number: startPlayoffRound + 1,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Winner of SF 1',
        team_b_label: 'Winner of SF 2',
        state: 'SCHEDULED'
      };
      playoffTies.push(sf1, sf2, finalTie);
      if (poolConfig.includeThirdPlaceMatch) {
        sf1.loser_advances_to_tie_code = '3RD_PLACE';
        sf1.loser_advances_to_slot = 'A';
        sf2.loser_advances_to_tie_code = '3RD_PLACE';
        sf2.loser_advances_to_slot = 'B';
        playoffTies.push({
          tie_code: '3RD_PLACE',
          stage: 'KNOCKOUT',
          round_name: '3rd Place Playoff',
          round_number: startPlayoffRound + 1,
          team_a_id: null,
          team_b_id: null,
          team_a_label: 'Loser of SF 1',
          team_b_label: 'Loser of SF 2',
          state: 'SCHEDULED'
        });
      }
    } else {
      // Top 2 from 4 Pools -> Quarterfinals (8 teams)
      const qf1: GeneratedTie = {
        tie_code: 'QF_01',
        stage: 'KNOCKOUT',
        round_name: 'Quarterfinal 1',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool A Winner',
        team_b_label: 'Pool B Runner-up',
        state: 'SCHEDULED',
        advances_to_tie_code: 'SF_01',
        advances_to_slot: 'A'
      };
      const qf2: GeneratedTie = {
        tie_code: 'QF_02',
        stage: 'KNOCKOUT',
        round_name: 'Quarterfinal 2',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool C Winner',
        team_b_label: 'Pool D Runner-up',
        state: 'SCHEDULED',
        advances_to_tie_code: 'SF_01',
        advances_to_slot: 'B'
      };
      const qf3: GeneratedTie = {
        tie_code: 'QF_03',
        stage: 'KNOCKOUT',
        round_name: 'Quarterfinal 3',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool B Winner',
        team_b_label: 'Pool A Runner-up',
        state: 'SCHEDULED',
        advances_to_tie_code: 'SF_02',
        advances_to_slot: 'A'
      };
      const qf4: GeneratedTie = {
        tie_code: 'QF_04',
        stage: 'KNOCKOUT',
        round_name: 'Quarterfinal 4',
        round_number: startPlayoffRound,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Pool D Winner',
        team_b_label: 'Pool C Runner-up',
        state: 'SCHEDULED',
        advances_to_tie_code: 'SF_02',
        advances_to_slot: 'B'
      };

      const sf1: GeneratedTie = {
        tie_code: 'SF_01',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 1',
        round_number: startPlayoffRound + 1,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Winner of QF 1',
        team_b_label: 'Winner of QF 2',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'A'
      };
      const sf2: GeneratedTie = {
        tie_code: 'SF_02',
        stage: 'KNOCKOUT',
        round_name: 'Semifinal 2',
        round_number: startPlayoffRound + 1,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Winner of QF 3',
        team_b_label: 'Winner of QF 4',
        state: 'SCHEDULED',
        advances_to_tie_code: 'FINAL',
        advances_to_slot: 'B'
      };

      const finalTie: GeneratedTie = {
        tie_code: 'FINAL',
        stage: 'KNOCKOUT',
        round_name: 'Championship Final',
        round_number: startPlayoffRound + 2,
        team_a_id: null,
        team_b_id: null,
        team_a_label: 'Winner of SF 1',
        team_b_label: 'Winner of SF 2',
        state: 'SCHEDULED'
      };

      playoffTies.push(qf1, qf2, qf3, qf4, sf1, sf2, finalTie);

      if (poolConfig.includeThirdPlaceMatch) {
        sf1.loser_advances_to_tie_code = '3RD_PLACE';
        sf1.loser_advances_to_slot = 'A';
        sf2.loser_advances_to_tie_code = '3RD_PLACE';
        sf2.loser_advances_to_slot = 'B';
        playoffTies.push({
          tie_code: '3RD_PLACE',
          stage: 'KNOCKOUT',
          round_name: '3rd Place Playoff',
          round_number: startPlayoffRound + 2,
          team_a_id: null,
          team_b_id: null,
          team_a_label: 'Loser of SF 1',
          team_b_label: 'Loser of SF 2',
          state: 'SCHEDULED'
        });
      }
    }
  }

  return {
    poolTies,
    playoffTies,
    allTies: [...poolTies, ...playoffTies]
  };
}

// Helpers
function getRoundName(totalRounds: number, roundNum: number): string {
  if (roundNum === totalRounds) return 'Championship Final';
  if (roundNum === totalRounds - 1) return 'Semifinal';
  if (roundNum === totalRounds - 2) return 'Quarterfinal';
  if (roundNum === totalRounds - 3) return 'Round of 16';
  return `Round ${roundNum}`;
}

function getKnockoutTieCode(roundNum: number, totalRounds: number, matchNum: number): string {
  const prefix =
    roundNum === totalRounds ? 'FINAL' :
    roundNum === totalRounds - 1 ? 'SF' :
    roundNum === totalRounds - 2 ? 'QF' :
    `R${roundNum}`;
  return `${prefix}_${String(matchNum).padStart(2, '0')}`;
}

function buildSeedSlots(size: number): number[] {
  let slots = [1, 2];
  while (slots.length < size) {
    const nextSlots: number[] = [];
    const targetSum = slots.length * 2 + 1;
    for (const s of slots) {
      nextSlots.push(s, targetSum - s);
    }
    slots = nextSlots;
  }
  return slots;
}
