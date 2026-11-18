export type AlertEventType = "match_call" | "schedule_change" | "result";

export interface CandidateRecipient {
  userId: string;
  source: "participant" | "player_follow" | "tournament_follow";
  isMuted?: boolean;
  notifyMatchCall?: boolean;
  notifyScheduleChange?: boolean;
  notifyResult?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export function isInQuietHours(
  quietStart?: string | null,
  quietEnd?: string | null,
  nowTime?: string
): boolean {
  if (!quietStart || !quietEnd) return false;

  const current = nowTime
    ? nowTime
    : new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

  const toMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const curMins = toMinutes(current);
  const startMins = toMinutes(quietStart);
  const endMins = toMinutes(quietEnd);

  if (startMins <= endMins) {
    // E.g. 13:00 to 15:00
    return curMins >= startMins && curMins <= endMins;
  } else {
    // Overnight, e.g. 22:00 to 07:00
    return curMins >= startMins || curMins <= endMins;
  }
}

export function deduplicateAndFilterRecipients(
  candidates: CandidateRecipient[],
  eventType: AlertEventType,
  currentTimeStr?: string
): string[] {
  const eligibleUserIds = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.isMuted) continue;

    // Check event-specific preferences
    if (eventType === "match_call" && candidate.notifyMatchCall === false) continue;
    if (eventType === "schedule_change" && candidate.notifyScheduleChange === false) continue;
    if (eventType === "result" && candidate.notifyResult === false) continue;

    // Check quiet hours
    if (candidate.quietHoursEnabled) {
      if (isInQuietHours(candidate.quietHoursStart, candidate.quietHoursEnd, currentTimeStr)) {
        continue;
      }
    }

    eligibleUserIds.add(candidate.userId);
  }

  return Array.from(eligibleUserIds);
}

export function formatTargetedAlert(params: {
  eventType: AlertEventType;
  side1: string;
  side2: string;
  category?: string | null;
  court?: string | null;
  scheduledTime?: string | null;
  score?: string | null;
  tournamentId?: string | null;
  matchId?: string | null;
}): { title: string; body: string; url: string } {
  const { eventType, side1, side2, category, court, scheduledTime, score, tournamentId, matchId } = params;
  const catPrefix = category ? `${category} · ` : "";
  const url = tournamentId
    ? matchId
      ? `/tournaments/${tournamentId}/matches/${matchId}`
      : `/tournaments/${tournamentId}`
    : "/";

  if (eventType === "match_call") {
    const where = court ? (court.toLowerCase().startsWith("court") ? court : `Court ${court}`) : "Your court";
    return {
      title: `📣 ${where} is ready for you`,
      body: `${catPrefix}${side1} vs ${side2} — please report to the court now.`,
      url,
    };
  }

  if (eventType === "schedule_change") {
    const courtText = court ? ` on ${court.toLowerCase().startsWith("court") ? court : `Court ${court}`}` : "";
    const timeText = scheduledTime ? ` at ${scheduledTime}` : "";
    return {
      title: `🏸 Schedule Update: ${side1} vs ${side2}`,
      body: `${catPrefix}Match scheduled${courtText}${timeText}.`,
      url,
    };
  }

  // Result
  return {
    title: `🏸 Match Result: ${side1} vs ${side2}`,
    body: `${catPrefix}Final score: ${score || "Completed"}. Tap to view full scorecard.`,
    url,
  };
}

