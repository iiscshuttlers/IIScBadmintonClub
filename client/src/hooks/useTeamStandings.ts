import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useTeamStandings(tournamentId?: string) {
  return useQuery({
    queryKey: ['team_standings', tournamentId],
    queryFn: async () => {
      let query = supabase.from('tournament_team_standings').select('*');
      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Sort in JS: primary tie_points desc, secondary rubbers_for desc, tertiary played asc
      return (data || []).sort((a: any, b: any) => {
        if (b.tie_points !== a.tie_points) return b.tie_points - a.tie_points;
        const diffA = a.rubbers_for - a.rubbers_against;
        const diffB = b.rubbers_for - b.rubbers_against;
        if (diffA !== diffB) return diffB - diffA;
        return a.played - b.played;
      });
    }
  });
}
