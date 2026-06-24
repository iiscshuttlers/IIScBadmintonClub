const fs = require('fs');
const path = 'D:/NF/New folder/iiscshuttlers/client/src/components/umpire/UmpireEngine.tsx';
const content = fs.readFileSync(path, 'utf8').split('\n');

const before = content.slice(0, 168);
const after = content.slice(398);

const newCode = `      {/* ── Change Ends Overlay ── */}
      {showChangeEnds && (
        <ChangeEndsModal reason={changeEndsReason} onConfirm={confirmChangeEnds} />
      )}

      {/* ── Cards Panel Overlay ── */}
      {showCardPanel && (
        <DisciplineCardModal 
          match={match} 
          cards={cards} 
          cardTarget={cardTarget} 
          setCardTarget={setCardTarget} 
          onClose={() => { setShowCardPanel(false); setCardTarget(null); }} 
          onIssueCard={issueCard} 
        />
      )}

      {/* ── Retirement Modal ── */}
      {showRetireModal && (
        <RetireModal onRetire={retireTeam} onClose={() => setShowRetireModal(false)} />
      )}

      {/* ── Direct Score Modal ── */}
      {isDirectScoreOpen && (
        <DirectScoreModal 
          directWinner={directWinner} 
          setDirectWinner={setDirectWinner} 
          directSetsText={directSetsText} 
          setDirectSetsText={setDirectSetsText} 
          onSave={() => {
            updateMatch({ status: "finished", winner: directWinner, setsHistory: directSetsText.split(",").map(s => s.trim()) });
            setIsDirectScoreOpen(false);
          }} 
          onClose={() => setIsDirectScoreOpen(false)} 
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-400 font-black uppercase tracking-widest text-xs mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Umpire
          </div>
          <div className="text-slate-400 text-[11px] font-bold truncate">
            {match.isFriendly ? "Friendly" : \`Tournament • \${match.matchNumber || "—"}\`} • {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts) • Game {currentGameNum}
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700"
          >
            <Settings className="w-4 h-4" /> Tools
            {showToolsMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showToolsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowToolsMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden py-1">
                {match.status === "playing" && (
                  <>
                    <button onClick={() => { updateMatch({ endsSwapped: !match.endsSwapped }); setShowToolsMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700 transition">
                      <ArrowLeftRight className="w-4 h-4 text-slate-400" /> Swap Ends
                    </button>
                    {match.t1.p2Id && (
                      <button onClick={() => { updateMatch({ serverPlayerIndex: match.serverPlayerIndex === 0 ? 1 : 0 }); setShowToolsMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700 transition">
                        <Repeat className="w-4 h-4 text-slate-400" /> Switch Server
                      </button>
                    )}
                    <button onClick={() => { setIsDirectScoreOpen(true); setShowToolsMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700 transition">
                      <Flag className="w-4 h-4 text-slate-400" /> Direct Score
                    </button>
                    <button onClick={() => { setIsEditSetupOpen(true); setShowToolsMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-slate-700 transition">
                      <Settings className="w-4 h-4 text-slate-400" /> Edit Setup
                    </button>
                    <div className="h-px bg-slate-700 my-1" />
                  </>
                )}
                <button onClick={() => { handleClose(); setShowToolsMenu(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition">
                  <X className="w-4 h-4" /> Abort Match
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Finished Screen ── */}
      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match {match.retiredTeam ? "Retired" : "Finished"}!</h2>
          <div className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase">
            {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts)
          </div>
          <p className="text-xl text-slate-300 mb-2">
            {match.winner === 1
              ? (match.t1.p1Name + (match.t1.p2Name ? \` / \${match.t1.p2Name}\` : ""))
              : (match.t2.p1Name + (match.t2.p2Name ? \` / \${match.t2.p2Name}\` : ""))
            } Won
          </p>
          <p className="text-emerald-400 font-bold mb-8 text-2xl">{match.setsHistory.join(", ")}{match.retiredTeam ? \` (T\${match.retiredTeam} Retired)\` : ""}</p>
          <button onClick={saveMatchToProfile} className="px-8 py-4 bg-linear-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black uppercase tracking-wider shadow-xl flex items-center gap-2 mx-auto">
            <Save className="w-5 h-5" /> Save to Profile & Notify
          </button>
          <button onClick={() => updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined })} className="mt-6 text-sm font-bold text-slate-500 hover:text-slate-400 underline">
            Wait, add a set / resume match
          </button>
        </div>
      ) : (
        <>
        {/* ── Break Timer mini-banner (always visible when timer running) ── */}
        {breakSecondsLeft !== null && (
          <button
            onClick={() => setShowFullTimer(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-400/10 border border-amber-400/40 rounded-2xl mb-4 hover:bg-amber-400/20 transition"
          >
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-amber-400 font-black text-sm uppercase tracking-widest">{breakLabel || "Break"}</span>
            </div>
            <span className="text-amber-400 font-black text-xl tabular-nums">
              {Math.floor(breakSecondsLeft / 60).toString().padStart(2, "0")}:{(breakSecondsLeft % 60).toString().padStart(2, "0")}
            </span>
          </button>
        )}
        {/* ── Full-screen timer overlay ── */}
        {showFullTimer && breakSecondsLeft !== null && (
          <BreakTimerOverlay 
            breakSecondsLeft={breakSecondsLeft} 
            breakLabel={breakLabel} 
            onEndBreak={endBreak} 
            onClose={() => setShowFullTimer(false)} 
          />
        )}`;

const finalContent = [...before, newCode, ...after].join('\n');
fs.writeFileSync(path, finalContent);
console.log('Done refactoring UmpireEngine.tsx part 2');
