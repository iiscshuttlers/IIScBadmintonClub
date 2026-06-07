import sys

with open('client/src/pages/PlayerProfile.tsx', 'r', encoding='utf8') as f:
    content = f.read()

# We want to replace the identity card block
# Let's find the start
start_str = '{/* ============== Identity Card ============== */}'
end_str = '{/* ============== BWF-Style Split Stats ============== */}'

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find blocks")
    sys.exit(1)

new_block = """{/* ============== Identity Card ============== */}
        <motion.div
          variants={itemVariants}
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 dark:shadow-black/60 border border-white/60 dark:border-slate-700/50 p-6 sm:p-12 mb-10 overflow-hidden relative group"
        >
          {/* Decorative gradients */}
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Pending Match Verification Banner (own profile only) */}
          {currentUser && player && currentUser.id === player.userId && pendingMatches.length > 0 && (
            <div className="mb-8 bg-amber-500/10 backdrop-blur-md border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 pulse-animation" />
              <h3 className="text-amber-800 dark:text-amber-400 font-black mb-4 flex items-center gap-2 text-sm relative z-10">
                <Swords className="w-5 h-5" /> Pending Match Verifications ({pendingMatches.length})
              </h3>
              <div className="space-y-3 relative z-10">
                {pendingMatches.map(m => (
                  <div key={m.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-sm p-4 rounded-xl border border-amber-500/10 hover:border-amber-500/30 transition-colors">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center sm:text-left">
                      <span className="font-bold">{m.player1?.full_name}</span>
                      <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">VS</span>
                      <span className="font-bold">{m.player2?.full_name}</span>
                      <div className="text-xs text-slate-500 mt-1.5">
                        Score: <span className="font-bold text-slate-800 dark:text-white">{m.score}</span>
                        <span className="mx-2 opacity-50">•</span>
                        Winner: <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {m.winner_id === m.player1_id ? m.player1?.full_name : m.player2?.full_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleConfirmMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-emerald-500/25"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 lg:gap-12">
            {/* Avatar */}
            <div className="relative z-10 shrink-0">
              <div className="absolute -inset-3 bg-gradient-to-tr from-emerald-400 via-teal-500 to-blue-500 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition duration-700 animate-pulse" style={{ animationDuration: '4s' }} />
              <div className="relative p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-2xl">
                <img
                  src={player.avatar}
                  alt={player.fullName}
                  onClick={() => setIsAvatarOpen(true)}
                  className="w-40 h-40 sm:w-56 sm:h-56 rounded-full object-cover border-4 border-slate-50 dark:border-slate-900 transform group-hover:scale-[1.02] transition duration-500 cursor-zoom-in"
                />
              </div>
              {player.currentRanking != null && (
                <div className="absolute -bottom-4 right-2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex flex-col items-center justify-center shadow-xl shadow-amber-500/40 border-4 border-white dark:border-slate-900 transform hover:scale-110 transition-transform cursor-default">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/90 leading-none mb-0.5">Rank</span>
                  <span className="text-xl font-black text-white leading-none">#{player.currentRanking}</span>
                </div>
              )}
            </div>

            {/* Identity text */}
            <div className="flex-1 text-center sm:text-left relative z-10 pt-2 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-5 justify-center sm:justify-start">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight leading-none drop-shadow-sm">
                  {player.fullName}
                </h1>
                {player.nickname && (
                  <span className="px-5 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm font-black tracking-widest uppercase border border-emerald-200/50 dark:border-emerald-500/30 shadow-inner transform -rotate-2">
                    "{player.nickname}"
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-6">
                <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:-translate-y-0.5 transition-transform">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>{player.department}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:-translate-y-0.5 transition-transform">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Class of {player.joinedYear}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:-translate-y-0.5 transition-transform">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>{player.playingLevel}</span>
                </div>
                {player.nationality && (
                  <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:-translate-y-0.5 transition-transform">
                    <Hash className="w-4 h-4 text-indigo-500" />
                    <span>{player.nationality}{player.homeState ? ` · ${player.homeState}` : ''}</span>
                  </div>
                )}
                {player.height && (
                  <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:-translate-y-0.5 transition-transform">
                    <Ruler className="w-4 h-4 text-violet-500" />
                    <span>{player.height}</span>
                  </div>
                )}
              </div>

              {/* Edit Profile button inline for mobile */}
              {currentUser && currentUser.id === player.userId && (
                <div className="mt-2 mb-6 flex justify-center sm:justify-start">
                  <button
                    onClick={() => setLocation('/profile/setup')}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-sm font-black uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg group"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500 group-hover:rotate-180 transition-transform duration-500" /> 
                    Edit Your Profile
                  </button>
                </div>
              )}

              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                {/* Recent form */}
                {player.recentForm && player.recentForm.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white/40 dark:bg-slate-900/40 p-3 pr-5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-max mx-auto sm:mx-0">
                    <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 rounded-xl">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] uppercase tracking-widest font-black">Recent Form</span>
                    </div>
                    <div className="flex gap-2">
                      {player.recentForm.slice(0, 5).map((r, i) => (
                        <FormPill key={i} result={r} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Profile completeness (own profile only) */}
                {currentUser && currentUser.id === player.userId && (
                  <div className="w-full xl:w-64 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center justify-between text-xs font-black mb-2">
                      <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">Completeness</span>
                      <span className={`px-2 py-0.5 rounded-md ${profileCompleteness === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                        {profileCompleteness}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${profileCompleteness}%` }}
                        transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full relative"
                      >
                        <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
                      </motion.div>
                    </div>
                    {profileCompleteness < 100 && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-semibold">
                        Complete your profile to stand out
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        
        """

new_content = content[:start_idx] + new_block + content[end_idx:]

with open('client/src/pages/PlayerProfile.tsx', 'w', encoding='utf8') as f:
    f.write(new_content)

print("Replacement successful")
