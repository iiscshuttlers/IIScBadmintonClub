import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sword, Trophy, Loader2, Users, User, Plus, Minus,
  Clock, Lock, QrCode, WifiOff, ChevronRight, ChevronLeft, Check, Wifi,
} from "lucide-react";
import QRCode from "react-qr-code";
import { Capacitor } from "@capacitor/core";
import { SwipeToConfirm } from "@/components/ui/SwipeToConfirm";
import { enqueueOfflineMatch } from "@/lib/offlineQueue";
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
    return <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">?</div>;
  if (player.avatar_url)
    return <img loading="lazy" src={player.avatar_url} className="w-full h-full object-cover" />;
  return <div className="w-full h-full flex items-center justify-center text-xl font-bold">{player.full_name[0]}</div>;
}

function PlayerSelect({
  value, onChange, players, placeholder,
}: { value: string; onChange: (v: string) => void; players: Player[]; placeholder?: string }) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const p = players.find((p) => p.id === value);
      if (p) setSearch(p.full_name);
    } else setSearch("");
  }, [value, players]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (value) {
          const p = players.find((p) => p.id === value);
          if (p) setSearch(p.full_name);
        } else setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, players]);

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder ?? "Search player..."}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); onChange(""); }}
        onFocus={() => setIsOpen(true)}
        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {isOpen && (
        <div className="absolute z-60 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">No players found</div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => { onChange(p.id); setSearch(p.full_name); setIsOpen(false); }}
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

function getDoublesCategory(players: (Player | undefined)[]): string {
  const genders = players.filter(Boolean).map((p) => p!.gender?.toLowerCase());
  if (genders.length < 2 || genders.some((g) => !g)) return "Doubles";
  const allMale = genders.every((g) => g === "male");
  const allFemale = genders.every((g) => g === "female");
  if (allMale) return "Men's Doubles";
  if (allFemale) return "Women's Doubles";
  return "Mixed Doubles";
}

interface SetScore { p1: string; p2: string; }

// ── Wizard step indicator ─────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const steps = ["Setup", "Scores", "Submit"];
  return (
    <div className="flex items-center gap-1 px-6 pt-4 pb-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-emerald-600 text-white ring-2 ring-emerald-300 dark:ring-emerald-700" : "bg-slate-200 dark:bg-slate-700 text-slate-400"}`}>
            {i < step ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span className={`text-[10px] font-bold whitespace-nowrap ${i === step ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>{label}</span>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 rounded transition-all ${i < step ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function LogMatchModal({
  isOpen, onClose, currentUser, otherPlayers, onSuccess, defaultOpponentId, userEmail,
}: LogMatchModalProps) {
  const [step, setStep] = useState(0);
  const [matchType, setMatchType] = useState<"singles" | "doubles">("singles");
  const [matchCategory, setMatchCategory] = useState<"friendly" | "tournament">("friendly");
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
  const [isMyQROpen, setIsMyQROpen] = useState(false);
  const [isNFCOpen, setIsNFCOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"opponent" | "partner" | "opponentPartner">("opponent");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("recent_opponents") || "[]");
      if (Array.isArray(stored)) setRecentOpponentIds(stored.slice(0, 3));
    } catch (e) {}

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    try {
      const q = JSON.parse(localStorage.getItem("offline_matches") || "[]");
      setOfflineQueueCount(q.length);
    } catch (e) {}
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Reset wizard state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setError(null);
    }
  }, [isOpen]);

  const isAdmin = isAdminEmail(userEmail);
  const now = new Date();
  const timestamp = now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  const addSet = () => { if (sets.length < 3) setSets([...sets, { p1: "", p2: "" }]); };
  const removeSet = (idx: number) => { if (sets.length > 1) setSets(sets.filter((_, i) => i !== idx)); };
  const updateSet = (idx: number, field: "p1" | "p2", val: string) => {
    const num = val.replace(/\D/g, "").slice(0, 2);
    setSets(sets.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, [field]: num };
      if (num.length >= 2 && field === "p1" && !s.p2) next.p2 = "0";
      if (num.length >= 2 && field === "p2" && !s.p1) next.p1 = "0";
      return next;
    }));
  };

  const formatScore = (): string =>
    sets.filter((s) => s.p1 !== "" && s.p2 !== "").map((s) => `${s.p1}-${s.p2}`).join(", ");

  const opponent = otherPlayers.find((p) => p.id === opponentId);
  const availableAsPartner = otherPlayers.filter((p) => p.id !== opponentId && p.id !== opponentPartnerId);
  const availableAsOpponent = otherPlayers.filter((p) => p.id !== partnerId);
  const availableAsOppPartner = otherPlayers.filter((p) => p.id !== opponentId && p.id !== partnerId);

  // ── Step 0 validation ──────────────────────────────────────
  const validateStep0 = (): string | null => {
    if (!opponentId) return "Please select the main opponent.";
    if (matchType === "doubles" && !partnerId) return "Please select your doubles partner.";
    if (matchType === "doubles" && !opponentPartnerId) return "Please select the opponent's partner.";

    const opp = otherPlayers.find((p) => p.id === opponentId);
    if (matchType === "singles") {
      const g1 = currentUser.gender?.toLowerCase() || "unknown";
      const g2 = opp?.gender?.toLowerCase() || "unknown";
      if (g1 !== "unknown" && g2 !== "unknown" && g1 !== g2)
        return "Cross-gender Singles matches (MS vs WS) are not allowed.";
    } else {
      const partner = otherPlayers.find((p) => p.id === partnerId);
      const oppPartner = otherPlayers.find((p) => p.id === opponentPartnerId);
      const [g1, g2, g3, g4] = [
        currentUser.gender?.toLowerCase() || "unknown",
        partner?.gender?.toLowerCase() || "unknown",
        opp?.gender?.toLowerCase() || "unknown",
        oppPartner?.gender?.toLowerCase() || "unknown",
      ];
      if (![g1, g2, g3, g4].includes("unknown")) {
        const t1Mixed = g1 !== g2, t2Mixed = g3 !== g4;
        const t1Male = g1 === "male" && g2 === "male", t2Male = g3 === "male" && g4 === "male";
        const t1Female = g1 === "female" && g2 === "female", t2Female = g3 === "female" && g4 === "female";
        if (t1Mixed !== t2Mixed || t1Male !== t2Male || t1Female !== t2Female)
          return "Hybrid Doubles matches (e.g. MD vs XD) are not allowed.";
      }
    }
    return null;
  };

  // ── Step 1 validation ──────────────────────────────────────
  const validateStep1 = (): string | null => {
    const filledSets = sets.filter((s) => s.p1 !== "" && s.p2 !== "");
    if (filledSets.length === 0) return "Please enter at least one set score.";
    let myWon = 0, oppWon = 0;
    for (let i = 0; i < filledSets.length; i++) {
      const p1 = parseInt(filledSets[i].p1), p2 = parseInt(filledSets[i].p2);
      if (isNaN(p1) || isNaN(p2)) return `Set ${i + 1}: Invalid score.`;
      if (p1 === p2) return `Set ${i + 1}: Scores cannot be equal.`;
      if (p1 > p2) myWon++; else oppWon++;
      const hi = Math.max(p1, p2), lo = Math.min(p1, p2);
      const valid = (hi >= 21 && hi - lo >= 2) || (hi === 30 && lo === 29) || hi === 15;
      if (!valid) return `Set ${i + 1}: Invalid badminton score (${p1}-${p2}).`;
    }
    if (myTeamWon && oppWon >= myWon) return `You claimed victory but lost more sets (${myWon}–${oppWon}).`;
    if (!myTeamWon && myWon >= oppWon) return `You claimed defeat but won more sets (${myWon}–${oppWon}).`;
    return null;
  };

  const goNext = () => {
    setError(null);
    if (step === 0) {
      const err = validateStep0();
      if (err) { setError(err); return; }
    }
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    setStep((s) => s + 1);
  };

  const handleNFC = async () => {
    // Check if on native platform (Android/iOS)
    const isNative = Capacitor.isNativePlatform();

    if (!isNative) {
      setIsNFCOpen(true);
      return;
    }

    try {
      // For native Android, we would use native NFC APIs
      // For now, show a message and fallback to QR scanning
      toast.info("NFC scanning will be available in the native app. Using QR code scanner instead.");
      setIsScanOpen(true);
    } catch (error) {
      console.error(error);
      setIsNFCOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    const filledSets = sets.filter((s) => s.p1 !== "" && s.p2 !== "");
    const winnerId = myTeamWon ? currentUser.id : opponentId;
    const scoreStr = formatScore();

    let finalScore = scoreStr;
    if (matchType === "doubles") {
      const partnerName = otherPlayers.find((p) => p.id === partnerId)?.full_name ?? "";
      const opp1Name = otherPlayers.find((p) => p.id === opponentId)?.full_name ?? "";
      const opp2Name = otherPlayers.find((p) => p.id === opponentPartnerId)?.full_name ?? "";
      const category = getDoublesCategory([
        currentUser,
        otherPlayers.find((p) => p.id === partnerId),
        otherPlayers.find((p) => p.id === opponentId),
        otherPlayers.find((p) => p.id === opponentPartnerId),
      ]);
      finalScore = `${scoreStr} [${category}: ${currentUser.full_name}+${partnerName} vs ${opp1Name}+${opp2Name}]`;
    }
    // Sanitize free-text inputs (#69)
    const safeVideoUrl = (() => {
      const v = videoUrl.trim();
      try {
        const u = new URL(v);
        return u.protocol === "https:" ? v : "";
      } catch { return ""; }
    })();
    const safeNotes = matchNotes.trim().replace(/<[^>]*>/g, "").slice(0, 120);

    if (safeVideoUrl) finalScore += ` | ${safeVideoUrl}`;
    if (safeNotes) finalScore += ` [note: ${safeNotes}]`;

    try {
      const newRecents = Array.from(new Set([opponentId, ...recentOpponentIds])).slice(0, 3);
      localStorage.setItem("recent_opponents", JSON.stringify(newRecents));
    } catch (e) {}

    const rpcPayload = {
      submitter_id: currentUser.id,
      opponent_id: opponentId,
      match_winner_id: winnerId,
      match_score: finalScore,
      submitter_partner_id: matchType === "doubles" ? partnerId : null,
      opponent_partner_id: matchType === "doubles" ? opponentPartnerId : null,
    };

    if (!navigator.onLine) {
      const existingQueue = JSON.parse(localStorage.getItem("offline_matches") || "[]");
      existingQueue.push({ ...rpcPayload, match_category: matchCategory, timestamp: Date.now() });
      localStorage.setItem("offline_matches", JSON.stringify(existingQueue));
      toast.success("Offline (Gym Mode) — match queued, will sync when reconnected.", { duration: 5000 });
      onSuccess(); onClose(); return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("submit_friendly_match", rpcPayload);
      if (rpcError) throw rpcError;

      if (matchCategory === "tournament") {
        const { data: latestMatch } = await supabase
          .from("matches").select("id").eq("submitted_by", currentUser.id)
          .eq("status", "pending").order("created_at", { ascending: false }).limit(1).single();
        if (latestMatch)
          await supabase.from("matches").update({ is_friendly: false, round: "Tournament" }).eq("id", latestMatch.id);
      }

      if (myTeamWon) toast.success("Incredible victory!");
      toast.success(
        matchCategory === "friendly"
          ? "Match submitted! Waiting for opponent to confirm."
          : "Tournament match logged! Waiting for opponent to confirm.",
      );
      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log match.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
                Log {matchCategory === "tournament" ? "Tournament" : "Friendly"} Match
              </h2>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <StepBar step={step} />

            <div className="p-6 space-y-5">
              {isOffline && (
                <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-3 text-amber-800 dark:text-amber-200">
                  <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">Gym Mode (Offline)</h4>
                    <p className="text-xs opacity-90 mt-0.5">Matches will be queued and synced when reconnected.</p>
                    {offlineQueueCount > 0 && <p className="text-xs font-black mt-1">{offlineQueueCount} match{offlineQueueCount > 1 ? "es" : ""} in queue.</p>}
                  </div>
                </div>
              )}

              {/* ── STEP 0: Setup ─────────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-5">
                  {/* ── Quick Action Hub ─────────────────────────────────── */}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setScanTarget("opponent"); setIsScanOpen(true); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all active:scale-95">
                      <QrCode className="w-6 h-6 text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Scan QR</span>
                    </button>
                    <button type="button" onClick={() => setIsMyQROpen(true)}
                      className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all active:scale-95">
                      <User className="w-6 h-6 text-blue-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Show My QR</span>
                    </button>
                    <button type="button" onClick={() => { setScanTarget("opponent"); handleNFC(); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all active:scale-95">
                      <Wifi className="w-6 h-6 text-purple-500 rotate-90" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Tap NFC</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                    <Clock className="w-3.5 h-3.5" /> Logging at: <span className="text-slate-700 dark:text-slate-200">{timestamp}</span>
                  </div>

                  {/* Friendly / Tournament */}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMatchCategory("friendly")}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${matchCategory === "friendly" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                      🏸 Friendly
                    </button>
                    <button type="button" onClick={() => { if (isAdmin) setMatchCategory("tournament"); }} disabled={!isAdmin}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition ${matchCategory === "tournament" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"} ${!isAdmin ? "opacity-40 cursor-not-allowed" : ""}`}>
                      🏆 Tournament {!isAdmin && <Lock className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Singles / Doubles */}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMatchType("singles")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition ${matchType === "singles" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                      <User className="w-4 h-4" /> Singles
                    </button>
                    <button type="button" onClick={() => setMatchType("doubles")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition ${matchType === "doubles" ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500"}`}>
                      <Users className="w-4 h-4" /> Doubles
                    </button>
                  </div>

                  {/* Player selection */}
                  {matchType === "singles" ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden mb-2 shadow-md">
                          <PlayerAvatar player={currentUser} />
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{currentUser.full_name}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-500">You</span>
                      </div>
                      <div className="text-xl font-black italic text-slate-300 dark:text-slate-700">VS</div>
                      <div className="flex-1 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden mb-2 shadow-md">
                          <PlayerAvatar player={opponent} />
                        </div>
                        <PlayerSelect value={opponentId} onChange={setOpponentId} players={otherPlayers} />
                        {recentOpponentIds.length > 0 && !opponentId && (
                          <div className="flex gap-2 mt-3 justify-center">
                            {recentOpponentIds.map((id) => {
                              const op = otherPlayers.find((p) => p.id === id);
                              if (!op) return null;
                              return (
                                <button key={id} type="button" onClick={() => setOpponentId(id)}
                                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:scale-110 transition flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                                  {op.avatar_url ? (
                                    <img src={op.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    op.full_name?.[0]?.toUpperCase() || "?"
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button type="button" onClick={() => { setScanTarget("opponent"); setIsScanOpen(true); }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                          <QrCode className="w-3 h-3" /> Scan QR
                        </button>
                        <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Opponent</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Your Team</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-emerald-500 overflow-hidden shadow-md"><PlayerAvatar player={currentUser} /></div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{currentUser.full_name}</span>
                          <span className="text-[10px] uppercase font-bold text-emerald-500">You</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-emerald-300 overflow-hidden shadow-md"><PlayerAvatar player={otherPlayers.find((p) => p.id === partnerId)} /></div>
                          <PlayerSelect value={partnerId} onChange={setPartnerId} players={availableAsPartner} placeholder="Your partner" />
                        </div>
                      </div>
                      <div className="text-center text-lg font-black italic text-slate-300 dark:text-slate-700">VS</div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Opponent Team</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md"><PlayerAvatar player={otherPlayers.find((p) => p.id === opponentId)} /></div>
                          <PlayerSelect value={opponentId} onChange={setOpponentId} players={availableAsOpponent} placeholder="Opponent 1" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-rose-300 overflow-hidden shadow-md"><PlayerAvatar player={otherPlayers.find((p) => p.id === opponentPartnerId)} /></div>
                          <PlayerSelect value={opponentPartnerId} onChange={setOpponentPartnerId} players={availableAsOppPartner} placeholder="Opponent 2" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 1: Scores ──────────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Set Scores</label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Enter scores per set. Winner must reach 21 and lead by 2 (or 30-29).</p>
                  </div>

                  {sets.map((set, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-12 shrink-0">Set {idx + 1}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <input type="text" inputMode="numeric" maxLength={2} value={set.p1}
                          onChange={(e) => updateSet(idx, "p1", e.target.value)} placeholder="0"
                          className="w-14 text-center px-2 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" />
                        <span className="text-lg font-black text-slate-300 dark:text-slate-600">—</span>
                        <input type="text" inputMode="numeric" maxLength={2} value={set.p2}
                          onChange={(e) => updateSet(idx, "p2", e.target.value)} placeholder="0"
                          className="w-14 text-center px-2 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-sm font-black text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500" />
                      </div>
                      {sets.length > 1 && (
                        <button type="button" onClick={() => removeSet(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition">
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {sets.length < 3 && (
                    <button type="button" onClick={addSet} className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition px-2 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                      <Plus className="w-3.5 h-3.5" /> Add Set
                    </button>
                  )}

                  {formatScore() && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800">
                      Score: <span className="font-bold text-slate-700 dark:text-slate-200">{formatScore()}</span>
                    </div>
                  )}

                  {/* Who Won */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Who won?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setMyTeamWon(true)}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border ${myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                        {myTeamWon && <Trophy className="w-4 h-4" />} {matchType === "doubles" ? "My Team Won" : "I Won"}
                      </button>
                      <button type="button" onClick={() => setMyTeamWon(false)} disabled={!opponentId}
                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition border ${!myTeamWon ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"} ${!opponentId ? "opacity-50 cursor-not-allowed" : ""}`}>
                        {!myTeamWon && <Trophy className="w-4 h-4" />} {matchType === "doubles" ? "They Won" : "Opponent Won"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Review & Submit ──────────────────────────── */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white">Match Summary</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Type</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">{matchCategory} · {matchType}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Players</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 text-right max-w-[60%]">
                        {matchType === "singles"
                          ? `${currentUser.full_name} vs ${opponent?.full_name}`
                          : `${currentUser.full_name} + ${otherPlayers.find(p => p.id === partnerId)?.full_name} vs ${otherPlayers.find(p => p.id === opponentId)?.full_name} + ${otherPlayers.find(p => p.id === opponentPartnerId)?.full_name}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Score</span>
                      <span className="font-black text-slate-700 dark:text-slate-200 font-mono">{formatScore()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Result</span>
                      <span className={`font-black ${myTeamWon ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {myTeamWon ? "🏆 Win" : "Defeat"}
                      </span>
                    </div>
                  </div>

                  {/* Optional fields */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Match Highlight (Optional)</label>
                    <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube or Video Link"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Match Note (Optional)</label>
                    <textarea value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)}
                      placeholder="Epic 3-setter! Great comeback... (max 120 chars)" maxLength={120} rows={2}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    {matchNotes.length > 0 && <p className="text-[10px] text-slate-400 mt-1 text-right">{matchNotes.length}/120</p>}
                  </div>

                  <div className="pt-2">
                    <SwipeToConfirm onConfirm={handleSubmit} isLoading={loading} disabled={loading} text="Swipe to Submit for Verification" />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-1">
                {step > 0 && (
                  <button type="button" onClick={() => { setStep((s) => s - 1); setError(null); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
                {step < 2 && (
                  <button type="button" onClick={goNext}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-md shadow-emerald-500/20">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <AnimatePresence>
        {isMyQROpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={() => setIsMyQROpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl text-center relative"
            >
              <button onClick={() => setIsMyQROpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">My Match QR</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Have your opponent scan this to quickly log a match with you.</p>
              
              <div className="bg-white p-4 rounded-2xl inline-block mx-auto border-4 border-slate-100 dark:border-slate-800 shadow-sm">
                <QRCode value={currentUser?.id || ""} size={200} />
              </div>
              <p className="mt-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">{currentUser?.full_name}</p>
            </motion.div>
          </div>
        )}

        {isNFCOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={() => setIsNFCOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl text-center relative border border-slate-200 dark:border-slate-800"
            >
              <button onClick={() => setIsNFCOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-purple-50 dark:border-purple-900/10">
                 <Wifi className="w-8 h-8 text-purple-600 dark:text-purple-400 rotate-90" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">NFC Unavailable</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Your device or browser does not currently support Web NFC. Please use Android Chrome or switch to QR Code scanning.</p>
              
              <button onClick={() => setIsNFCOpen(false)} className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition">
                Got it
              </button>
            </motion.div>
          </div>
        )}
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
