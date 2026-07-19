import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import HealthConnect from '@/lib/healthConnect';

export interface HealthData {
  matchId: string;
  matchSource: string;
  hrAvg: number;
  hrMax: number;
  hrMin: number;
  hrResting: number | null;
  hrRecovery: number | null;
  hrZone1Pct: number;
  hrZone2Pct: number;
  hrZone3Pct: number;
  hrZone4Pct: number;
  hrZone5Pct: number;
  hrSamples: any[];
  steps: number;
  caloriesBurned: number;
  hrvAvg: number | null;
  spo2Avg: number | null;
  spo2Min: number | null;
}

export function useHealthData(matchIds: string[], playerId: string | undefined) {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!matchIds || matchIds.length === 0 || !playerId) {
      setHealthData([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('match_health_data')
      .select('match_id, match_source, hr_avg, hr_max, hr_min, hr_resting, hr_recovery, hr_zone_1_pct, hr_zone_2_pct, hr_zone_3_pct, hr_zone_4_pct, hr_zone_5_pct, hr_samples, steps, calories_burned, hrv_avg, spo2_avg, spo2_min')
      .eq('player_id', playerId)
      .in('match_id', matchIds);

    if (data && !error) {
      setHealthData(data.map(d => ({
        matchId: d.match_id,
        matchSource: d.match_source,
        hrAvg: d.hr_avg,
        hrMax: d.hr_max,
        hrMin: d.hr_min,
        hrResting: d.hr_resting,
        hrRecovery: d.hr_recovery,
        hrZone1Pct: d.hr_zone_1_pct,
        hrZone2Pct: d.hr_zone_2_pct,
        hrZone3Pct: d.hr_zone_3_pct,
        hrZone4Pct: d.hr_zone_4_pct,
        hrZone5Pct: d.hr_zone_5_pct,
        hrSamples: d.hr_samples,
        steps: d.steps,
        caloriesBurned: d.calories_burned,
        hrvAvg: d.hrv_avg ?? null,
        spo2Avg: d.spo2_avg ?? null,
        spo2Min: d.spo2_min ?? null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [matchIds, playerId]);

  return { healthData, loading, refetch: fetchData };
}
