import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Calendar, AlertCircle, Plus, Check, X, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { TeamLineupBuilder } from '@/components/admin/TeamLineupBuilder';
import { TeamStandingsTable } from '@/components/events/TeamStandingsTable';

export default function TournamentTeamHub({ params }: { params: { id: string } }) {
  const teamId = params.id;
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');

  usePageMeta({ title: "Team Hub", description: "Manage your tournament team" });

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_teams').select('*, tournaments(*)').eq('id', teamId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!teamId
  });

  const { data: ties, isLoading: tiesLoading } = useQuery({
    queryKey: ['my_ties', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_ties')
        .select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)')
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!teamId
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team_members', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_team_members')
        .select('*, players(*)')
        .eq('team_id', teamId);
      if (error) throw error;
      return data;
    },
    enabled: !!teamId
  });

  const isCaptain = session?.user?.id === team?.captain_id;
  const isMember = members?.some(m => m.player_id === session?.user?.id && m.status === 'ACTIVE');
  const myInvite = members?.find(m => m.player_id === session?.user?.id && m.status === 'INVITED');

  const respondInvite = useMutation({
    mutationFn: async ({ accept }: { accept: boolean }) => {
      if (!myInvite) return;
      const { error } = await supabase.rpc('respond_team_invite', {
        p_member_id: myInvite.id,
        p_accept: accept
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Responded to invite');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc('remove_team_member', { p_member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Mocked player search by email/username for simplicity
  const inviteMember = useMutation({
    mutationFn: async (email: string) => {
      const { data: player, error: playerErr } = await supabase.from('players').select('id').eq('email', email).single();
      if (playerErr || !player) throw new Error("Player not found with that email");
      
      const { error } = await supabase.rpc('invite_team_member', {
        p_team_id: teamId,
        p_player_id: player.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invite sent');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  if (teamLoading || membersLoading) return <div className="p-8 text-center flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  if (!team) return <div className="p-8 text-center">Team not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
              {team.short_name}
            </div>
            <div>
              <h1 className="text-2xl font-black">{team.name}</h1>
              <p className="text-sm text-slate-500">{team.tournaments?.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Roster Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Team Roster</h2>
            </div>
            
            <div className="space-y-3">
              {members?.map(m => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                      {m.players?.avatar_url ? <img src={m.players.avatar_url} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {m.players?.display_name || m.players?.full_name}
                        {m.role === 'CAPTAIN' && <Shield className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {m.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isCaptain && m.player_id !== session?.user?.id && m.status !== 'REMOVED' && (
                    <Button variant="ghost" size="sm" onClick={() => removeMember.mutate(m.id)} disabled={removeMember.isPending}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {isCaptain && (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold mb-3 text-sm">Invite Player</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="email" 
                    placeholder="Player Email Address" 
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                  <Button onClick={() => inviteMember.mutate(inviteEmail)} disabled={!inviteEmail || inviteMember.isPending} className="w-full sm:w-auto">
                    <Plus className="w-4 h-4 mr-2" /> Invite
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Action Center */}
          {(myInvite || isMember) && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h2 className="font-bold mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-500" /> Action Center</h2>
              
              {myInvite && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-3 font-medium">You have been invited to join {team.name}.</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => respondInvite.mutate({ accept: true })}>
                      <Check className="w-4 h-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => respondInvite.mutate({ accept: false })}>
                      <X className="w-4 h-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              )}
              
              {isMember && !myInvite && (
                <div className="text-center text-sm text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-[var(--success)] mx-auto mb-2" />
                  You are an active member.
                </div>
              )}
            </div>
          )}

          {/* Fixtures */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Fixtures & Lineups</h2>
            
            {tiesLoading ? <Loader2 className="animate-spin text-primary" /> : (
              !ties?.length ? (
                <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  No ties scheduled yet.
                </div>
              ) : (
                <div className="space-y-6">
                  {ties.map((tie: any) => {
                    const side = tie.team_a_id === teamId ? 'A' : 'B';
                    const opponent = side === 'A' ? tie.team_b?.name : tie.team_a?.name;
                    return (
                      <div key={tie.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 dark:bg-slate-800 p-4 flex justify-between items-center">
                          <div>
                            <span className="text-primary font-black text-xs mr-2">{tie.tie_code}</span>
                            <span className="font-bold">vs {opponent || 'TBD'}</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">
                            {tie.state}
                          </span>
                        </div>
                        <div className="p-4">
                          <TeamLineupBuilder 
                            tie={tie} 
                            team={team} 
                            members={members || []} 
                            isCaptain={isCaptain} 
                            side={side} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Standings */}
          <div className="mt-6">
            <TeamStandingsTable tournamentId={team?.tournament_id} />
          </div>
        </div>
      </div>
    </div>
  );
}
