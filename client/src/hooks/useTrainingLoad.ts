import { useQuery } from "@tanstack/react-query";

export interface TrainingLoadResult {
  acuteLoad: number;
  chronicLoad: number;
  acwr: number | null;
  riskLabel: "elevated" | "undertrained" | "steady" | null;
  sessionCount: number;
}

// Training load is derived from match_sensor_analytics, which was retired.
// No sensor sessions exist, so this always reports an empty signal.
export function useTrainingLoad(playerId: string | undefined) {
  return useQuery({
    queryKey: ["trainingLoad", playerId],
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<TrainingLoadResult> => ({
      acuteLoad: 0,
      chronicLoad: 0,
      acwr: null,
      riskLabel: null,
      sessionCount: 0,
    }),
  });
}
