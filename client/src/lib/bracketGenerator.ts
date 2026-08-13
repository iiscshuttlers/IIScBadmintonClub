export interface BracketParticipant {
  playerId: string | null;
  partnerId: string | null;
  displayName: string;
  seed: number;
  /**
   * Round this participant plays their first match in. 1 = round 1 (no bye),
   * 2 = one bye, 3 = two byes, and so on.
   * `null`/`undefined` means "let the draw decide" — byes are handed out
   * automatically down the seed list to fill the draw.
   */
  entryRound?: number | null;
  /**
   * Opaque caller-supplied identifier. Ignored when building matches, but
   * carried through `planDraw` so a caller can map entries back to its own rows.
   */
  refId?: string;
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

/** One participant's resolved place in the draw. */
export interface DrawEntry {
  participant: BracketParticipant;
  /** Round they actually play their first match in. */
  entryRound: number;
  /** Round-1 slots they occupy on their own (2^(entryRound-1)). */
  blockSize: number;
  /** True when the admin pinned this entry round by hand. */
  pinned: boolean;
}

export interface DrawPlan {
  drawSize: number;
  totalRounds: number;
  /** Empty round-1 slots in the draw (drawSize - participants). */
  totalByeSlots: number;
  /** Bye slots consumed by hand-pinned entry rounds. */
  manualByeSlots: number;
  /** Bye slots handed out automatically down the seed list. */
  autoByeSlots: number;
  /**
   * Slots the pinned entry rounds ask for beyond the draw size. Anything above
   * 0 means the configuration is impossible and the bracket cannot be built.
   */
  overAllocatedSlots: number;
  /** Pinned entries that had to be widened anyway to keep the draw tileable. */
  forcedAdjustments: DrawEntry[];
  entries: DrawEntry[];
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

/** Human label for the round a participant enters at, given a draw size. */
export function entryRoundLabel(entryRound: number, drawSize: number): string {
  return roundName(drawSize / Math.pow(2, entryRound - 1));
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
 * Works out how big the draw is and how many byes each participant gets.
 *
 * Participants with a pinned `entryRound` are honoured first; whatever bye
 * slots are left over are handed to the best remaining seeds, one each, the
 * standard way. Call this on its own to preview the bye budget before
 * committing to a bracket.
 */
export function planDraw(participants: BracketParticipant[]): DrawPlan {
  const sorted = [...participants].sort((a, b) => a.seed - b.seed);
  const drawSize = nextPow2(Math.max(sorted.length, 2));
  const totalRounds = Math.log2(drawSize);

  const entries: DrawEntry[] = sorted.map((participant) => {
    const raw = participant.entryRound;
    const pinned = raw != null && Number.isFinite(raw) && raw >= 1;
    // A participant can enter at the final at the latest — any deeper and they
    // would own more than half the draw.
    const entryRound = pinned ? Math.min(Math.max(Math.floor(raw as number), 1), totalRounds) : 1;
    return { participant, entryRound, blockSize: Math.pow(2, entryRound - 1), pinned };
  });

  let used = entries.reduce((sum, e) => sum + e.blockSize, 0);
  const manualByeSlots = used - entries.length;
  const forcedAdjustments: DrawEntry[] = [];

  if (used > drawSize) {
    return {
      drawSize, totalRounds,
      totalByeSlots: drawSize - entries.length,
      manualByeSlots,
      autoByeSlots: 0,
      overAllocatedSlots: used - drawSize,
      forcedAdjustments,
      entries,
    };
  }

  // Fill the rest of the draw. Doubling the *smallest* block always fits (every
  // block is a power of two, so the shortfall is a multiple of the smallest
  // one), and among equally small blocks the best seed goes first — which is
  // exactly "spare byes go down the seed list".
  while (used < drawSize) {
    let target: DrawEntry | null = null;
    for (const e of entries) {
      if (used + e.blockSize > drawSize) continue;
      if (target === null) { target = e; continue; }
      // Prefer unpinned entries, then the smallest block, then the best seed.
      if (e.pinned !== target.pinned) { if (!e.pinned) target = e; continue; }
      if (e.blockSize < target.blockSize) target = e;
    }
    if (!target) break; // unreachable for power-of-two blocks, but never spin
    if (target.pinned) forcedAdjustments.push(target);
    used += target.blockSize;
    target.blockSize *= 2;
    target.entryRound += 1;
  }

  return {
    drawSize, totalRounds,
    totalByeSlots: drawSize - entries.length,
    manualByeSlots,
    autoByeSlots: drawSize - entries.length - manualByeSlots,
    overAllocatedSlots: 0,
    forcedAdjustments,
    entries,
  };
}

/**
 * Snake preference used by standard seeding: within any region the best seed
 * goes to the near half, the next two to the far half, the next two back to the
 * near half, and so on (A B B A A B B A ...).
 */
function prefersNearHalf(index: number): boolean {
  const phase = index % 4;
  return phase === 0 || phase === 3;
}

/**
 * Splits a region's entries into two halves of exactly `half` slots each.
 *
 * Wide blocks are placed first so the packing always succeeds: because every
 * block is a power of two, once the larger blocks are down both halves have
 * remaining capacity that is a multiple of the next block's width, so a block
 * fits somewhere whenever capacity remains.
 */
function splitRegion(entries: DrawEntry[], half: number): [DrawEntry[], DrawEntry[]] {
  const near: DrawEntry[] = [];
  const far: DrawEntry[] = [];
  let nearFree = half;
  let farFree = half;

  const order = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.blockSize - a.entry.blockSize || a.index - b.index);

  for (const { entry, index } of order) {
    const wantsNear = prefersNearHalf(index);
    const canNear = nearFree >= entry.blockSize;
    const canFar = farFree >= entry.blockSize;
    const goNear = wantsNear ? canNear : !canFar;
    if (goNear) { near.push(entry); nearFree -= entry.blockSize; }
    else { far.push(entry); farFree -= entry.blockSize; }
  }

  near.sort((a, b) => a.participant.seed - b.participant.seed);
  far.sort((a, b) => a.participant.seed - b.participant.seed);
  return [near, far];
}

/**
 * Lays entries out across the round-1 slots. Each entry is written to the first
 * slot of its block; the remaining slots of that block stay empty, which is what
 * turns into their byes.
 *
 * `mirrored` alternates the orientation of each pair of halves so the result
 * matches a conventional printed draw (1 8 5 4 3 6 7 2 for eight seeds).
 */
function placeEntries(
  entries: DrawEntry[],
  start: number,
  size: number,
  mirrored: boolean,
  slots: (DrawEntry | null)[],
): void {
  if (entries.length === 0) return;
  if (entries.length === 1) { slots[start] = entries[0]; return; }

  const half = size / 2;
  const [near, far] = splitRegion(entries, half);
  const first = mirrored ? far : near;
  const second = mirrored ? near : far;
  placeEntries(first, start, half, false, slots);
  placeEntries(second, start + half, half, true, slots);
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

  const plan = planDraw(participants);
  if (plan.overAllocatedSlots > 0) return [];

  const { drawSize: P, totalRounds } = plan;
  const slots: (DrawEntry | null)[] = new Array(P).fill(null);
  placeEntries(plan.entries, 0, P, false, slots);

  // occupants[i] = number of real participants in slots [0, i)
  const occupants: number[] = new Array(P + 1).fill(0);
  for (let i = 0; i < P; i++) occupants[i + 1] = occupants[i] + (slots[i] ? 1 : 0);
  const countIn = (from: number, to: number) => occupants[to] - occupants[from];
  const soleEntry = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (slots[i]) return slots[i];
    return null;
  };

  const rows: TournamentMatchInsert[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const width = Math.pow(2, r);
    const matchesInRound = P / width;
    const isFinal = r === totalRounds;

    for (let m = 0; m < matchesInRound; m++) {
      const start = m * width;
      const mid = start + width / 2;
      const end = start + width;
      const leftCount = countIn(start, mid);
      const rightCount = countIn(mid, end);

      // Nobody can ever reach this match — don't create it at all.
      if (leftCount + rightCount === 0) continue;

      const side = (from: number, to: number, count: number, childMatch: number) => {
        if (count === 0) return { label: "BYE", playerId: null, partnerId: null };
        if (count === 1) {
          const e = soleEntry(from, to)!;
          return {
            label: e.participant.displayName,
            playerId: e.participant.playerId,
            partnerId: e.participant.partnerId,
          };
        }
        return {
          label: `Winner of ${matchCode(category, r - 1, totalRounds, childMatch)}`,
          playerId: null,
          partnerId: null,
        };
      };

      const left = side(start, mid, leftCount, m * 2 + 1);
      const right = side(mid, end, rightCount, m * 2 + 2);

      rows.push({
        tournament_id: tournamentId,
        category,
        match_code: matchCode(category, r, totalRounds, m + 1),
        round: r,
        round_name: roundName(P / Math.pow(2, r - 1)),
        match_number: m + 1,
        player1_id: left.playerId,
        player3_id: left.partnerId,
        team1_label: left.label,
        player2_id: right.playerId,
        player4_id: right.partnerId,
        team2_label: right.label,
        advances_to_match: isFinal ? null : matchCode(category, r + 1, totalRounds, Math.floor(m / 2) + 1),
        advances_to_position: isFinal ? null : (m % 2 === 0 ? 1 : 2),
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

  return rows;
}

/**
 * Matches that are a walkover on generation — one side is a real participant,
 * the other is empty. Sorted by round so the caller can submit them in order and
 * let each result propagate before the next round is advanced.
 */
export function findWalkoverMatches(rows: TournamentMatchInsert[]): TournamentMatchInsert[] {
  return rows
    .filter((r) => (r.team1_label === "BYE") !== (r.team2_label === "BYE"))
    .filter((r) => {
      const opponent = r.team1_label === "BYE" ? r.team2_label : r.team1_label;
      return opponent !== "TBD" && !opponent.startsWith("Winner of ");
    })
    .sort((a, b) => a.round - b.round || a.match_number - b.match_number);
}
