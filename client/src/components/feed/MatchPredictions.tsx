import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState } from "@/types/umpire";

type VoteTally = { t1: number; t2: number };
type StatProb = { t1: number; t2: number } | null;

async function fetchStatProb(t1Ids: string[], t2Ids: string[]): Promise<StatProb> {
  if (!t1Ids.length || !t2Ids.length) return null;

  const { data } = await supabase
    .from("matches")
    .select("player1_id, team1_partner_id, player2_id, team2_partner_id, winner_id")
    .or(
      `and(player1_id.in.(${t1Ids.join(",")}),player2_id.in.(${t2Ids.join(",")})),` +
      `and(player1_id.in.(${t2Ids.join(",")}),player2_id.in.(${t1Ids.join(",")}))`
    )
    .limit(100);

  if (!data || data.length === 0) {
    // fallback: individual win rates from matches table
    const allIds = [...t1Ids, ...t2Ids];
    const { data: allMatches } = await supabase
      .from("matches")
      .select("player1_id, team1_partner_id, player2_id, team2_partner_id, winner_id")
      .or(
        allIds.map(id => `player1_id.eq.${id},player2_id.eq.${id},team1_partner_id.eq.${id},team2_partner_id.eq.${id}`).join(",")
      )
      .limit(200);
    if (!allMatches || allMatches.length === 0) return null;

    const winRate = (ids: string[]) => {
      let wins = 0, total = 0;
      for (const match of allMatches) {
        const isT1 = ids.includes(match.player1_id) || ids.includes(match.team1_partner_id ?? "");
        const isT2 = ids.includes(match.player2_id) || ids.includes(match.team2_partner_id ?? "");
        if (!isT1 && !isT2) continue;
        total++;
        const wonAsT1 = isT1 && (ids.includes(match.winner_id));
        const wonAsT2 = isT2 && (ids.includes(match.winner_id));
        if (wonAsT1 || wonAsT2) wins++;
      }
      return total === 0 ? 0.5 : wins / total;
    };

    const r1 = winRate(t1Ids);
    const r2 = winRate(t2Ids);
    const total = r1 + r2 || 1;
    return { t1: Math.round((r1 / total) * 100), t2: Math.round((r2 / total) * 100) };
  }

  let t1Wins = 0, t2Wins = 0;
  for (const match of data) {
    const matchT1Ids = [match.player1_id, match.team1_partner_id].filter(Boolean);
    const winnerIsMatchT1 = matchT1Ids.includes(match.winner_id);
    // Determine if match's team1 maps to our t1 or t2
    const matchT1IsOurT1 = t1Ids.some(id => matchT1Ids.includes(id));
    if (winnerIsMatchT1) {
      matchT1IsOurT1 ? t1Wins++ : t2Wins++;
    } else {
      matchT1IsOurT1 ? t2Wins++ : t1Wins++;
    }
  }

  const total = t1Wins + t2Wins || 1;
  return {
    t1: Math.round((t1Wins / total) * 100),
    t2: Math.round((t2Wins / total) * 100),
  };
}

function ProbBar({ t1Pct, t2Pct, t1Label, t2Label, label, tooltip }: {
  t1Pct: number; t2Pct: number; t1Label: string; t2Label: string; label: string; tooltip?: string;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
        {tooltip && (
          <div className="group relative flex items-center">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-muted-foreground cursor-help transition-colors" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-slate-800 text-slate-300 text-xs font-medium p-2.5 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-xl border border-slate-700 leading-relaxed text-center pointer-events-none">
              {tooltip}
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-slate-800" />
            </div>
          </div>
        )}
      </div>
      <div className="flex rounded-full overflow-hidden h-4">
        {t1Pct > 0 && (
          <div
            className="bg-primary flex items-center justify-start pl-2 transition-all duration-700"
            style={{ width: `${t1Pct}%` }}
          >
            {t1Pct >= 20 && <span className="text-[10px] font-black text-slate-900 truncate">{t1Pct}%</span>}
          </div>
        )}
        {t2Pct > 0 && (
          <div
            className="bg-sky-400 flex items-center justify-end pr-2 transition-all duration-700"
            style={{ width: `${t2Pct}%` }}
          >
            {t2Pct >= 20 && <span className="text-[10px] font-black text-slate-900 truncate">{t2Pct}%</span>}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2 mt-1">
        <span className="text-[10px] text-primary dark:text-primary font-bold break-words flex-1">{t1Label}</span>
        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold break-words flex-1 text-right">{t2Label}</span>
      </div>
    </div>
  );
}

export function MatchPredictionCard({
  matchId,
  t1Ids,
  t2Ids,
  t1Label,
  t2Label,
  hasStarted,
  myPick,
  profileId,
  onPick,
  isResultsRevealed = false,
  isAdmin = false,
  onToggleRevealResults,
  compact = false
}: {
  matchId: string;
  t1Ids: string[];
  t2Ids: string[];
  t1Label: string;
  t2Label: string;
  hasStarted: boolean;
  myPick: 1 | 2 | undefined;
  profileId: string | undefined;
  onPick: (team: 1 | 2) => void;
  isResultsRevealed?: boolean;
  isAdmin?: boolean;
  onToggleRevealResults?: () => void;
  compact?: boolean;
}) {
  const [statProb, setStatProb] = useState<StatProb>(null);
  const [tally, setTally] = useState<VoteTally>({ t1: 0, t2: 0 });

  // Load stat probability once
  useEffect(() => {
    fetchStatProb(t1Ids, t2Ids).then(setStatProb);
  }, [matchId, t1Ids, t2Ids]);

  // Load vote tally + realtime (always, so after voting bars update live)
  useEffect(() => {
    const loadTally = async () => {
      const { data } = await supabase
        .from("live_match_votes")
        .select("pick")
        .eq("live_match_id", matchId);
      if (!data) return;
      setTally({ t1: data.filter(r => r.pick === 1).length, t2: data.filter(r => r.pick === 2).length });
    };
    loadTally();

    const sub = supabase
      .channel(`votes_${matchId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "live_match_votes",
        filter: `live_match_id=eq.${matchId}`,
      }, (payload) => {
        if (profileId && (payload.new as any).user_id === profileId) return; // Handled optimistically
        setTally(prev => ({
          t1: prev.t1 + ((payload.new as any).pick === 1 ? 1 : 0),
          t2: prev.t2 + ((payload.new as any).pick === 2 ? 1 : 0),
        }));
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "live_match_votes",
        filter: `live_match_id=eq.${matchId}`,
      }, (payload) => {
        if (profileId && (payload.old as any).user_id === profileId) return; // Handled optimistically
        setTally(prev => ({
          t1: Math.max(0, prev.t1 - ((payload.old as any).pick === 1 ? 1 : 0)),
          t2: Math.max(0, prev.t2 - ((payload.old as any).pick === 2 ? 1 : 0)),
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [matchId, profileId]);

  const totalVotes = tally.t1 + tally.t2;
  const voteT1Pct = totalVotes === 0 ? 50 : Math.round((tally.t1 / totalVotes) * 100);
  const voteT2Pct = totalVotes === 0 ? 50 : 100 - voteT1Pct;

  const shouldShowResults = isResultsRevealed;

  return (
    <div className={compact ? "mt-1" : "pt-2 border-t border-slate-700/50 mt-2"}>
      {myPick || hasStarted ? (
        <>
          {myPick && (
            <div className={`flex items-start sm:items-center gap-2 bg-violet-50 dark:bg-violet-950/20 rounded-xl px-3 ${compact ? "py-1.5 mb-1" : "py-2.5 mb-1"}`}>
              <Check className={`${compact ? "w-3.5 h-3.5 mt-0.5" : "w-4 h-4 shrink-0 mt-0.5 sm:mt-0"} text-violet-500`} />
              <p className={`${compact ? "text-[10px]" : "text-sm"} text-violet-700 dark:text-violet-400 font-bold leading-snug`}>
                You picked <strong>{myPick === 1 ? t1Label : t2Label}</strong>
              </p>
            </div>
          )}
          {!myPick && hasStarted && !compact && (
            <p className="text-xs text-muted-foreground italic mb-2">Voting closed (Match has started)</p>
          )}


          {shouldShowResults ? (
            <>
              {statProb && !compact && (
                <ProbBar
                  t1Pct={statProb.t1}
                  t2Pct={statProb.t2}
                  t1Label={t1Label}
                  t2Label={t2Label}
                  label="Based on history"
                  tooltip="Calculated from past match history between these players. If they haven't faced each other, it defaults to their overall win rates."
                />
              )}
              <ProbBar
                t1Pct={voteT1Pct}
                t2Pct={voteT2Pct}
                t1Label={compact ? `${tally.t1} vote${tally.t1 !== 1 ? "s" : ""}` : `${t1Label} · ${tally.t1} vote${tally.t1 !== 1 ? "s" : ""}`}
                t2Label={compact ? `${tally.t2} vote${tally.t2 !== 1 ? "s" : ""}` : `${tally.t2} vote${tally.t2 !== 1 ? "s" : ""} · ${t2Label}`}
                label={compact ? undefined : "Community votes"}
                tooltip="Live predictions from people in the community watching this match."
              />
            </>
          ) : (
            <div className={`${compact ? "mt-1 py-1 px-2 text-[9px]" : "mt-2 p-2.5 text-[11px]"} rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-muted-foreground flex items-center justify-between font-medium`}>
              <span className="flex items-center gap-1.5 line-clamp-1">
                🔒 Poll results will be revealed when match umpiring starts or when released by admin.
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col">
          {!compact && (
            <p className="text-[11px] text-center font-black text-slate-500 mb-2 flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-violet-500" /> Predict the winner!
            </p>
          )}
          <div className={`flex ${compact ? "gap-1.5 flex-row" : "gap-2 flex-col sm:flex-row"}`}>
            <button
              onClick={() => {
                setTally(prev => ({ ...prev, t1: prev.t1 + 1 }));
                onPick(1);
              }}
              className={`flex-1 flex items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/80/30 border border-primary/40 dark:border-primary/80 font-black text-primary dark:text-primary transition overflow-hidden ${compact ? "py-1 px-1.5 text-[9px] sm:text-[10px] min-h-[1.75rem]" : "p-2 text-xs sm:text-sm min-h-[4.5rem] rounded-xl"}`}
            >
              <span className={`line-clamp-2 break-words ${compact ? "leading-none" : "leading-tight"}`}>{t1Label}</span>
            </button>
            <button
              onClick={() => {
                setTally(prev => ({ ...prev, t2: prev.t2 + 1 }));
                onPick(2);
              }}
              className={`flex-1 flex items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 border border-sky-200 dark:border-sky-800 font-black text-sky-700 dark:text-sky-400 transition overflow-hidden ${compact ? "py-1 px-1.5 text-[9px] sm:text-[10px] min-h-[1.75rem]" : "p-2 text-xs sm:text-sm min-h-[4.5rem] rounded-xl"}`}
            >
              <span className={`line-clamp-2 break-words ${compact ? "leading-none" : "leading-tight"}`}>{t2Label}</span>
            </button>
          </div>
        </div>
      )}

      {isAdmin && onToggleRevealResults && (
        <div className={`text-right ${compact ? "mt-1" : "mt-2"}`}>
          <button
            onClick={onToggleRevealResults}
            className={`font-bold text-amber-500 hover:text-amber-400 inline-flex items-center gap-1 uppercase tracking-wider transition ${compact ? "text-[9px]" : "text-[10px]"}`}
          >
            {isResultsRevealed ? "Hide Poll Results" : "Reveal"}
          </button>
        </div>
      )}
    </div>
  );
}

import { PredictionLeaderboard } from "./PredictionLeaderboard";

export function MatchPredictions() {
  const { profile, isAdmin } = useAuth();
  const [liveMatches, setLiveMatches] = useState<BwfMatchState[]>([]);
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"predictions" | "leaderboard">("predictions");

  useEffect(() => {
    const parse = (val: Record<string, BwfMatchState>) => {
      let killed = [];
      try {
        killed = JSON.parse(sessionStorage.getItem("killed_match_ids") || "[]");
      } catch (e) {}
      const killedMatchIds = new Set(killed);
      setLiveMatches(Object.values(val).filter((m) => {
        // Don't show matches that were just killed
        if (killedMatchIds.has(m.id)) return false;
        return m.status === "playing" || (m.status === "setup" && m.t1.p1Id && m.t2.p1Id);
      }));
    };

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => { if (data?.value) parse(data.value as any); });

    const sub = supabase
      .channel("match_predictions_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => { if ((payload.new as any)?.value) parse((payload.new as any).value); })
      .subscribe();

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "poll_revealed_matches")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setRevealedMatchIds(data.value as Record<string, boolean>);
      });

    const subRevealed = supabase
      .channel("poll_revealed_matches_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.poll_revealed_matches" },
        (payload) => { if ((payload.new as any)?.value) setRevealedMatchIds((payload.new as any).value); })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
      supabase.removeChannel(subRevealed);
    };
  }, []);

  const toggleRevealMatchPoll = async (matchId: string) => {
    const nextState = { ...revealedMatchIds, [matchId]: !revealedMatchIds[matchId] };
    setRevealedMatchIds(nextState);
    await supabase.from("site_data").upsert({ key: "poll_revealed_matches", value: nextState }, { onConflict: "key" });
  };

  // Load picks from DB on mount
  useEffect(() => {
    if (!profile?.id || liveMatches.length === 0) return;
    const ids = liveMatches.map(m => m.id);
    supabase
      .from("live_match_votes")
      .select("live_match_id, pick")
      .eq("user_id", profile.id)
      .in("live_match_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, 1 | 2> = {};
        for (const row of data) map[row.live_match_id] = row.pick as 1 | 2;
        setPicks(map);
      });
  }, [profile?.id, liveMatches.map(m => m.id).join(",")]);

  const pick = async (matchId: string, team: 1 | 2) => {
    if (!profile?.id || picks[matchId]) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    const { error } = await supabase.from("live_match_votes").upsert({
      live_match_id: matchId,
      user_id: profile.id,
      pick: team,
    }, { onConflict: "live_match_id,user_id" });
    if (error) {
      if (error.code === '23505') { // 23505 is unique_violation
        toast.success("Your vote is already recorded!");
      } else {
        toast.error(`Failed to submit vote: ${error.message}`);
        setPicks(prev => { const next = { ...prev }; delete next[matchId]; return next; });
      }
    }
  };

  if (liveMatches.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h3 className="font-black text-slate-800 dark:text-foreground">Who's going to win?</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("predictions")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "predictions"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Matches
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "leaderboard"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-on-accent"
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {activeTab === "leaderboard" ? (
        <div className="p-4">
          <PredictionLeaderboard />
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {liveMatches.map((m) => (
            <MatchPredictionCard
              key={m.id}
              matchId={m.id}
              t1Ids={[m.t1.p1Id, m.t1.p2Id].filter(Boolean) as string[]}
              t2Ids={[m.t2.p1Id, m.t2.p2Id].filter(Boolean) as string[]}
              t1Label={m.t1.p2Name ? `${m.t1.p1Name} & ${m.t1.p2Name}` : m.t1.p1Name}
              t2Label={m.t2.p2Name ? `${m.t2.p1Name} & ${m.t2.p2Name}` : m.t2.p1Name}
              hasStarted={m.status === "playing"}
              myPick={picks[m.id]}
              profileId={profile?.id}
              onPick={(team) => pick(m.id, team)}
              isResultsRevealed={!!revealedMatchIds[m.id]}
              isAdmin={isAdmin}
              onToggleRevealResults={() => toggleRevealMatchPoll(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


