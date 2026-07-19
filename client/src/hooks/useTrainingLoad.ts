import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TrainingLoadResult {
  acuteLoad: number;
  chronicLoad: number;
  acwr: number | null;
  riskLabel: "elevated" | "undertrained" | "steady" | null;
  sessionCount: number;
}

const MIN_SESSIONS_FOR_SIGNAL = 3;

export function useTrainingLoad(playerId: string | undefined) {
  return useQuery({
    queryKey: ["trainingLoad", playerId],
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<TrainingLoadResult> => {
      const empty: TrainingLoadResult = { acuteLoad: 0, chronicLoad: 0, acwr: null, riskLabel: null, sessionCount: 0 };
      if (!playerId) return empty;

      const since = new Date(Date.now() - 28 * 86400000).toISOString();
      const { data, error } = await supabase
        .from("match_sensor_analytics")
        .select("created_at, accel_avg")
        .eq("player_id", playerId)
        .gte("created_at", since);

      if (error || !data || data.length === 0) return empty;

      // Bucket per-session intensity into daily training load, then compare
      // a 7-day rolling average ("acute") against the 28-day average ("chronic") — ACWR.
      const dailyLoad = new Map<string, number>();
      for (const row of data) {
        if (row.accel_avg == null) continue;
        const day = new Date(row.created_at).toISOString().split("T")[0];
        dailyLoad.set(day, (dailyLoad.get(day) || 0) + row.accel_avg);
      }

      const now = Date.now();
      let acuteSum = 0;
      let chronicSum = 0;
      dailyLoad.forEach((load, day) => {
        const ageDays = (now - new Date(day).getTime()) / 86400000;
        chronicSum += load;
        if (ageDays <= 7) acuteSum += load;
      });

      const acuteLoad = acuteSum / 7;
      const chronicLoad = chronicSum / 28;
      const sessionCount = data.length;

      if (sessionCount < MIN_SESSIONS_FOR_SIGNAL || chronicLoad === 0) {
        return { acuteLoad, chronicLoad, acwr: null, riskLabel: null, sessionCount };
      }

      const acwr = acuteLoad / chronicLoad;
      const riskLabel = acwr > 1.5 ? "elevated" : acwr < 0.8 ? "undertrained" : "steady";

      return { acuteLoad, chronicLoad, acwr, riskLabel, sessionCount };
    },
  });
}
