import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Swords, Clock, AlertCircle, MapPin, User, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface PlayerMatchBannerProps {
  tournamentId?: string;
  onNavigateToTie?: (tieId: string) => void;
}

export function PlayerMatchBanner({ tournamentId, onNavigateToTie }: PlayerMatchBannerProps) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  // Query tie lineups where the logged-in user is selected in player1 or player2
  const { data: myAssignedRubbers = [], isLoading } = useQuery({
    queryKey: ['my_player_rubbers', tournamentId, userId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('tie_lineups' as any)
        .select(`
          *,
          tie:tournament_ties!tie_lineups_tie_id_fkey(
            id,
            tie_code,
            state,
            scheduled_at,
            court,
            tournament_id,
            team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
            team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
          ),
          player1:players!tie_lineups_player1_id_fkey(full_name, display_name),
          player2:players!tie_lineups_player2_id_fkey(full_name, display_name)
        `)
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

      if (tournamentId) {
        // filter by tie tournament_id
        query = query.filter('tie.tournament_id', 'eq', tournamentId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Could not load player assigned rubbers:', error.message);
        return [];
      }

      // Filter out completed ties or cancelled ties
      return (data || []).filter((item: any) => item.tie && item.tie.state !== 'COMPLETED');
    },
    enabled: !!userId
  });

  if (isLoading || myAssignedRubbers.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-transparent border-2 border-violet-500/30 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-600/20">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Your Upcoming Rubber Assignments ({myAssignedRubbers.length})
            </h3>
            <p className="text-xs text-slate-500">
              Matches where you are assigned to play in your team lineup
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {myAssignedRubbers.map((item: any) => {
          const isDoubles = !!item.player2_id;
          const partner = item.player1_id === userId ? item.player2 : item.player1;
          const isRevealed = item.is_revealed;

          return (
            <div 
              key={item.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-violet-200/60 dark:border-violet-900/40 shadow-xs flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                    {item.tie?.tie_code} · Rubber #{item.rubber_order}
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                    {item.tie?.team_a?.short_name || 'Team A'} vs {item.tie?.team_b?.short_name || 'Team B'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isRevealed 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                  {isRevealed ? 'Revealed' : 'Private Lineup'}
                </span>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                {isDoubles && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Partner: <strong>{partner?.full_name || partner?.display_name || 'Assigned Teammate'}</strong></span>
                  </div>
                )}
                {item.tie?.court && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Court: {item.tie.court}</span>
                  </div>
                )}
                {item.tie?.scheduled_at && (
                  <div className="flex items-center gap-1.5 font-medium text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{format(new Date(item.tie.scheduled_at), 'EEE, d MMM · h:mm a')}</span>
                  </div>
                )}
              </div>

              {onNavigateToTie && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onNavigateToTie(item.tie?.id)}
                  className="w-full text-xs h-7 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                >
                  View Tie Details
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
