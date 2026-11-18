import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/supabase-types-auto";
import {
  parsePublishedStoryRecord,
  storySiteDataKey,
  type PublishedStoryRecord,
} from "@/lib/tournamentStory";

/**
 * Published factual story for a tournament (WC-08).
 *
 * Stored in `site_data` (public read, admin write). The query returns plain
 * JSON or null — the React Query cache is persisted to localStorage.
 */
export function useTournamentStory(tournamentId: string) {
  const key = storySiteDataKey(tournamentId);
  const queryClient = useQueryClient();
  const queryKey = ["site_data", key] as const;

  const query = useQuery({
    queryKey,
    enabled: !!tournamentId,
    queryFn: async (): Promise<PublishedStoryRecord | null> => {
      const { data, error } = await supabase.from("site_data").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return parsePublishedStoryRecord(data?.value ?? null, tournamentId);
    },
    staleTime: 60_000,
    retry: 1,
  });

  const publish = useMutation({
    mutationFn: async (record: PublishedStoryRecord) => {
      const { error } = await supabase
        .from("site_data")
        .upsert({ key, value: record as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      return record;
    },
    onSuccess: (record) => queryClient.setQueryData(queryKey, record),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_data").delete().eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => queryClient.setQueryData(queryKey, null),
  });

  return {
    record: query.data ?? null,
    status: (query.isPending ? "loading" : query.isError && query.data === undefined ? "error" : "ready") as
      | "loading"
      | "error"
      | "ready",
    retry: () => void query.refetch(),
    publish,
    withdraw,
  };
}
