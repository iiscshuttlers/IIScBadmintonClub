import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface SleepData {
  sleepDate: string;
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
}

export function useSleepData(playerId: string | undefined, days = 7) {
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!playerId) {
      setSleepData([]);
      return;
    }
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('player_sleep_data')
      .select('*')
      .eq('player_id', playerId)
      .gte('sleep_date', since)
      .order('sleep_date', { ascending: true });

    if (data && !error) {
      setSleepData(data.map(d => ({
        sleepDate: d.sleep_date,
        totalMinutes: d.total_minutes || 0,
        deepMinutes: d.deep_minutes || 0,
        remMinutes: d.rem_minutes || 0,
        lightMinutes: d.light_minutes || 0,
        awakeMinutes: d.awake_minutes || 0,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [playerId, days]);

  return { sleepData, loading, refetch: fetchData };
}
