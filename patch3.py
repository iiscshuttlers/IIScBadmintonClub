import re

filename = 'client/src/components/umpire/MatchModals.tsx'
with open(filename, 'r', encoding='utf8') as f:
    content = f.read()

target = '''export function DirectScoreModal({
  directWinner,
  setDirectWinner,
  directSetsText,
  setDirectSetsText,
  onSave,
  onClose
}: {
  directWinner: 1 | 2 | null;
  setDirectWinner: (w: 1 | 2 | null) => void;
  directSetsText: string;
  setDirectSetsText: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {'''

replacement = '''export function DirectScoreModal({
  directWinner,
  setDirectWinner,
  directSetsText,
  setDirectSetsText,
  onSave,
  onClose,
  team1Label = "Team 1",
  team2Label = "Team 2"
}: {
  directWinner: 1 | 2 | null;
  setDirectWinner: (w: 1 | 2 | null) => void;
  directSetsText: string;
  setDirectSetsText: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
  team1Label?: string;
  team2Label?: string;
}) {
  const sets = directSetsText ? directSetsText.split(",").map(s => s.trim()) : [];
  const parsedSets = [0, 1, 2, 3, 4].map(i => {
    const s = sets[i] || "";
    const [t1, t2] = s.split("-");
    return { t1: t1 || "", t2: t2 || "" };
  });

  const handleSetChange = (idx: number, team: 1 | 2, val: string) => {
    const newSets = [...parsedSets];
    if (team === 1) newSets[idx].t1 = val;
    else newSets[idx].t2 = val;
    
    const validSets = newSets.filter(s => s.t1 !== "" || s.t2 !== "");
    const str = validSets.map(s => \\-\\).join(", ");
    setDirectSetsText(str);
  };
'''

content = content.replace(target, replacement)

target2 = '''              <div className="flex gap-2">
                <button onClick={() => setDirectWinner(1)} className={lex-1 py-3 rounded-xl font-bold transition }>Team 1</button>
                <button onClick={() => setDirectWinner(2)} className={lex-1 py-3 rounded-xl font-bold transition }>Team 2</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Scores (comma separated)</label>
              <input 
                type="text" 
                value={directSetsText} 
                onChange={e => setDirectSetsText(e.target.value)} 
                placeholder="e.g. 21-15, 21-18" 
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 outline-none"
              />
            </div>'''

replacement2 = '''              <div className="flex gap-2">
                <button onClick={() => setDirectWinner(1)} className={lex-1 py-3 rounded-xl font-bold transition }>{team1Label}</button>
                <button onClick={() => setDirectWinner(2)} className={lex-1 py-3 rounded-xl font-bold transition }>{team2Label}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Scores</label>
              <div className="space-y-2">
                {parsedSets.slice(0, Math.max(1, parsedSets.filter(s => s.t1 || s.t2).length + 1)).map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-bold text-slate-500">Set {idx + 1}</span>
                    <input 
                      type="number" 
                      value={s.t1} 
                      onChange={e => handleSetChange(idx, 1, e.target.value)} 
                      placeholder="0" 
                      className="w-16 text-center bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white font-bold focus:border-emerald-500 outline-none"
                    />
                    <span className="text-slate-500 font-bold">-</span>
                    <input 
                      type="number" 
                      value={s.t2} 
                      onChange={e => handleSetChange(idx, 2, e.target.value)} 
                      placeholder="0" 
                      className="w-16 text-center bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-white font-bold focus:border-sky-500 outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>'''

content = content.replace(target2, replacement2)

with open(filename, 'w', encoding='utf8') as f:
    f.write(content)
print('Patched MatchModals successfully!')
