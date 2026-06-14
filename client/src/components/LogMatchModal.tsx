import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sword,
  Trophy,
  Loader2,
  Users,
  User,
  Plus,
  Minus,
  Clock,
  Lock,
  Video,
  QrCode,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { toast } from "sonner";
import { QRCodeScannerModal } from "./QRCodeScannerModal";

interface Player {
  id: string;
  full_name: string;
  avatar_url?: string;
  gender?: string;
}

interface LogMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Player;
  otherPlayers: Player[];
  onSuccess: () => void;
  defaultOpponentId?: string;
  userEmail?: string;
}

function PlayerAvatar({ player }: { player: Player | undefined }) {
  if (!player)
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
        ?
      </div>
    );
  if (player.avatar_url)
    return (
      <img
        loading="lazy"
        src={player.avatar_url}
        className="w-full h-full object-cover"
      />
    );
  return (
    <div className="w-full h-full flex items-center justify-center text-xl font-bold">
      {player.full_name[0]}
    </div>
  );
}

function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  players: Player[];
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      if (p) setSearch(p.full_name);
    } else {
      setSearch("");
    }
  }, [value, players]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (value) {
          const p = players.find((p) => p.id === value);
          if (p) setSearch(p.full_name);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players]);

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder ?? "Search player..."}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          onChange(""); // Clear selection while searching
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {isOpen && (
        <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">
              No players found
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setSearch(p.full_name);
                  setIsOpen(false);
                }}
                className="p-2 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer text-slate-700 dark:text-slate-200"
              >
                {p.full_name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Determine doubles category from genders
function getDoublesCategory(players: (Player | undefined)[]): string {
  const genders = players.filter(Boolean).map((p) => p!.gender?.toLowerCase());
  if (genders.length < 2 || genders.some((g) => !g)) return "Doubles";
  const allMale = genders.every((g) => g === "male");
  const allFemale = genders.every((g) => g === "female");
  if (allMale) return "Men's Doubles";
  if (allFemale) return "Women's Doubles";
  return "Mixed Doubles";
}

interface SetScore {
  p1: string;
  p2: string;
}

export default function LogMatchModal({
  isOpen,
  onClose,
  currentUser,
  otherPlayers,
  onSuccess,
  defaultOpponentId,
  userEmail,
}: LogMatchModalProps) {
  const [matchType, setMatchType] = useState<"singles" | "doubles">("singles");
  const [matchCategory, setMatchCategory] = useState<"friendly" | "tournament">(
    "friendly",
  );
  const [opponentId, setOpponentId] = useState(defaultOpponentId ?? "");
  const [partnerId, setPartnerId] = useState("");
  const [opponentPartnerId, setOpponentPartnerId] = useState("");
  const [sets, setSets] = useState<SetScore[]>([{ p1: "", p2: "" }]);
  const [myTeamWon, setMyTeamWon] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [matchNotes, setMatchNotes] = useState("");
  const [recentOpponentIds, setRecentOpponentIds] = useState<string[]>([]);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"opponent" | "partner" | "opponentPartner">("opponent");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("recent_opponents") || "[]",
      );
      if (Array.isArray(stored)) setRecentOpponentIds(stored.slice(0, 3));
    } catch (e) {}

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    try {
      const q = JSON.parse(localStorage.getItem("offline_matches") || "[]");
      setOfflineQueueCount(q.length);
    } catch(e) {}

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isAdmin = isAdminEmail(userEmail);
  const now = new Date();
  const timestamp = now.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const addSet = () => {
    if (sets.length < 3) setSets([...sets, { p1: "", p2: "" }]);
  };

  const removeSet = (idx: number) => {
    if (sets.length > 1) setSets(sets.filter((_, i) => i !== idx));
  };

  const updateSet = (idx: number, field: "p1" | "p2", val: string) => {
    // Allow only digits 0-30
    const num = val.replace(/\D/g, "").slice(0, 2);
    setSets(
      sets.map((s, i) => {
        if (i === idx) {
          const next = { ...s, [field]: num };
          // Auto-fill opposite side with 0 if length is > 0 and opposite is empty
          if (num.length >= 2 && field === "p1" && !s.p2) next.p2 = "0";
          if (num.length >= 2 && field === "p2" && !s.p1) next.p1 = "0";
          return next;
        }
        return s;
      }),
    );
  };

  // Format sets into readable score string: "21-18, 19-21, 21-15"
  const formatScore = (): string => {
    return sets
      .filter((s) => s.p1 !== "" && s.p2 !== "")
      .map((s) => `${s.p1}-${s.p2}`)
      .join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentId) {
      setError("Please select the main opponent.");
      return;
    }
    if (matchType === "doubles" && !partnerId) {
      setError("Please select your doubles partner.");
      return;
    }
    if (matchType === "doubles" && !opponentPartnerId) {
      setError("Please select the opponent's partner.");
      return;
    }

    const filledSets = sets.filter((s) => s.p1 !== "" && s.p2 !== "");
    if (filledSets.length === 0) {
      setError("Please enter at least one set score.");
      return;
    }

    // Validate each set has reasonable scores
    let myTeamSetsWon = 0;
    let opponentSetsWon = 0;
    for (let i = 0; i < filledSets.length; i++) {
      const p1 = parseInt(filledSets[i].p1);
      const p2 = parseInt(filledSets[i].p2);
      if (isNaN(p1) || isNaN(p2)) {
        setError(`Set ${i + 1}: Invalid score.`);
        return;
      }
      if (p1 === p2) {
        setError(`Set ${i + 1}: Scores cannot be equal (a set must have a winner).`);
        return;
      }
      
      if (p1 > p2) myTeamSetsWon++;
      else opponentSetsWon++;

      const hi = Math.max(p1, p2);
      const lo = Math.min(p1, p2);
      // Badminton: must reach 21 (or 30 at deuce), and win by ≥2 unless at 29-30
      const validWin21 = hi >= 21 && hi - lo >= 2;
      const validDeuce = hi === 30 && lo === 29;
      const validShortSet = hi === 15; // 3rd set short
      if (!validWin21 && !validDeuce && !validShortSet) {
        setError(`Set ${i + 1}: Invalid badminton score (${p1}-${p2}). Winner must reach at least 21 and lead by 2, or win 30-29.`);
        return;
      }
    }

    if (myTeamWon && opponentSetsWon >= myTeamSetsWon) {
      setError(`You claimed victory, but the scores indicate you lost more sets (${opponentSetsWon}) than you won (${myTeamSetsWon}).`);
      return;
    }
    if (!myTeamWon && myTeamSetsWon >= opponentSetsWon) {
      setError(`You claimed defeat, but the scores indicate you won more sets (${myTeamSetsWon}) than you lost (${opponentSetsWon}).`);
      return;
    }

    // Strict Category Validation
    const opp = otherPlayers.find((p) => p.id === opponentId);
    if (matchType === "singles") {
      const g1 = currentUser.gender?.toLowerCase() || "unknown";
      const g2 = opp?.gender?.toLowerCase() || "unknown";
      if (g1 !== "unknown" && g2 !== "unknown" && g1 !== g2) {
        setError("Cross-gender Singles matches (MS vs WS) are not allowed.");
        return;
      }
    } else {
      const partner = otherPlayers.find((p) => p.id === partnerId);
      const oppPartner = otherPlayers.find((p) => p.id === opponentPartnerId);
      const g1 = currentUser.gender?.toLowerCase() || "unknown";
      const g2 = partner?.gender?.toLowerCase() || "unknown";
      const g3 = opp?.gender?.toLowerCase() || "unknown";
      const g4 = oppPartner?.gender?.toLowerCase() || "unknown";
      
      if (g1 !== "unknown" && g2 !== "unknown" && g3 !== "unknown" && g4 !== "unknown") {
        const t1Mixed = g1 !== g2;
        const t2Mixed = g3 !== g4;
        const t1Male = g1 === "male" && g2 === "male";
        const t2Male = g3 === "male" && g4 === "male";
        const t1Female = g1 === "female" && g2 === "female";
        const t2Female = g3 === "female" && g4 === "female";

        if ((t1Mixed !== t2Mixed) || (t1Male !== t2Male) || (t1Female !== t2Female)) {
           setError("Hybrid Doubles matches (e.g. MD vs XD) are not allowed.");
           return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const winnerId = myTeamWon ? currentUser.id : opponentId;
      const scoreStr = formatScore();

      let finalScore = scoreStr;
      if (matchType === "doubles") {
        const partnerName =
          otherPlayers.find((p) => p.id === partnerId)?.full_name ?? "";
        const opp1Name =
          otherPlayers.find((p) => p.id === opponentId)?.full_name ?? "";
        const opp2Name =
          otherPlayers.find((p) => p.id === opponentPartnerId)?.full_name ?? "";

        // Auto-detect category from genders
        const team1 = [
          currentUser,
          otherPlayers.find((p) => p.id === partnerId),
        ];
        const team2 = [
          otherPlayers.find((p) => p.id === opponentId),
          otherPlayers.find((p) => p.id === opponentPartnerId),
        ];
        const category = getDoublesCategory([...team1, ...team2]);

        finalScore = `${scoreStr} [${category}: ${currentUser.full_name}+${partnerName} vs ${opp1Name}+${opp2Name}]`;
      }

      if (videoUrl.trim()) {
        finalScore += ` | ${videoUrl.trim()}`;
      }
      if (matchNotes.trim()) {
        finalScore += ` [note: ${matchNotes.trim().slice(0, 120)}]`;
      }

      // Save to recent opponents
      try {
        const newRecents = Array.from(
          new Set([opponentId, ...recentOpponentIds]),
        ).slice(0, 3);
        localStorage.setItem("recent_opponents", JSON.stringify(newRecents));
      } catch (e) {}

      const offlinePayload = {
        submitter_id: currentUser.id,
        opponent_id: opponentId,
        match_winner_id: winnerId,
        match_score: finalScore,
        submitter_partner_id: matchType === "doubles" ? partnerId : null,
        opponent_partner_id: matchType === "doubles" ? opponentPartnerId : null,
        match_category: matchCategory, // Save category to handle later if offline
      };

      const rpcPayload = {
        submitter_id: currentUser.id,
        opponent_id: opponentId,
        match_winner_id: winnerId,
        match_score: finalScore,
        submitter_partner_id: matchType === "doubles" ? partnerId : null,
        opponent_partner_id: matchType === "doubles" ? opponentPartnerId : null,
      };

      if (!navigator.onLine) {
        // OFFLINE QUEUE LOGIC
        const existingQueue = JSON.parse(
          localStorage.getItem("offline_matches") || "[]",
        );
        existingQueue.push({ ...offlinePayload, timestamp: Date.now() });
        localStorage.setItem("offline_matches", JSON.stringify(existingQueue));

        toast.success(
          "You are offline. Match saved to Gym Mode queue and will auto-sync when internet is restored!",
          { duration: 5000 },
        );
        onSuccess();
        onClose();
        setLoading(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc(
        "submit_friendly_match",
        rpcPayload,
      );

      if (rpcError) throw rpcError;

      // If tournament match, also mark it as non-friendly directly
      // The RPC always inserts as is_friendly=true, so override for tournament
      if (matchCategory === "tournament") {
        // We need to update the match after creation — get latest pending match
        const { data: latestMatch } = await supabase
          .from("matches")
          .select("id")
          .eq("submitted_by", currentUser.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (latestMatch) {
          await supabase
            .from("matches")
            .update({ is_friendly: false, round: "Tournament" })
            .eq("id", latestMatch.id);
        }
      }

      if (myTeamWon) {
        toast.success("🎉 Incredible victory!");
      }

      toast.success(
        matchCategory === "friendly"
          ? "Match submitted! Waiting for opponent to confirm."
          : "Tournament match logged! Waiting for opponent to confirm.",
      );
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

  const opponent = otherPlayers.find((p) => p.id === opponentId);
  const availableAsPartner = otherPlayers.filter(
    (p) => p.id !== opponentId && p.id !== opponentPartnerId,
  );
  const availableAsOpponent = otherPlayers.filter((p) => p.id !== partnerId);
  const availableAsOppPartner = otherPlayers.filter(
    (p) => p.id !== opponentId && p.id !== partnerId,
  );

  return (
    <>
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
              Log {matchCategory === "tournament"
                ? "Tournament"
                : "Friendly"}{" "}
              Match
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {isOffline && (
              <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-3 text-amber-800 dark:text-amber-200">
                <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">You are offline (Gym Mode)</h4>
                  <p className="text-xs opacity-90 mt-0.5">Matches logged will be queued locally and synced automatically when internet is restored.</p>
                  {offlineQueueCount > 0 && (
                    <p className="text-xs font-black mt-1">{offlineQueueCount} match{offlineQueueCount > 1 ? "es" : ""} in queue waiting to sync.</p>
                  )}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
              <Clock className="w-3.5 h-3.5" /> Logging at:{" "}
              <span className="text-slate-700 dark:text-slate-200">
                {timestamp}
              </span>
            </div>

            {/* Friendly / Tournament toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatchCategory("friendly")}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition
                  ${matchCategory === "friendly" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}
              >
                🏸 Friendly
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) setMatchCategory("tournament");
                }}
                disabled={!isAdmin}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition
                  ${matchCategory === "tournament" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}
                  ${!isAdmin ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                🏆 Tournament {!isAdmin && <Lock className="w-3 h-3" />}
              </button>
            </div>
            {!isAdmin && matchCategory === "friendly" && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 -mt-3">
                Tournament match logging is admin-only
              </p>
            )}

            {/* Singles / Doubles toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatchType("singles")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition
                  ${matchType === "singles" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}
              >
                <User className="w-4 h-4" /> Singles
              </button>
              <button
                type="button"
                onClick={() => setMatchType("doubles")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition
                  ${matchType === "doubles" ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}
              >
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
                  <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {currentUser.full_name}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500">
                    You
                  </span>
                </div>
                <div className="text-xl font-black italic text-slate-300 dark:text-slate-700 shrink-0">
                  VS
                </div>
                <div className="flex-1 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden mb-2 shadow-md shrink-0">
                    <PlayerAvatar player={opponent} />
                  </div>
                  <PlayerSelect
                    value={opponentId}
                    onChange={setOpponentId}
                    players={otherPlayers}
                  />

                  {recentOpponentIds.length > 0 && !opponentId && (
                    <div className="flex gap-2 mt-3 justify-center">
                      {recentOpponentIds.map((id) => {
                        const op = otherPlayers.find((p) => p.id === id);
                        if (!op) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setOpponentId(id)}
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:scale-110 transition"
                          >
                            <img
                              src={op.avatar_url || ""}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setScanTarget("opponent");
                      setIsScanOpen(true);
                    }}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    <QrCode className="w-3 h-3" /> Scan QR
                  </button>

                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">
                    Opponent
                  </span>
                </div>
              </div>
            ) : (
              /* ---- DOUBLES ---- */
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                  Your Team
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar player={currentUser} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                      {currentUser.full_name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-500">
                      You
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-emerald-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar
                        player={otherPlayers.find((p) => p.id === partnerId)}
                      />
                    </div>
                    <PlayerSelect
                      value={partnerId}
                      onChange={setPartnerId}
                      players={availableAsPartner}
                      placeholder="Your partner"
                    />
                  </div>
                </div>

                <div className="text-center text-lg font-black italic text-slate-300 dark:text-slate-700">
                  VS
                </div>

                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                  Opponent Team
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar
                        player={otherPlayers.find((p) => p.id === opponentId)}
                      />
                    </div>
                    <PlayerSelect
                      value={opponentId}
                      onChange={setOpponentId}
                      players={availableAsOpponent}
                      placeholder="Opponent 1"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md shrink-0">
                      <PlayerAvatar
                        player={otherPlayers.find(
                          (p) => p.id === opponentPartnerId,
                        )}
                      />
                    </div>
                    <PlayerSelect
                      value={opponentPartnerId}
                      onChange={setOpponentPartnerId}
                      players={availableAsOppPartner}
                      placeholder="Opponent 2"
                    />
                  </div>
                </div>
              </div>
            )}

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Set-by-Set Score Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                  Set Scores
                </label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Enter scores per set (e.g. 21–18). Add sets for best-of-3 matches.
                </p>
              </div>

              {sets.map((set, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-12 shrink-0">
                    Set {idx + 1}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={set.p1}
                      onChange={(e) => updateSet(idx, "p1", e.target.value)}
                      placeholder="0"
                      className="w-14 text-center px-2 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-lg font-black text-slate-300 dark:text-slate-600">
                      —
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={set.p2}
                      onChange={(e) => updateSet(idx, "p2", e.target.value)}
                      placeholder="0"
                      className="w-14 text-center px-2 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm font-black text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  {sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {sets.length < 3 && (
                <button
                  type="button"
                  onClick={addSet}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Set
                </button>
              )}

              {/* Live Score Preview */}
              {formatScore() && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                  Score:{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {formatScore()}
                  </span>
                </div>
              )}
            </div>

            {/* Who Won */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Who won?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMyTeamWon(true)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border
                    ${myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                >
                  {myTeamWon && <Trophy className="w-4 h-4" />}
                  {matchType === "doubles" ? "My Team Won" : "I Won"}
                </button>
                <button
                  type="button"
                  onClick={() => setMyTeamWon(false)}
                  disabled={!opponentId}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border
                    ${!myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}
                    ${!opponentId ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {!myTeamWon && <Trophy className="w-4 h-4" />}
                  {matchType === "doubles" ? "They Won" : "Opponent Won"}
                </button>
              </div>
            </div>

            {/* Video Highlight Link */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Match Highlight (Optional)
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="YouTube or Video Link"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Match Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Match Note (Optional)
              </label>
              <textarea
                value={matchNotes}
                onChange={(e) => setMatchNotes(e.target.value)}
                placeholder="Epic 3-setter! Great comeback in the 3rd... (max 120 chars)"
                maxLength={120}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              {matchNotes.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-1 text-right">{matchNotes.length}/120</p>
              )}
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
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sword className="w-5 h-5" />
              )}
              {loading ? "Submitting..." : "Submit Match for Verification"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>

      <QRCodeScannerModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onScan={(id) => {
          if (scanTarget === "opponent") setOpponentId(id);
          else if (scanTarget === "partner") setPartnerId(id);
          else if (scanTarget === "opponentPartner") setOpponentPartnerId(id);
        }}
      />
    </>
  );
}
