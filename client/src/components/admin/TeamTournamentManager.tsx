import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Users, Calendar, Plus, Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function TeamTournamentManager({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'teams' | 'fixtures'>('teams');

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');

  // New Tie Form State
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [tieCode, setTieCode] = useState('');
  const [stage, setStage] = useState('POOL');
  const [advancesTo, setAdvancesTo] = useState('');
  const [advancesSlot, setAdvancesSlot] = useState('');

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['tournament_teams', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_teams').select('*, players!tournament_teams_captain_id_fkey(display_name, email)').eq('tournament_id', tournamentId);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: ties, isLoading: tiesLoading } = useQuery({
    queryKey: ['tournament_ties', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_ties').select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(name)').eq('tournament_id', tournamentId);
      if (error) throw error;
      return data || [];
    }
  });

  const createTeam = useMutation({
    mutationFn: async () => {
      // Lookup captain
      const { data: player, error: playerErr } = await supabase.from('players').select('id').eq('email', captainEmail).single();
      if (playerErr || !player) throw new Error("Captain not found with that email");

      const { error } = await supabase.rpc('create_team', {
        p_tournament_id: tournamentId,
        p_name: newTeamName,
        p_short_name: newTeamShort,
        p_logo_url: null,
        p_captain_id: player.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team created successfully!');
      setNewTeamName('');
      setNewTeamShort('');
      setCaptainEmail('');
      queryClient.invalidateQueries({ queryKey: ['tournament_teams', tournamentId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const createTie = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_tie', {
        p_tournament_id: tournamentId,
        p_tie_code: tieCode,
        p_team_a_id: teamA || null,
        p_team_b_id: teamB || null,
        p_stage: stage,
        p_advances_to_tie: advancesTo || null,
        p_advances_to_slot: advancesSlot || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tie scheduled successfully!');
      setTieCode('');
      setTeamA('');
      setTeamB('');
      setAdvancesTo('');
      setAdvancesSlot('');
      queryClient.invalidateQueries({ queryKey: ['tournament_ties', tournamentId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const resolveTie = useMutation({
    mutationFn: async ({ tieId, winnerId }: { tieId: string, winnerId: string }) => {
      const { error } = await supabase.rpc('set_tie_result', {
        p_tie_id: tieId,
        p_winner_team_id: winnerId,
        p_note: 'Resolved by manager'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tie resolved manually");
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => setActiveTab('teams')}
          className={`pb-3 text-sm font-bold border-b-2 px-1 transition-colors ${activeTab === 'teams' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Manage Teams</div>
        </button>
        <button 
          onClick={() => setActiveTab('fixtures')}
          className={`pb-3 text-sm font-bold border-b-2 px-1 transition-colors ${activeTab === 'fixtures' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Tie Fixtures</div>
        </button>
      </div>

      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-lg mb-4">Create Team</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Team Name</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Short Name (max 5)</label>
                <input type="text" maxLength={5} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={newTeamShort} onChange={e => setNewTeamShort(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Captain Email</label>
                <input type="email" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={captainEmail} onChange={e => setCaptainEmail(e.target.value)} />
              </div>
              <Button onClick={() => createTeam.mutate()} disabled={createTeam.isPending || !newTeamName || !captainEmail} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> Add Team
              </Button>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-lg">Registered Teams</h2>
            {teamsLoading ? <Loader2 className="animate-spin text-primary" /> : (
              teams?.map((t: any) => (
                <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-black text-lg">{t.name} <span className="text-sm font-normal text-slate-500">({t.short_name})</span></div>
                    <div className="text-sm text-slate-500">Captain: {t.players?.display_name || t.players?.email}</div>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md">
                    {t.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'fixtures' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-lg mb-4">Schedule Tie</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Tie Code (e.g. SF1, Final)</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={tieCode} onChange={e => setTieCode(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Team A</label>
                <select className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={teamA} onChange={e => setTeamA(e.target.value)}>
                  <option value="">Select Team</option>
                  {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Team B</label>
                <select className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={teamB} onChange={e => setTeamB(e.target.value)}>
                  <option value="">Select Team</option>
                  {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Stage</label>
                <select className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-transparent" value={stage} onChange={e => setStage(e.target.value)}>
                  <option value="POOL">Pool Match</option>
                  <option value="KNOCKOUT">Knockout Match</option>
                </select>
              </div>

              {stage === 'KNOCKOUT' && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Winner Advances To (Tie)</label>
                    <select className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900" value={advancesTo} onChange={e => setAdvancesTo(e.target.value)}>
                      <option value="">None (Final)</option>
                      {ties?.map((t: any) => <option key={t.id} value={t.id}>{t.tie_code}</option>)}
                    </select>
                  </div>
                  {advancesTo && (
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Slot</label>
                      <select className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900" value={advancesSlot} onChange={e => setAdvancesSlot(e.target.value)}>
                        <option value="">Select Slot</option>
                        <option value="A">Team A</option>
                        <option value="B">Team B</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={() => createTie.mutate()} disabled={createTie.isPending || !tieCode} className="w-full">
                <Calendar className="w-4 h-4 mr-2" /> Schedule
              </Button>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-lg">Scheduled Ties</h2>
            {tiesLoading ? <Loader2 className="animate-spin text-primary" /> : (
              ties?.map((tie: any) => (
                <div key={tie.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-primary mb-1">{tie.tie_code}</div>
                    <div className="font-black text-lg">{tie.team_a?.name || 'TBD'} <span className="text-slate-400 font-normal mx-2">vs</span> {tie.team_b?.name || 'TBD'}</div>
                    <div className="text-sm font-bold text-slate-500">{tie.score_team_a} - {tie.score_team_b}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-md">
                      {tie.state}
                    </div>
                    {tie.state !== 'COMPLETED' && tie.team_a_id && tie.team_b_id && (
                      <div className="flex items-center gap-1">
                        <select className="text-xs px-2 py-1 border rounded" onChange={(e) => {
                          if (e.target.value) {
                            if(confirm("Force resolve tie?")) resolveTie.mutate({ tieId: tie.id, winnerId: e.target.value });
                            e.target.value = "";
                          }
                        }}>
                          <option value="">Force Win...</option>
                          <option value={tie.team_a_id}>{tie.team_a?.short_name || 'Team A'}</option>
                          <option value={tie.team_b_id}>{tie.team_b?.short_name || 'Team B'}</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
