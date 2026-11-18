import { useQuery } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/lib/supabase";
import { computeTournamentStatus } from "@/lib/tournaments";
import { buildAdminActionCards, countDelayedMatches, countScheduleConflicts, type AdminActionCard, type TournamentActionInput } from "@/lib/adminActions";
import { parseOfflineQueue } from "@/lib/umpire/offlineQueue";
import type { UnavailableCourtPeriod } from "@/lib/courtConflicts";

const OFFLINE_QUEUE_KEY = "umpire_offline_queue_v1"; // same key as useOfflineUmpireSync

async function countRows(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function unsyncedOnThisDevice(): Promise<number | null> {
  try {
    const { value } = await Preferences.get({ key: OFFLINE_QUEUE_KEY });
    return parseOfflineQueue(value).length;
  } catch {
    return null;
  }
}

async function tournamentInputs(now = new Date()): Promise<TournamentActionInput[]> {
  // select("*"): policy columns (rest/duration/blackouts) may not exist on
  // every deployed schema yet; missing ones fall back to defaults.
  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("*")
    .not("status", "in", "(draft,archived,deleted,completed)");
  if (error) throw error;
  const running = (tournaments ?? [])
    .map((t) => ({ ...t, lifecycle: computeTournamentStatus(t) }))
    .filter((t) => t.lifecycle === "active" || t.lifecycle === "upcoming");
  if (running.length === 0) return [];
  const ids = running.map((t) => t.id);

  const [{ data: officials, error: oErr }, { data: matches, error: mErr }] = await Promise.all([
    supabase.from("tournament_officials").select("tournament_id, role").in("tournament_id", ids).in("role", ["UMPIRE", "REFEREE"]),
    supabase.from("tournament_matches").select("*").in("tournament_id", ids).neq("status", "cancelled"),
  ]);
  if (oErr) throw oErr;
  if (mErr) throw mErr;

  return running.map((t) => {
    const mine = (matches ?? []).filter((m) => m.tournament_id === t.id);
    const conflicts = countScheduleConflicts(mine, {
      minRestMinutes: typeof t.min_rest_minutes === "number" ? t.min_rest_minutes : undefined,
      estimatedMinutes: typeof t.estimated_match_minutes === "number" ? t.estimated_match_minutes : undefined,
      unavailablePeriods: Array.isArray(t.unavailable_court_periods)
        ? (t.unavailable_court_periods as unknown as UnavailableCourtPeriod[])
        : [],
    });
    return {
      id: t.id,
      name: t.name ?? "Tournament",
      lifecycle: t.lifecycle,
      officialCount: (officials ?? []).filter((o) => o.tournament_id === t.id).length,
      hardConflicts: conflicts.hard,
      warningConflicts: conflicts.warning,
      delayedMatches: countDelayedMatches(mine, now),
    };
  });
}

/**
 * Current, server-derived admin to-dos. Refetches whenever the overview is
 * shown or the window regains focus, and realtime match changes invalidate it
 * through the "tournament_matches" prefix, so resolved items drop out.
 */
export function useAdminActionItems(enabled: boolean) {
  return useQuery({
    queryKey: ["tournament_matches", "admin-action-items"],
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<AdminActionCard[]> => {
      const [tournaments, guestIdentities, unsynced] = await Promise.all([
        tournamentInputs(),
        countRows(
          supabase.from("players").select("id", { count: "exact", head: true }).eq("is_guest", true).is("deleted_at", null),
        ),
        unsyncedOnThisDevice(),
      ]);
      // Plain array of plain objects: the query cache is persisted.
      return buildAdminActionCards({
        tournaments,
        guestIdentities,
        unsyncedOnThisDevice: unsynced,
      });
    },
  });
}
