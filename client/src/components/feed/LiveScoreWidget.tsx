/**
 * Live Match Spectator Mode
 * Scoreboard showing live matches with real-time Supabase subscription.
 * Players with the app open can watch live scores update in real time.
 * Supports Singles and Doubles.
 * When a match finishes, the scorer is asked if they want to submit it
 * as a friendly match for ELO calculation.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Circle, Plus, Minus, X, Users, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LiveMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  partner1_id?: string | null;
  partner2_id?: string | null;
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
  partner1?: { full_name: string; avatar_url?: string };
  partner2?: { full_name: string; avatar_url?: string };
}

// State for the post-match ELO submission prompt
interface EloPrompt {
  match: LiveMatch;
  winnerId: string;
  scoreStr: string; // e.g. "21-15, 18-21, 21-19"
}

interface Props {
  onClose?: () => void;
}

export function LiveScoreWidget({ onClose }: Props) {
  const { profile } = useAuth();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [scoring, setScoring] = useState<string | null>(null);
  const [eloPrompt, setEloPrompt] = useState<EloPrompt | null>(null);
  const [submittingElo, setSubmittingElo] = useState(false);

  // Per-match set score history so we can build a score string (e.g. "21-15, 18-21")
  const [setScores, setSetScores] = useState<Record<string, { p1: number; p2: number }[]>>({});

  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase
        .from("live_matches")
        .select(`
          *,
          player1:players!player1_id(full_name, avatar_url),
          player2:players!player2_id(full_name, avatar_url),
          partner1:players!partner1_id(full_name, avatar_url),
          partner2:players!partner2_id(full_name, avatar_url)
        `)
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

  const updateScore = async (matchId: string, side: "p1" | "p2", delta: 1 | -1) => {
    const match = liveMatches.find((m) => m.id === matchId);
    if (!match) return;

    const newP1 = side === "p1" ? Math.max(0, match.score_p1 + delta) : match.score_p1;
    const newP2 = side === "p2" ? Math.max(0, match.score_p2 + delta) : match.score_p2;

    let sets_p1 = match.sets_p1, sets_p2 = match.sets_p2;
    let scoreP1 = newP1, scoreP2 = newP2;
    let setNumber = match.set_number;

    const setWon = (a: number, b: number) =>
      (a >= 21 && a - b >= 2) || (a === 30 && b === 29);

    const p1WonSet = setWon(newP1, newP2);
    const p2WonSet = setWon(newP2, newP1);

    if (p1WonSet) {
      // Record completed set score
      setSetScores((prev) => ({
        ...prev,
        [matchId]: [...(prev[matchId] ?? []), { p1: newP1, p2: newP2 }],
      }));
      sets_p1++;
      scoreP1 = 0; scoreP2 = 0;
      setNumber++;
    } else if (p2WonSet) {
      setSetScores((prev) => ({
        ...prev,
        [matchId]: [...(prev[matchId] ?? []), { p1: newP1, p2: newP2 }],
      }));
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
      const winnerId = sets_p1 > sets_p2 ? match.player1_id : match.player2_id;
      const winner = sets_p1 > sets_p2
        ? (match.player1 as any)?.full_name ?? "Team 1"
        : (match.player2 as any)?.full_name ?? "Team 2";
      toast.success(`Match over! ${winner}'s team wins!`);
      setScoring(null);

      // Build score string from recorded set scores
      const completedSets = setSetScores[matchId] ?? [];
      const scoreStr = completedSets.map((s) => `${s.p1}-${s.p2}`).join(", ") || `${sets_p1}-${sets_p2} sets`;

      // Only the scorer gets the ELO prompt
      if (profile?.id === match.scorer_id) {
        setEloPrompt({ match, winnerId, scoreStr });
      }
    }
  };

  const submitForElo = async () => {
    if (!eloPrompt || !profile?.id) return;
    const { match, winnerId, scoreStr } = eloPrompt;
    const isDoubles = !!(match.partner1_id || match.partner2_id);

    setSubmittingElo(true);
    try {
      const { error } = await supabase.rpc("submit_friendly_match", {
        submitter_id: match.scorer_id,
        opponent_id: match.player2_id,
        match_winner_id: winnerId,
        match_score: scoreStr,
        submitter_partner_id: isDoubles ? match.partner1_id ?? null : null,
        opponent_partner_id: isDoubles ? match.partner2_id ?? null : null,
      });
      if (error) throw error;
      toast.success("Match submitted for ELO! The opponent needs to confirm it.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit for ELO");
    } finally {
      setSubmittingElo(false);
      setEloPrompt(null);
    }
  };

  if (liveMatches.length === 0 && !eloPrompt) return null;

  return (
    <>
    {liveMatches.length > 0 && (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-primary/40 shadow-xl overflow-hidden mb-6">
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
          const partner1Name = (m.partner1 as any)?.full_name;
          const partner2Name = (m.partner2 as any)?.full_name;
          const team1Label = partner1Name ? `${p1Name} & ${partner1Name}` : p1Name;
          const team2Label = partner2Name ? `${p2Name} & ${partner2Name}` : p2Name;

          return (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                {/* Team 1 */}
                <div className="flex-1 text-center">
                  <p className="text-sm font-black text-white truncate">{team1Label}</p>
                  <p className="text-3xl font-black text-primary mt-1">{m.score_p1}</p>
                  {isScorer && scoring === m.id && (
                    <div className="flex gap-2 justify-center mt-1">
                      <button onClick={() => updateScore(m.id, "p1", 1)}
                        className="p-1 rounded-lg bg-primary/30 hover:bg-primary/50 text-primary transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => updateScore(m.id, "p1", -1)}
                        className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-primary font-black mt-0.5">{m.sets_p1} sets</p>
                </div>

                {/* Middle */}
                <div className="px-4 text-center">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Set {m.set_number}</p>
                  <p className="text-slate-500 text-lg my-0.5">vs</p>
                  <Zap className="w-4 h-4 text-amber-400 mx-auto animate-pulse" />
                </div>

                {/* Team 2 */}
                <div className="flex-1 text-center">
                  <p className="text-sm font-black text-white truncate">{team2Label}</p>
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
              {isScorer && scoring !== m.id && (
                <button
                  onClick={() => setScoring(m.id)}
                  className="mt-3 w-full py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-black transition"
                >
                  Control Score
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
    )}

      {/* ELO Submission Prompt — shown to scorer when match finishes */}
      {eloPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">Submit for ELO?</h3>
                <p className="text-xs text-slate-400">This will log it as a friendly match</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Winner</span>
                <span className="font-black text-slate-800 dark:text-white">
                  {eloPrompt.winnerId === eloPrompt.match.player1_id
                    ? (eloPrompt.match.player1 as any)?.full_name ?? "Player 1"
                    : (eloPrompt.match.player2 as any)?.full_name ?? "Player 2"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Score</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{eloPrompt.scoreStr}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              The opponent will need to confirm the match before ELO updates.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setEloPrompt(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                No thanks
              </button>
              <button
                onClick={submitForElo}
                disabled={submittingElo}
                className="flex-1 py-3 rounded-2xl bg-primary hover:bg-primary disabled:opacity-60 text-white font-black text-sm transition flex items-center justify-center gap-2"
              >
                {submittingElo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {submittingElo ? "Submitting…" : "Yes, submit!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Button to start a new live scoring session — supports Singles and Doubles */
export function StartLiveScoringButton() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isDoubles, setIsDoubles] = useState(false);
  const [player1Id, setPlayer1Id] = useState("");
  const [partner1Id, setPartner1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [partner2Id, setPartner2Id] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase
        .from("players")
        .select("id, full_name")
        .eq("is_approved", true)
        .is("deleted_at", null)
        .order("full_name")
        .then(({ data }) => setPlayers(data ?? []));
    }
  }, [open]);

  const reset = () => {
    setPlayer1Id(""); setPartner1Id("");
    setPlayer2Id(""); setPartner2Id("");
    setIsDoubles(false);
  };

  const canStart = player1Id && player2Id && player1Id !== player2Id &&
    (!isDoubles || (partner1Id && partner2Id && partner1Id !== partner2Id &&
      partner1Id !== player1Id && partner2Id !== player2Id));

  const start = async () => {
    if (!profile?.id || !canStart) return;
    setLoading(true);
    const payload: any = {
      player1_id: player1Id,
      player2_id: player2Id,
      scorer_id: profile.id,
    };
    if (isDoubles) {
      payload.partner1_id = partner1Id;
      payload.partner2_id = partner2Id;
    }
    const { error } = await supabase.from("live_matches").insert(payload);
    setLoading(false);
    if (error) {
      toast.error("Failed to start live scoring");
      return;
    }
    toast.success("Live match started! Everyone watching the feed will see the score.");
    reset();
    setOpen(false);
  };

  if (!profile?.id) return null;

  const otherIds = [player1Id, partner1Id, player2Id, partner2Id].filter(Boolean);

  const selectCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setOpen(false); reset(); }}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Start Live Scoring</h3>
              <button onClick={() => { setOpen(false); reset(); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Format Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setIsDoubles(false)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${!isDoubles ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}
              >
                Singles
              </button>
              <button
                onClick={() => setIsDoubles(true)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${isDoubles ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}
              >
                <Users className="w-3.5 h-3.5" /> Doubles
              </button>
            </div>

            <div className="space-y-4">
              {/* Team 1 */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {isDoubles ? "Team 1" : "Player 1"}
                </p>
                <div className="space-y-2">
                  <select value={player1Id} onChange={(e) => setPlayer1Id(e.target.value)} className={selectCls}>
                    <option value="">Select Player 1</option>
                    {players.filter(p => !otherIds.filter(id => id !== player1Id).includes(p.id)).map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                  {isDoubles && (
                    <select value={partner1Id} onChange={(e) => setPartner1Id(e.target.value)} className={selectCls}>
                      <option value="">Select Partner 1</option>
                      {players.filter(p => !otherIds.filter(id => id !== partner1Id).includes(p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="text-center text-slate-400 font-black text-sm">VS</div>

              {/* Team 2 */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                  {isDoubles ? "Team 2" : "Player 2"}
                </p>
                <div className="space-y-2">
                  <select value={player2Id} onChange={(e) => setPlayer2Id(e.target.value)} className={selectCls}>
                    <option value="">Select Player 2</option>
                    {players.filter(p => !otherIds.filter(id => id !== player2Id).includes(p.id)).map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                  {isDoubles && (
                    <select value={partner2Id} onChange={(e) => setPartner2Id(e.target.value)} className={selectCls}>
                      <option value="">Select Partner 2</option>
                      {players.filter(p => !otherIds.filter(id => id !== partner2Id).includes(p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={start}
              disabled={loading || !canStart}
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
