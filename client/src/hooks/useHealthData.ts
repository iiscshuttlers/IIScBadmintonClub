import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import HealthConnect from '@/lib/healthConnect';

export interface HealthData {
  matchId: string;
  hrAvg: number;
  hrMax: number;
  hrMin: number;
  hrResting: number;
  hrRecovery: number;
  hrZone1Pct: number;
  hrZone2Pct: number;
  hrZone3Pct: number;
  hrZone4Pct: number;
  hrZone5Pct: number;
  hrSamples: any[];
  steps: number;
  caloriesBurned: number;
}

export function useHealthData(matchIds: string[]) {
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchIds || matchIds.length === 0) {
      setHealthData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('match_health_data')
        .select('*')
        .in('match_id', matchIds);

      if (data && !error) {
        setHealthData(data.map(d => ({
          matchId: d.match_id,
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
          caloriesBurned: d.calories_burned
        })));
      }
      setLoading(false);
    };

    fetchData();
  }, [matchIds]);

  return { healthData, loading };
}
