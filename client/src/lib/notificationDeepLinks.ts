export type NotificationTarget =
  | { kind: "internal"; path: string }
  | { kind: "external"; url: string };

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=shuttlers.iisc.com";

function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string" || !/^\/(?!\/)/.test(value) || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://app.invalid");
    if (parsed.origin !== "https://app.invalid") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** One navigation contract for native taps, warm web clients and cold web opens. */
export function notificationTarget(data: Record<string, unknown> | null | undefined): NotificationTarget | null {
  if (!data) return null;

  const explicit = safeInternalPath(data.link);
  if (explicit) return { kind: "internal", path: explicit };

  const type = typeof data.type === "string" ? data.type : "";
  const action = typeof data.action === "string" ? data.action : "";
  const matchId = typeof data.match_id === "string"
    ? data.match_id
    : typeof data.matchId === "string" ? data.matchId : "";
  const tournamentId = typeof data.tournament_id === "string" ? data.tournament_id : "";
  const playerId = typeof data.player_id === "string"
    ? data.player_id
    : typeof data.from_player_id === "string" ? data.from_player_id : "";

  if (type === "app_update") return { kind: "external", url: PLAY_STORE_URL };
  if (matchId && tournamentId) {
    return {
      kind: "internal",
      path: `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`,
    };
  }
  if (["player_profile", "buddy_request", "follow", "status_update", "elo_milestone"].includes(type)) {
    return { kind: "internal", path: playerId ? `/player/${encodeURIComponent(playerId)}` : "/players" };
  }
  if (["challenge_expiry", "new_challenge"].includes(type) || action === "view_challenges" || data.tab === "challenges") {
    return { kind: "internal", path: "/my-matches" };
  }
  if (["find_lost", "find_lost_post"].includes(type) || action === "view_find_lost") {
    return { kind: "internal", path: "/club?tab=lost-found" };
  }
  if (["announcement", "weekly_digest"].includes(type) || action === "view_announcements") {
    return { kind: "internal", path: "/club?tab=news" };
  }
  if (type === "live_score" || action === "view_live_score") {
    return { kind: "internal", path: "/tournaments" };
  }
  if (matchId) {
    return { kind: "internal", path: `/my-matches?highlight=${encodeURIComponent(matchId)}` };
  }
  if (["match_confirmation", "match_logged", "kudos", "match_reminder", "court_queue"].includes(type) || action === "view_match") {
    return { kind: "internal", path: "/my-matches" };
  }
  return { kind: "internal", path: "/" };
}

