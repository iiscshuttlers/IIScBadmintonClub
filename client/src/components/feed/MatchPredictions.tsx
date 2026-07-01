import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Check } from "lucide-react";
import type { BwfMatchState } from "@/types/umpire";

type VoteTally = { t1: number; t2: number };
type StatProb = { t1: number; t2: number } | null;

async function fetchStatProb(m: BwfMatchState): Promise<StatProb> {
  const t1Ids = [m.t1.p1Id, m.t1.p2Id].filter(Boolean) as string[];
  const t2Ids = [m.t2.p1Id, m.t2.p2Id].filter(Boolean) as string[];
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

function ProbBar({ t1Pct, t2Pct, t1Label, t2Label, label }: {
  t1Pct: number; t2Pct: number; t1Label: string; t2Label: string; label: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex rounded-full overflow-hidden h-4">
        {t1Pct > 0 && (
          <div
            className="bg-primary flex items-center justify-start pl-2 transition-all duration-700"
            style={{ width: `${t1Pct}%` }}
          >
            {t1Pct >= 20 && <span className="text-[10px] font-black text-white truncate">{t1Pct}%</span>}
          </div>
        )}
        {t2Pct > 0 && (
          <div
            className="bg-sky-400 flex items-center justify-end pr-2 transition-all duration-700"
            style={{ width: `${t2Pct}%` }}
          >
            {t2Pct >= 20 && <span className="text-[10px] font-black text-white truncate">{t2Pct}%</span>}
          </div>
        )}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-primary dark:text-primary font-bold truncate max-w-[45%]">{t1Label}</span>
        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold truncate max-w-[45%] text-right">{t2Label}</span>
      </div>
    </div>
  );
}

function MatchPredictionCard({ m, myPick, onPick }: {
  m: BwfMatchState;
  myPick: 1 | 2 | undefined;
  onPick: (team: 1 | 2) => void;
}) {
  const [statProb, setStatProb] = useState<StatProb>(null);
  const [tally, setTally] = useState<VoteTally>({ t1: 0, t2: 0 });

  const t1Label = m.t1.p2Name
    ? `${m.t1.p1Name.split(" ")[0]} & ${m.t1.p2Name.split(" ")[0]}`
    : m.t1.p1Name;
  const t2Label = m.t2.p2Name
    ? `${m.t2.p1Name.split(" ")[0]} & ${m.t2.p2Name.split(" ")[0]}`
    : m.t2.p1Name;

  // Load stat probability once
  useEffect(() => {
    fetchStatProb(m).then(setStatProb);
  }, [m.id]);

  // Load vote tally + realtime (always, so after voting bars update live)
  useEffect(() => {
    const loadTally = async () => {
      const { data } = await supabase
        .from("live_match_votes")
        .select("pick")
        .eq("live_match_id", m.id);
      if (!data) return;
      setTally({ t1: data.filter(r => r.pick === 1).length, t2: data.filter(r => r.pick === 2).length });
    };
    loadTally();

    const sub = supabase
      .channel(`votes_${m.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "live_match_votes",
        filter: `live_match_id=eq.${m.id}`,
      }, (payload) => {
        setTally(prev => ({
          t1: prev.t1 + ((payload.new as any).pick === 1 ? 1 : 0),
          t2: prev.t2 + ((payload.new as any).pick === 2 ? 1 : 0),
        }));
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "live_match_votes",
        filter: `live_match_id=eq.${m.id}`,
      }, (payload) => {
        setTally(prev => ({
          t1: Math.max(0, prev.t1 - ((payload.old as any).pick === 1 ? 1 : 0)),
          t2: Math.max(0, prev.t2 - ((payload.old as any).pick === 2 ? 1 : 0)),
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [m.id]);

  const totalVotes = tally.t1 + tally.t2;
  const voteT1Pct = totalVotes === 0 ? 50 : Math.round((tally.t1 / totalVotes) * 100);
  const voteT2Pct = totalVotes === 0 ? 50 : 100 - voteT1Pct;

  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
        {m.isFriendly ? "Friendly" : `Tournament · ${m.matchNumber}`} · {m.inferredCategory || m.category}
      </p>

      {myPick ? (
        <>
          <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/20 rounded-xl px-3 py-2.5 mb-1">
            <Check className="w-4 h-4 text-violet-500 shrink-0" />
            <p className="text-sm text-violet-700 dark:text-violet-400 font-bold">
              You picked <strong>{myPick === 1 ? t1Label : t2Label}</strong>
            </p>
          </div>

          {statProb && (
            <ProbBar
              t1Pct={statProb.t1}
              t2Pct={statProb.t2}
              t1Label={t1Label}
              t2Label={t2Label}
              label="Based on history"
            />
          )}

          <ProbBar
            t1Pct={voteT1Pct}
            t2Pct={voteT2Pct}
            t1Label={`${t1Label} · ${tally.t1} vote${tally.t1 !== 1 ? "s" : ""}`}
            t2Label={`${tally.t2} vote${tally.t2 !== 1 ? "s" : ""} · ${t2Label}`}
            label="Community votes"
          />
        </>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onPick(1)}
            className="flex-1 py-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/80/30 border border-primary/40 dark:border-primary/80 text-sm font-black text-primary dark:text-primary transition truncate"
          >
            {t1Label}
          </button>
          <button
            onClick={() => onPick(2)}
            className="flex-1 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 border border-sky-200 dark:border-sky-800 text-sm font-black text-sky-700 dark:text-sky-400 transition truncate"
          >
            {t2Label}
          </button>
        </div>
      )}
    </div>
  );
}

export function MatchPredictions() {
  const { profile } = useAuth();
  const [liveMatches, setLiveMatches] = useState<BwfMatchState[]>([]);
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});

  useEffect(() => {
    const parse = (val: Record<string, BwfMatchState>) => {
      setLiveMatches(Object.values(val).filter((m) => m.status === "playing"));
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
    return () => { supabase.removeChannel(sub); };
  }, []);

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
    const { error } = await supabase.from("live_match_votes").insert({
      live_match_id: matchId,
      user_id: profile.id,
      pick: team,
    });
    if (error) {
      setPicks(prev => { const next = { ...prev }; delete next[matchId]; return next; });
    }
  };

  if (liveMatches.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-violet-500" />
        <h3 className="font-black text-slate-800 dark:text-white">Who's going to win?</h3>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" /> Live
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {liveMatches.map((m) => (
          <MatchPredictionCard
            key={m.id}
            m={m}
            myPick={picks[m.id]}
            onPick={(team) => pick(m.id, team)}
          />
        ))}
      </div>
    </div>
  );
}
