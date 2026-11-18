export interface CourtScheduledMatch {
  id: string;
  court_number?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  status: string;
  match_code?: string | null;
}

export interface UnavailableCourtPeriod {
  id?: string;
  court: string;
  start: string;
  end: string;
  reason?: string;
}

export interface CourtConflict {
  matchId: string;
  otherMatchId?: string;
  otherCode?: string;
  court: string;
  overlapMins: number;
  timingBasis: "actual" | "estimated" | "unavailable" | "unavailable_period";
  conflictType: "hard" | "warning";
  reason?: string;
  description?: string;
}

export interface SuggestedSlot {
  court: string;
  scheduledAt: string;
  scheduled_at?: string;
  label: string;
  reason?: string;
}

export const DEFAULT_COURT_SLOT_MINS = 30;

const time = (value: string | null | undefined) => value ? Date.parse(value) : Number.NaN;

const interval = (match: CourtScheduledMatch, estimatedMins: number) => {
  const start = time(match.started_at ?? match.scheduled_at);
  if (!Number.isFinite(start)) return null;
  const actualEnd = time(match.ended_at);
  return {
    start,
    end: Number.isFinite(actualEnd) ? actualEnd : start + estimatedMins * 60_000,
    basis: Number.isFinite(actualEnd) ? "actual" as const : "estimated" as const,
  };
};

export function findCourtConflicts(
  matches: CourtScheduledMatch[],
  optionsOrEstimatedMins?: { estimatedMinutes?: number; unavailablePeriods?: UnavailableCourtPeriod[] } | number,
  unavailablePeriodsParam: UnavailableCourtPeriod[] = [],
): Map<string, CourtConflict[]> {
  const estimatedMins = typeof optionsOrEstimatedMins === "number"
    ? optionsOrEstimatedMins
    : (optionsOrEstimatedMins?.estimatedMinutes ?? DEFAULT_COURT_SLOT_MINS);
  const unavailablePeriods = typeof optionsOrEstimatedMins === "number"
    ? unavailablePeriodsParam
    : (optionsOrEstimatedMins?.unavailablePeriods ?? unavailablePeriodsParam ?? []);

  const usable = matches.filter((match) =>
    match.status !== "walkover" && !!match.court_number && interval(match, estimatedMins) !== null,
  );
  const out = new Map<string, CourtConflict[]>();

  // 1. Check unavailable court periods
  for (const match of usable) {
    const matchInt = interval(match, estimatedMins)!;
    const courtNorm = match.court_number!.trim().toLowerCase();

    for (const period of unavailablePeriods) {
      if (period.court.trim().toLowerCase() !== courtNorm) continue;
      const periodStart = time(period.start);
      const periodEnd = time(period.end);
      if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd)) continue;

      const overlapStart = Math.max(matchInt.start, periodStart);
      const overlapEnd = Math.min(matchInt.end, periodEnd);
      const overlapMins = Math.ceil((overlapEnd - overlapStart) / 60_000);

      if (overlapMins > 0) {
        const conflict: CourtConflict = {
          matchId: match.id,
          court: match.court_number!,
          overlapMins,
          timingBasis: "unavailable_period",
          conflictType: "hard",
          reason: period.reason || "Maintenance / Blackout",
          description: `Court ${match.court_number} is unavailable: ${period.reason || "Maintenance / Blackout"}`,
        };
        out.set(match.id, [...(out.get(match.id) ?? []), conflict]);
      }
    }
  }

  // 2. Check match-to-match overlaps
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const left = usable[i];
      const right = usable[j];
      if (left.court_number!.trim().toLowerCase() !== right.court_number!.trim().toLowerCase()) continue;
      const a = interval(left, estimatedMins)!;
      const b = interval(right, estimatedMins)!;
      const overlapMins = Math.ceil((Math.min(a.end, b.end) - Math.max(a.start, b.start)) / 60_000);
      if (overlapMins <= 0) continue;

      const now = Date.now();
      const isLeftLive = (left.status === "in_progress" || left.status === "live") && now >= a.start;
      const isRightLive = (right.status === "in_progress" || right.status === "live") && now >= b.start;
      const isOccupiedNow = isLeftLive || isRightLive;

      const basis = a.basis === "actual" && b.basis === "actual" ? "actual" as const : "estimated" as const;
      const court = left.court_number!;

      const leftConflict: CourtConflict = {
        matchId: left.id,
        otherMatchId: right.id,
        otherCode: right.match_code || "another match",
        court,
        overlapMins,
        timingBasis: isOccupiedNow ? "actual" : basis,
        conflictType: isOccupiedNow ? "hard" : "warning",
        description: isOccupiedNow
          ? `Court ${court} is actively in use by ${right.match_code || "another match"}`
          : `Court ${court} overlaps ${right.match_code || "another match"} by ${overlapMins}m (${basis})`,
      };

      const rightConflict: CourtConflict = {
        matchId: right.id,
        otherMatchId: left.id,
        otherCode: left.match_code || "another match",
        court,
        overlapMins,
        timingBasis: isOccupiedNow ? "actual" : basis,
        conflictType: isOccupiedNow ? "hard" : "warning",
        description: isOccupiedNow
          ? `Court ${court} is actively in use by ${left.match_code || "another match"}`
          : `Court ${court} overlaps ${left.match_code || "another match"} by ${overlapMins}m (${basis})`,
      };

      out.set(left.id, [...(out.get(left.id) ?? []), leftConflict]);
      out.set(right.id, [...(out.get(right.id) ?? []), rightConflict]);
    }
  }

  return out;
}

/**
 * Suggest non-conflicting slots for a match on either the same court or alternative courts.
 */
export function suggestAlternativeSlots(
  targetMatch: CourtScheduledMatch,
  allMatches: CourtScheduledMatch[],
  courts: string[],
  estimatedMins = DEFAULT_COURT_SLOT_MINS,
  unavailablePeriods: UnavailableCourtPeriod[] = [],
): SuggestedSlot[] {
  const baseTime = time(targetMatch.scheduled_at) || Date.now();
  const suggestions: SuggestedSlot[] = [];
  const targetCourt = targetMatch.court_number?.trim();

  // Try intervals of estimatedMins from baseTime up to 3 hours later
  const candidateTimes: number[] = [];
  for (let offsetMins = 0; offsetMins <= 180; offsetMins += Math.max(15, estimatedMins)) {
    candidateTimes.push(baseTime + offsetMins * 60_000);
  }

  // Prioritize target court first, then other available courts
  const sortedCourts = courts.slice().sort((a, b) => {
    if (targetCourt && a.toLowerCase() === targetCourt.toLowerCase()) return -1;
    if (targetCourt && b.toLowerCase() === targetCourt.toLowerCase()) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  for (const candTime of candidateTimes) {
    if (suggestions.length >= 4) break;
    for (const c of sortedCourts) {
      if (suggestions.length >= 4) break;
      // Don't suggest the exact same court and time if it was the original target
      if (candTime === baseTime && targetCourt && c.toLowerCase() === targetCourt.toLowerCase()) {
        continue;
      }
      const candIso = new Date(candTime).toISOString();
      const testMatch: CourtScheduledMatch = {
        ...targetMatch,
        court_number: c,
        scheduled_at: candIso,
      };

      // Exclude target match itself from the check
      const otherMatches = allMatches.filter((m) => m.id !== targetMatch.id);
      const conflicts = findCourtConflicts([...otherMatches, testMatch], estimatedMins, unavailablePeriods);

      if (!conflicts.has(targetMatch.id)) {
        // No conflicts found for this slot!
        const dateObj = new Date(candTime);
        const timeLabel = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const courtLabel = c.toUpperCase().startsWith("C") ? c : `Court ${c}`;
        suggestions.push({
          court: c,
          scheduledAt: candIso,
          scheduled_at: candIso,
          label: `${courtLabel} at ${timeLabel}`,
          reason: `Available on ${courtLabel}`,
        });
      }
    }
  }

  return suggestions;
}
