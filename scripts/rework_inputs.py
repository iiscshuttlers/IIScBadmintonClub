import sys
import re

with open('client/src/pages/ProfileSetup.tsx', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Add States
state_target = 'const [tournamentsRaw, setTournamentsRaw] = useState("");'
state_insertion = """
  const [tourName, setTourName] = useState("");
  const [tourYear, setTourYear] = useState("");
  const [achMedal, setAchMedal] = useState("Gold");
  const [achCustomMedal, setAchCustomMedal] = useState("");
  const [achTournament, setAchTournament] = useState("");
"""
content = content.replace(state_target, state_target + state_insertion)

# 2. Replace Achievements Input UI
ach_input_old = """                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="achInput"
                            placeholder="e.g. Men's Doubles Winner - Farewell 2026"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const inp = document.getElementById('achInput') as HTMLInputElement;
                              const val = inp?.value.trim();
                              if (val) { setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val); inp.value = ''; }
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Press Enter or comma to add · Click × to remove · Or use the builder above</p>"""

ach_input_new = """                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex gap-2 sm:w-1/3 shrink-0">
                            <select
                              value={achMedal}
                              onChange={(e) => setAchMedal(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="Gold">🥇 Gold / Winner</option>
                              <option value="Silver">🥈 Silver / Runner-up</option>
                              <option value="Bronze">🥉 Bronze / Semi-Finalist</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          {achMedal === "Other" && (
                            <input
                              type="text"
                              value={achCustomMedal}
                              onChange={(e) => setAchCustomMedal(e.target.value)}
                              placeholder="e.g. Quarter-Finalist"
                              className="w-full sm:w-32 shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          )}
                          <select
                            value={achTournament}
                            onChange={(e) => setAchTournament(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Select Tournament Played --</option>
                            {tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean).map((t, idx) => (
                              <option key={idx} value={t}>{t}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const medalStr = achMedal === "Other" ? achCustomMedal.trim() : (achMedal === "Gold" ? "Winner" : achMedal === "Silver" ? "Runner-up" : "Semi-Finalist");
                              if (medalStr && achTournament.trim()) {
                                const val = `${medalStr} - ${achTournament.trim()}`;
                                setAchievementsRaw(achievementsRaw.trim() ? achievementsRaw.trim() + ", " + val : val);
                                setAchCustomMedal("");
                                setAchTournament("");
                              }
                            }}
                            disabled={!(achMedal === "Other" ? achCustomMedal.trim() : true) || !achTournament.trim()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">First add Tournaments below, then select them here.</p>"""

content = content.replace(ach_input_old, ach_input_new)

# 3. Replace Tournaments Input UI
tour_input_old = """                        <div className="flex gap-2">
                          <input
                            type="text"
                            id="tourInput"
                            placeholder="e.g. Farewell 2026"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const inp = document.getElementById('tourInput') as HTMLInputElement;
                              const val = inp?.value.trim();
                              if (val) { setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val); inp.value = ''; }
                            }}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">Press Enter or comma to add · Click × to remove</p>"""

tour_input_new = """                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={tourName}
                            onChange={(e) => setTourName(e.target.value)}
                            placeholder="Tournament Name (e.g. Farewell Tournament)"
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            value={tourYear}
                            onChange={(e) => setTourYear(e.target.value)}
                            placeholder="Year (e.g. 2025)"
                            className="w-full sm:w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (tourName.trim() && tourYear.trim()) {
                                const val = `${tourName.trim()} ${tourYear.trim()}`;
                                setTournamentsRaw(tournamentsRaw.trim() ? tournamentsRaw.trim() + ", " + val : val);
                                setTourName("");
                                setTourYear("");
                              }
                            }}
                            disabled={!tourName.trim() || !tourYear.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >Add</button>
                        </div>"""

content = content.replace(tour_input_old, tour_input_new)

with open('client/src/pages/ProfileSetup.tsx', 'w', encoding='utf8') as f:
    f.write(content)

print("UI successfully modified.")
