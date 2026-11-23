import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface LiveScorePeek {
  tournament_id: string;
  /** tournament_matches.score */
  score: string | null;
  court_number?: number | string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  category?: string | null;
  round_name?: string | null;
  format_family?: string | null;
  /** In-progress matches in this tournament right now (courts in play). */
  live_count?: number;
}

/**
 * Lightweight 25-second polling hook for public directory view.
 * Prevents WebSocket thrashing across multiple cards.
 */
export function useLiveScoresFor(tournamentIds: string[]) {
  const ids = tournamentIds.filter(Boolean);

  // NOTE: cache a plain array, NOT a Map — react-query is persisted to
  // localStorage, and a Map serializes to {} (losing .get/.has). Rebuild the
  // Map client-side via useMemo below.
  const { data: rows = [] } = useQuery<LiveScorePeek[]>({
    queryKey: ["live-scores-for", [...ids].sort().join(",")],
    queryFn: async () => {
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, tournament_id, score, court_number, team1_label, team2_label, category, round_name, created_at")
        .eq("status", "in_progress")
        .in("tournament_id", ids)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching live match score peek:", error);
        return [];
      }

      // Keep the latest in-progress match per tournament, and count them all.
      const byTournament = new Map<string, LiveScorePeek>();
      (data || []).forEach((m) => {
        const existing = byTournament.get(m.tournament_id);
        if (existing) {
          existing.live_count = (existing.live_count ?? 1) + 1;
          return;
        }
        byTournament.set(m.tournament_id, {
          tournament_id: m.tournament_id,
          score: m.score,
          court_number: m.court_number,
          team1_label: m.team1_label,
          team2_label: m.team2_label,
          category: m.category,
          round_name: m.round_name,
          live_count: 1,
        });
      });
      return [...byTournament.values()];
    },
    enabled: ids.length > 0,
    refetchInterval: 25000,
    staleTime: 20000,
  });

  return useMemo(
    () => new Map((Array.isArray(rows) ? rows : []).map((r) => [r.tournament_id, r])),
    [rows],
  );
}
