import type { MatchShareData, MatchSharePlayer } from "@/lib/matchShareCard";
import type { MatchSide, MatchView } from "@/lib/matchView";
import { getBaseShareUrl } from "@/lib/utils";
import { matchPath } from "@/lib/tournamentRoutes";

/**
 * Adapter from the shared `MatchView` model (WP6) to the existing PNG share
 * card, so tournament surfaces share the same image as the feed.
 * Pure: no canvas or DOM, so it's unit-testable.
 */

/** Public, absolute match URL. Shares must never use the app's own origin
 * (capacitor://localhost on Android) and must keep the GitHub Pages base path. */
export function matchShareUrl(view: Pick<MatchView, "tournamentId" | "id">): string {
  return `${getBaseShareUrl()}${matchPath(view.tournamentId, view.id)}`;
}

function players(side: MatchSide): MatchSharePlayer[] {
  const names = side.label
    .split(/\s+(?:\/|&)\s+/)
    .map((n) => n.trim())
    .filter(Boolean);
  const list = (names.length ? names : [side.label]).map((name) => ({ name }));
  if (side.seed != null && list[0]) list[0] = { name: `${list[0].name} [${side.seed}]` };
  return list;
}

/** Only decided matches with a winner can be shared as a result card. */
export function canShareResult(view: Pick<MatchView, "state" | "sides">): boolean {
  return (view.state === "completed" || view.state === "walkover") && view.sides.some((s) => s.isWinner);
}

export function matchViewToShareInput(
  view: MatchView,
  opts: { tournamentName?: string | null } = {},
): { data: MatchShareData; text: string; url: string } | null {
  if (!canShareResult(view)) return null;
  const winnerIdx = view.sides[0].isWinner ? 0 : 1;
  const winner = view.sides[winnerIdx];
  const loser = view.sides[winnerIdx === 0 ? 1 : 0];
  const walkover = view.state === "walkover";

  const sets = walkover
    ? []
    : view.games.map((g) => (winnerIdx === 0 ? { w: g.side1, l: g.side2 } : { w: g.side2, l: g.side1 }));
  const setsWon = sets.length
    ? { w: sets.filter((s) => s.w > s.l).length, l: sets.filter((s) => s.l > s.w).length }
    : undefined;
  const displayScore = walkover
    ? "Walkover"
    : sets.length
      ? sets.map((s) => `${s.w}-${s.l}`).join(", ")
      : view.scoreText ?? "";

  const event = [view.categoryLabel, view.roundName, view.rubberLabel].filter(Boolean).join(" · ");
  const dateIso = view.endedAt ?? view.startedAt ?? view.scheduledAt;
  const url = matchShareUrl(view);
  const tournamentName = opts.tournamentName?.trim() || undefined;

  const text = `🏸 ${tournamentName ? `${tournamentName} · ` : ""}${event}: ${winner.label} ${
    walkover ? "won by walkover against" : "def."
  } ${loser.label}${!walkover && displayScore ? ` (${displayScore})` : ""}.`;

  return {
    data: {
      winners: players(winner),
      losers: players(loser),
      sets,
      setsWon,
      displayScore,
      matchType: "Tournament",
      matchDate: dateIso ? new Date(dateIso) : undefined,
      category: event || undefined,
      tournamentName,
    },
    text,
    url,
  };
}
