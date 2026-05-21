import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sword, Trophy, Loader2, Users, User } from "lucide-react";
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
  defaultOpponentId?: string;
}

function PlayerAvatar({ player }: { player: Player | undefined }) {
  if (!player) return <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">?</div>;
  if (player.avatar_url) return <img loading="lazy" src={player.avatar_url} className="w-full h-full object-cover" />;
  return <div className="w-full h-full flex items-center justify-center text-xl font-bold">{player.full_name[0]}</div>;
}

function PlayerSelect({ value, onChange, players, placeholder }: {
  value: string; onChange: (v: string) => void;
  players: Player[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
    >
      <option value="">{placeholder ?? "Select..."}</option>
      {players.map(p => (
        <option key={p.id} value={p.id}>{p.full_name}</option>
      ))}
    </select>
  );
}

export default function LogMatchModal({ isOpen, onClose, currentUser, otherPlayers, onSuccess, defaultOpponentId }: LogMatchModalProps) {
  const [matchType, setMatchType] = useState<"singles" | "doubles">("singles");
  const [opponentId, setOpponentId] = useState(defaultOpponentId ?? "");
  const [partnerId, setPartnerId] = useState("");
  const [opponentPartnerId, setOpponentPartnerId] = useState("");
  const [score, setScore] = useState("");
  const [myTeamWon, setMyTeamWon] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentId) { setError("Please select the main opponent."); return; }
    if (matchType === "doubles" && !partnerId) { setError("Please select your doubles partner."); return; }
    if (matchType === "doubles" && !opponentPartnerId) { setError("Please select the opponent's partner."); return; }
    if (!score) { setError("Please enter the match score."); return; }

    setLoading(true);
    setError(null);

    try {
      const winnerId = myTeamWon ? currentUser.id : opponentId;
      const scoreWithDoubles = matchType === "doubles"
        ? `${score} [Doubles: ${currentUser.full_name}+${otherPlayers.find(p => p.id === partnerId)?.full_name ?? ""} vs ${otherPlayers.find(p => p.id === opponentId)?.full_name ?? ""}+${otherPlayers.find(p => p.id === opponentPartnerId)?.full_name ?? ""}]`
        : score;

      const { error: rpcError } = await supabase.rpc("submit_friendly_match", {
        submitter_id: currentUser.id,
        opponent_id: opponentId,
        match_winner_id: winnerId,
        match_score: scoreWithDoubles,
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
  const availableAsPartner = otherPlayers.filter(p => p.id !== opponentId && p.id !== opponentPartnerId);
  const availableAsOpponent = otherPlayers.filter(p => p.id !== partnerId);
  const availableAsOppPartner = otherPlayers.filter(p => p.id !== opponentId && p.id !== partnerId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
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
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Singles / Doubles toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMatchType("singles")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition
                  ${matchType === "singles" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                <User className="w-4 h-4" /> Singles
              </button>
              <button type="button" onClick={() => setMatchType("doubles")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition
                  ${matchType === "doubles" ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                <Users className="w-4 h-4" /> Doubles
              </button>
            </div>

            {/* Players section */}
            {matchType === "singles" ? (
              /* ---- SINGLES ---- */
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden mb-2 shadow-md shrink-0">
                    <PlayerAvatar player={currentUser} />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{currentUser.full_name}</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500">You</span>
                </div>
                <div className="text-xl font-black italic text-slate-300 dark:text-slate-700 shrink-0">VS</div>
                <div className="flex-1 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden mb-2 shadow-md shrink-0">
                    <PlayerAvatar player={opponent} />
                  </div>
                  <PlayerSelect value={opponentId} onChange={setOpponentId} players={otherPlayers} />
                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Opponent</span>
                </div>
              </div>
            ) : (
              /* ---- DOUBLES ---- */
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Your Team</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar player={currentUser} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{currentUser.full_name}</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-500">You</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-emerald-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar player={otherPlayers.find(p => p.id === partnerId)} />
                    </div>
                    <PlayerSelect value={partnerId} onChange={setPartnerId} players={availableAsPartner} placeholder="Your partner" />
                  </div>
                </div>

                <div className="text-center text-lg font-black italic text-slate-300 dark:text-slate-700">VS</div>

                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Opponent Team</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar player={otherPlayers.find(p => p.id === opponentId)} />
                    </div>
                    <PlayerSelect value={opponentId} onChange={setOpponentId} players={availableAsOpponent} placeholder="Opponent 1" />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar player={otherPlayers.find(p => p.id === opponentPartnerId)} />
                    </div>
                    <PlayerSelect value={opponentPartnerId} onChange={setOpponentPartnerId} players={availableAsOppPartner} placeholder="Opponent 2" />
                  </div>
                </div>
              </div>
            )}

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
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Who won?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setMyTeamWon(true)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border
                      ${myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                    {myTeamWon && <Trophy className="w-4 h-4" />}
                    {matchType === "doubles" ? "My Team Won" : "I Won"}
                  </button>
                  <button type="button" onClick={() => setMyTeamWon(false)} disabled={!opponentId}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border
                      ${!myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}
                      ${!opponentId ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {!myTeamWon && <Trophy className="w-4 h-4" />}
                    {matchType === "doubles" ? "They Won" : "Opponent Won"}
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
              {loading ? "Submitting..." : "Submit Match for Verification"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
