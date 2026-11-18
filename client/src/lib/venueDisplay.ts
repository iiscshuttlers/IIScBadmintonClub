import { getBaseShareUrl } from "@/lib/utils";

export const VENUE_STALE_AFTER_MS = 75_000;

export function isVenueDataStale(
  updatedAt: number | null,
  now = Date.now(),
  staleAfterMs = VENUE_STALE_AFTER_MS,
): boolean {
  return updatedAt != null && now - updatedAt > staleAfterMs;
}

export function venueTournamentUrl(tournamentId: string): string {
  return `${getBaseShareUrl()}/tournaments/${encodeURIComponent(tournamentId)}`;
}
