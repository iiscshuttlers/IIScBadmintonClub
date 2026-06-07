import sys
import re

with open('client/src/pages/ProfileSetup.tsx', 'r', encoding='utf8') as f:
    content = f.read()

# 1. Add State
state_target = 'const [tournamentsRaw, setTournamentsRaw] = useState("");'
state_insertion = '\n  const [careerHighlights, setCareerHighlights] = useState<{year: string; title: string; description: string}[]>([]);'
content = content.replace(state_target, state_target + state_insertion)

# 2. Add Initialization
init_target = 'setOriginalStats(profile.stats || {});'
init_insertion = '\n          setCareerHighlights(profile.career_highlights || []);'
content = content.replace(init_target, init_target + init_insertion)

# 3. Add to Payload
payload_target = 'tournament_history: tournamentsRaw ? tournamentsRaw.split(",").map(s => s.trim()).filter(Boolean) : [],'
payload_insertion = '\n      career_highlights: careerHighlights.filter(h => h.year && h.title),'
content = content.replace(payload_target, payload_target + payload_insertion)

# 4. Add UI inside highlights tab
ui_target = '                    </div>\n                  </motion.div>\n                )}\n\n\n                {/* TAB 5: MEDIA SHOWCASE'
ui_insertion = """                    </div>

                    {/* Career Highlights Builder */}
                    <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" />
                          Career Highlights
                        </label>
                        <button
                          type="button"
                          onClick={() => setCareerHighlights([...careerHighlights, { year: "", title: "", description: "" }])}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30 transition shadow-sm"
                        >
                          + Add Highlight
                        </button>
                      </div>
                      
                      {careerHighlights.length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                          <p className="text-slate-500 dark:text-slate-400 text-sm">Add custom narrative milestones (e.g. "Joined IISc Team") to show on your profile timeline.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {careerHighlights.map((hl, idx) => (
                            <div key={idx} className="relative bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm pr-12">
                              <button
                                type="button"
                                onClick={() => setCareerHighlights(careerHighlights.filter((_, i) => i !== idx))}
                                className="absolute top-4 right-4 text-rose-500 hover:text-rose-600 dark:text-rose-400 font-black p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition"
                                title="Remove highlight"
                              >
                                ×
                              </button>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="sm:col-span-1">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Year</label>
                                  <input
                                    type="text"
                                    value={hl.year}
                                    placeholder="e.g. 2023"
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].year = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={hl.title}
                                    placeholder="e.g. Inter-University Quarter-Finalist"
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].title = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Description (Optional)</label>
                                  <textarea
                                    value={hl.description}
                                    rows={2}
                                    placeholder="Briefly describe this milestone..."
                                    onChange={(e) => {
                                      const arr = [...careerHighlights];
                                      arr[idx].description = e.target.value;
                                      setCareerHighlights(arr);
                                    }}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}


                {/* TAB 5: MEDIA SHOWCASE"""

content = content.replace(ui_target, ui_insertion)

# 5. Add Star to lucide-react import
import_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+"lucide-react";', content)
if import_match:
    import_block = import_match.group(1)
    if 'Star' not in import_block:
        new_import_block = import_block + ', Star'
        content = content.replace(import_block, new_import_block)

with open('client/src/pages/ProfileSetup.tsx', 'w', encoding='utf8') as f:
    f.write(content)

print("Modification complete.")
