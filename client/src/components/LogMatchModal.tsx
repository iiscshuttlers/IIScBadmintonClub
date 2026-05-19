import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sword, Trophy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface LogMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Player;
  otherPlayers: Player[];
  onSuccess: () => void;
}

export default function LogMatchModal({ isOpen, onClose, currentUser, otherPlayers, onSuccess }: LogMatchModalProps) {
  const [opponentId, setOpponentId] = useState("");
  const [score, setScore] = useState("");
  const [winnerId, setWinnerId] = useState(currentUser.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentId) {
      setError("Please select an opponent.");
      return;
    }
    if (!score) {
      setError("Please enter the match score.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("submit_friendly_match", {
        submitter_id: currentUser.id,
        opponent_id: opponentId,
        match_winner_id: winnerId,
        match_score: score
      });

      if (rpcError) throw rpcError;

      alert("Match submitted! Waiting for opponent to confirm.");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log match.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const opponent = otherPlayers.find(p => p.id === opponentId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sword className="w-5 h-5 text-emerald-500" />
              Log Friendly Match
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Players VS */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden mb-2 shadow-md shrink-0">
                  {currentUser.avatar_url ? <img src={currentUser.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold">{currentUser.full_name[0]}</div>}
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{currentUser.full_name}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-500">You</span>
              </div>
              
              <div className="text-xl font-black italic text-slate-300 dark:text-slate-700 shrink-0">VS</div>
              
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden mb-2 shadow-md shrink-0">
                  {opponent ? (
                     opponent.avatar_url ? <img src={opponent.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold">{opponent.full_name[0]}</div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">?</div>
                  )}
                </div>
                <select 
                  value={opponentId}
                  onChange={(e) => setOpponentId(e.target.value)}
                  className="w-full max-w-[120px] text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select...</option>
                  {otherPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
                <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Opponent</span>
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Match Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Match Score</label>
                <input
                  type="text"
                  placeholder="e.g. 21-18, 19-21, 21-15"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Who won?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWinnerId(currentUser.id)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border ${winnerId === currentUser.id ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {winnerId === currentUser.id && <Trophy className="w-4 h-4" />}
                    I Won
                  </button>
                  <button
                    type="button"
                    disabled={!opponentId}
                    onClick={() => setWinnerId(opponentId)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border ${winnerId === opponentId ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'} ${!opponentId && 'opacity-50 cursor-not-allowed'}`}
                  >
                    {winnerId === opponentId && <Trophy className="w-4 h-4" />}
                    Opponent Won
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-bold text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 transition disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sword className="w-5 h-5" />}
              {loading ? 'Submitting...' : 'Submit Match for Verification'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
