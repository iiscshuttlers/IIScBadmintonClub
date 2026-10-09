import React, { useState } from 'react';
import { Trophy, Users, Layers, ShieldCheck, ArrowRight, CheckCircle2, Shuffle, Settings2, HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  TeamParticipant, 
  PoolAssignmentMethod, 
  generateDirectKnockoutBracket, 
  generatePoolAndPlayoffTournament,
  assignTeamsToPools
} from '@/lib/teamBracketGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teams: TeamParticipant[];
  tournament: any;
  onGenerate: (params: {
    format: 'DIRECT_KNOCKOUT' | 'POOLS_AND_PLAYOFFS' | 'PURE_LEAGUE';
    ties: any[];
    poolAssignments: Record<string, string>; // teamId -> pool
    tieDeciderConfig: any;
  }) => Promise<void>;
}

export function TeamBracketGeneratorModal({ isOpen, onClose, teams, tournament, onGenerate }: Props) {
  const [format, setFormat] = useState<'DIRECT_KNOCKOUT' | 'POOLS_AND_PLAYOFFS' | 'PURE_LEAGUE'>('POOLS_AND_PLAYOFFS');
  
  // Pool settings
  const [numPools, setNumPools] = useState<number>(2);
  const [assignmentMethod, setAssignmentMethod] = useState<PoolAssignmentMethod>('SEEDED_SNAKE');
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    teams.forEach((t, i) => {
      init[t.id] = String.fromCharCode(65 + (i % 2));
    });
    return init;
  });
  const [advancingPerPool, setAdvancingPerPool] = useState<number>(2);
  const [includeThirdPlace, setIncludeThirdPlace] = useState<boolean>(true);

  // Tie Decider Rules (for ties ending 3-3)
  const [deciderRule, setDeciderRule] = useState<'SET_DIFF' | 'POINT_DIFF' | 'TOTAL_POINTS' | 'SPECIFIC_RUBBER' | 'GOLDEN_MATCH'>('SET_DIFF');
  const [specificRubberOrder, setSpecificRubberOrder] = useState<number>(1);
  const [drawAllowedInPools, setDrawAllowedInPools] = useState<boolean>(true);
  const [standingsSortPriority, setStandingsSortPriority] = useState<'STANDARD' | 'SETS_FIRST' | 'WINS_FIRST'>('STANDARD');
  
  // Standings Points
  const [winPoints, setWinPoints] = useState<number>(2);
  const [drawPoints, setDrawPoints] = useState<number>(1);
  const [lossPoints, setLossPoints] = useState<number>(0);

  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const rubbers = tournament?.tie_format_config?.rubbers || tournament?.tie_format_config || [];

  const handleManualPoolChange = (teamId: string, poolLetter: string) => {
    setManualAssignments(prev => ({ ...prev, [teamId]: poolLetter }));
  };

  const handleShuffleRandom = () => {
    const poolLetters = Array.from({ length: numPools }, (_, i) => String.fromCharCode(65 + i));
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const newAssignments: Record<string, string> = {};
    shuffled.forEach((t, i) => {
      newAssignments[t.id] = poolLetters[i % numPools];
    });
    setManualAssignments(newAssignments);
    setAssignmentMethod('MANUAL');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let ties: any[] = [];
      let finalPoolAssignments: Record<string, string> = {};

      if (format === 'DIRECT_KNOCKOUT') {
        ties = generateDirectKnockoutBracket(teams, includeThirdPlace);
      } else {
        const poolConfig = {
          numPools,
          assignmentMethod,
          manualAssignments,
          advancingPerPool: format === 'PURE_LEAGUE' ? 0 : advancingPerPool,
          includeThirdPlaceMatch: includeThirdPlace
        };

        const result = generatePoolAndPlayoffTournament(teams, poolConfig);
        ties = format === 'PURE_LEAGUE' ? result.poolTies : result.allTies;

        // Collect resolved pool for each team
        const pools = assignTeamsToPools(teams, numPools, assignmentMethod, manualAssignments);
        Object.entries(pools).forEach(([pLetter, pTeams]) => {
          pTeams.forEach(t => {
            finalPoolAssignments[t.id] = pLetter;
          });
        });
      }

      const tieDeciderConfig = {
        rubbers,
        decider_rule: deciderRule,
        specific_decider_rubber_order: deciderRule === 'SPECIFIC_RUBBER' ? specificRubberOrder : undefined,
        draw_allowed_in_pools: drawAllowedInPools,
        tie_points_win: winPoints,
        tie_points_draw: drawPoints,
        tie_points_loss: lossPoints,
        standings_sort_priority: standingsSortPriority
      };

      await onGenerate({
        format,
        ties,
        poolAssignments: finalPoolAssignments,
        tieDeciderConfig
      });

      onClose();
    } finally {
      setGenerating(false);
    }
  };

  const poolLetters = Array.from({ length: numPools }, (_, i) => String.fromCharCode(65 + i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              Generate Team Tournament Bracket
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure tournament format, pools, knockout playoffs, and tiebreaker deciders for {teams.length} teams.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Format Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tournament Structure
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { 
                id: 'POOLS_AND_PLAYOFFS', 
                title: 'Pools + Knockouts', 
                desc: 'Group stage round-robin followed by SF/QF playoffs' 
              },
              { 
                id: 'DIRECT_KNOCKOUT', 
                title: 'Direct Knockouts', 
                desc: 'Single elimination tree with optional 3rd place match' 
              },
              { 
                id: 'PURE_LEAGUE', 
                title: 'Pure League', 
                desc: 'Round-robin only; final standings determine winner' 
              }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id as any)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  format === f.id
                    ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">{f.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{f.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Pool Configuration (If Pools or League selected) */}
        {format !== 'DIRECT_KNOCKOUT' && (
          <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Pools & Team Assignment
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Number of Pools
                </label>
                <select
                  value={numPools}
                  onChange={(e) => setNumPools(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  <option value={1}>1 Pool (All teams in single pool)</option>
                  <option value={2}>2 Pools (Pool A & Pool B)</option>
                  <option value={3}>3 Pools (Pool A, B, C)</option>
                  <option value={4}>4 Pools (Pool A, B, C, D)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Pool Assignment Method
                </label>
                <select
                  value={assignmentMethod}
                  onChange={(e) => setAssignmentMethod(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  <option value="SEEDED_SNAKE">Seeded Snake Draw (Recommended)</option>
                  <option value="RANDOM">Random Draw</option>
                  <option value="MANUAL">Manual Team Assignment</option>
                </select>
              </div>
            </div>

            {/* Manual Assignment UI */}
            {assignmentMethod === 'MANUAL' && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Assign Each Team to a Pool:</span>
                  <button
                    type="button"
                    onClick={handleShuffleRandom}
                    className="text-xs text-primary flex items-center gap-1 font-bold hover:underline"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Random Shuffle
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  {teams.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 text-xs">
                      <span className="font-bold truncate max-w-[140px]">{t.name}</span>
                      <select
                        value={manualAssignments[t.id] || poolLetters[0]}
                        onChange={(e) => handleManualPoolChange(t.id, e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-bold text-xs"
                      >
                        {poolLetters.map(p => (
                          <option key={p} value={p}>Pool {p}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {format === 'POOLS_AND_PLAYOFFS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Advancing Teams per Pool
                  </label>
                  <select
                    value={advancingPerPool}
                    onChange={(e) => setAdvancingPerPool(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                  >
                    <option value={1}>Top 1 per pool (Pool Winners only)</option>
                    <option value={2}>Top 2 per pool (Winner & Runner-up)</option>
                    {numPools === 1 && <option value={4}>Top 4 teams (Semifinals)</option>}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="include3rd"
                    checked={includeThirdPlace}
                    onChange={(e) => setIncludeThirdPlace(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary"
                  />
                  <label htmlFor="include3rd" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Include 3rd Place Match (Bronze Playoff)
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Direct Knockout 3rd Place Toggle */}
        {format === 'DIRECT_KNOCKOUT' && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm">3rd Place Playoff Match</div>
              <div className="text-xs text-slate-500">Play a bronze medal tie between the two semifinal losers</div>
            </div>
            <input
              type="checkbox"
              checked={includeThirdPlace}
              onChange={(e) => setIncludeThirdPlace(e.target.checked)}
              className="w-5 h-5 rounded text-primary border-slate-300 focus:ring-primary cursor-pointer"
            />
          </div>
        )}

        {/* 4. Tie Decider Rules (For 3-3 ties in rubbers) */}
        <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Tiebreaker & Decider Settings (e.g. 3-3 in a 6-rubber tie)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Knockout Tie Decider Rule
              </label>
              <select
                value={deciderRule}
                onChange={(e) => setDeciderRule(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
              >
                <option value="SET_DIFF">Net Set Difference across Rubbers</option>
                <option value="POINT_DIFF">Net Point Difference (Pts +/-)</option>
                <option value="TOTAL_POINTS">Total Match Points Won</option>
                <option value="SPECIFIC_RUBBER">Winner of Designated Rubber (e.g. WS/XD)</option>
                <option value="GOLDEN_MATCH">Additional Golden Match (Extra Rubber)</option>
              </select>
            </div>

            {deciderRule === 'SPECIFIC_RUBBER' && (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Designated Decider Rubber
                </label>
                <select
                  value={specificRubberOrder}
                  onChange={(e) => setSpecificRubberOrder(parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  {rubbers.map((r: any) => (
                    <option key={r.order} value={r.order}>
                      Rubber {r.order}: {r.label} ({r.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {format !== 'DIRECT_KNOCKOUT' && (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Pool Stage Draws
                </label>
                <select
                  value={drawAllowedInPools ? 'true' : 'false'}
                  onChange={(e) => setDrawAllowedInPools(e.target.value === 'true')}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  <option value="true">Allowed (Ties can end in a draw, 1 pt each)</option>
                  <option value="false">Not Allowed (Apply tie decider in pools too)</option>
                </select>
              </div>
            )}
          </div>

          {/* Points Table Sorting & League Points */}
          {format !== 'DIRECT_KNOCKOUT' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Points for Win</label>
                  <input
                    type="number"
                    value={winPoints}
                    onChange={(e) => setWinPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Points for Draw</label>
                  <input
                    type="number"
                    value={drawPoints}
                    onChange={(e) => setDrawPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Points for Loss</label>
                  <input
                    type="number"
                    value={lossPoints}
                    onChange={(e) => setLossPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Points Table Sorting</label>
                  <select
                    value={standingsSortPriority}
                    onChange={(e) => setStandingsSortPriority(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="STANDARD">Pts &gt; Rubbers &gt; Sets &gt; Points</option>
                    <option value="SETS_FIRST">Pts &gt; Sets Diff &gt; Points Diff</option>
                    <option value="WINS_FIRST">Wins First &gt; Sets &gt; Points</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={generating} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={generating}
            className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            {generating ? 'Generating Bracket...' : 'Generate Bracket & Ties'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}
