import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface RubberConfig {
  order: number;
  label: string;
  category: string;
  points: number;
  best_of_sets?: number;
  points_to_win?: number;
}

interface TeamFormatConfigPanelProps {
  rubbers: RubberConfig[];
  setRubbers: (rubbers: RubberConfig[]) => void;
  teamRosterMin: number;
  setTeamRosterMin: (min: number) => void;
  teamRosterMax: number;
  setTeamRosterMax: (max: number) => void;
  tiePointsWin: number;
  setTiePointsWin: (pts: number) => void;
  tiePointsDraw: number;
  setTiePointsDraw: (pts: number) => void;
}

export function TeamFormatConfigPanel({
  rubbers,
  setRubbers,
  teamRosterMin,
  setTeamRosterMin,
  teamRosterMax,
  setTeamRosterMax,
  tiePointsWin,
  setTiePointsWin,
  tiePointsDraw,
  setTiePointsDraw
}: TeamFormatConfigPanelProps) {
  
  const addRubber = () => {
    setRubbers([
      ...rubbers, 
      { 
        order: rubbers.length + 1, 
        label: `Rubber ${rubbers.length + 1}`, 
        category: 'MS', 
        points: 1,
        best_of_sets: 3,
        points_to_win: 21
      }
    ]);
  };

  const updateRubber = (index: number, field: keyof RubberConfig, value: any) => {
    const newRubbers = [...rubbers];
    newRubbers[index] = { ...newRubbers[index], [field]: value };
    setRubbers(newRubbers);
  };

  const removeRubber = (index: number) => {
    const newRubbers = [...rubbers];
    newRubbers.splice(index, 1);
    // Re-order
    newRubbers.forEach((r, i) => { r.order = i + 1; });
    setRubbers(newRubbers);
  };

  return (
    <div className="space-y-6 mt-6 p-5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">Custom Tie Configuration</h3>
      
      <div className="space-y-4">
        <h4 className="font-bold text-sm text-slate-600 dark:text-slate-400">Rubbers (Matches per Tie)</h4>
        
        {rubbers.map((rubber, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 w-5">{rubber.order}.</span>
              <input 
                type="text" 
                value={rubber.label} 
                onChange={e => updateRubber(index, 'label', e.target.value)}
                placeholder="Label (e.g. MS1)"
                className="flex-1 sm:w-24 px-2 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
              <select 
                value={rubber.category}
                onChange={e => updateRubber(index, 'category', e.target.value)}
                className="w-20 px-2 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <option value="MS">MS</option>
                <option value="WS">WS</option>
                <option value="MD">MD</option>
                <option value="WD">WD</option>
                <option value="XD">XD</option>
              </select>
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 whitespace-nowrap">Pts:</span>
                <input 
                  type="number" 
                  min="1"
                  value={rubber.points} 
                  onChange={e => updateRubber(index, 'points', parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 whitespace-nowrap">Format:</span>
                <select 
                  value={`${rubber.best_of_sets}x${rubber.points_to_win}`}
                  onChange={e => {
                    const [sets, pts] = e.target.value.split('x').map(Number);
                    updateRubber(index, 'best_of_sets', sets);
                    updateRubber(index, 'points_to_win', pts);
                  }}
                  className="w-28 px-2 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value="3x21">3x21 (Std)</option>
                  <option value="1x21">1x21</option>
                  <option value="1x31">1x31</option>
                </select>
              </div>

              <button 
                onClick={() => removeRubber(index)}
                className="ml-auto p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button 
          onClick={addRubber}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Rubber
        </button>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold text-sm text-slate-600 dark:text-slate-400 mb-3">League Scoring</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Points for Win</span>
              <input type="number" value={tiePointsWin} onChange={e => setTiePointsWin(parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Points for Draw</span>
              <input type="number" value={tiePointsDraw} onChange={e => setTiePointsDraw(parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-sm text-slate-600 dark:text-slate-400 mb-3">Roster Limits</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Min Players</span>
              <input type="number" value={teamRosterMin} onChange={e => setTeamRosterMin(parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Max Players</span>
              <input type="number" value={teamRosterMax} onChange={e => setTeamRosterMax(parseInt(e.target.value))} className="w-20 px-2 py-1 text-sm border rounded bg-white dark:bg-slate-900" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
