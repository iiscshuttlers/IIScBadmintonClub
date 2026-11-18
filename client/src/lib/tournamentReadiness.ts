export type ReadinessState = "pass" | "fail" | "unknown";

export type LifecycleAction = "announce" | "publish_draw" | "start_play";

export type ReadinessBlockerCode =
  | "MISSING_DETAILS"
  | "EMPTY_ENTRANTS"
  | "UNRESOLVED_PAIRS"
  | "NO_FIXTURES"
  | "INVALID_SCORING"
  | "NO_PLAYABLE_MATCHES"
  | "UNSCHEDULED_PLAYABLE_MATCHES"
  | "HARD_SCHEDULE_CONFLICT"
  | "DATA_ERROR";

export type ReadinessWarningCode =
  | "MISSING_DESCRIPTION"
  | "NO_CATEGORIES"
  | "MISSING_OFFICIALS";

export type ReadinessFixTab =
  | "setup"
  | "participants"
  | "teams"
  | "bracket"
  | "fixtures"
  | "rules"
  | "schedule"
  | "officials";

export interface ReadinessIssue {
  code: ReadinessBlockerCode | ReadinessWarningCode;
  message: string;
  fix_tab: ReadinessFixTab;
  count?: number;
  entity_ids?: string[];
  severity: "blocker" | "warning";
}

export interface LifecycleReadinessReport {
  action: LifecycleAction;
  allowed: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

export interface ReadinessCheck {
  key: "details" | "entrants" | "fixtures" | "scoring" | "schedule" | "officials" | "published";
  state: ReadinessState;
  blocking: boolean;
  detail: string;
  code?: ReadinessBlockerCode | ReadinessWarningCode;
  tab?: ReadinessFixTab;
  entity_ids?: string[];
}

export interface ReadinessTournament {
  id?: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  format_family?: string | null;
  tournament_type?: string | null;
  categories?: string[] | null;
  unavailable_court_periods?: any;
  estimated_match_minutes?: number | null;
  [key: string]: any;
}

export interface ReadinessParticipant {
  id?: string;
  category?: string | null;
  partner_id?: string | null;
  display_name?: string | null;
}

export interface ReadinessMatch {
  id?: string;
  status?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  court_number?: string | null;
  scheduled_at?: string | null;
  points_to_win?: number | null;
  best_of_sets?: number | null;
  golden_point?: number | null;
  umpired_by?: string | null;
}

const doublesCategory = (category: string | null | undefined) =>
  ["MD", "WD", "XD", "DOUBLES", "MIXED"].some((token) => (category ?? "").toUpperCase().includes(token));

const assigned = (match: ReadinessMatch) =>
  !!(match.player1_id || match.team1_label) && !!(match.player2_id || match.team2_label);

export interface EvaluateLifecycleInput {
  action: LifecycleAction;
  tournament?: ReadinessTournament | null;
  participants?: ReadinessParticipant[];
  teamCount?: number;
  tieCount?: number;
  matches?: ReadinessMatch[];
  dataError?: boolean;
}

export function evaluateLifecycleReadiness(input: EvaluateLifecycleInput): LifecycleReadinessReport {
  const { action, tournament, participants = [], teamCount = 0, tieCount = 0, matches = [], dataError = false } = input;

  if (!tournament || dataError) {
    return {
      action,
      allowed: false,
      blockers: [
        {
          code: "DATA_ERROR",
          message: "Could not verify tournament readiness due to a data error. Retry before continuing.",
          fix_tab: "setup",
          severity: "blocker",
        },
      ],
      warnings: [],
    };
  }

  const isTeam = tournament.format_family === "TEAM" || tournament.tournament_type === "team";
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // ==========================================
  // STAGE 1: ANNOUNCE (Details & Registration)
  // ==========================================
  if (!tournament.name || tournament.name.trim() === "") {
    blockers.push({
      code: "MISSING_DETAILS",
      message: "Tournament name is required",
      fix_tab: "setup",
      severity: "blocker",
    });
  }

  if (!tournament.start_date) {
    blockers.push({
      code: "MISSING_DETAILS",
      message: "Tournament start date is required",
      fix_tab: "setup",
      severity: "blocker",
    });
  }

  if (!tournament.venue || tournament.venue.trim() === "") {
    blockers.push({
      code: "MISSING_DETAILS",
      message: "Tournament venue is required",
      fix_tab: "setup",
      severity: "blocker",
    });
  }

  if (!tournament.description || tournament.description.trim() === "") {
    warnings.push({
      code: "MISSING_DESCRIPTION",
      message: "Tournament description is empty",
      fix_tab: "setup",
      severity: "warning",
    });
  }

  if (!isTeam && (!tournament.categories || tournament.categories.length === 0)) {
    warnings.push({
      code: "NO_CATEGORIES",
      message: "No playing categories selected (MS, WS, MD, WD, XD)",
      fix_tab: "setup",
      severity: "warning",
    });
  }

  if (action === "announce") {
    return {
      action,
      allowed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  // ==========================================
  // STAGE 2: PUBLISH DRAW (Brackets & Pairs)
  // ==========================================
  const entrantCount = isTeam ? teamCount : participants.length;
  if (entrantCount < 2) {
    blockers.push({
      code: "EMPTY_ENTRANTS",
      message: isTeam
        ? "Add at least two teams before publishing draw"
        : "Add at least two participants before publishing draw",
      count: entrantCount,
      fix_tab: isTeam ? "teams" : "participants",
      severity: "blocker",
    });
  }

  if (!isTeam) {
    const unresolvedPairs = participants.filter(
      (p) => doublesCategory(p.category) && !p.partner_id && !(p.display_name ?? "").includes("&")
    );
    if (unresolvedPairs.length > 0) {
      blockers.push({
        code: "UNRESOLVED_PAIRS",
        message: `Resolve partner assignments for ${unresolvedPairs.length} doubles/XD entry(ies)`,
        count: unresolvedPairs.length,
        entity_ids: unresolvedPairs.map((p) => p.id).filter(Boolean) as string[],
        fix_tab: "participants",
        severity: "blocker",
      });
    }
  }

  const fixtureCount = isTeam ? tieCount : matches.length;
  if (fixtureCount === 0) {
    blockers.push({
      code: "NO_FIXTURES",
      message: isTeam
        ? "Generate tournament ties before publishing fixtures"
        : "Generate tournament bracket / matches before publishing draw",
      count: 0,
      fix_tab: isTeam ? "fixtures" : "bracket",
      severity: "blocker",
    });
  }

  const invalidScoringMatches = matches.filter(
    (m) =>
      (m.points_to_win ?? 0) <= 0 ||
      (m.best_of_sets ?? 0) <= 0 ||
      (m.best_of_sets ?? 0) % 2 === 0 ||
      ((m.golden_point ?? 0) !== 0 && (m.golden_point ?? 0) < (m.points_to_win ?? 0))
  );

  if (fixtureCount > 0 && invalidScoringMatches.length > 0) {
    blockers.push({
      code: "INVALID_SCORING",
      message: `Configure valid scoring rules for ${invalidScoringMatches.length} match(es)`,
      count: invalidScoringMatches.length,
      entity_ids: invalidScoringMatches.map((m) => m.id).filter(Boolean) as string[],
      fix_tab: "rules",
      severity: "blocker",
    });
  }

  if (action === "publish_draw") {
    return {
      action,
      allowed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  // ==========================================
  // STAGE 3: START PLAY (Live Play / Active)
  // ==========================================
  const playable = matches.filter(
    (m) => assigned(m) && !["completed", "walkover", "cancelled"].includes(m.status ?? "")
  );

  if (playable.length === 0) {
    blockers.push({
      code: "NO_PLAYABLE_MATCHES",
      message: "Assign competitors to both sides of at least one playable match",
      fix_tab: "bracket",
      severity: "blocker",
    });
  } else {
    const unscheduled = playable.filter((m) => !m.court_number?.trim() || !m.scheduled_at);
    if (unscheduled.length > 0) {
      blockers.push({
        code: "UNSCHEDULED_PLAYABLE_MATCHES",
        message: `Assign court and scheduled time for ${unscheduled.length} playable match(es)`,
        count: unscheduled.length,
        entity_ids: unscheduled.map((m) => m.id).filter(Boolean) as string[],
        fix_tab: "schedule",
        severity: "blocker",
      });
    }

    // Hard court conflicts: blackout periods and a court occupied by a live match.
    const rawPeriods = tournament.unavailable_court_periods;
    const blackoutPeriods: Array<{ court: string; start: string; end: string; reason?: string }> =
      Array.isArray(rawPeriods)
        ? rawPeriods
        : typeof rawPeriods === "string"
        ? (() => {
            try {
              return JSON.parse(rawPeriods);
            } catch {
              return [];
            }
          })()
        : [];

    const courtMatches = matches.filter((match): match is ReadinessMatch & { id: string } => !!match.id);
    const conflictMap = findCourtConflicts(courtMatches as CourtScheduledMatch[], {
      estimatedMinutes: tournament.estimated_match_minutes || 30,
      unavailablePeriods: blackoutPeriods,
    });
    const hardConflictIds = playable
      .map((match) => match.id)
      .filter((id): id is string => !!id && (conflictMap.get(id)?.some((conflict) => conflict.conflictType === "hard") ?? false));

    if (hardConflictIds.length > 0) {
      blockers.push({
        code: "HARD_SCHEDULE_CONFLICT",
        message: `${hardConflictIds.length} playable match(es) have an unavailable or occupied court`,
        count: hardConflictIds.length,
        entity_ids: hardConflictIds,
        fix_tab: "schedule",
        severity: "blocker",
      });
    }

    const unumpired = playable.filter((m) => !m.umpired_by);
    if (unumpired.length > 0) {
      warnings.push({
        code: "MISSING_OFFICIALS",
        message: `${unumpired.length} playable match(es) have no assigned umpire / official`,
        count: unumpired.length,
        entity_ids: unumpired.map((m) => m.id).filter(Boolean) as string[],
        fix_tab: "officials",
        severity: "warning",
      });
    }
  }

  return {
    action,
    allowed: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function evaluateTournamentReadiness(input: {
  tournament?: ReadinessTournament | null;
  participants?: ReadinessParticipant[];
  teamCount?: number;
  tieCount?: number;
  matches?: ReadinessMatch[];
  dataError?: boolean;
}): ReadinessCheck[] {
  const { tournament, participants = [], teamCount = 0, tieCount = 0, matches = [], dataError = false } = input;
  if (!tournament || dataError) {
    return ["details", "entrants", "fixtures", "scoring", "schedule", "officials", "published"].map((key) => ({
      key: key as ReadinessCheck["key"],
      state: "unknown",
      blocking: key !== "published",
      detail: "Could not verify this check. Retry before publishing or starting play.",
      code: "DATA_ERROR",
      tab: "setup",
    }));
  }

  const isTeam = tournament.format_family === "TEAM" || tournament.tournament_type === "team";
  const unresolvedPairs = participants.filter((p) =>
    doublesCategory(p.category) && !p.partner_id && !(p.display_name ?? "").includes("&")
  );
  const playable = matches.filter((m) => assigned(m) && !["completed", "walkover", "cancelled"].includes(m.status ?? ""));
  const scheduled = playable.filter((m) => !!m.court_number && !!m.scheduled_at);
  const validScoring = matches.filter(
    (m) =>
      (m.points_to_win ?? 0) > 0 &&
      (m.best_of_sets ?? 0) > 0 &&
      (m.best_of_sets ?? 0) % 2 === 1 &&
      ((m.golden_point ?? 0) === 0 || (m.golden_point ?? 0) >= (m.points_to_win ?? 0))
  );
  const officialsAssigned = playable.filter((m) => !!m.umpired_by);
  const entrantCount = isTeam ? teamCount : participants.length;
  const fixtureCount = isTeam ? tieCount : matches.length;

  return [
    {
      key: "details",
      state: tournament.start_date && tournament.venue && tournament.name ? "pass" : "fail",
      blocking: true,
      detail:
        tournament.start_date && tournament.venue && tournament.name
          ? "Name, date and venue are configured."
          : "Add tournament name, start date and venue.",
      code: "MISSING_DETAILS",
      tab: "setup",
    },
    {
      key: "entrants",
      state: entrantCount >= 2 && unresolvedPairs.length === 0 ? "pass" : "fail",
      blocking: true,
      detail:
        unresolvedPairs.length > 0
          ? `${unresolvedPairs.length} doubles/XD entry or entries still need a partner.`
          : `${entrantCount} ${isTeam ? "team" : "participant"}${entrantCount === 1 ? "" : "s"} configured.`,
      code: unresolvedPairs.length > 0 ? "UNRESOLVED_PAIRS" : "EMPTY_ENTRANTS",
      tab: isTeam ? "teams" : "participants",
      entity_ids: unresolvedPairs.map((p) => p.id).filter(Boolean) as string[],
    },
    {
      key: "fixtures",
      state: fixtureCount > 0 ? "pass" : "fail",
      blocking: true,
      detail: `${fixtureCount} ${isTeam ? "tie" : "match"}${fixtureCount === 1 ? "" : "es"} generated.`,
      code: "NO_FIXTURES",
      tab: isTeam ? "fixtures" : "bracket",
    },
    {
      key: "scoring",
      state: matches.length > 0 && validScoring.length === matches.length ? "pass" : "fail",
      blocking: true,
      detail:
        matches.length === 0
          ? "Generate fixtures before scoring rules can be verified."
          : `${validScoring.length}/${matches.length} matches have valid scoring rules.`,
      code: "INVALID_SCORING",
      tab: "rules",
    },
    {
      key: "schedule",
      state: playable.length > 0 && scheduled.length === playable.length ? "pass" : "fail",
      blocking: true,
      detail: `${scheduled.length}/${playable.length} currently playable matches have a court and time.`,
      code: playable.length === 0 ? "NO_PLAYABLE_MATCHES" : "UNSCHEDULED_PLAYABLE_MATCHES",
      tab: "schedule",
    },
    {
      key: "officials",
      state: playable.length > 0 && officialsAssigned.length === playable.length ? "pass" : "fail",
      blocking: false,
      detail: `${officialsAssigned.length}/${playable.length} currently playable matches have an assigned official.`,
      code: "MISSING_OFFICIALS",
      tab: "officials",
    },
    {
      key: "published",
      state: tournament.status === "active" ? "pass" : "fail",
      blocking: false,
      detail: tournament.status === "active" ? "Tournament is live." : "Tournament is not live yet.",
      tab: "setup",
    },
  ];
}
import { findCourtConflicts, type CourtScheduledMatch } from "./courtConflicts";

