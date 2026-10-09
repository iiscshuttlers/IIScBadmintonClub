import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Swords, Trash2, Calendar, Edit3, CheckCircle2, AlertCircle, Loader2, Layers, Filter, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import { TeamBracketGeneratorModal } from './TeamBracketGeneratorModal';
import { TieUmpireConsole } from '@/components/umpire/TieUmpireConsole';

export function TeamBracketTab({ tournament, isMasterAdmin }: { tournament: any; isMasterAdmin: boolean }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [ties, setTies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);
  const [stageFilter, setStageFilter] = useState<'ALL' | 'POOL' | 'KNOCKOUT'>('ALL');
  const [poolFilter, setPoolFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tData }, { data: tieData }] = await Promise.all([
      supabase.from("tournament_teams").select("*").eq("tournament_id", tournament.id).eq("status", "ACTIVE").order("seed"),
      supabase.from("tournament_ties").select(`
        *,
        team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name, logo_url),
        team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name, logo_url)
      `).eq("tournament_id", tournament.id).order("round_number").order("tie_code")
    ]);
    setTeams(tData ?? []);
    setTies(tieData ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async ({
    format,
    ties: generatedTies,
    poolAssignments,
    tieDeciderConfig
  }: {
    format: 'DIRECT_KNOCKOUT' | 'POOLS_AND_PLAYOFFS' | 'PURE_LEAGUE';
    ties: any[];
    poolAssignments: Record<string, string>;
    tieDeciderConfig: any;
  }) => {
    if (ties.length > 0) {
      if (!confirm("This will delete all existing ties and regenerate. Continue?")) return;
      await supabase.from("tournament_ties").delete().eq("tournament_id", tournament.id);
    }

    // 1. Update pool assignments on tournament_teams
    if (Object.keys(poolAssignments).length > 0) {
      for (const [teamId, pool] of Object.entries(poolAssignments)) {
        await supabase.from("tournament_teams").update({ pool }).eq("id", teamId);
      }
    }

    // 2. Update tournament tie format config and points
    const currentConfig = tournament.tie_format_config || {};
    const updatedConfig = {
      ...(typeof currentConfig === 'object' && !Array.isArray(currentConfig) ? currentConfig : { rubbers: currentConfig }),
      ...tieDeciderConfig
    };

    await supabase.from("tournaments").update({
      tie_format_config: updatedConfig,
      tie_points_win: tieDeciderConfig.tie_points_win ?? 2,
      tie_points_draw: tieDeciderConfig.tie_points_draw ?? 1
    }).eq("id", tournament.id);

    // 3. Insert generated ties
    const tieInserts = generatedTies.map(t => ({
      tournament_id: tournament.id,
      tie_code: t.tie_code,
      stage: t.stage,
      round_name: t.round_name,
      round_number: t.round_number,
      team_a_id: t.team_a_id,
      team_b_id: t.team_b_id,
      state: 'SCHEDULED',
      advances_to_slot: t.advances_to_slot || null,
      loser_advances_to_slot: t.loser_advances_to_slot || null,
      _temp_advances_to: t.advances_to_tie_code || null,
      _temp_loser_advances_to: t.loser_advances_to_tie_code || null
    }));

    const { data: insertedTies, error } = await supabase.from("tournament_ties").insert(
      tieInserts.map(({ _temp_advances_to, _temp_loser_advances_to, ...rest }) => rest)
    ).select();

    if (error) {
      toast.error(`Error creating ties: ${error.message}`);
      return;
    }

    // 4. Link advances_to_tie & loser_advances_to_tie
    if (insertedTies) {
      const codeToId = new Map(insertedTies.map((t: any) => [t.tie_code, t.id]));
      
      for (const tie of tieInserts) {
        const currentId = codeToId.get(tie.tie_code);
        if (!currentId) continue;

        const updatePayload: any = {};
        if (tie._temp_advances_to) {
          const nextId = codeToId.get(tie._temp_advances_to);
          if (nextId) updatePayload.advances_to_tie = nextId;
        }
        if (tie._temp_loser_advances_to) {
          const loserId = codeToId.get(tie._temp_loser_advances_to);
          if (loserId) updatePayload.loser_advances_to_tie = loserId;
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from("tournament_ties").update(updatePayload).eq("id", currentId);
        }
      }

      // 5. Generate empty rubbers for each tie
      const matchInserts: any[] = [];
      const teamMap = new Map(teams.map(t => [t.id, t]));
      
      let rubbers = [];
      if (Array.isArray(updatedConfig.rubbers)) rubbers = updatedConfig.rubbers;
      else if (Array.isArray(updatedConfig)) rubbers = updatedConfig;

      for (const tie of insertedTies) {
        const teamA = teamMap.get(tie.team_a_id);
        const teamB = teamMap.get(tie.team_b_id);

        for (const rubber of rubbers) {
          matchInserts.push({
            tournament_id: tournament.id,
            category: rubber.category,
            match_code: `${tie.tie_code}-${rubber.label}`,
            match_number: rubber.order,
            round_name: tie.round_name || tie.tie_code,
            team1_label: teamA?.short_name || 'TBD',
            team2_label: teamB?.short_name || 'TBD',
            status: 'scheduled',
            tie_id: tie.id,
            rubber_order: rubber.order,
            rubber_label: rubber.label,
            best_of_sets: rubber.best_of_sets ?? 3,
            points_to_win: rubber.points_to_win ?? 21,
            locked: false
          });
        }
      }

      if (matchInserts.length > 0) {
        await supabase.from("tournament_matches").insert(matchInserts);
      }
    }

    toast.success(`Generated ${insertedTies?.length} ties with rubbers successfully!`);
    await load();
  };

  const clearBracket = async () => {
    if (!confirm("Are you sure you want to delete all ties? This cannot be undone.")) return;
    await supabase.from("tournament_ties").delete().eq("tournament_id", tournament.id);
    toast.success("Bracket cleared.");
    await load();
  };

  const distinctPools = useMemo(() => {
    const s = new Set<string>();
    ties.forEach(t => {
      if (t.tie_code.startsWith('POOL_')) {
        const parts = t.tie_code.split('_');
        if (parts[1]) s.add(parts[1]);
      }
    });
    return Array.from(s).sort();
  }, [ties]);

  const filteredTies = useMemo(() => {
    return ties.filter(t => {
      if (stageFilter === 'POOL' && t.stage !== 'POOL') return false;
      if (stageFilter === 'KNOCKOUT' && t.stage !== 'KNOCKOUT') return false;
      if (poolFilter !== 'ALL' && t.stage === 'POOL' && !t.tie_code.startsWith(`POOL_${poolFilter}_`)) return false;
      return true;
    });
  }, [ties, stageFilter, poolFilter]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Team Bracket & Pool Management
          </h2>
          <p className="text-sm text-slate-500">
            Configure multi-pool leagues, knockouts, decider rules, and scheduled rubbers for {teams.length} teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {ties.some(t => t.stage === 'POOL') && ties.some(t => t.stage === 'KNOCKOUT') && (
            <button
              onClick={async () => {
                const { data, error } = await supabase.rpc('populate_playoff_qualifiers_from_standings', {
                  p_tournament_id: tournament.id
                });
                if (error) {
                  toast.error(`Failed to advance qualifiers: ${error.message}`);
                } else {
                  toast.success("Pool qualifiers advanced into playoff bracket successfully!");
                  await load();
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl font-bold transition-colors text-xs"
              title="Populates Semifinals/Quarterfinals from current pool rankings"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Advance Qualifiers
            </button>
          )}
          {ties.length > 0 && (
            <button 
              onClick={clearBracket} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-bold transition-colors text-xs"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
          <button 
            onClick={() => {
              if (teams.length < 2) {
                toast.error("Need at least 2 active teams to generate a bracket.");
                return;
              }
              setModalOpen(true);
            }} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-primary text-slate-950 hover:opacity-90 rounded-xl font-bold shadow-md transition-opacity text-xs"
          >
            <Swords className="w-4 h-4" /> {ties.length > 0 ? "Regenerate Bracket" : "Generate Bracket"}
          </button>
        </div>
      </div>

      {/* Filter Bar (If ties exist) */}
      {ties.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Stage:
            </span>
            {(['ALL', 'POOL', 'KNOCKOUT'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  stageFilter === s
                    ? 'bg-primary text-slate-950 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {s === 'ALL' ? 'All Ties' : s === 'POOL' ? 'Pool Stage' : 'Playoffs / Knockouts'}
              </button>
            ))}
          </div>

          {distinctPools.length > 0 && stageFilter !== 'KNOCKOUT' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Pool:
              </span>
              <button
                onClick={() => setPoolFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  poolFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All
              </button>
              {distinctPools.map(p => (
                <button
                  key={p}
                  onClick={() => setPoolFilter(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    poolFilter === p
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Pool {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ties List */}
      {ties.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-500">No Bracket Generated</h3>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto">
            Click 'Generate Bracket' to configure pools, knockouts, decider rules, and pairings.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800/50">
            {filteredTies.map((tie) => (
              <div key={tie.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-col shadow-inner px-1 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate w-full">{tie.round_name}</span>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{tie.tie_code}</span>
                    <span className={`text-[8px] font-bold px-1 rounded mt-0.5 ${tie.stage === 'POOL' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                      {tie.stage}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span className={tie.team_a ? "text-slate-900 dark:text-white" : "text-slate-400 italic"}>
                        {tie.team_a?.name || "TBD / BYE"}
                      </span>
                      {tie.score_team_a > 0 && <span className="font-black text-primary">({tie.score_team_a})</span>}
                    </div>
                    <div className="text-xs font-bold text-slate-400 my-0.5">vs</div>
                    <div className="font-bold flex items-center gap-2">
                      <span className={tie.team_b ? "text-slate-900 dark:text-white" : "text-slate-400 italic"}>
                        {tie.team_b?.name || "TBD / BYE"}
                      </span>
                      {tie.score_team_b > 0 && <span className="font-black text-primary">({tie.score_team_b})</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTieForConsole(tie)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-slate-900 dark:text-white dark:hover:text-slate-950 transition-colors border border-primary/20"
                  >
                    <Eye className="w-3.5 h-3.5" /> Umpire Reveal &amp; Lineup
                  </button>
                  <div className="text-right">
                    <div className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {tie.state}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generator Modal */}
      <TeamBracketGeneratorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        teams={teams}
        tournament={tournament}
        onGenerate={handleGenerate}
      />

      {/* Umpire Lineup & Reveal Console Modal */}
      {selectedTieForConsole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-400">Match Official Desk</span>
              <button
                type="button"
                onClick={() => setSelectedTieForConsole(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <TieUmpireConsole
              tie={selectedTieForConsole}
              tournament={tournament}
              onClose={() => setSelectedTieForConsole(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
