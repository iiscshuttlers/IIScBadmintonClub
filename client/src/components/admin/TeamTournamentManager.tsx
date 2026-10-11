import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Users, Calendar, Plus, Trophy, Loader2, ChevronDown, X, Award, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/contexts/ConfirmContext';
import { ClickableTeamName } from '@/contexts/TeamModalContext';

export function TeamTournamentManager({ tournamentId }: { tournamentId: string }) {
  const { confirm } = useConfirm();
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

  // Resolve Tie with Scores Modal State
  const [resolvingTie, setResolvingTie] = useState<{
    tie: any;
    winnerId: string;
    scoreA: string;
    scoreB: string;
  } | null>(null);

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['tournament_teams', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_teams')
        .select('*, captain:players!captain_id(full_name, nickname, email)')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: ties, isLoading: tiesLoading } = useQuery({
    queryKey: ['tournament_ties', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournament_ties').select('*, team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name), team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name)').eq('tournament_id', tournamentId);
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
    mutationFn: async ({
      tieId,
      winnerId,
      scoreA,
      scoreB,
    }: {
      tieId: string;
      winnerId: string;
      scoreA?: number | null;
      scoreB?: number | null;
    }) => {
      // 1. If scores provided, update tie score columns
      const updatePayload: Record<string, any> = {};
      if (scoreA !== undefined && scoreA !== null) updatePayload.score_team_a = scoreA;
      if (scoreB !== undefined && scoreB !== null) updatePayload.score_team_b = scoreB;

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('tournament_ties')
          .update(updatePayload)
          .eq('id', tieId);
      }

      // 2. Resolve tie via set_tie_result RPC
      const { error } = await supabase.rpc('set_tie_result', {
        p_tie_id: tieId,
        p_winner_team_id: winnerId,
        p_note: 'Resolved by manager',
      });
      if (error) throw error;

      // 3. Handle bracket progression if advances_to_tie is configured
      const { data: currentTie } = await supabase
        .from('tournament_ties')
        .select('*')
        .eq('id', tieId)
        .single();

      if (currentTie?.advances_to_tie && currentTie?.advances_to_slot) {
        const slotField = currentTie.advances_to_slot === 'A' ? 'team_a_id' : 'team_b_id';
        await supabase
          .from('tournament_ties')
          .update({ [slotField]: winnerId })
          .eq('id', currentTie.advances_to_tie);
      }

      if (currentTie?.loser_advances_to_tie && currentTie?.loser_advances_to_slot) {
        const loserId = winnerId === currentTie.team_a_id ? currentTie.team_b_id : currentTie.team_a_id;
        if (loserId) {
          const loserSlotField = currentTie.loser_advances_to_slot === 'A' ? 'team_a_id' : 'team_b_id';
          await supabase
            .from('tournament_ties')
            .update({ [loserSlotField]: loserId })
            .eq('id', currentTie.loser_advances_to_tie);
        }
      }
    },
    onSuccess: () => {
      toast.success("Tie resolved successfully");
      setResolvingTie(null);
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setActiveTab('teams')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'teams' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Manage Teams</span>
        </button>
        <button 
          onClick={() => setActiveTab('fixtures')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'fixtures' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Tie Fixtures</span>
        </button>
      </div>

      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900 dark:text-slate-100 leading-tight">Create Team</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Register new team and assign captain</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Team Name</label>
                <input
                  type="text"
                  placeholder="e.g. IISc Smashers"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Short Name (max 5)</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. SMA"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all uppercase"
                  value={newTeamShort}
                  onChange={(e) => setNewTeamShort(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">Captain Email</label>
                <input
                  type="email"
                  placeholder="captain@iisc.ac.in"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all"
                  value={captainEmail}
                  onChange={(e) => setCaptainEmail(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => createTeam.mutate()}
                disabled={createTeam.isPending || !newTeamName || !captainEmail}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 active:scale-[0.99] text-slate-950 font-black text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTeam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Team
              </button>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-lg">Registered Teams ({teams?.length || 0})</h2>
            {teamsLoading ? <Loader2 className="animate-spin text-primary" /> : (
              teams?.map((t: any) => (
                <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="font-black text-lg">
                      <ClickableTeamName team={{ id: t.id, name: t.name, short_name: t.short_name, tournament_id: tournamentId, captain_id: t.captain_id }} className="text-lg font-black text-slate-900 dark:text-slate-100 hover:text-primary transition-colors" />
                    </div>
                    <div className="text-sm text-slate-500">Captain: {t.captain?.full_name || t.captain?.nickname || t.captain?.email || 'Not Assigned'}</div>
                  </div>
                  <div className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300/40 rounded-lg">
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
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-base text-slate-900 dark:text-slate-100 leading-tight">Schedule Tie</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Pair teams for pool matches or knockout ties</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Tie Code (e.g. SF1, Final, A vs B)
                </label>
                <input
                  type="text"
                  placeholder="e.g. POOL-A1, SF1, FINAL"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all"
                  value={tieCode}
                  onChange={(e) => setTieCode(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Team A
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm cursor-pointer transition-all shadow-xs"
                    value={teamA}
                    onChange={(e) => setTeamA(e.target.value)}
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Team</option>
                    {teams?.map((t: any) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {t.name} ({t.short_name || '—'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Team B
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm cursor-pointer transition-all shadow-xs"
                    value={teamB}
                    onChange={(e) => setTeamB(e.target.value)}
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Team</option>
                    {teams?.map((t: any) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {t.name} ({t.short_name || '—'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Stage
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm cursor-pointer transition-all shadow-xs"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="POOL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Pool Match</option>
                    <option value="KNOCKOUT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Knockout Match</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {stage === 'KNOCKOUT' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                      Winner Advances To (Tie)
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm cursor-pointer"
                        value={advancesTo}
                        onChange={(e) => setAdvancesTo(e.target.value)}
                      >
                        <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">None (Final)</option>
                        {ties?.map((t: any) => (
                          <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {t.tie_code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  {advancesTo && (
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                        Slot
                      </label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-3.5 py-2.5 pr-10 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm cursor-pointer"
                          value={advancesSlot}
                          onChange={(e) => setAdvancesSlot(e.target.value)}
                        >
                          <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Slot</option>
                          <option value="A" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Team A</option>
                          <option value="B" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Team B</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => createTie.mutate()}
                disabled={createTie.isPending || !tieCode}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 active:scale-[0.99] text-slate-950 font-black text-sm shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTie.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule Tie
              </button>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-bold text-lg">Scheduled Ties ({ties?.length || 0})</h2>
            {tiesLoading ? <Loader2 className="animate-spin text-primary" /> : (
              ties?.map((tie: any) => {
                const isLive = tie.state === 'IN_PROGRESS';
                const isCompleted = tie.state === 'COMPLETED';

                return (
                  <div 
                    key={tie.id} 
                    className={`rounded-2xl p-4 sm:p-5 border transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isLive 
                        ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20' 
                        : isCompleted
                        ? 'bg-slate-50/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 opacity-85'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-primary/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-primary uppercase tracking-wider">{tie.tie_code}</span>
                        {tie.stage && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            · {tie.stage}
                          </span>
                        )}
                      </div>
                      <div className="font-black text-lg flex items-center gap-2 flex-wrap">
                        <ClickableTeamName team={{ id: tie.team_a_id, name: tie.team_a?.name || 'TBD', short_name: tie.team_a?.short_name, tournament_id: tournamentId }} className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 hover:text-primary transition-colors" />
                        <span className="text-slate-400 font-normal mx-1">vs</span>
                        <ClickableTeamName team={{ id: tie.team_b_id, name: tie.team_b?.name || 'TBD', short_name: tie.team_b?.short_name, tournament_id: tournamentId }} className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 hover:text-primary transition-colors" />
                      </div>
                      <div className="text-sm font-black text-slate-500 mt-0.5">
                        {tie.score_team_a ?? 0} - {tie.score_team_b ?? 0}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl shadow-xs animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          LIVE ON COURT
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-xl shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          COMPLETED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 rounded-xl shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                          UPCOMING
                        </span>
                      )}

                      {!isCompleted && tie.team_a_id && tie.team_b_id && (
                        <div className="relative">
                          <select
                            className="text-xs font-bold appearance-none pl-3 pr-7 py-1.5 border border-slate-200 dark:border-slate-700/80 rounded-xl bg-slate-50 dark:bg-slate-950/80 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer shadow-xs transition-all"
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                e.target.value = "";
                                setResolvingTie({
                                  tie,
                                  winnerId: val,
                                  scoreA: tie.score_team_a ? String(tie.score_team_a) : '',
                                  scoreB: tie.score_team_b ? String(tie.score_team_b) : '',
                                });
                              }
                            }}
                          >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Force Win...</option>
                            <option value={tie.team_a_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                              {tie.team_a?.short_name || tie.team_a?.name || 'Team A'}
                            </option>
                            <option value={tie.team_b_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                              {tie.team_b?.short_name || tie.team_b?.name || 'Team B'}
                            </option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Resolve Tie with Optional Scores Modal */}
      {resolvingTie && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setResolvingTie(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 leading-tight">
                    Resolve Tie: {resolvingTie.tie?.tie_code}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Assign winner and optionally enter tie scores
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingTie(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Winner Banner */}
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 mb-4">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Winner Selected
              </div>
              <div className="font-black text-sm text-emerald-900 dark:text-emerald-200 mt-0.5">
                {resolvingTie.winnerId === resolvingTie.tie?.team_a_id
                  ? resolvingTie.tie?.team_a?.name || 'Team A'
                  : resolvingTie.tie?.team_b?.name || 'Team B'}
              </div>
            </div>

            {/* Optional Score Inputs */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tie Score (Optional)
                </label>
                <span className="text-[11px] text-slate-400">Can leave blank</span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 block mb-1 truncate">
                    {resolvingTie.tie?.team_a?.short_name || 'Team A'} Rubbers Won
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 3"
                    value={resolvingTie.scoreA}
                    onChange={(e) => setResolvingTie((prev) => prev ? { ...prev, scoreA: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400 block mb-1 truncate">
                    {resolvingTie.tie?.team_b?.short_name || 'Team B'} Rubbers Won
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1"
                    value={resolvingTie.scoreB}
                    onChange={(e) => setResolvingTie((prev) => prev ? { ...prev, scoreB: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-black text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResolvingTie(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={resolveTie.isPending}
                onClick={() => {
                  const sA = resolvingTie.scoreA.trim() !== '' ? Number(resolvingTie.scoreA) : null;
                  const sB = resolvingTie.scoreB.trim() !== '' ? Number(resolvingTie.scoreB) : null;
                  resolveTie.mutate({
                    tieId: resolvingTie.tie.id,
                    winnerId: resolvingTie.winnerId,
                    scoreA: sA,
                    scoreB: sB,
                  });
                }}
                className="px-5 py-2.5 rounded-xl bg-primary hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 transition disabled:opacity-50"
              >
                {resolveTie.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Confirm Result</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
