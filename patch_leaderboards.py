import re

with open("client/src/pages/PlayersDirectory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I will add a Monthly Leaderboard section at the top of the Directory.
leaderboard_code = """
              {/* Monthly Leaderboards */}
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                    <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Monthly Leaderboards</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Top performers for this month</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Top Elo */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-3xl p-5 border border-indigo-100 dark:border-indigo-800/50 shadow-sm relative overflow-hidden">
                    <h4 className="text-sm font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" /> Highest ELO Rating</h4>
                    <div className="space-y-3">
                      {[...players].sort((a, b) => (b.elo_rating || 1200) - (a.elo_rating || 1200)).slice(0, 3).map((p, i) => (
                        <div key={`elo-${p.id}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 text-center font-black text-indigo-400">#{i+1}</div>
                            <img src={p.avatar_url || ''} className="w-8 h-8 rounded-full bg-indigo-200" />
                            <div className="font-bold text-sm text-indigo-950 dark:text-indigo-100">{p.full_name}</div>
                          </div>
                          <div className="font-black text-indigo-600 dark:text-indigo-400">{p.elo_rating}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Active */}
                  <div className="bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40 rounded-3xl p-5 border border-rose-100 dark:border-rose-800/50 shadow-sm relative overflow-hidden">
                    <h4 className="text-sm font-black uppercase tracking-widest text-rose-900 dark:text-rose-300 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> Most Active (This Month)</h4>
                    <div className="space-y-3">
                      {[...players].sort((a, b) => {
                        const aWins = parseInt(a.win_loss_record?.split('-')[0] || '0');
                        const aLoss = parseInt(a.win_loss_record?.split('-')[1] || '0');
                        const bWins = parseInt(b.win_loss_record?.split('-')[0] || '0');
                        const bLoss = parseInt(b.win_loss_record?.split('-')[1] || '0');
                        return (bWins + bLoss) - (aWins + aLoss);
                      }).slice(0, 3).map((p, i) => {
                        const wins = parseInt(p.win_loss_record?.split('-')[0] || '0');
                        const loss = parseInt(p.win_loss_record?.split('-')[1] || '0');
                        return (
                        <div key={`active-${p.id}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 text-center font-black text-rose-400">#{i+1}</div>
                            <img src={p.avatar_url || ''} className="w-8 h-8 rounded-full bg-rose-200" />
                            <div className="font-bold text-sm text-rose-950 dark:text-rose-100">{p.full_name}</div>
                          </div>
                          <div className="font-black text-rose-600 dark:text-rose-400">{wins + loss} Matches</div>
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
              </div>
"""

content = content.replace("{buddiesLooking.length > 0 && (", leaderboard_code + "\n              {buddiesLooking.length > 0 && (")

with open("client/src/pages/PlayersDirectory.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayersDirectory updated with Monthly Leaderboards.")
