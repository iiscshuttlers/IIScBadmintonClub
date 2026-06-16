import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Swords, TrendingUp, TrendingDown, Calendar, Flag, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { createPortal } from "react-dom";

interface MatchScorecardModalProps {
  match: any;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
}

export function MatchScorecardModal({ match, isOpen, onClose, currentUser }: MatchScorecardModalProps) {
  const [disputing, setDisputing] = useState(false);
  const [disputed, setDisputed] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  if (!match) return null;

  const p1 = match.player1;
  const p2 = match.player2;
  const partner1 = match.partner1;
  const partner2 = match.partner2;
  const isDoubles = !!partner1 || !!partner2;
  const isP1Winner = match.winner_id === p1?.id || match.winner_id === partner1?.id;

  // Parse set scores from match_score e.g. "21-15, 19-21, 21-18"
  const rawScore = match.match_score || match.score || "";
  const sets = rawScore.split(",").map((s: string) => s.trim()).filter(Boolean).map((s: string) => {
    const parts = s.split("-");
    if (parts.length === 2) {
      return { p1: parseInt(parts[0]) || 0, p2: parseInt(parts[1]) || 0 };
    }
    return null;
  }).filter(Boolean);

  const isPlayerInMatch = currentUser && (
    match.player1_id === currentUser.id ||
    match.player2_id === currentUser.id ||
    match.team1_partner_id === currentUser.id ||
    match.team2_partner_id === currentUser.id
  );

  const handleDispute = async () => {
    if (!disputeReason.trim()) { toast.error("Please explain the dispute"); return; }
    setDisputing(true);
    try {
      // Insert into notifications for admins — they'll see it in the admin panel
      await supabase.from("notifications").insert({
        user_id: match.player1_id, // admin will filter by type
        title: "⚠️ Match Disputed",
        message: `Match #${match.id.slice(0, 8)} disputed by a player: "${disputeReason}"`,
        type: "match_dispute",
        link: `/feed`,
      });
      // Flag the match
      await supabase.from("matches").update({ is_disputed: true, dispute_reason: disputeReason }).eq("id", match.id);
      setDisputed(true);
      setShowDisputeForm(false);
      toast.success("Dispute filed. Admins will review.");
    } catch {
      toast.error("Failed to file dispute");
    } finally {
      setDisputing(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-emerald-500" />
                <h2 className="font-black text-slate-800 dark:text-white text-base">Match Scorecard</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Category + Date */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(match.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {match.category || "Friendly"}
                </span>
              </div>

              {/* Players */}
              <div className="flex items-center justify-between gap-3">
                {/* Team 1 */}
                <div className={`flex-1 flex flex-col items-center text-center p-3 rounded-2xl transition-all ${isP1Winner ? "bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-400" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                  {p1?.avatar_url ? (
                    <img src={p1.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow mb-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-2" />
                  )}
                  <span className="font-black text-sm text-slate-800 dark:text-white line-clamp-1">{p1?.full_name}</span>
                  {partner1 && <span className="text-[10px] text-slate-400 mt-0.5">& {partner1.full_name}</span>}
                  {isP1Winner && <span className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1"><Trophy className="w-3 h-3" /> Winner</span>}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-slate-800 dark:text-white">
                    {sets.filter((s: any) => s.p1 > s.p2).length} — {sets.filter((s: any) => s.p2 > s.p1).length}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sets</span>
                </div>

                {/* Team 2 */}
                <div className={`flex-1 flex flex-col items-center text-center p-3 rounded-2xl transition-all ${!isP1Winner ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400" : "bg-slate-50 dark:bg-slate-800/50"}`}>
                  {p2?.avatar_url ? (
                    <img src={p2.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow mb-2" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-2" />
                  )}
                  <span className="font-black text-sm text-slate-800 dark:text-white line-clamp-1">{p2?.full_name}</span>
                  {partner2 && <span className="text-[10px] text-slate-400 mt-0.5">& {partner2.full_name}</span>}
                  {!isP1Winner && <span className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1"><Trophy className="w-3 h-3" /> Winner</span>}
                </div>
              </div>

              {/* Set-by-Set Breakdown */}
              {sets.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>{p1?.full_name?.split(" ")[0]}</span>
                    <span>Set</span>
                    <span>{p2?.full_name?.split(" ")[0]}</span>
                  </div>
                  {sets.map((s: any, i: number) => {
                    const p1Won = s.p1 > s.p2;
                    return (
                      <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <span className={`text-lg font-black w-10 text-center ${p1Won ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>{s.p1}</span>
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          {p1Won && <Trophy className="w-3 h-3 text-emerald-500" />}
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SET {i + 1}</span>
                          {!p1Won && <Trophy className="w-3 h-3 text-blue-500" />}
                        </div>
                        <span className={`text-lg font-black w-10 text-center ${!p1Won ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}>{s.p2}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ELO Changes */}
              {(match.elo_change_p1 != null || match.elo_change_p2 != null) && (
                <div className="flex gap-3">
                  {match.elo_change_p1 != null && (
                    <div className={`flex-1 flex flex-col items-center py-3 rounded-2xl text-center ${match.elo_change_p1 >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20"}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{p1?.full_name?.split(" ")[0]} ELO</span>
                      <span className={`text-xl font-black ${match.elo_change_p1 >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {match.elo_change_p1 >= 0 ? "+" : ""}{match.elo_change_p1}
                      </span>
                    </div>
                  )}
                  {match.elo_change_p2 != null && (
                    <div className={`flex-1 flex flex-col items-center py-3 rounded-2xl text-center ${match.elo_change_p2 >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20"}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{p2?.full_name?.split(" ")[0]} ELO</span>
                      <span className={`text-xl font-black ${match.elo_change_p2 >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {match.elo_change_p2 >= 0 ? "+" : ""}{match.elo_change_p2}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Dispute Section */}
              {isPlayerInMatch && !disputed && (
                <div>
                  {!showDisputeForm ? (
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-rose-300 hover:text-rose-500 dark:hover:border-rose-700 dark:hover:text-rose-400 transition-all"
                    >
                      <Flag className="w-3.5 h-3.5" /> Dispute this score
                    </button>
                  ) : (
                    <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-200 dark:border-rose-800">
                      <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-2"><Flag className="w-4 h-4" /> File a Dispute</h4>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Explain what was incorrect about this score..."
                        rows={3}
                        className="w-full text-sm bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-xl p-3 outline-none resize-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setShowDisputeForm(false)} className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                          Cancel
                        </button>
                        <button
                          onClick={handleDispute}
                          disabled={disputing}
                          className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white transition disabled:opacity-50"
                        >
                          {disputing ? "Filing..." : "Submit Dispute"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {disputed && (
                <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Dispute filed — admins will review.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
