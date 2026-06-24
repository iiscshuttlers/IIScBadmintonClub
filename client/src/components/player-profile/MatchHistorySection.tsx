import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronRight, Swords, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { shareMatch } from "@/lib/shareMatch";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";

// Duplicate the small helper function for encapsulation
function matchParticipantIds(match: any): string[] {
  return [
    match.player1_id,
    match.player2_id,
    match.team1_partner_id,
    match.team2_partner_id,
  ].filter(Boolean);
}

function isMatchParticipant(match: any, playerId?: string | null): boolean {
  return !!playerId && matchParticipantIds(match).includes(playerId);
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

interface MatchHistorySectionProps {
  id: string;
  liveMatches: any[];
  ownPlayerProfile: any;
  handleWithdrawMatch: (matchId: string) => Promise<void>;
  handleConfirmMatch?: (matchId: string) => Promise<void>;
  handleRejectMatch?: (matchId: string) => Promise<void>;
  handleResendRequest?: (match: any) => Promise<void>;
  defaultOpen?: boolean;
}

export function MatchHistorySection({
  id,
  liveMatches,
  ownPlayerProfile,
  handleWithdrawMatch,
  handleConfirmMatch,
  handleRejectMatch,
  handleResendRequest,
  defaultOpen = false,
}: MatchHistorySectionProps) {
  const [, setLocation] = useLocation();
  const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(defaultOpen);
  const [matchHistoryFilter, setMatchHistoryFilter] = useState<
    "all" | "friendly" | "tournament"
  >("all");

  const confirmedMatches = liveMatches.filter((m) => m.status === "confirmed");
  const pendingMatchesList = liveMatches
    .filter((m) => m.status === "pending")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  if (confirmedMatches.length === 0 && pendingMatchesList.length === 0)
    return null;

  const getGenderColor = (gender?: string | null) => {
    const g = gender?.toLowerCase() || '';
    if (g === 'female') return 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300';
    if (g === 'male') return 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300';
    return 'text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400';
  };

  const filteredMatches =
    matchHistoryFilter === "all"
      ? confirmedMatches
      : matchHistoryFilter === "friendly"
        ? confirmedMatches.filter((m) => m.is_friendly !== false)
        : confirmedMatches.filter((m) => m.is_friendly === false);

  // Rivalry Analytics
  const isViewingOther = ownPlayerProfile?.id && ownPlayerProfile.id !== id;
  const h2hMatches = isViewingOther
    ? confirmedMatches.filter((m) => isMatchParticipant(m, ownPlayerProfile.id))
    : [];

  const h2hWins = h2hMatches.filter((m) => m.winner_id === id).length; // Wins for the profile we're looking at
  const h2hLosses = h2hMatches.filter(
    (m) => m.winner_id === ownPlayerProfile?.id,
  ).length;

  return (
    <motion.section variants={itemVariants}>
      <button
        type="button"
        onClick={() => setIsMatchHistoryOpen((open) => !open)}
        aria-expanded={isMatchHistoryOpen}
        className="w-full bg-white dark:bg-slate-800/80 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 p-5 sm:p-6 flex items-center justify-between gap-4 text-left hover:border-blue-200 dark:hover:border-blue-800/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
              Match History
            </h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] sm:text-xs font-bold">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {confirmedMatches.length} confirmed
              </span>
              {pendingMatchesList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  {pendingMatchesList.length} pending
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isMatchHistoryOpen ? "rotate-90" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isMatchHistoryOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" as const }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {/* Rivalry Analytics */}
              {isViewingOther && h2hMatches.length > 0 && (
                <div className="mb-4 ml-2 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,63,94,0.05),transparent)] pointer-events-none" />
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2 relative z-10">
                    <Swords className="w-4 h-4 text-rose-500" /> Head-to-Head vs
                    You
                  </div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="text-center flex-1">
                      <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
                        {h2hWins}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        Their Wins
                      </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 mx-4" />
                    <div className="text-center flex-1">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        {h2hLosses}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        Your Wins
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 relative z-10">
                    <div
                      style={{
                        width: `${(h2hWins / h2hMatches.length) * 100}%`,
                      }}
                      className="bg-rose-500 transition-all duration-1000"
                    />
                    <div
                      style={{
                        width: `${(h2hLosses / h2hMatches.length) * 100}%`,
                      }}
                      className="bg-emerald-500 transition-all duration-1000"
                    />
                  </div>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex gap-2 ml-2 mb-4 overflow-x-auto pb-1">
                {(["all", "friendly", "tournament"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMatchHistoryFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border shrink-0
                      ${
                        matchHistoryFilter === tab
                          ? tab === "tournament"
                            ? "bg-amber-50 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400"
                            : tab === "friendly"
                              ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-400"
                              : "bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                  >
                    {tab === "all"
                      ? `All (${confirmedMatches.length})`
                      : tab === "friendly"
                        ? `🏸 Friendly (${confirmedMatches.filter((m) => m.is_friendly !== false).length})`
                        : `🏆 Tournament (${confirmedMatches.filter((m) => m.is_friendly === false).length})`}
                  </button>
                ))}
              </div>

              {/* Pending Matches Banner */}
              {pendingMatchesList.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 mb-4 ml-2">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">
                    ⏳ {pendingMatchesList.length} Pending Verification
                  </div>
                  <div className="space-y-2">
                    {pendingMatchesList.map((m, idx) => {
                      const isTeam1 = m.player1_id === id || m.team1_partner_id === id;
                      let partner = null;
                      let me = null;
                      if (isTeam1 && (m.team1_partner_id || m.partner1)) {
                        partner = m.player1_id === id ? m.partner1 : m.player1;
                        me = m.player1_id === id ? m.player1 : m.partner1;
                      } else if (!isTeam1 && (m.team2_partner_id || m.partner2)) {
                        partner = m.player2_id === id ? m.partner2 : m.player2;
                        me = m.player2_id === id ? m.player2 : m.partner2;
                      } else {
                        me = isTeam1 ? m.player1 : m.player2;
                      }

                      let opponents: any[] = [];
                      if (isTeam1) {
                        if (m.player2) opponents.push(m.player2);
                        if (m.partner2) opponents.push(m.partner2);
                      } else {
                        if (m.player1) opponents.push(m.player1);
                        if (m.partner1) opponents.push(m.partner1);
                      }

                      // Dynamic format label
                      let formatLabel = "S";
                      const allGenders = [me?.gender, partner?.gender, ...opponents.map(o => o?.gender)]
                        .map(g => (g || '').toLowerCase())
                        .filter(Boolean);
                        
                      if (partner || opponents.length > 1) {
                        const hasMale = allGenders.includes('male');
                        const hasFemale = allGenders.includes('female');
                        if (hasMale && hasFemale) {
                          formatLabel = "XD";
                        } else if (hasFemale) {
                          formatLabel = "WD";
                        } else {
                          formatLabel = "MD";
                        }
                      } else {
                        if (me?.gender?.toLowerCase() === 'female' || opponents[0]?.gender?.toLowerCase() === 'female') {
                          formatLabel = "WS";
                        } else {
                          formatLabel = "MS";
                        }
                      }

                      const isSubmitter =
                        ownPlayerProfile &&
                        m.submitted_by === ownPlayerProfile.id;
                      const isOpponent =
                        isMatchParticipant(m, ownPlayerProfile?.id) &&
                        !isSubmitter;

                      return (
                        <div
                          key={`pen-${m.id || idx}`}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-amber-200/50 dark:border-amber-700/30"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-800/40 flex items-center justify-center text-xs font-black text-amber-700 dark:text-amber-400 shrink-0">
                              ?
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <div className="flex flex-col gap-1.5">
                                {partner && (
                                  <div className="flex items-center gap-2 mb-0.5 leading-none">
                                    <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 w-6 text-right">with</span>
                                    <span className={`text-xs font-bold truncate ${getGenderColor(partner.gender)}`}>
                                      {partner.full_name}
                                    </span>
                                  </div>
                                )}
                                {opponents.map((opp, i) => (
                                  <div key={i} className="flex items-center gap-2 leading-none">
                                    {i === 0 ? (
                                      <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase w-6 text-right">vs</span>
                                    ) : (
                                      <span className="text-[10px] font-black text-rose-400/80 dark:text-rose-500/80 uppercase w-6 text-right">&</span>
                                    )}
                                    <span className={`font-black truncate ${getGenderColor(opp?.gender)}`}>
                                      {opp?.full_name ?? "Unknown"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-col gap-1 items-start">
                                <BeautifulScoreDisplay score={m.match_score || m.score} />
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 shrink-0">
                              {new Date(m.created_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            {isSubmitter && (
                              <>
                                <button
                                  onClick={() => handleWithdrawMatch(m.id)}
                                  className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-800/40 text-rose-700 dark:text-rose-400 transition-colors border border-rose-200 dark:border-rose-800/50"
                                >
                                  Withdraw Match
                                </button>
                                {handleResendRequest && (
                                  <button
                                    onClick={() => handleResendRequest(m)}
                                    className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 transition-colors border border-emerald-200 dark:border-emerald-800/50"
                                  >
                                    Resend Request
                                  </button>
                                )}
                              </>
                            )}
                            {isOpponent &&
                              handleConfirmMatch &&
                              handleRejectMatch && (
                                <>
                                  <button
                                    onClick={() => handleConfirmMatch(m.id)}
                                    className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => handleRejectMatch(m.id)}
                                    className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Match List — BWF table style */}
              <div className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="col-span-1 text-center">Result</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1 text-center">Format</div>
                  <div className="col-span-3">Opponent</div>
                  <div className="col-span-3">Score</div>
                  <div className="col-span-3 text-right">Date & Time</div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((m, idx) => {
                      const isTeam1 = m.player1_id === id || m.team1_partner_id === id;
                      
                      let partner = null;
                      let me = null;
                      if (isTeam1 && (m.team1_partner_id || m.partner1)) {
                        partner = m.player1_id === id ? m.partner1 : m.player1;
                        me = m.player1_id === id ? m.player1 : m.partner1;
                      } else if (!isTeam1 && (m.team2_partner_id || m.partner2)) {
                        partner = m.player2_id === id ? m.partner2 : m.player2;
                        me = m.player2_id === id ? m.player2 : m.partner2;
                      } else {
                        me = isTeam1 ? m.player1 : m.player2;
                      }

                      let opponents: any[] = [];
                      if (isTeam1) {
                        if (m.player2) opponents.push(m.player2);
                        if (m.partner2) opponents.push(m.partner2);
                      } else {
                        if (m.player1) opponents.push(m.player1);
                        if (m.partner1) opponents.push(m.partner1);
                      }

                      const won = isTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
                      const matchDate = new Date(m.created_at);
                      const isFriendly = m.is_friendly !== false;

                      // Dynamic format label
                      let formatLabel = "S";
                      const allGenders = [me?.gender, partner?.gender, ...opponents.map(o => o?.gender)]
                        .map(g => (g || '').toLowerCase())
                        .filter(Boolean);
                        
                      if (partner || opponents.length > 1) {
                        // Doubles
                        const hasMale = allGenders.includes('male');
                        const hasFemale = allGenders.includes('female');
                        if (hasMale && hasFemale) {
                          formatLabel = "XD";
                        } else if (hasFemale) {
                          formatLabel = "WD";
                        } else {
                          formatLabel = "MD";
                        }
                      } else {
                        // Singles
                        if (me?.gender?.toLowerCase() === 'female' || opponents[0]?.gender?.toLowerCase() === 'female') {
                          formatLabel = "WS";
                        } else {
                          formatLabel = "MS";
                        }
                      }

                      const scoreBg = won 
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40" 
                        : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40";

                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 p-4 sm:px-5 sm:py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors items-center"
                        >
                          {/* Result Badge */}
                          <div className="col-span-1 flex sm:justify-center">
                            <div
                              className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md
                            ${
                              won
                                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30"
                                : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/30"
                            }`}
                            >
                              {won ? "W" : "L"}
                            </div>
                          </div>

                          {/* Match Type */}
                          <div className="col-span-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                isFriendly
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
                                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30"
                              }`}
                            >
                              {isFriendly ? "FRD" : "TRN"}
                            </span>
                          </div>

                          {/* Format */}
                          <div className="col-span-1 flex sm:justify-center">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                              {formatLabel}
                            </span>
                          </div>

                          {/* Opponent */}
                          <div className="col-span-3">
                            <div className="flex flex-col gap-1.5">
                              {partner && (
                                <div className="flex items-center gap-2 mb-0.5 leading-none">
                                  <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 w-6 text-right">with</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); partner.id && setLocation(`/player/${partner.id}`); }} 
                                    className={`text-xs font-bold transition-colors text-left truncate ${getGenderColor(partner.gender)}`}
                                  >
                                    {partner.full_name}
                                  </button>
                                </div>
                              )}
                              {opponents.map((opp, i) => (
                                <div key={i} className="flex items-center gap-2 leading-none">
                                  {i === 0 ? (
                                    <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase w-6 text-right">vs</span>
                                  ) : (
                                    <span className="text-[10px] font-black text-rose-400/80 dark:text-rose-500/80 uppercase w-6 text-right">&</span>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); opp?.id && setLocation(`/player/${opp.id}`); }}
                                    className={`font-black transition-colors text-left truncate text-sm ${getGenderColor(opp?.gender)}`}
                                  >
                                    {opp?.full_name ?? "Unknown"}
                                  </button>
                                </div>
                              ))}
                            </div>
                            {m.round && m.round !== "Tournament" && m.round !== "Friendly" && (
                              <div className="text-[10px] text-slate-400 font-medium mt-1">
                                {m.round}
                              </div>
                            )}
                          </div>

                          {/* Score */}
                          <div className="col-span-3">
                            <div className="flex flex-col gap-1 items-start">
                              <BeautifulScoreDisplay score={m.match_score || m.score} />
                            </div>
                          </div>

                          {/* Date & Time & Share */}
                          <div className="col-span-3 flex items-center justify-end gap-3 text-right">
                            <div>
                              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {matchDate.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                {matchDate.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </div>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await shareMatch(m);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 rounded-lg transition-colors"
                              title="Share Match Result"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                      No{" "}
                      {matchHistoryFilter === "all" ? "" : matchHistoryFilter}{" "}
                      matches found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
