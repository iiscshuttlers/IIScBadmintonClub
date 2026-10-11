/**
 * Team Lineup & Repeat Rules Engine
 *
 * Handles:
 * 1. Dynamic roster headcount calculations based on tie rubbers and gender-differentiated repetition limits.
 * 2. Real-time lineup validation for captains (preventing MS1 + MS2 repeats, exceeding max appearances, decider conflicts).
 * 3. Gender floor requirements (min males and females needed).
 */

export interface TieRubberConfig {
  order: number;
  label: string;
  category: 'MS' | 'WS' | 'MD' | 'WD' | 'XD' | string;
  points?: number;
  is_decider_tiebreaker?: boolean;
}

export interface TieLineupRulesConfig {
  // Repetition Caps
  max_rubbers_per_male?: number;        // e.g. 1 or 2 (Default: 2)
  max_rubbers_per_female?: number;      // e.g. 1 or 2 (Default: 2)
  max_rubbers_per_player?: number;      // Hard ceiling (Default: 2)

  // Discipline & Category Rules
  allow_same_discipline_repeat?: boolean; // false => player who played MS1 cannot play MS2 (Default: false)
  ignore_gender_rules?: boolean;         // true => ignore male/female category restrictions (Default: false)

  // Decider Tiebreaker Rules
  allow_repeat_in_decider?: boolean;     // Can a regular match player play decider? (Default: true)
  allow_same_event_repeat_in_decider?: boolean; // Can XD1 pair play XD2 decider? (Default: false)

  // Explicit overrides if tournament organizer sets manual limits
  team_roster_min?: number;
  team_roster_max?: number;
  min_male_players?: number;
  min_female_players?: number;
}

export interface LineupAssignment {
  rubber_order: number;
  player1_id: string;
  player2_id?: string;
  is_decider?: boolean;
}

export interface PlayerInfo {
  id: string;
  full_name: string;
  gender?: 'Male' | 'Female' | 'M' | 'F' | string | null;
}

export interface RosterRequirementResult {
  minTotalPlayers: number;
  minMalePlayers: number;
  minFemalePlayers: number;
  totalMaleSlots: number;
  totalFemaleSlots: number;
  maxRubbersPerMale: number;
  maxRubbersPerFemale: number;
  singlesRubberCount: number;
  doublesRubberCount: number;
}

/**
 * Returns required male and female slots for a given rubber category.
 */
export function getSlotsForCategory(category: string, ignoreGenderRules = false): { male: number; female: number } {
  const cat = (category || '').toUpperCase().trim();
  if (ignoreGenderRules) {
    if (cat === 'MD' || cat === 'WD' || cat === 'XD') return { male: 1, female: 1 }; // agnostic
    return { male: 1, female: 0 };
  }

  if (cat === 'MS') return { male: 1, female: 0 };
  if (cat === 'WS') return { male: 0, female: 1 };
  if (cat === 'MD') return { male: 2, female: 0 };
  if (cat === 'WD') return { male: 0, female: 2 };
  if (cat === 'XD') return { male: 1, female: 1 };

  // Fallback for custom labels
  if (cat.includes('WOMEN') || cat.includes('WS') || cat.includes('WD')) return { male: 0, female: cat.includes('D') ? 2 : 1 };
  if (cat.includes('MEN') || cat.includes('MS') || cat.includes('MD')) return { male: cat.includes('D') ? 2 : 1, female: 0 };
  return { male: 1, female: 0 };
}

/**
 * Normalizes player gender to 'Male' or 'Female'.
 */
export function normalizeGender(gender?: string | null): 'Male' | 'Female' {
  if (!gender) return 'Male'; // default if unstated
  const g = gender.trim().toUpperCase();
  if (g === 'FEMALE' || g === 'F' || g === 'WOMAN' || g === 'GIRL') return 'Female';
  return 'Male';
}

/**
 * Calculate dynamic minimum roster requirements based on tie rubbers and repeat rules.
 */
export function calculateMinRosterRequirements(
  rubbers: TieRubberConfig[],
  rules?: TieLineupRulesConfig
): RosterRequirementResult {
  const regularRubbers = (rubbers || []).filter(r => !r.is_decider_tiebreaker);
  const ignoreGender = Boolean(rules?.ignore_gender_rules);

  const maxMale = Math.max(1, rules?.max_rubbers_per_male ?? rules?.max_rubbers_per_player ?? 2);
  const maxFemale = Math.max(1, rules?.max_rubbers_per_female ?? rules?.max_rubbers_per_player ?? 2);

  let totalMaleSlots = 0;
  let totalFemaleSlots = 0;
  let singlesCount = 0;
  let doublesCount = 0;

  regularRubbers.forEach(r => {
    const slots = getSlotsForCategory(r.category, ignoreGender);
    totalMaleSlots += slots.male;
    totalFemaleSlots += slots.female;
    const cat = (r.category || '').toUpperCase();
    if (cat.includes('D') || slots.male + slots.female > 1) {
      doublesCount++;
    } else {
      singlesCount++;
    }
  });

  // Calculate distinct headcount floor
  let minMale = Math.ceil(totalMaleSlots / maxMale);
  let minFemale = Math.ceil(totalFemaleSlots / maxFemale);

  // If same discipline cannot repeat (default: false), then distinct singles players must cover singles count
  if (rules?.allow_same_discipline_repeat === false) {
    const msRubbers = regularRubbers.filter(r => (r.category || '').toUpperCase().startsWith('MS')).length;
    const wsRubbers = regularRubbers.filter(r => (r.category || '').toUpperCase().startsWith('WS')).length;
    minMale = Math.max(minMale, msRubbers);
    minFemale = Math.max(minFemale, wsRubbers);
  }

  const calculatedTotal = minMale + minFemale;
  // If tournament explicitly defines a manual floor higher than mathematical minimum, respect it
  const finalMinTotal = rules?.team_roster_min ? Math.max(rules.team_roster_min, calculatedTotal) : calculatedTotal;

  return {
    minTotalPlayers: finalMinTotal,
    minMalePlayers: rules?.min_male_players ? Math.max(rules.min_male_players, minMale) : minMale,
    minFemalePlayers: rules?.min_female_players ? Math.max(rules.min_female_players, minFemale) : minFemale,
    totalMaleSlots,
    totalFemaleSlots,
    maxRubbersPerMale: maxMale,
    maxRubbersPerFemale: maxFemale,
    singlesRubberCount: singlesCount,
    doublesRubberCount: doublesCount
  };
}

export interface ValidationError {
  rubberOrder: number;
  playerId: string;
  playerName: string;
  message: string;
  ruleType: 'MAX_REPEAT' | 'SAME_DISCIPLINE' | 'DECIDER_CONFLICT' | 'GENDER_MISMATCH' | 'DUPLICATE_PARTNER';
}

export interface ValidationSummary {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  playerAppearanceCounts: Record<string, { total: number; categories: string[]; rubbers: number[] }>;
}

/**
 * Validates a team's proposed lineup against all tournament rules.
 */
export function validateLineupAssignments(
  assignments: Record<number, { player1_id: string; player2_id?: string }>,
  rubbers: TieRubberConfig[],
  members: Array<{ player_id: string; players?: PlayerInfo; player?: PlayerInfo }>,
  rules?: TieLineupRulesConfig,
  deciderMatch?: { rubber_order: number; category: string }
): ValidationSummary {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const playerAppearanceCounts: Record<string, { total: number; categories: string[]; rubbers: number[] }> = {};

  const playerMap = new Map<string, PlayerInfo>();
  members.forEach(m => {
    const p = m.players || m.player;
    if (p) playerMap.set(m.player_id, p);
  });

  const getPlayerName = (id: string) => playerMap.get(id)?.full_name || 'Player';
  const getPlayerGender = (id: string) => normalizeGender(playerMap.get(id)?.gender);

  const maxMale = Math.max(1, rules?.max_rubbers_per_male ?? rules?.max_rubbers_per_player ?? 2);
  const maxFemale = Math.max(1, rules?.max_rubbers_per_female ?? rules?.max_rubbers_per_player ?? 2);
  const allowSameDiscipline = rules?.allow_same_discipline_repeat ?? false;
  const allowDeciderRepeat = rules?.allow_repeat_in_decider ?? true;
  const allowSameEventDeciderRepeat = rules?.allow_same_event_repeat_in_decider ?? false;

  // Track appearances across regular rubbers
  Object.entries(assignments).forEach(([orderStr, assign]) => {
    const order = Number(orderStr);
    const rubber = rubbers.find(r => r.order === order);
    const category = (rubber?.category || '').toUpperCase();
    const isDecider = Boolean(deciderMatch && deciderMatch.rubber_order === order);

    const playersInRubber = [assign.player1_id, assign.player2_id].filter(Boolean) as string[];

    // 1. Check partner duplication
    if (playersInRubber.length === 2 && playersInRubber[0] === playersInRubber[1]) {
      errors.push({
        rubberOrder: order,
        playerId: playersInRubber[0],
        playerName: getPlayerName(playersInRubber[0]),
        message: `${getPlayerName(playersInRubber[0])} cannot be paired with themselves in ${rubber?.label || `Rubber #${order}`}.`,
        ruleType: 'DUPLICATE_PARTNER'
      });
    }

    // 1b. Check gender eligibility for gendered category (unless ignore_gender_rules is set)
    if (!rules?.ignore_gender_rules && rubber) {
      const cat = (rubber.category || '').toUpperCase();
      if (cat === 'MS' || cat === 'MD') {
        playersInRubber.forEach(pid => {
          if (getPlayerGender(pid) !== 'Male') {
            errors.push({
              rubberOrder: order,
              playerId: pid,
              playerName: getPlayerName(pid),
              message: `${getPlayerName(pid)} is female and cannot be assigned to men's event (${cat}) under strict gender rules.`,
              ruleType: 'GENDER_MISMATCH'
            });
          }
        });
      } else if (cat === 'WS' || cat === 'WD') {
        playersInRubber.forEach(pid => {
          if (getPlayerGender(pid) !== 'Female') {
            errors.push({
              rubberOrder: order,
              playerId: pid,
              playerName: getPlayerName(pid),
              message: `${getPlayerName(pid)} is male and cannot be assigned to women's event (${cat}) under strict gender rules.`,
              ruleType: 'GENDER_MISMATCH'
            });
          }
        });
      } else if (cat === 'XD' && playersInRubber.length === 2) {
        const g1 = getPlayerGender(playersInRubber[0]);
        const g2 = getPlayerGender(playersInRubber[1]);
        if (g1 === g2) {
          errors.push({
            rubberOrder: order,
            playerId: playersInRubber[1],
            playerName: getPlayerName(playersInRubber[1]),
            message: `Mixed Doubles (${rubber.label || `Rubber #${order}`}) requires one male and one female player.`,
            ruleType: 'GENDER_MISMATCH'
          });
        }
      }
    }

    playersInRubber.forEach(pid => {
      if (!playerAppearanceCounts[pid]) {
        playerAppearanceCounts[pid] = { total: 0, categories: [], rubbers: [] };
      }

      if (!isDecider) {
        playerAppearanceCounts[pid].total += 1;
        playerAppearanceCounts[pid].categories.push(category);
        playerAppearanceCounts[pid].rubbers.push(order);
      }
    });
  });

  // 2. Validate max repetitions for regular rubbers
  Object.entries(playerAppearanceCounts).forEach(([pid, stats]) => {
    const gender = getPlayerGender(pid);
    const cap = gender === 'Female' ? maxFemale : maxMale;
    const name = getPlayerName(pid);

    if (stats.total > cap) {
      errors.push({
        rubberOrder: stats.rubbers[stats.rubbers.length - 1],
        playerId: pid,
        playerName: name,
        message: `${name} exceeds repetition cap for ${gender}s (Max ${cap} rubber${cap > 1 ? 's' : ''}, assigned ${stats.total}).`,
        ruleType: 'MAX_REPEAT'
      });
    }

    // 3. Same-discipline repetition check (e.g. MS1 and MS2, or MD1 and MD2, or XD1 and XD2)
    if (!allowSameDiscipline) {
      const categoryCounts: Record<string, number> = {};
      stats.categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      Object.entries(categoryCounts).forEach(([cat, count]) => {
        if (count > 1) {
          errors.push({
            rubberOrder: stats.rubbers[stats.rubbers.length - 1],
            playerId: pid,
            playerName: name,
            message: `${name} is assigned to multiple ${cat} matches. Same-discipline repetition is not allowed.`,
            ruleType: 'SAME_DISCIPLINE'
          });
        }
      });
    }
  });

  // 4. Decider Match validations
  if (deciderMatch) {
    const deciderAssign = assignments[deciderMatch.rubber_order];
    if (deciderAssign) {
      const deciderPlayers = [deciderAssign.player1_id, deciderAssign.player2_id].filter(Boolean) as string[];
      deciderPlayers.forEach(pid => {
        const stats = playerAppearanceCounts[pid];
        const name = getPlayerName(pid);

        if (stats && stats.total > 0 && !allowDeciderRepeat) {
          errors.push({
            rubberOrder: deciderMatch.rubber_order,
            playerId: pid,
            playerName: name,
            message: `${name} played in regular rubbers and is not eligible for the decider match under current rules.`,
            ruleType: 'DECIDER_CONFLICT'
          });
        }

        // Check same event decider repeat (e.g. played regular XD and playing decider XD)
        if (stats && !allowSameEventDeciderRepeat) {
          const deciderCat = (deciderMatch.category || '').toUpperCase();
          if (stats.categories.includes(deciderCat)) {
            errors.push({
              rubberOrder: deciderMatch.rubber_order,
              playerId: pid,
              playerName: name,
              message: `${name} already played regular ${deciderCat} and cannot play the decider ${deciderCat}.`,
              ruleType: 'DECIDER_CONFLICT'
            });
          }
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    playerAppearanceCounts
  };
}

/**
 * Checks single player eligibility for assignment into a specific rubber slot.
 */
export function getPlayerEligibilityForRubber(
  player: PlayerInfo,
  rubber: TieRubberConfig,
  currentAssignments: Record<number, { player1_id: string; player2_id?: string }>,
  rules?: TieLineupRulesConfig,
  currentSlotPlayerId?: string,
  allRubbers?: TieRubberConfig[]
): { eligible: boolean; reason?: string } {
  const gender = normalizeGender(player.gender);
  const cat = (rubber.category || '').toUpperCase();
  const ignoreGender = Boolean(rules?.ignore_gender_rules);

  if (!ignoreGender) {
    if ((cat === 'MS' || cat === 'MD') && gender !== 'Male') {
      return { eligible: false, reason: "Women cannot play in men's category" };
    }
    if ((cat === 'WS' || cat === 'WD') && gender !== 'Female') {
      return { eligible: false, reason: "Men cannot play in women's category" };
    }
  }

  const maxMale = Math.max(1, rules?.max_rubbers_per_male ?? rules?.max_rubbers_per_player ?? 2);
  const maxFemale = Math.max(1, rules?.max_rubbers_per_female ?? rules?.max_rubbers_per_player ?? 2);
  const cap = gender === 'Female' ? maxFemale : maxMale;

  // Count appearances in other rubbers
  let count = 0;
  const playedCategories: string[] = [];

  Object.entries(currentAssignments).forEach(([rOrderStr, assign]) => {
    const rOrder = Number(rOrderStr);
    if (rOrder === rubber.order) {
      // In current rubber, check if they are already in the OTHER slot
      if (assign.player1_id === player.id && currentSlotPlayerId !== player.id) {
        count++;
      }
      if (assign.player2_id === player.id && currentSlotPlayerId !== player.id) {
        count++;
      }
      return;
    }

    if (assign.player1_id === player.id || assign.player2_id === player.id) {
      count++;
      const otherRubber = allRubbers?.find(r => r.order === rOrder);
      if (otherRubber?.category) {
        playedCategories.push(otherRubber.category.toUpperCase());
      }
    }
  });

  // Decider Match checks
  if (rubber.is_decider_tiebreaker) {
    if (rules?.allow_repeat_in_decider === false && count > 0) {
      return { eligible: false, reason: "Decider match does not allow players who already played in tie" };
    }
    if (rules?.allow_same_event_repeat_in_decider === false && playedCategories.includes(cat)) {
      return { eligible: false, reason: `Already played ${cat} in regular tie` };
    }
  }

  if (count >= cap && !rubber.is_decider_tiebreaker) {
    return { eligible: false, reason: `Max repetition limit reached (${cap} rubber${cap > 1 ? 's' : ''})` };
  }

  if (rules?.allow_same_discipline_repeat === false && playedCategories.includes(cat) && !rubber.is_decider_tiebreaker) {
    return { eligible: false, reason: `Already assigned to ${cat}` };
  }

  return { eligible: true };
}

