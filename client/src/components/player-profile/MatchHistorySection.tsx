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

function getRoundLabel(m: any): string | null {
  if (m.is_friendly !== false) return null; // friendly matches don't have rounds usually, or we hide them
  if (m.round_name) return m.round_name;
  if (m.match_code) {
    const parts = m.match_code.split('_');
    if (parts.length >= 3) {
      const r = parts[1];
      if (r === 'F') return 'Final';
      if (r === 'SF') return 'Semifinal';
      if (r === 'QF') return 'Quarterfinal';
      if (r === '3P') return '3rd Place';
    }
  }
  if (m.round && m.round !== "Tournament" && m.round !== "Friendly") {
    return typeof m.round === 'number' || !isNaN(Number(m.round)) ? `Round ${m.round}` : m.round;
  }
  return null;
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
  defaultOpen?: boolean;
}

export function MatchHistorySection({
  id,
  liveMatches,
  ownPlayerProfile,
  defaultOpen = true,
}: MatchHistorySectionProps) {
  const [, setLocation] = useLocation();
  const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(defaultOpen);
  const [matchHistoryFilter, setMatchHistoryFilter] = useState<
    "all" | "friendly" | "tournament"
  >("tournament");

  const confirmedMatches = liveMatches.filter((m) => m.status === "confirmed" || m.status === "completed");
  if (confirmedMatches.length === 0)
    return null;

  const getGenderColor = (gender?: string | null) => {
    const g = gender?.toLowerCase() || '';
    if (g === 'female') return 'text-warning hover:text-warning/80';
    if (g === 'male') return 'text-info hover:text-info/80';
    return 'text-foreground hover:text-primary';
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
        className="w-full bg-muted/80 rounded-3xl shadow-xl shadow-media/40 dark:shadow-none border border-border-strong/50 p-5 sm:p-6 flex items-center justify-between gap-4 text-left hover:border-info/35 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-info/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-info" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-foreground">
              Match History
            </h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] sm:text-xs font-bold">
              <span className="px-2 py-0.5 rounded-full bg-info/20 text-info">
                {confirmedMatches.length} matches
              </span>
            </div>
          </div>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${isMatchHistoryOpen ? "rotate-90" : ""}`}
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
                <div className="mb-4 ml-2 bg-gradient-to-r from-muted to-muted/50 rounded-2xl p-4 border border-border-strong shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,63,94,0.05),transparent)] pointer-events-none" />
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2 relative z-10">
                    <Swords className="w-4 h-4 text-danger" /> Head-to-Head vs
                    You
                  </div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="text-center flex-1">
                      <div className="text-3xl font-black text-danger">
                        {h2hWins}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                        Their Wins
                      </div>
                    </div>
                    <div className="w-px h-10 bg-muted-strong mx-4" />
                    <div className="text-center flex-1">
                      <div className="text-3xl font-black text-primary">
                        {h2hLosses}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                        Your Wins
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-muted-strong relative z-10">
                    <div
                      style={{
                        width: `${(h2hWins / h2hMatches.length) * 100}%`,
                      }}
                      className="bg-danger transition-all duration-1000"
                    />
                    <div
                      style={{
                        width: `${(h2hLosses / h2hMatches.length) * 100}%`,
                      }}
                      className="bg-primary transition-all duration-1000"
                    />
                  </div>
                </div>
              )}

              {/* Filter Tabs temporarily removed to show only tournament matches */}

              {/* Match List — BWF table style */}
              <div className="bg-muted/80 rounded-3xl shadow-xl shadow-media/40 dark:shadow-none border border-border-strong/50 overflow-hidden">
                {/* Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border-strong/50">
                  <div className="col-span-1 text-center">Result</div>
                  <div className="col-span-2">Match Details</div>
                  <div className="col-span-3">Opponent</div>
                  <div className="col-span-3">Score</div>
                  <div className="col-span-3 text-right">Date & Time</div>
                </div>

                <div className="divide-y divide-border-strong/50">
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
                      const oppTeamLabel = isTeam1 ? m.team2_label : m.team1_label;
                      if (isTeam1) {
                        if (m.player2) opponents.push(m.player2);
                        if (m.partner2) opponents.push(m.partner2);
                      } else {
                        if (m.player1) opponents.push(m.player1);
                        if (m.partner1) opponents.push(m.partner1);
                      }

                      if (opponents.length === 0) {
                        const labelStr = (oppTeamLabel || "").toUpperCase();
                        if (labelStr.includes("BYE") || labelStr === "BYE") {
                          opponents.push({ id: "bye", full_name: "BYE", gender: "unknown" });
                        } else if (labelStr) {
                          opponents.push({ id: "tbd", full_name: oppTeamLabel, gender: "unknown" });
                        }
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
                        ? "bg-primary/30 text-primary border-primary/50" 
                        : "bg-danger/10 text-danger border-danger/25";

                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-2 p-4 sm:px-5 sm:py-4 hover:bg-muted/40 transition-colors sm:items-center relative"
                        >
                          {/* Mobile Top Row & Desktop Col 1-3 */}
                          <div className="flex items-start justify-between sm:contents">
                            <div className="flex items-center gap-3 sm:contents">
                              {/* Result Badge */}
                              <div className="sm:col-span-1 flex sm:justify-center shrink-0">
                                <div
                                  className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm
                                ${
                                  won
                                    ? "bg-gradient-to-br from-success to-success text-on-accent shadow-success/30"
                                    : "bg-gradient-to-br from-danger to-danger text-on-accent shadow-danger/30"
                                }`}
                                >
                                  {won ? "W" : "L"}
                                </div>
                              </div>

                              {/* Type & Format & Round */}
                              <div className="sm:col-span-2 flex flex-col justify-center items-start gap-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-sm ${
                                      isFriendly
                                        ? "bg-gradient-to-r from-info to-info text-on-accent shadow-info/20 border border-info/20"
                                        : "bg-gradient-to-r from-warning to-secondary text-on-accent shadow-warning/20 border border-warning/20"
                                    }`}
                                  >
                                    {isFriendly ? "FRD" : "TRN"}
                                  </span>
                                  <span className="text-[10px] font-black text-muted-foreground uppercase">
                                    {formatLabel}
                                  </span>
                                </div>
                                {(() => {
                                  const roundLabel = getRoundLabel(m);
                                  if (!roundLabel) return null;
                                  return (
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                      {roundLabel}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Mobile Date */}
                            <div className="sm:hidden flex flex-col items-end">
                              <div className="text-[10px] font-bold text-muted-foreground">
                                {matchDate.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "2-digit",
                                })}
                              </div>
                              <div className="text-[9px] font-medium text-muted-foreground">
                                {matchDate.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Opponent */}
                          <div className="sm:col-span-3 mt-1 sm:mt-0">
                            <div className="flex flex-col gap-1.5">
                              {partner && (
                                <div className="flex items-center gap-2 mb-0.5 leading-none">
                                  <span className="text-[9px] font-black text-muted-foreground uppercase w-6 text-right">with</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); partner.id && setLocation(`/player/${partner.id}`); }} 
                                    className={`text-sm font-bold transition-colors text-left truncate ${getGenderColor(partner.gender)}`}
                                  >
                                    {partner.full_name}
                                  </button>
                                </div>
                              )}
                              {opponents.map((opp, i) => (
                                <div key={i} className="flex items-center gap-2 leading-none">
                                  {i === 0 ? (
                                    <span className="text-[9px] font-black text-muted-foreground uppercase w-6 text-right">vs</span>
                                  ) : (
                                    <span className="text-[9px] font-black text-muted-foreground uppercase w-6 text-right">&</span>
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
                          </div>

                          {/* Score & Mobile Share */}
                          <div className="sm:col-span-3 mt-1 sm:mt-0 flex items-center justify-between sm:block">
                            <div className="flex flex-col gap-1 items-start">
                              <BeautifulScoreDisplay score={m.match_score || m.score} />
                            </div>
                            {/* Mobile Share */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await shareMatch(m);
                              }}
                              className="sm:hidden p-2 text-muted-foreground hover:text-primary hover:bg-primary/20 rounded-full transition-colors ml-auto -mr-2"
                              title="Share Match Result"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Desktop Date & Time & Share */}
                          <div className="hidden sm:col-span-3 sm:flex items-center justify-end gap-3 text-right">
                            <div>
                              <div className="text-xs font-bold text-soft">
                                {matchDate.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-medium">
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
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/20 rounded-lg transition-colors"
                              title="Share Match Result"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-sm text-muted-foreground italic">
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
