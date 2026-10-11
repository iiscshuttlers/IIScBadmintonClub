import React, { useState } from 'react';
import { Settings2, X, Save, ShieldCheck, Trophy, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { calculateMinRosterRequirements } from '@/lib/teamLineupRules';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournament: any;
  onSaved: () => void;
}

export function TeamSettingsEditModal({ isOpen, onClose, tournament, onSaved }: Props) {
  const currentConfig = tournament?.tie_format_config || {};
  const rubbers = currentConfig.rubbers || (Array.isArray(currentConfig) ? currentConfig : []);

  const [advancingPerPool, setAdvancingPerPool] = useState<number>(
    currentConfig.advancing_per_pool ?? 2
  );
  const [playoffFormat, setPlayoffFormat] = useState<string>(
    currentConfig.playoff_format ?? 'KNOCKOUT'
  );

  // Decider Rules
  const [deciderRule, setDeciderRule] = useState<string>(
    currentConfig.decider_rule ?? 'EXTRA_DECIDER_RUBBER'
  );
  const [specificRubberOrder, setSpecificRubberOrder] = useState<number>(
    currentConfig.specific_decider_rubber_order ?? 1
  );

  // Extra Decider Rubber Settings
  const extraRubber = currentConfig.extra_decider_rubber || {};
  const [deciderCategory, setDeciderCategory] = useState<string>(
    extraRubber.category ?? 'XD'
  );
  const [deciderLabel, setDeciderLabel] = useState<string>(
    extraRubber.label ?? 'XD 2'
  );
  const [deciderSets, setDeciderSets] = useState<number>(
    extraRubber.best_of_sets ?? 1
  );
  const [deciderPoints, setDeciderPoints] = useState<number>(
    extraRubber.points_to_win ?? 21
  );

  // Standings Points
  const [winPoints, setWinPoints] = useState<number>(
    tournament.tie_points_win ?? currentConfig.tie_points_win ?? 2
  );
  const [drawPoints, setDrawPoints] = useState<number>(
    tournament.tie_points_draw ?? currentConfig.tie_points_draw ?? 1
  );
  const [lossPoints, setLossPoints] = useState<number>(
    currentConfig.tie_points_loss ?? 0
  );
  const [drawAllowedInPools, setDrawAllowedInPools] = useState<boolean>(
    currentConfig.draw_allowed_in_pools ?? true
  );
  const [standingsSortPriority, setStandingsSortPriority] = useState<string>(
    currentConfig.standings_sort_priority ?? 'STANDARD'
  );

  // Lineup & Player Repetition Restrictions
  const [maxRubbersPerMale, setMaxRubbersPerMale] = useState<number>(
    currentConfig.max_rubbers_per_male ?? tournament.max_rubbers_per_player ?? 2
  );
  const [maxRubbersPerFemale, setMaxRubbersPerFemale] = useState<number>(
    currentConfig.max_rubbers_per_female ?? tournament.max_rubbers_per_player ?? 2
  );
  const [allowSameDisciplineRepeat, setAllowSameDisciplineRepeat] = useState<boolean>(
    currentConfig.allow_same_discipline_repeat ?? false
  );
  const [allowSameEventRepeatInDecider, setAllowSameEventRepeatInDecider] = useState<boolean>(
    currentConfig.allow_same_event_repeat_in_decider ?? false
  );

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfig = {
        ...(typeof currentConfig === 'object' && !Array.isArray(currentConfig) ? currentConfig : { rubbers: currentConfig }),
        advancing_per_pool: advancingPerPool,
        playoff_format: playoffFormat,
        decider_rule: deciderRule,
        specific_decider_rubber_order: deciderRule === 'SPECIFIC_RUBBER' ? specificRubberOrder : undefined,
        extra_decider_rubber: {
          enabled: deciderRule === 'EXTRA_DECIDER_RUBBER' || deciderRule === 'GOLDEN_MATCH',
          category: deciderCategory,
          label: deciderLabel,
          best_of_sets: deciderSets,
          points_to_win: deciderPoints
        },
        draw_allowed_in_pools: drawAllowedInPools,
        tie_points_win: winPoints,
        tie_points_draw: drawPoints,
        tie_points_loss: lossPoints,
        standings_sort_priority: standingsSortPriority,
        max_rubbers_per_male: maxRubbersPerMale,
        max_rubbers_per_female: maxRubbersPerFemale,
        allow_same_discipline_repeat: allowSameDisciplineRepeat,
        allow_same_event_repeat_in_decider: allowSameEventRepeatInDecider
      };

      const { error } = await supabase.from('tournaments').update({
        tie_format_config: updatedConfig,
        tie_points_win: winPoints,
        tie_points_draw: drawPoints
      }).eq('id', tournament.id);

      if (error) throw error;

      toast.success("Tournament format & decider settings updated successfully!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto overflow-hidden">
        
        {/* Header (fixed at top) */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-primary" />
              Edit Format, Advancement &amp; Decider Rules
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Customize pool qualification cutoffs, playoff formats, and sudden-death decider rubbers. Changes take effect immediately.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-6 py-4 pr-1">
        {/* 1. Advancement & Playoff Format */}
        <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Pool Advancement &amp; Stage 2 Structure
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <option value={2}>Top 2 per pool (Winner &amp; Runner-up)</option>
                <option value={3}>Top 3 per pool (1st, 2nd &amp; 3rd Place)</option>
                <option value={4}>Top 4 per pool (Top 4 teams)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Updates standings qualification cutoff line dynamically.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Playoff Stage Format
              </label>
              <select
                value={playoffFormat}
                onChange={(e) => setPlayoffFormat(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
              >
                <option value="KNOCKOUT">Knockouts (Play-ins &amp; Byes for 6 teams)</option>
                <option value="CHAMPIONSHIP_POOL">Championship Pool (Round-Robin between qualifiers)</option>
                <option value="CHAMPIONSHIP_POOL_PLUS_FINAL">Championship Pool + Grand Final</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Decider & Tiebreaker Rules */}
        <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Tiebreaker &amp; Decider Rubber Settings (e.g. 3-3 Tie)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Knockout Tie Decider Rule
              </label>
              <select
                value={deciderRule}
                onChange={(e) => setDeciderRule(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
              >
                <option value="EXTRA_DECIDER_RUBBER">Sudden-Death Extra Decider Rubber (e.g. XD2, MS2 - Unlocked on tie)</option>
                <option value="SET_DIFF">Net Set Difference across Rubbers</option>
                <option value="POINT_DIFF">Net Point Difference (Pts +/-)</option>
                <option value="TOTAL_POINTS">Total Match Points Won</option>
                <option value="SPECIFIC_RUBBER">Winner of Pre-selected Rubber</option>
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
          </div>

          {(deciderRule === 'EXTRA_DECIDER_RUBBER' || deciderRule === 'GOLDEN_MATCH') && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                  Conditional Decider Rubber (e.g. XD2, MS2)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Category</label>
                  <select
                    value={deciderCategory}
                    onChange={(e) => setDeciderCategory(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="XD">XD (Mixed Doubles)</option>
                    <option value="MS">MS (Men's Singles)</option>
                    <option value="WS">WS (Women's Singles)</option>
                    <option value="MD">MD (Men's Doubles)</option>
                    <option value="WD">WD (Women's Doubles)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Rubber Label</label>
                  <input
                    type="text"
                    value={deciderLabel}
                    onChange={(e) => setDeciderLabel(e.target.value)}
                    placeholder="e.g. XD 2 or MS 2"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Sets Format</label>
                  <select
                    value={deciderSets}
                    onChange={(e) => setDeciderSets(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value={1}>1 Set (Sudden Death)</option>
                    <option value={3}>Best of 3 Sets</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Points to Win</label>
                  <select
                    value={deciderPoints}
                    onChange={(e) => setDeciderPoints(parseInt(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value={11}>11 Points (Sprint)</option>
                    <option value={15}>15 Points</option>
                    <option value={21}>21 Points (Standard)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ⚡ <strong>Captains Lineup:</strong> Submitted later by captains only when the tie actually ends in a tie. Official reveals the decider rubber when ready.
              </p>
            </div>
          )}

          {/* Points Table Settings */}
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
                  onChange={(e) => setStandingsSortPriority(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="STANDARD">Pts &gt; Rubbers &gt; Sets &gt; Points</option>
                  <option value="SETS_FIRST">Pts &gt; Sets Diff &gt; Points Diff</option>
                  <option value="WINS_FIRST">Wins First &gt; Sets &gt; Points</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Player Repetition & Lineup Restrictions */}
          {(() => {
            const rosterReq = calculateMinRosterRequirements(rubbers, {
              max_rubbers_per_male: maxRubbersPerMale,
              max_rubbers_per_female: maxRubbersPerFemale,
              allow_same_discipline_repeat: allowSameDisciplineRepeat,
              ignore_gender_rules: tournament?.ignore_gender_rules
            });

            return (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Player Repetition &amp; Lineup Restrictions
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Configure individual match participation caps and prevent duplicate discipline assignments.
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold shrink-0">
                    Min Roster: {rosterReq.minTotalPlayers} players ({rosterReq.minMalePlayers}♂, {rosterReq.minFemalePlayers}♀)
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Max Rubbers per Male Player
                    </label>
                    <select
                      value={maxRubbersPerMale}
                      onChange={(e) => setMaxRubbersPerMale(parseInt(e.target.value) || 2)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                    >
                      <option value={1}>1 rubber only (No repeats)</option>
                      <option value={2}>At most 2 rubbers (Standard)</option>
                      <option value={3}>At most 3 rubbers</option>
                      <option value={4}>Unlimited / 4 rubbers</option>
                    </select>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Requires at least {rosterReq.minMalePlayers} male players for {rosterReq.totalMaleSlots} male slots.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Max Rubbers per Female Player
                    </label>
                    <select
                      value={maxRubbersPerFemale}
                      onChange={(e) => setMaxRubbersPerFemale(parseInt(e.target.value) || 2)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                    >
                      <option value={1}>1 rubber only (No repeats)</option>
                      <option value={2}>At most 2 rubbers (Standard)</option>
                      <option value={3}>At most 3 rubbers (Flexible)</option>
                      <option value={4}>Unlimited / 4 rubbers</option>
                    </select>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Requires at least {rosterReq.minFemalePlayers} female players for {rosterReq.totalFemaleSlots} female slots.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!allowSameDisciplineRepeat}
                      onChange={(e) => setAllowSameDisciplineRepeat(!e.target.checked)}
                      className="w-4 h-4 accent-primary rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Disallow Same-Discipline Repeats
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        A player who played MS1 cannot play MS2 (or WD1/WD2).
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowSameEventRepeatInDecider}
                      onChange={(e) => setAllowSameEventRepeatInDecider(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Allow Same Event Player in Decider
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        If tie has a decider (e.g. XD2), allow players who played regular XD1.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            );
          })()}
        </div>
        </div>

        {/* Footer Actions (fixed at bottom) */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </Button>
        </div>

      </div>
    </div>
  );
}
