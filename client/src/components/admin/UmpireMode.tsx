import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Plus,
  Minus,
  PlusCircle,
  Trophy,
  Activity,
  LogOut,
  Undo2,
  Save,
  Timer,
  Pause,
  Play,
  RotateCcw,
  Circle,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { db, auth } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";

type ScoreSet = { p1: number; p2: number };
type HistoryEntry = { scores: ScoreSet[]; activeSet: number; server: string };

// Parse doubles pair names: "Alice / Bob" or "Alice & Bob" → ["Alice", "Bob"]
function parsePairNames(name: string): string[] {
  const parts = name
    .split(/\s*[\/&]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : [name];
}

export function UmpireMode() {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [selectedFormat, setFormat] = useState("MS");
  const [selectedMatchId, setMatchId] = useState("");
  const [status, setStatus] = useState("in-progress");
  const [winner, setWinner] = useState("");
  const [scores, setScores] = useState<ScoreSet[]>([{ p1: 0, p2: 0 }]);
  const [activeSet, setActiveSet] = useState(0);
  const [server, setServer] = useState("p1-0"); // "p1-0", "p1-1", "p2-0", "p2-1" for doubles
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [sendingPush, setSendingPush] = useState(false);

  // Break timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerPreset, setTimerPreset] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Firebase auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setFbUser(user);
      else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.warn("Firebase anon sign-in failed:", err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Firebase data listener
  useEffect(() => {
    if (!fbUser || !db) return;
    const unsub = onSnapshot(
      doc(db, "live_data", "tournament"),
      (snap) => {
        if (snap.exists()) setData(snap.data());
      },
      (err) => {
        // Silently handle permission errors — Firestore rules may not allow
        // access outside of an active tournament; this is expected behaviour.
        console.warn("Firestore live_data read blocked:", err.code);
        // Set empty data structure so the UI doesn't stay in loading state
        setData({ formats: [], matches: {} });
      }
    );
    return () => unsub();
  }, [fbUser]);

  // Load match scores when match changes
  useEffect(() => {
    if (!data || !selectedMatchId) {
      setScores([{ p1: 0, p2: 0 }]);
      setActiveSet(0);
      setHistory([]);
      setServer("p1-0");
      return;
    }
    const match = data.matches[selectedFormat]?.find(
      (m: any) => m.Match_ID === selectedMatchId,
    );
    if (match?.Score_1) {
      try {
        const parsed = match.Score_1.split(",").map((s: string) => {
          const [p1, p2] = s
            .split("-")
            .map((x: string) => parseInt(x.trim()) || 0);
          return { p1, p2 };
        });
        setScores(parsed.length > 0 ? parsed : [{ p1: 0, p2: 0 }]);
        setActiveSet(parsed.length - 1);
      } catch {
        setScores([{ p1: 0, p2: 0 }]);
        setActiveSet(0);
      }
    } else {
      setScores([{ p1: 0, p2: 0 }]);
      setActiveSet(0);
    }
    setStatus(match?.Status || "in-progress");
    setWinner(match?.Winner || "");
    setHistory([]);
  }, [selectedMatchId, data, selectedFormat]);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            toast("⏰ Break time is over!", { icon: "🔔" });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerSeconds > 0]);

  const pushHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      { scores: scores.map((s) => ({ ...s })), activeSet, server },
    ]);
  }, [scores, activeSet, server]);

  const undo = useCallback(() => {
    if (history.length === 0) {
      toast("Nothing to undo", { icon: "ℹ️" });
      return;
    }
    const prev = history[history.length - 1];
    setScores(prev.scores);
    setActiveSet(prev.activeSet);
    setServer(prev.server);
    setHistory((h) => h.slice(0, -1));
  }, [history]);

  const updateScore = (player: "p1" | "p2", delta: number) => {
    pushHistory();
    const next = [...scores];
    next[activeSet] = {
      ...next[activeSet],
      [player]: Math.max(0, next[activeSet][player] + delta),
    };
    setScores(next);
    // Auto-switch service side on point scored
    if (delta > 0 && !server.startsWith(player)) {
      setServer(`${player}-0`);
    }
  };

  const addSet = () => {
    if (scores.length >= 5) return;
    pushHistory();
    setScores([...scores, { p1: 0, p2: 0 }]);
    setActiveSet(scores.length);
    setServer("p1-0");
  };

  const serverSide = server.startsWith("p1") ? "p1" : "p2";

  const pushUpdate = async () => {
    if (!data || !selectedMatchId || !db) return;
    const updatedMatches = [...data.matches[selectedFormat]];
    const idx = updatedMatches.findIndex(
      (m: any) => m.Match_ID === selectedMatchId,
    );
    if (idx === -1) return;
    if (status === "completed" && !winner) {
      toast("Select a winner before saving!", { icon: "⚠️" });
      return;
    }
    const scoreStr = scores
      .map((s) => `${s.p1}-${s.p2}`)
      .filter((s) => s !== "0-0" || scores.length === 1)
      .join(", ");
    updatedMatches[idx] = {
      ...updatedMatches[idx],
      Score_1: scoreStr,
      Status: status,
      Winner: status === "completed" ? winner : "",
    };
    await updateDoc(doc(db, "live_data", "tournament"), {
      [`matches.${selectedFormat}`]: updatedMatches,
      lastUpdated: new Date().toISOString(),
    });
    if (status === "completed" && winner) {
      toast("Score saved!", { icon: "✅" });
      setWinner("");
      setMatchId("");
    } else {
      toast("Live score pushed!", { icon: "📡" });
    }
  };

  const sendMatchStartPush = async () => {
    if (!selectedMatchId || !data) return;
    setSendingPush(true);
    try {
      const match = data.matches[selectedFormat]?.find((m: any) => m.Match_ID === selectedMatchId);
      if (!match) { toast.error("Match not found"); setSendingPush(false); return; }
      const player1 = match.Player_1 || match.Players_1 || "Player 1";
      const player2 = match.Player_2 || match.Players_2 || "Player 2";
      const roundLabel = match.Round || match.round || "";
      const tournamentName = data?.tournament_name || "IISC Shuttlers";
      const scoreStr = scores.map((s) => `${s.p1}-${s.p2}`).filter((s) => s !== "0-0" || scores.length === 1).join(", ");
      const title = `${tournamentName} • ${selectedFormat}${roundLabel ? ` • ${roundLabel}` : ""}`;
      const body = `Match ${selectedMatchId}: ${player1} vs ${player2}${scoreStr && scoreStr !== "0-0" ? ` | ${scoreStr}` : " — Match Started!"}`;

      const { error: fnError } = await supabase.functions.invoke("send-announcement", {
        body: {
          title,
          body,
          admin_email: "umpire",
          data: { type: "live_score", match_id: selectedMatchId },
        },
      });
      if (fnError) throw fnError;

      await supabase.from("site_data").upsert(
        { key: "admin_push", value: { title, body, url: "/feed/live", timestamp: Date.now() }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

      toast.success("Push notification sent to all players!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send push");
    } finally {
      setSendingPush(false);
    }
  };

  const startTimer = (secs: number) => {
    setTimerPreset(secs);
    setTimerSeconds(secs);
    setTimerActive(true);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const isDoubles = ["MD", "WD", "XD"].includes(selectedFormat);

  // Loading states
  if (!fbUser)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-muted-foreground dark:text-muted-foreground font-bold animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" /> Connecting to live
          data...
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-muted-foreground dark:text-muted-foreground font-bold animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading live data...
        </div>
      </div>
    );

  // No active tournament data
  if (!data.formats || data.formats.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <Activity className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
        <div>
          <p className="font-black text-muted-foreground dark:text-slate-200">No Active Tournament</p>
          <p className="text-sm text-muted-foreground mt-1">Live data will appear here when a tournament is in progress.</p>
        </div>
      </div>
    );

  const currentMatch = data.matches[selectedFormat]?.find(
    (m: any) => m.Match_ID === selectedMatchId,
  );
  const p1Name =
    currentMatch?.Player_1 || currentMatch?.Players_1 || "Player 1";
  const p2Name =
    currentMatch?.Player_2 || currentMatch?.Players_2 || "Player 2";
  const p1Players = isDoubles ? parsePairNames(p1Name) : [p1Name];
  const p2Players = isDoubles ? parsePairNames(p2Name) : [p2Name];

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary dark:text-primary text-sm font-bold">
          <Activity className="w-4 h-4 animate-pulse" /> Live Umpire
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${isDoubles ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"}`}
          >
            {isDoubles ? "Doubles" : "Singles"}
          </span>
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition border border-slate-200 dark:border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Format selector */}
      <div className="flex flex-wrap gap-2">
        {data.formats.map((f: string) => (
          <button
            key={f}
            onClick={() => {
              setFormat(f);
              setMatchId("");
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition ${selectedFormat === f ? "bg-primary text-foreground shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Match selector */}
      <select
        value={selectedMatchId}
        onChange={(e) => setMatchId(e.target.value)}
        className={inputCls}
      >
        <option value="">— Choose a match to umpire —</option>
        {data.matches[selectedFormat]?.map((m: any) => (
          <option key={m.Match_ID} value={m.Match_ID}>
            {m.Match_ID}: {m.Player_1 || m.Players_1} vs{" "}
            {m.Player_2 || m.Players_2}
          </option>
        ))}
      </select>

      {selectedMatchId && (
        <div className="space-y-4">
          {/* Set tabs + Add Set */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {scores.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSet(idx)}
                className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${activeSet === idx ? "bg-blue-600 text-foreground shadow-md scale-105" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground"}`}
              >
                Set {idx + 1}
              </button>
            ))}
            {scores.length < 5 && (
              <button
                onClick={addSet}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-primary hover:bg-primary/10 dark:hover:bg-primary/90/20 ml-auto"
                title="Add Set"
              >
                <PlusCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Service Indicator */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="text-center text-xs font-black text-muted-foreground uppercase tracking-wider">
              🏸 Service
            </div>
            {isDoubles ? (
              <div className="grid grid-cols-2 gap-2">
                {/* Side 1 players */}
                <div className="space-y-1.5">
                  {p1Players.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        pushHistory();
                        setServer(`p1-${idx}`);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${server === `p1-${idx}` ? "bg-amber-400 text-amber-900 shadow-md" : "bg-white dark:bg-slate-800 text-muted-foreground hover:text-muted-foreground border border-slate-200 dark:border-slate-700"}`}
                    >
                      <Circle
                        className={`w-2.5 h-2.5 shrink-0 ${server === `p1-${idx}` ? "fill-amber-900" : ""}`}
                      />
                      {name}
                    </button>
                  ))}
                </div>
                {/* Side 2 players */}
                <div className="space-y-1.5">
                  {p2Players.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        pushHistory();
                        setServer(`p2-${idx}`);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${server === `p2-${idx}` ? "bg-amber-400 text-amber-900 shadow-md" : "bg-white dark:bg-slate-800 text-muted-foreground hover:text-muted-foreground border border-slate-200 dark:border-slate-700"}`}
                    >
                      <Circle
                        className={`w-2.5 h-2.5 shrink-0 ${server === `p2-${idx}` ? "fill-amber-900" : ""}`}
                      />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    pushHistory();
                    setServer("p1-0");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${serverSide === "p1" ? "bg-amber-400 text-amber-900 shadow-md scale-105" : "text-muted-foreground hover:text-muted-foreground"}`}
                >
                  <Circle
                    className={`w-3 h-3 ${serverSide === "p1" ? "fill-amber-900" : ""}`}
                  />
                  {p1Name.split(" ")[0]} serves
                </button>
                <button
                  onClick={() => {
                    pushHistory();
                    setServer("p2-0");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${serverSide === "p2" ? "bg-amber-400 text-amber-900 shadow-md scale-105" : "text-muted-foreground hover:text-muted-foreground"}`}
                >
                  {p2Name.split(" ")[0]} serves
                  <Circle
                    className={`w-3 h-3 ${serverSide === "p2" ? "fill-amber-900" : ""}`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Scoreboard */}
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["p1", p1Name],
                ["p2", p2Name],
              ] as const
            ).map(([player, name]) => (
              <div key={player} className="space-y-2">
                <div className="text-center font-bold text-muted-foreground dark:text-slate-200 h-10 line-clamp-2 leading-tight text-sm flex items-center justify-center gap-1.5">
                  {serverSide === player && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                      title="Serving"
                    />
                  )}
                  {name}
                </div>
                <button
                  onClick={() => updateScore(player, 1)}
                  className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center transition shadow-sm active:scale-95 ${
                    serverSide === player
                      ? "bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 text-amber-700 dark:text-amber-400 active:bg-amber-500 active:text-foreground"
                      : "bg-primary/10 dark:bg-primary/20 border-2 border-primary text-primary dark:text-primary active:bg-primary active:text-foreground"
                  }`}
                >
                  <Plus className="w-8 h-8 opacity-40 mb-1" />
                  <span className="text-6xl font-black">
                    {scores[activeSet]?.[player] ?? 0}
                  </span>
                </button>
                <button
                  onClick={() => updateScore(player, -1)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-muted-foreground font-bold flex justify-center active:bg-slate-300 dark:active:bg-slate-700"
                >
                  <Minus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Score summary across sets */}
          {scores.length > 1 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center">
                All Sets
              </div>
              <div className="flex justify-center gap-3">
                {scores.map((s, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 rounded-lg text-sm font-black text-center ${activeSet === idx ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" : "text-muted-foreground"}`}
                  >
                    {s.p1}-{s.p2}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action bar: Undo + Save */}
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 font-bold text-sm hover:border-amber-400 hover:text-amber-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" /> Undo ({history.length})
            </button>
            <button
              onClick={pushUpdate}
              className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-foreground font-black text-sm shadow-lg active:scale-95 transition-transform"
            >
              <Save className="w-4 h-4" /> PUSH TO LIVE
            </button>
          </div>

          {/* Push notification to all players */}
          <button
            onClick={sendMatchStartPush}
            disabled={sendingPush}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-foreground font-bold text-sm shadow-lg active:scale-95 transition disabled:opacity-50"
          >
            {sendingPush ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            {sendingPush ? "Sending…" : "Notify All Players (Push)"}
          </button>

          {/* Break Timer */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-wider">
              <Timer className="w-4 h-4" /> Break Timer
            </div>
            {timerActive || timerSeconds > 0 ? (
              <div className="text-center space-y-3">
                <div
                  className={`text-5xl font-black tabular-nums ${timerSeconds <= 10 && timerSeconds > 0 ? "text-rose-500 animate-pulse" : "text-slate-800 dark:text-foreground"}`}
                >
                  {formatTime(timerSeconds)}
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setTimerActive(!timerActive)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition ${timerActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-primary/15 text-primary hover:bg-primary/20"}`}
                  >
                    {timerActive ? (
                      <>
                        <Pause className="w-4 h-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Resume
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTimerActive(false);
                      setTimerSeconds(0);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-muted-foreground dark:text-slate-300 text-sm font-bold hover:bg-slate-300 transition"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {[
                  { label: "30s", secs: 30 },
                  { label: "1 min", secs: 60 },
                  { label: "2 min", secs: 120 },
                ].map((p) => (
                  <button
                    key={p.secs}
                    onClick={() => startTimer(p.secs)}
                    className="flex-1 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-muted-foreground dark:text-slate-200 font-bold text-sm hover:border-primary hover:text-primary transition active:scale-95"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status + winner */}
          <div className="space-y-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputCls}
            >
              <option value="in-progress">🟢 Match is LIVE</option>
              <option value="completed">🏁 Match Completed</option>
              <option value="scheduled">📅 Scheduled (Not Started)</option>
            </select>
            {status === "completed" && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
                <label className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-400 uppercase mb-2">
                  <Trophy className="w-4 h-4" /> Select Winner
                </label>
                <select
                  value={winner}
                  onChange={(e) => setWinner(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Who won?</option>
                  <option value={p1Name}>{p1Name}</option>
                  <option value={p2Name}>{p2Name}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
