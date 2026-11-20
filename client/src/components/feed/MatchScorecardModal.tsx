import { resolveTeamMembers } from "@/lib/teamNames";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Swords, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { createPortal } from "react-dom";

interface MatchScorecardModalProps {
  match: any;
  isOpen: boolean;
  onClose: () => void;
}

export function MatchScorecardModal({ match, isOpen, onClose }: MatchScorecardModalProps) {
  if (!match) return null;

  const p1 = match.player1;
  const p2 = match.player2;
  // A partner with no linked player record returns null from the join, which
  // both hid them and made a doubles match look like singles. Resolve against
  // team*_label too. See lib/teamNames.
  const partner1 = match.partner1 ?? resolveTeamMembers(match.player1, match.partner1, match.team1_label)[1] ?? null;
  const partner2 = match.partner2 ?? resolveTeamMembers(match.player2, match.partner2, match.team2_label)[1] ?? null;
  // Parse set scores from match_score e.g. "21-15, 19-21, 21-18"
  const rawScore = match.match_score || match.score || "";
  const sets = rawScore.split(",").map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
    const parts = s.split("-");
    if (parts.length === 2) {
      return { p1: parseInt(parts[0]) || 0, p2: parseInt(parts[1]) || 0 };
    }
    return null;
  }).filter(Boolean);

  const isP1Winner = 
    match.winner_side === 1 || 
    (match.winner_id && (match.winner_id === p1?.id || match.winner_id === partner1?.id)) ||
    (match.winner_side === undefined && sets.filter((s: any) => s.p1 > s.p2).length > sets.filter((s: any) => s.p2 > s.p1).length);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 pb-24 sm:p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-media/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border-strong overflow-hidden max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary" />
                <h2 className="font-black text-foreground text-base">Match Scorecard</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-xl hover:bg-muted transition">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Category + Date */}
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(match.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {match.category || "Friendly"}
                </span>
              </div>

              {/* Players */}
              <div className="flex items-center justify-between gap-3">
                {/* Team 1 */}
                <div className={`flex-1 flex flex-col items-start justify-center gap-3 p-3 rounded-2xl transition-all ${isP1Winner ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/50"}`}>
                  <div className="flex items-center gap-2.5">
                    {p1?.avatar_url ? (
                      <img src={p1.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-foreground shadow shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted-strong flex items-center justify-center text-xs font-black text-muted-foreground border-2 border-foreground shadow shrink-0">
                        {p1?.full_name?.substring(0, 2).toUpperCase() || "??"}
                      </div>
                    )}
                    <span className="font-black text-sm text-foreground leading-tight text-left">{p1?.full_name}</span>
                  </div>

                  {partner1 && (
                    <div className="flex items-center gap-2.5">
                      {partner1.avatar_url ? (
                        <img src={partner1.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-foreground shadow shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted-strong flex items-center justify-center text-xs font-black text-muted-foreground border-2 border-foreground shadow shrink-0">
                          {partner1.full_name?.substring(0, 2).toUpperCase() || "??"}
                        </div>
                      )}
                      <span className="font-black text-sm text-foreground leading-tight text-left">{partner1.full_name}</span>
                    </div>
                  )}

                  {isP1Winner && (
                    <div className="w-full flex justify-center mt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1"><Trophy className="w-3 h-3" /> Winner</span>
                    </div>
                  )}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-foreground">
                    {sets.filter((s: any) => s.p1 > s.p2).length} — {sets.filter((s: any) => s.p2 > s.p1).length}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sets</span>
                </div>

                {/* Team 2 */}
                <div className={`flex-1 flex flex-col items-start justify-center gap-3 p-3 rounded-2xl transition-all ${!isP1Winner ? "bg-info/10 ring-2 ring-info" : "bg-muted/50"}`}>
                  <div className="flex items-center gap-2.5">
                    {p2?.avatar_url ? (
                      <img src={p2.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-foreground shadow shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted-strong flex items-center justify-center text-xs font-black text-muted-foreground border-2 border-foreground shadow shrink-0">
                        {p2?.full_name?.substring(0, 2).toUpperCase() || "??"}
                      </div>
                    )}
                    <span className="font-black text-sm text-foreground leading-tight text-left">{p2?.full_name}</span>
                  </div>

                  {partner2 && (
                    <div className="flex items-center gap-2.5">
                      {partner2.avatar_url ? (
                        <img src={partner2.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-foreground shadow shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted-strong flex items-center justify-center text-xs font-black text-muted-foreground border-2 border-foreground shadow shrink-0">
                          {partner2.full_name?.substring(0, 2).toUpperCase() || "??"}
                        </div>
                      )}
                      <span className="font-black text-sm text-foreground leading-tight text-left">{partner2.full_name}</span>
                    </div>
                  )}

                  {!isP1Winner && (
                    <div className="w-full flex justify-center mt-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-info flex items-center gap-1"><Trophy className="w-3 h-3" /> Winner</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Set-by-Set Breakdown */}
              {sets.length > 0 && (
                <div className="bg-muted/50 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2 bg-muted flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>{p1?.full_name?.split(" ")[0] || match.team1_label?.split(" ")[0] || "Team 1"}</span>
                    <span>Set</span>
                    <span>{p2?.full_name?.split(" ")[0] || match.team2_label?.split(" ")[0] || "Team 2"}</span>
                  </div>
                  {sets.map((s: any, i: number) => {
                    const p1Won = s.p1 > s.p2;
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border-strong/50 last:border-0">
                        <span className={`text-lg font-black w-10 text-center ${p1Won ? "text-primary" : "text-muted-foreground"}`}>{s.p1}</span>
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg">
                          {p1Won && <Trophy className="w-3 h-3 text-primary" />}
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SET {i + 1}</span>
                          {!p1Won && <Trophy className="w-3 h-3 text-info" />}
                        </div>
                        <span className={`text-lg font-black w-10 text-center ${!p1Won ? "text-info" : "text-muted-foreground"}`}>{s.p2}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ELO Changes */}
              {(match.elo_change_p1 != null || match.elo_change_p2 != null) && (
                <div className="flex gap-3">
                  {match.elo_change_p1 != null && (
                    <div className={`flex-1 flex flex-col items-center py-3 rounded-2xl text-center ${match.elo_change_p1 >= 0 ? "bg-primary/20" : "bg-danger/10"}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{p1?.full_name?.split(" ")[0]} ELO</span>
                      <span className={`text-xl font-black ${match.elo_change_p1 >= 0 ? "text-primary" : "text-danger"}`}>
                        {match.elo_change_p1 >= 0 ? "+" : ""}{match.elo_change_p1}
                      </span>
                    </div>
                  )}
                  {match.elo_change_p2 != null && (
                    <div className={`flex-1 flex flex-col items-center py-3 rounded-2xl text-center ${match.elo_change_p2 >= 0 ? "bg-primary/20" : "bg-danger/10"}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{p2?.full_name?.split(" ")[0]} ELO</span>
                      <span className={`text-xl font-black ${match.elo_change_p2 >= 0 ? "text-primary" : "text-danger"}`}>
                        {match.elo_change_p2 >= 0 ? "+" : ""}{match.elo_change_p2}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Court Path Tracing (singles only, v1) - Disabled temporarily */}

              {/* AI Match Analysis (Per-match AI Insights & Stroke Data) - Disabled temporarily */}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
