import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  MATCH_VIEW_COLUMNS,
  buildSeedIndex,
  toMatchView,
  type MatchRow,
  type MatchView,
} from "@/lib/matchView";

/**
 * Match data for the Match Centre and court queues (WP6).
 *
 * Query keys start with "tournament_matches", which RealtimeProvider already
 * invalidates on every tournament_matches change — so these views stay live
 * without opening any additional realtime channel.
 *
 * Open (not finished) matches are loaded in full because the court queue
 * needs every one of them; finished matches are paged.
 */

const FINISHED = ["completed", "walkover", "cancelled", "finished"];
export const COMPLETED_PAGE_SIZE = 30;
/** A live view older than this is labelled as possibly out of date. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

type SeedRow = { category: string | null; player_id: string | null; partner_id: string | null; seed: number | null };

async function fetchSeeds(tournamentId: string): Promise<SeedRow[]> {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("category, player_id, partner_id, seed")
    .eq("tournament_id", tournamentId)
    .not("seed", "is", null);
  // Seeds are decoration: a failure must not hide matches.
  if (error) return [];
  return (data ?? []) as SeedRow[];
}

export interface MatchViewsResult {
  views: MatchView[];
  status: "loading" | "error" | "ready";
  /** Time of the last successful server read, or null. */
  updatedAt: number | null;
  /** The last refresh failed but earlier data is still shown. */
  refreshFailed: boolean;
  retry: () => void;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function useOpenMatchViews(tournamentId: string): MatchViewsResult & { online: boolean } {
  const online = useOnline();
  const q = useQuery({
    queryKey: ["tournament_matches", tournamentId, "open-views"],
    enabled: !!tournamentId,
    queryFn: async () => {
      const [{ data, error }, seeds] = await Promise.all([
        supabase
          .from("tournament_matches")
          .select(MATCH_VIEW_COLUMNS)
          .eq("tournament_id", tournamentId)
          .not("status", "in", `(${FINISHED.join(",")})`),
        fetchSeeds(tournamentId),
      ]);
      if (error) throw error;
      // Plain arrays only: the query cache is persisted to localStorage.
      return { rows: (data ?? []) as unknown as MatchRow[], seeds };
    },
    staleTime: 15_000,
    refetchInterval: online ? 60_000 : false,
    retry: 1,
  });

  const views = useMemo(() => {
    if (!q.data) return [];
    const seeds = buildSeedIndex(q.data.seeds);
    return q.data.rows.map((r) => toMatchView(r, seeds));
  }, [q.data]);

  return {
    views,
    status: q.isPending ? "loading" : q.data ? "ready" : "error",
    updatedAt: q.dataUpdatedAt || null,
    refreshFailed: !!q.data && q.isError,
    retry: () => void q.refetch(),
    online,
  };
}

export function useFinishedMatchViews(
  tournamentId: string,
  opts: { discipline?: string | null; court?: string | null; limit: number },
): MatchViewsResult & { hasMore: boolean } {
  const q = useQuery({
    queryKey: ["tournament_matches", tournamentId, "finished-views", opts.discipline ?? "", opts.court ?? "", opts.limit],
    enabled: !!tournamentId,
    queryFn: async () => {
      let query = supabase
        .from("tournament_matches")
        .select(MATCH_VIEW_COLUMNS)
        .eq("tournament_id", tournamentId)
        .in("status", FINISHED)
        .order("ended_at", { ascending: false, nullsFirst: false })
        .order("round", { ascending: false })
        .order("match_number", { ascending: true })
        .range(0, opts.limit); // one extra row tells us whether more exist
      if (opts.court) query = query.eq("court_number", opts.court);
      // Paging must respect the discipline filter, otherwise a page can be
      // mostly other disciplines. The client re-checks with disciplineOf().
      if (opts.discipline && /^(MS|WS|MD|WD|XD)$/.test(opts.discipline)) {
        query = query.or(`category.eq.${opts.discipline},match_code.like.${opts.discipline}_%`);
      }
      const [{ data, error }, seeds] = await Promise.all([query, fetchSeeds(tournamentId)]);
      if (error) throw error;
      return { rows: (data ?? []) as unknown as MatchRow[], seeds };
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    retry: 1,
  });

  const all = useMemo(() => {
    if (!q.data) return [];
    const seeds = buildSeedIndex(q.data.seeds);
    return q.data.rows.map((r) => toMatchView(r, seeds));
  }, [q.data]);

  return {
    views: all.slice(0, opts.limit),
    hasMore: all.length > opts.limit,
    status: q.isPending ? "loading" : q.data ? "ready" : "error",
    updatedAt: q.dataUpdatedAt || null,
    refreshFailed: !!q.data && q.isError,
    retry: () => void q.refetch(),
  };
}
