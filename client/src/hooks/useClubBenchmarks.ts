import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ClubBenchmarks {
  avgSwingSpeed: number;
  avgFatigueIndex: number;
  avgHr: number;
  sensorSampleSize: number;
  healthSampleSize: number;
}

export function useClubBenchmarks() {
  return useQuery({
    queryKey: ["clubBenchmarks"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ClubBenchmarks | null> => {
      const [sensorRes, healthRes] = await Promise.all([
        supabase.from("match_sensor_analytics").select("avg_swing_speed, fatigue_index"),
        supabase.from("match_health_data").select("hr_avg"),
      ]);

      const sensorRows = (sensorRes.data || []).filter((r) => r.avg_swing_speed != null);
      const fatigueRows = (sensorRes.data || []).filter((r) => r.fatigue_index != null);
      const healthRows = (healthRes.data || []).filter((r) => r.hr_avg != null);

      if (sensorRows.length === 0 && healthRows.length === 0) return null;

      return {
        avgSwingSpeed: sensorRows.length ? sensorRows.reduce((s, r) => s + r.avg_swing_speed, 0) / sensorRows.length : 0,
        avgFatigueIndex: fatigueRows.length ? fatigueRows.reduce((s, r) => s + r.fatigue_index, 0) / fatigueRows.length : 0,
        avgHr: healthRows.length ? healthRows.reduce((s, r) => s + r.hr_avg, 0) / healthRows.length : 0,
        sensorSampleSize: sensorRows.length,
        healthSampleSize: healthRows.length,
      };
    },
  });
}
