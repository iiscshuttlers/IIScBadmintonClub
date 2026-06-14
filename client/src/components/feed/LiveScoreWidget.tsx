/**
 * Live Match Spectator Mode (#2)
 * Scoreboard showing live matches with real-time Supabase subscription.
 * Players with the app open can watch live scores update in real time.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Circle, Plus, Minus, Trophy, X } from "lucide-react";
import { toast } from "sonner";

interface LiveMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  scorer_id: string;
  score_p1: number;
  score_p2: number;
  set_number: number;
  sets_p1: number;
  sets_p2: number;
  status: string;
  started_at: string;
  player1?: { full_name: string; avatar_url?: string };
  player2?: { full_name: string; avatar_url?: string };
}

interface Props {
  onClose?: () => void;
}

export function LiveScoreWidget({ onClose }: Props) {
  const { profile } = useAuth();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [scoring, setScoring] = useState<string | null>(null); // live_match id being scored

  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase
        .from("live_matches")
        .select("*, player1:players!player1_id(full_name, avatar_url), player2:players!player2_id(full_name, avatar_url)")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(5);
      setLiveMatches((data ?? []) as LiveMatch[]);
    };

    fetchLive();

    const channel = supabase
      .channel("live_matches_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_matches" },
        () => fetchLive(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const startScoring = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("live_matches")
      .insert({
        player1_id: profile.id,
        player2_id: profile.id, // placeholder — should pick opponent
        scorer_id: profile.id,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Could not start live scoring. Pick players first.");
      return;
    }
    setScoring(data.id);
    toast.success("Live scoring started! Share the feed so others can watch.");
  };

  const updateScore = async (matchId: string, side: "p1" | "p2", delta: 1 | -1) => {
    const match = liveMatches.find((m) => m.id === matchId);
    if (!match) return;

    const newP1 = side === "p1" ? Math.max(0, match.score_p1 + delta) : match.score_p1;
    const newP2 = side === "p2" ? Math.max(0, match.score_p2 + delta) : match.score_p2;

    // Check if a set is over (21+ with 2 ahead, or 30-29)
    let sets_p1 = match.sets_p1, sets_p2 = match.sets_p2;
    let scoreP1 = newP1, scoreP2 = newP2;
    let setNumber = match.set_number;

    const setWon = (a: number, b: number) =>
      (a >= 21 && a - b >= 2) || (a === 30 && b === 29);

    if (setWon(newP1, newP2)) {
      sets_p1++;
      scoreP1 = 0; scoreP2 = 0;
      setNumber++;
    } else if (setWon(newP2, newP1)) {
      sets_p2++;
      scoreP1 = 0; scoreP2 = 0;
      setNumber++;
    }

    const matchDone = sets_p1 >= 2 || sets_p2 >= 2;

    await supabase
      .from("live_matches")
      .update({
        score_p1: scoreP1,
        score_p2: scoreP2,
        sets_p1,
        sets_p2,
        set_number: setNumber,
        status: matchDone ? "finished" : "live",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (matchDone) {
      const winner = sets_p1 > sets_p2
        ? (match.player1 as any)?.full_name ?? "Player 1"
        : (match.player2 as any)?.full_name ?? "Player 2";
      toast.success(`Match over! ${winner} wins!`);
      setScoring(null);
    }
  };

  if (liveMatches.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-emerald-800/40 shadow-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
          <span className="font-black text-white text-sm">LIVE</span>
          <span className="text-slate-400 text-xs">— {liveMatches.length} match{liveMatches.length > 1 ? "es" : ""}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 transition text-slate-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-700/60">
        {liveMatches.map((m) => {
          const isScorer = m.scorer_id === profile?.id;
          const p1Name = (m.player1 as any)?.full_name ?? "Player 1";
          const p2Name = (m.player2 as any)?.full_name ?? "Player 2";

          return (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                {/* Player 1 */}
                <div className="flex-1 text-center">
                  <p className="text-sm font-black text-white truncate">{p1Name}</p>
                  <p className="text-3xl font-black text-emerald-400 mt-1">{m.score_p1}</p>
                  {isScorer && scoring === m.id && (
                    <div className="flex gap-2 justify-center mt-1">
                      <button onClick={() => updateScore(m.id, "p1", 1)}
                        className="p-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => updateScore(m.id, "p1", -1)}
                        className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-emerald-600 font-black mt-0.5">{m.sets_p1} sets</p>
                </div>

                {/* Middle */}
                <div className="px-4 text-center">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Set {m.set_number}</p>
                  <p className="text-slate-500 text-lg my-0.5">vs</p>
                  <Zap className="w-4 h-4 text-amber-400 mx-auto animate-pulse" />
                </div>

                {/* Player 2 */}
                <div className="flex-1 text-center">
                  <p className="text-sm font-black text-white truncate">{p2Name}</p>
                  <p className="text-3xl font-black text-slate-300 mt-1">{m.score_p2}</p>
                  {isScorer && scoring === m.id && (
                    <div className="flex gap-2 justify-center mt-1">
                      <button onClick={() => updateScore(m.id, "p2", 1)}
                        className="p-1 rounded-lg bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => updateScore(m.id, "p2", -1)}
                        className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 font-black mt-0.5">{m.sets_p2} sets</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Button to start a new live scoring session */
export function StartLiveScoringButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase
        .from("players")
        .select("id, full_name")
        .eq("is_approved", true)
        .order("full_name")
        .then(({ data }) => setPlayers(data ?? []));
    }
  }, [open]);

  const start = async () => {
    if (!profile?.id || !player1Id || !player2Id) return;
    setLoading(true);
    const { error } = await supabase.from("live_matches").insert({
      player1_id: player1Id,
      player2_id: player2Id,
      scorer_id: profile.id,
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to start live scoring");
      return;
    }
    toast.success("Live match started! Everyone watching the feed will see the score.");
    setOpen(false);
  };

  if (!profile?.id) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black transition-all shadow-md"
      >
        <Circle className="w-2.5 h-2.5 fill-white animate-pulse" />
        Score Live Match
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Start Live Scoring</h3>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              <select
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Player 1</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <select
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Player 2</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <button
              onClick={start}
              disabled={loading || !player1Id || !player2Id || player1Id === player2Id}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black transition"
            >
              {loading ? "Starting..." : "Start Match"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
