import { useQuery } from "@tanstack/react-query";

export interface ClubBenchmarks {
  avgSwingSpeed: number;
  avgFatigueIndex: number;
  avgHr: number;
  sensorSampleSize: number;
  healthSampleSize: number;
}

// The sensor/health analytics tables (match_sensor_analytics, match_health_data)
// were retired, so there are no club benchmarks to compute.
export function useClubBenchmarks() {
  return useQuery({
    queryKey: ["clubBenchmarks"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ClubBenchmarks | null> => null,
  });
}
