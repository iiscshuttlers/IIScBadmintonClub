export interface BracketParticipant {
  playerId: string | null;
  partnerId: string | null;
  displayName: string;
  seed: number;
}

export interface TournamentMatchInsert {
  tournament_id: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  player1_id: string | null;
  player3_id: string | null;
  team1_label: string;
  player2_id: string | null;
  player4_id: string | null;
  team2_label: string;
  advances_to_match: string | null;
  advances_to_position: 1 | 2 | null;
  advances_to_match_loser: string | null;
  advances_to_position_loser: 1 | 2 | null;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function roundName(totalSlots: number): string {
  if (totalSlots === 2) return "Final";
  if (totalSlots === 4) return "Semifinal";
  if (totalSlots === 8) return "Quarterfinal";
  if (totalSlots === 16) return "Round of 16";
  if (totalSlots === 32) return "Round of 32";
  return `Round of ${totalSlots}`;
}

function matchCode(category: string, roundNum: number, totalRounds: number, matchNum: number): string {
  const roundLabel =
    roundNum === totalRounds ? "F" :
    roundNum === totalRounds - 1 ? "SF" :
    roundNum === totalRounds - 2 ? "QF" :
    `R${roundNum}`;
  return `${category}_${roundLabel}_${String(matchNum).padStart(2, "0")}`;
}

/**
 * Generates a standard single-elimination bracket.
 * Returns rows ready to insert into tournament_matches.
 */
export function generateSingleElimBracket(
  participants: BracketParticipant[],
  category: string,
  tournamentId: string,
  hasThirdPlace = false
): TournamentMatchInsert[] {
  if (participants.length < 2) return [];

  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const P = nextPow2(sorted.length);
  const totalRounds = Math.log2(P);
  const byes = P - sorted.length;

  // Build seeded slots: [seed1, seed_P, seed2, seed_{P-1}, ...]
  // Standard BWF single-elim seeding
  const slots: (BracketParticipant | null)[] = new Array(P).fill(null);
  const seedPositions = buildSeedPositions(P);
  for (let i = 0; i < sorted.length; i++) {
    slots[seedPositions[i]] = sorted[i];
  }

  const rows: TournamentMatchInsert[] = [];

  // Round 1 matches (includes byes — bye matches advance automatically)
  const r1MatchCount = P / 2;
  for (let m = 0; m < r1MatchCount; m++) {
    const s1 = slots[m * 2];
    const s2 = slots[m * 2 + 1];
    const code = matchCode(category, 1, totalRounds, m + 1);
    const nextCode = matchCode(category, 2, totalRounds, Math.floor(m / 2) + 1);
    const pos: 1 | 2 = (m % 2 === 0 ? 1 : 2);

    rows.push({
      tournament_id: tournamentId,
      category,
      match_code: code,
      round: 1,
      round_name: roundName(P),
      match_number: m + 1,
      player1_id: s1?.playerId ?? null,
      player3_id: s1?.partnerId ?? null,
      team1_label: s1?.displayName ?? "TBD",
      player2_id: s2?.playerId ?? null,
      player4_id: s2?.partnerId ?? null,
      team2_label: s2?.displayName ?? "TBD",
      advances_to_match: totalRounds > 1 ? nextCode : null,
      advances_to_position: totalRounds > 1 ? pos : null,
      advances_to_match_loser: null,
      advances_to_position_loser: null,
    });
  }

  // Subsequent rounds (all TBD until results flow in)
  for (let r = 2; r <= totalRounds; r++) {
    const matchesInRound = P / Math.pow(2, r);
    for (let m = 0; m < matchesInRound; m++) {
      const code = matchCode(category, r, totalRounds, m + 1);
      const isFinal = r === totalRounds;
      const nextCode = isFinal ? null : matchCode(category, r + 1, totalRounds, Math.floor(m / 2) + 1);
      const pos: 1 | 2 = (m % 2 === 0 ? 1 : 2);

      rows.push({
        tournament_id: tournamentId,
        category,
        match_code: code,
        round: r,
        round_name: roundName(P / Math.pow(2, r - 1)),
        match_number: m + 1,
        player1_id: null,
        player3_id: null,
        team1_label: `Winner of ${matchCode(category, r - 1, totalRounds, m * 2 + 1)}`,
        player2_id: null,
        player4_id: null,
        team2_label: `Winner of ${matchCode(category, r - 1, totalRounds, m * 2 + 2)}`,
        advances_to_match: nextCode,
        advances_to_position: isFinal ? null : pos,
        advances_to_match_loser: null,
        advances_to_position_loser: null,
      });
    }
  }

  // 3rd place playoff: SF losers feed into an extra match at the same round level as SF
  if (hasThirdPlace && totalRounds >= 2) {
    const sfRound = totalRounds - 1;
    const thirdCode = `${category}_3RD_01`;
    // Find the SF match rows and wire their loser to the 3rd place match
    const sf01Code = matchCode(category, sfRound, totalRounds, 1);
    const sf02Code = matchCode(category, sfRound, totalRounds, 2);
    for (const row of rows) {
      if (row.match_code === sf01Code) {
        row.advances_to_match_loser = thirdCode;
        row.advances_to_position_loser = 1;
      } else if (row.match_code === sf02Code) {
        row.advances_to_match_loser = thirdCode;
        row.advances_to_position_loser = 2;
      }
    }
    rows.push({
      tournament_id: tournamentId,
      category,
      match_code: thirdCode,
      round: sfRound,
      round_name: "3rd Place Playoff",
      match_number: 99,
      player1_id: null,
      player3_id: null,
      team1_label: `Loser of ${sf01Code}`,
      player2_id: null,
      player4_id: null,
      team2_label: `Loser of ${sf02Code}`,
      advances_to_match: null,
      advances_to_position: null,
      advances_to_match_loser: null,
      advances_to_position_loser: null,
    });
  }

  // Auto-advance byes in round 1: if one slot is null, mark it as a walkover
  // The caller should handle this by calling submit_tournament_match with the non-null side as winner
  // We mark them with team2_label="BYE" so the UI can render them correctly
  for (const row of rows) {
    if (row.round === 1) {
      if (row.team1_label === "TBD" && row.team2_label !== "TBD") {
        row.team1_label = "BYE";
      } else if (row.team2_label === "TBD" && row.team1_label !== "TBD") {
        row.team2_label = "BYE";
      }
    }
  }

  return rows;
}

/**
 * Standard single-elim seeding positions for P slots.
 * Returns array of slot indices for seed 1, 2, 3, ...
 * seed 1 vs seed P, seed 2 vs seed P-1, etc.
 */
function buildSeedPositions(P: number): number[] {
  // Build using recursive split: position seed 1 at top, seed 2 at bottom
  // then recursively fill quarters, etc.
  let positions = [0];
  let size = 1;
  while (size < P) {
    const next: number[] = [];
    for (const pos of positions) {
      next.push(pos * 2);
      next.push(pos * 2 + (size * 2 - 1) - pos * 2 + pos * 2);
    }
    // simpler: mirror approach
    const newPositions: number[] = [];
    for (const pos of positions) {
      newPositions.push(pos);
      newPositions.push(size * 2 - 1 - pos);
    }
    positions = newPositions;
    size *= 2;
  }
  return positions;
}
