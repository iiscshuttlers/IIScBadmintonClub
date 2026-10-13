import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ThemeScope } from '@/components/tournament/ThemeScope';
import { StatusChip } from '@/components/tournament/StatusChip';
import { Shield, Users, Clock, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { usePlayerModal } from '@/contexts/PlayerModalContext';

interface TeamSquadViewProps {
  tie: any;
  rubbers?: any[];
  tournament?: any;
}

interface TeamMember {
  id: string;
  role?: string;
  player_id?: string;
  players?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    gender?: string | null;
  } | null;
}

export function TeamSquadView({ tie, rubbers = [], tournament }: TeamSquadViewProps) {
  const { openPlayerModal } = usePlayerModal();

  const teamAId = tie?.team_a?.id || tie?.team_a_id;
  const teamBId = tie?.team_b?.id || tie?.team_b_id;

  // Fetch squad rosters for both teams
  const { data: squadA = [], isLoading: loadingA } = useQuery<TeamMember[]>({
    queryKey: ['team_squad_roster', teamAId],
    queryFn: async () => {
      if (!teamAId) return [];
      const { data, error } = await supabase
        .from('tournament_team_members')
        .select('id, role, player_id, players!tournament_team_members_player_id_fkey(id, full_name, avatar_url, gender)')
        .eq('team_id', teamAId);
      if (error) {
        console.error('Error fetching squad A:', error);
        return [];
      }
      return (data as any) || [];
    },
    enabled: !!teamAId,
    staleTime: 60000,
  });

  const { data: squadB = [], isLoading: loadingB } = useQuery<TeamMember[]>({
    queryKey: ['team_squad_roster', teamBId],
    queryFn: async () => {
      if (!teamBId) return [];
      const { data, error } = await supabase
        .from('tournament_team_members')
        .select('id, role, player_id, players!tournament_team_members_player_id_fkey(id, full_name, avatar_url, gender)')
        .eq('team_id', teamBId);
      if (error) {
        console.error('Error fetching squad B:', error);
        return [];
      }
      return (data as any) || [];
    },
    enabled: !!teamBId,
    staleTime: 60000,
  });

  // Determine lineup reveal status. Gate STRICTLY on revealed_at (matching the
  // rest of the app: TeamTiesSection.tsx:512/752) so pairings are never leaked
  // before the official reveal — a merely *locked* (submitted-but-secret) lineup
  // must stay hidden. Pairings only surface once rubbers are revealed on court.
  const isTieRevealed = rubbers.some(
    (r: any) => !!r.revealed_at || (!!r.player1_id && !!r.player2_id)
  );
  const teamARevealed = isTieRevealed;
  const teamBRevealed = isTieRevealed;

  // Set of player IDs participating in announced playing lineup
  const playingPlayerIdsA = new Set<string>();
  const playingPlayerIdsB = new Set<string>();

  rubbers.forEach((r: any) => {
    if (r.player1_id) playingPlayerIdsA.add(r.player1_id);
    if (r.player2_id) playingPlayerIdsA.add(r.player2_id);
    if (r.player3_id) playingPlayerIdsB.add(r.player3_id);
    if (r.player4_id) playingPlayerIdsB.add(r.player4_id);
  });

  const renderTeamSquad = (
    team: any,
    squad: TeamMember[],
    isLoading: boolean,
    isRevealed: boolean,
    playingIds: Set<string>,
    isLocked: boolean,
    sideLabel: string
  ) => {
    if (isLoading) {
      return (
        <div className="p-6 text-center text-slate-400 animate-pulse text-xs">
          Loading {team?.name || sideLabel} squad...
        </div>
      );
    }

    const playingMembers: TeamMember[] = [];
    const benchMembers: TeamMember[] = [];

    squad.forEach((m) => {
      const pid = m.player_id || m.players?.id;
      if (isRevealed && pid && playingIds.has(pid)) {
        playingMembers.push(m);
      } else {
        benchMembers.push(m);
      }
    });

    return (
      <div className="flex-1 bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
        {/* Team Header */}
        <div className="p-3.5 bg-slate-800/70 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 truncate">
            {team?.logo_url ? (
              <img
                src={team.logo_url}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black text-white shrink-0">
                {team?.short_name?.slice(0, 2) || sideLabel.slice(0, 1)}
              </div>
            )}
            <div className="truncate">
              <h4 className="font-bold text-sm text-slate-100 truncate">
                {team?.name || sideLabel}
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                {isRevealed && playingMembers.length > 0
                  ? `Playing ${playingMembers.length} · Bench ${benchMembers.length}`
                  : `${squad.length} squad ${squad.length === 1 ? 'member' : 'members'}`
                }
              </span>
            </div>
          </div>

          <StatusChip
            state={isRevealed ? "completed" : isLocked ? "locked" : "pending"}
            label={isRevealed ? "Lineup Announced" : isLocked ? "Lineup Locked" : "Lineup Pending"}
            compact={true}
          />
        </div>

        {/* Content: Playing vs Bench (if revealed) OR Full Squad (if not revealed) */}
        <div className="p-3 flex-1 space-y-3">
          {isRevealed && playingMembers.length > 0 ? (
            <>
              {/* Playing Lineup Section */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Playing Lineup ({playingMembers.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {playingMembers.map((m) => {
                    const p = m.players;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => p?.id && openPlayerModal(p.id)}
                        className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 transition text-left cursor-pointer border border-emerald-500/20"
                      >
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {p?.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p?.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-200 truncate flex-1">
                          {p?.full_name || 'Player'}
                        </span>
                        {m.role === 'captain' && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            C
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bench Section */}
              {benchMembers.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    <Users className="w-3.5 h-3.5" /> Bench ({benchMembers.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {benchMembers.map((m) => {
                      const p = m.players;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => p?.id && openPlayerModal(p.id)}
                          className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition text-left cursor-pointer border border-slate-800"
                        >
                          <div className="w-6 h-6 rounded-lg bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {p?.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p?.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-300 truncate flex-1">
                            {p?.full_name || 'Player'}
                          </span>
                          {m.role === 'captain' && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              C
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Squad List before Lineup Reveal */
            <div>
              <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Full Squad
                </span>
                <span className="text-amber-400/90 text-[10px] normal-case font-bold">
                  Pairings reveal on match start
                </span>
              </div>

              {squad.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-medium">
                  No squad members registered yet
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {squad.map((m) => {
                    const p = m.players;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => p?.id && openPlayerModal(p.id)}
                        className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition text-left cursor-pointer border border-slate-800/80"
                      >
                        <div className="w-6 h-6 rounded-lg bg-slate-700/80 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {p?.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p?.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-200 truncate flex-1">
                          {p?.full_name || 'Player'}
                        </span>
                        {m.role === 'captain' && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            C
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ThemeScope family="team" className="my-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> Squads
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            {isTieRevealed ? 'Lineup announced' : 'Squad overview'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderTeamSquad(
            tie.team_a,
            squadA,
            loadingA,
            teamARevealed,
            playingPlayerIdsA,
            !!tie.lineup_locked_a,
            'Side A'
          )}
          {renderTeamSquad(
            tie.team_b,
            squadB,
            loadingB,
            teamBRevealed,
            playingPlayerIdsB,
            !!tie.lineup_locked_b,
            'Side B'
          )}
        </div>
      </div>
    </ThemeScope>
  );
}
