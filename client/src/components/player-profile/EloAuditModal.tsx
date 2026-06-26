import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, AlertTriangle, ChevronDown, Calendar, Search, Filter } from "lucide-react";
import { format } from "date-fns";

interface EloAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: any[];
  playerId: string;
}

export function EloAuditModal({ isOpen, onClose, matches, playerId }: EloAuditModalProps) {
  if (!isOpen) return null;

  const getEloChange = (match: any) => {
    if (match.player1_id === playerId) return match.elo_change_p1;
    if (match.player2_id === playerId) return match.elo_change_p2;
    if (match.team1_partner_id === playerId) return match.elo_change_p3;
    if (match.team2_partner_id === playerId) return match.elo_change_p4;
    return 0;
  };

  const getFirstName = (name: string) => name ? name.split(" ")[0] : "";

  let totalChange = 0;
  let singlesChange = 0;
  let doublesChange = 0;
  let mixedChange = 0;

  const validMatches = matches
    .filter((m) => m.status === "confirmed" && getEloChange(m) !== undefined && getEloChange(m) !== null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  validMatches.forEach(m => {
    const change = getEloChange(m) || 0;
    totalChange += change;

    const isSingles = !m.team1_partner_id && !m.team2_partner_id;
    if (isSingles) {
      singlesChange += change;
    } else {
      const allGenders = [m.player1?.gender, m.player2?.gender, m.partner1?.gender, m.partner2?.gender]
         .map(g => (g || '').toLowerCase())
         .filter(Boolean);
      const isMixed = allGenders.includes('male') && allGenders.includes('female');
      if (isMixed) {
        mixedChange += change;
      } else {
        doublesChange += change;
      }
    }
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                ELO Audit Log
              </h2>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-1">
                Transparent Match Impact
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary Strip */}
          <div className="bg-slate-100 dark:bg-slate-800/50 px-6 py-3 shrink-0 flex gap-4 overflow-x-auto hide-scrollbar border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Overall</span>
              <span className={`text-sm font-black ${totalChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totalChange > 0 ? "+" : ""}{totalChange}
              </span>
            </div>
            <div className="w-px bg-slate-300 dark:bg-slate-700 my-1" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Singles</span>
              <span className={`text-sm font-black ${singlesChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {singlesChange > 0 ? "+" : ""}{singlesChange}
              </span>
            </div>
            <div className="w-px bg-slate-300 dark:bg-slate-700 my-1" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Doubles</span>
              <span className={`text-sm font-black ${doublesChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {doublesChange > 0 ? "+" : ""}{doublesChange}
              </span>
            </div>
            <div className="w-px bg-slate-300 dark:bg-slate-700 my-1" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mixed</span>
              <span className={`text-sm font-black ${mixedChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {mixedChange > 0 ? "+" : ""}{mixedChange}
              </span>
            </div>
          </div>

          <div className="overflow-y-auto p-4 space-y-2 flex-1 bg-slate-50/50 dark:bg-slate-950">
            {validMatches.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-sm">No competitive match data found.</p>
              </div>
            ) : (
              validMatches.map((m) => {
                const change = getEloChange(m);
                const isPositive = change > 0;
                const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
                
                const isSingles = !m.team1_partner_id && !m.team2_partner_id;
                const allGenders = [m.player1?.gender, m.player2?.gender, m.partner1?.gender, m.partner2?.gender].map(g => (g || '').toLowerCase()).filter(Boolean);
                const isMixed = allGenders.includes('male') && allGenders.includes('female');
                const formatLabel = isSingles ? "S" : (isMixed ? "XD" : "D");
                
                const opponentPlayer = isTeam1 ? m.player2 : m.player1;
                const opponentPartner = isTeam1 ? m.partner2 : m.partner1;
                
                let ownPartner = null;
                if (!isSingles) {
                  if (isTeam1) ownPartner = (m.player1_id === playerId) ? m.partner1 : m.player1;
                  else ownPartner = (m.player2_id === playerId) ? m.partner2 : m.player2;
                }
                
                const opponentStr = [opponentPlayer?.full_name, opponentPartner?.full_name]
                  .filter(Boolean)
                  .map(n => getFirstName(n))
                  .join(" & ");

                const cleanScore = m.score 
                  ? m.score.replace(/\[.*?\]/g, '').trim()
                  : "";

                return (
                  <div key={m.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {formatLabel}
                          {m.is_friendly ? " • F" : ""}
                        </span>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 truncate">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(m.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate flex items-center gap-2">
                        <span><span className="text-[10px] uppercase text-rose-500/70 mr-1">vs</span>{opponentStr}</span>
                        {ownPartner && (
                          <span className="text-xs text-slate-400 font-medium ml-1">
                            <span className="text-[9px] uppercase text-sky-500/70 mr-1">with</span>{getFirstName(ownPartner.full_name)}
                          </span>
                        )}
                      </div>
                      {cleanScore && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cleanScore.split(',').map((s: string, i: number) => {
                            const setScore = s.trim();
                            if (!setScore) return null;
                            return (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-black tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {setScore}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className={`shrink-0 flex items-center justify-center min-w-[3.5rem] px-3 py-1.5 rounded-xl font-black text-sm border shadow-sm ${
                      isPositive 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" 
                        : "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400"
                    }`}>
                      {isPositive ? "+" : ""}{change}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
