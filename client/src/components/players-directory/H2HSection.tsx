import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Swords, Trophy, Activity, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { RivalriesDashboard } from "./RivalriesDashboard";
import { useAuth } from "@/contexts/AuthContext";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { ChevronDown } from "lucide-react";

export function H2HSection() {
  const { session } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [p1Id, setP1Id] = useState<string>("");
  const [p2Id, setP2Id] = useState<string>("");
  const [matches, setMatches] = useState<any[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  const [matchTab, setMatchTab] = useState<"club" | "tournament">("tournament");
  const [loading, setLoading] = useState(true);

  const rankMap = useMemo(() => calculateRanksMap(players), [players]);

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .then(({ data }) => {
        if (data) {
          setPlayers(data.sort((a, b) => b.elo_rating - a.elo_rating));
          if (data.length >= 2) {
            const currentUserId = session?.user?.id;
            const hasCurrentUser = data.find(p => p.id === currentUserId);
            if (hasCurrentUser) {
              setP1Id(currentUserId);
              setP2Id(data.find(p => p.id !== currentUserId)?.id || data[1].id);
            } else {
              setP1Id(data[0].id);
              setP2Id(data[1].id);
            }
          }
        }
        setLoading(false);
      });

    supabase
      .from("matches")
      .select("*")
      .in("status", ["confirmed", "walkover"])
      .then(({ data }) => {
        if (data) setMatches(data);
      });

    supabase
      .from("tournament_matches")
      .select("*, tournaments(name)")
      .eq("status", "completed")
      .then(({ data }) => {
        if (data) setTournamentMatches(data);
      });
  }, [session?.user?.id]);

  const h2hMatches = useMemo(() => {
    if (!p1Id || !p2Id || !matches.length) return [];
    return matches
      .filter(
        (m) =>
          (m.player1_id === p1Id && m.player2_id === p2Id) ||
          (m.player1_id === p2Id && m.player2_id === p1Id) ||
          ((m.player1_id === p1Id || m.team1_partner_id === p1Id) &&
            (m.player2_id === p2Id || m.team2_partner_id === p2Id)) ||
          ((m.player2_id === p1Id || m.team2_partner_id === p1Id) &&
            (m.player1_id === p2Id || m.team1_partner_id === p2Id)),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [matches, p1Id, p2Id]);

  const h2hTournamentMatches = useMemo(() => {
    if (!p1Id || !p2Id || !tournamentMatches.length) return [];
    return tournamentMatches
      .filter((m) =>
        ((m.player1_id === p1Id || m.player3_id === p1Id) && (m.player2_id === p2Id || m.player4_id === p2Id)) ||
        ((m.player1_id === p2Id || m.player3_id === p2Id) && (m.player2_id === p1Id || m.player4_id === p1Id))
      )
      .sort((a, b) => {
        const aIsFinal = a.round_name?.toLowerCase().includes("final") || a.match_code?.includes("_F_");
        const bIsFinal = b.round_name?.toLowerCase().includes("final") || b.match_code?.includes("_F_");
        if (aIsFinal && !bIsFinal) return -1;
        if (!aIsFinal && bIsFinal) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tournamentMatches, p1Id, p2Id]);

  const t1TournamentWins = h2hTournamentMatches.filter((m) => {
    const isTeam1 = m.player1_id === p1Id || m.player3_id === p1Id;
    return (isTeam1 && m.winner_side === 1) || (!isTeam1 && m.winner_side === 2);
  }).length;
  const t2TournamentWins = h2hTournamentMatches.length - t1TournamentWins;

  const topRivalries = useMemo(() => {
    if (!matches.length || !players.length) return [];

    const pairCounts: Record<
      string,
      { p1: string; p2: string; count: number; matches: any[] }
    > = {};

    matches.forEach((m) => {
      if (m.team1_partner_id || m.team2_partner_id) return; // Skip doubles for pure rivalries
      const pid1 = m.player1_id;
      const pid2 = m.player2_id;
      if (!pid1 || !pid2) return;

      const key = pid1 < pid2 ? `${pid1}_${pid2}` : `${pid2}_${pid1}`;
      if (!pairCounts[key])
        pairCounts[key] = { p1: pid1, p2: pid2, count: 0, matches: [] };
      pairCounts[key].count++;
      pairCounts[key].matches.push(m);
    });

    return Object.values(pairCounts)
      .filter((r) => r.count > 1) // Must have played at least twice
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [matches, players]);

  const clubP1Wins = h2hMatches.filter(
    (m) =>
      m.winner_id === p1Id ||
      (m.winner_id &&
        m.team1_partner_id === p1Id &&
        m.winner_id === m.player1_id),
  ).length;
  const clubP2Wins = h2hMatches.length - clubP1Wins;
  
  const p1Wins = clubP1Wins + t1TournamentWins;
  const p2Wins = clubP2Wins + t2TournamentWins;
  const totalMatchesPlayed = h2hMatches.length + h2hTournamentMatches.length;

  const p1 = players.find((p) => p.id === p1Id);
  const p2 = players.find((p) => p.id === p2Id);

  const rivalryMilestone = useMemo(() => {
    if (!p1 || !p2) return null;
    const total = p1Wins + p2Wins;
    if (total === 0)
      return {
        text: `No matches yet between ${p1.full_name} & ${p2.full_name}. Who will draw first blood?`,
        color: "text-muted-foreground",
      };
    if (total === 1)
      return {
        text: `This rivalry is just getting started! The gauntlet has been thrown.`,
        color: "text-indigo-500",
      };
    if (p1Wins === p2Wins)
      return {
        text: `Dead even at ${p1Wins}-${p2Wins}! This rivalry is a toss-up â€” next match decides the bragging rights.`,
        color: "text-amber-500",
      };
    const leader = p1Wins > p2Wins ? p1 : p2;
    const trailer = p1Wins > p2Wins ? p2 : p1;
    const leaderWins = Math.max(p1Wins, p2Wins);
    const trailerWins = Math.min(p1Wins, p2Wins);
    const gap = leaderWins - trailerWins;
    if (gap === 1)
      return {
        text: `${trailer.full_name} is 1 win away from tying the series! Can they even it up?`,
        color: "text-rose-500",
      };
    if (gap === 2)
      return {
        text: `${leader.full_name} leads ${leaderWins}-${trailerWins}. ${trailer.full_name} needs to win 2 straight to level the series.`,
        color: "text-orange-500",
      };
    if (leaderWins >= 5 && gap >= 3)
      return {
        text: `${leader.full_name} dominates this rivalry ${leaderWins}-${trailerWins}. ${trailer.full_name} is in desperate need of a comeback!`,
        color: "text-rose-600",
      };
    return {
      text: `${leader.full_name} leads ${leaderWins}-${trailerWins}. ${trailer.full_name} has some ground to make up!`,
      color: "text-muted-foreground",
    };
  }, [p1, p2, p1Wins, p2Wins]);

  const p1WinProb = useMemo(() => {
    if (
      !p1 ||
      !p2 ||
      p1.elo_rating === undefined ||
      p2.elo_rating === undefined
    )
      return 50;
    return Math.round(
      (1 / (1 + Math.pow(10, (p2.elo_rating - p1.elo_rating) / 400))) * 100,
    );
  }, [p1, p2]);
  const p2WinProb = 100 - p1WinProb;

  const h2hPointStats = useMemo(() => {
    let p1Points = 0;
    let p2Points = 0;
    let maxP1Streak = 0, currentP1Streak = 0;
    let maxP2Streak = 0, currentP2Streak = 0;

    const combinedMatches = [
      ...h2hMatches.map(m => ({ ...m, type: 'club' })),
      ...h2hTournamentMatches.map(m => ({ ...m, type: 'tourn' }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const m of combinedMatches) {
      let isP1Winner = false;
      let isT1 = false;
      
      if (m.type === 'tourn') {
          isT1 = m.player1_id === p1Id || m.player3_id === p1Id;
          isP1Winner = (isT1 && m.winner_side === 1) || (!isT1 && m.winner_side === 2);
      } else {
          isP1Winner = m.winner_id === p1Id || (m.winner_id && m.team1_partner_id === p1Id && m.winner_id === m.player1_id);
          isT1 = m.player1_id === p1Id || m.team1_partner_id === p1Id;
      }

      if (isP1Winner) {
        currentP1Streak++;
        maxP1Streak = Math.max(maxP1Streak, currentP1Streak);
        currentP2Streak = 0;
      } else {
        currentP2Streak++;
        maxP2Streak = Math.max(maxP2Streak, currentP2Streak);
        currentP1Streak = 0;
      }

      let scorePart = m.score || "";
      if (m.type === 'club') {
          scorePart = scorePart.split(" | ")[0];
      }
      const sets = scorePart.split(",").map((s: string) => s.trim());
      for (const s of sets) {
        const pts = s.split("-").map((p: string) => parseInt(p, 10));
        if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) {
          if (isT1) {
            p1Points += pts[0];
            p2Points += pts[1];
          } else {
            p1Points += pts[1];
            p2Points += pts[0];
          }
        }
      }
    }

    return { p1Points, p2Points, maxP1Streak, maxP2Streak };
  }, [h2hMatches, p1Id]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="font-sans animate-in fade-in zoom-in-95 duration-300 space-y-4">
      
      <RivalriesDashboard />

      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground dark:text-foreground flex items-center justify-center gap-2">
            <Swords className="w-6 h-6 text-primary" /> Head-to-Head
          </h1>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-lg">
                <img
                  src={p1?.avatar_url || ""}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative group w-full px-1 mx-auto">
                <PlayerSelect
                  value={p1Id}
                  onChange={setP1Id}
                  players={players}
                  placeholder="Player 1"
                  className="text-sm sm:text-xl font-black text-foreground dark:text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none focus:ring-0 focus:border-0 border-0 outline-none pr-8"
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-primary dark:text-primary">
                  <ChevronDown className="w-4 h-4 drop-shadow-sm" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-row justify-center text-[10px] font-black mt-1 mx-auto min-h-[24px] w-full">
                {!!rankMap[p1?.id || ""]?.overall && (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/50">
                    OVR: #{rankMap[p1?.id || ""].overall}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.singles && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                    S: #{rankMap[p1?.id || ""].singles}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.doubles && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50">
                    D: #{rankMap[p1?.id || ""].doubles}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.mixed && (
                  <span className="px-2 py-1 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 rounded-md border border-fuchsia-200 dark:border-fuchsia-800/50">
                    XD: #{rankMap[p1?.id || ""].mixed}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center w-full px-2">
              <div className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 mb-1">
                {p1Wins}{" "}
                <span className="text-slate-300 dark:text-muted-foreground">-</span>{" "}
                {p2Wins}
              </div>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {totalMatchesPlayed} Matches
              </div>

              {/* Link to Deep Analytics */}
              {p1Id && p2Id && (
                <Link href={`/compare/${p1Id}/${p2Id}`}>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-primary text-primary-foreground rounded-full text-[10px] font-black uppercase tracking-wider mb-4 hover:scale-105 transition-transform shadow-md">
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                  </button>
                </Link>
              )}

              {/* H2H wins visual bar */}
              {totalMatchesPlayed > 0 && (
                <div className="w-full mb-3" aria-label={`Head to head wins: ${p1?.full_name} ${p1Wins} vs ${p2?.full_name} ${p2Wins}`}>
                  <div className="flex h-3 rounded-full overflow-hidden w-full shadow-inner bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${totalMatchesPlayed > 0 ? (p1Wins / totalMatchesPlayed) * 100 : 50}%` }}
                    />
                    <div
                      className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                      style={{ width: `${totalMatchesPlayed > 0 ? (p2Wins / totalMatchesPlayed) * 100 : 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold mt-1 px-0.5">
                    <span className="text-primary">{p1Wins} W</span>
                    <span className="text-indigo-500">{p2Wins} W</span>
                  </div>
                </div>
              )}

              {/* Points Scored & Streaks Breakdown */}
              {(h2hPointStats.p1Points > 0 || h2hPointStats.p2Points > 0) && (
                <div className="w-full mb-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/40 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>Pts</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{h2hPointStats.p1Points} - {h2hPointStats.p2Points}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(h2hPointStats.p1Points / (h2hPointStats.p1Points + h2hPointStats.p2Points || 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-purple-500 transition-all duration-700"
                      style={{ width: `${(h2hPointStats.p2Points / (h2hPointStats.p1Points + h2hPointStats.p2Points || 1)) * 100}%` }}
                    />
                  </div>
                  {(h2hPointStats.maxP1Streak > 1 || h2hPointStats.maxP2Streak > 1) && (
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-emerald-600 dark:text-emerald-400">Streak: {h2hPointStats.maxP1Streak}</span>
                      <span className="text-purple-600 dark:text-purple-400">Streak: {h2hPointStats.maxP2Streak}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rivalry Milestone */}
              {rivalryMilestone && (
                <div className="w-full mb-2 text-center px-1">
                  <p
                    className={`text-[10px] sm:text-xs font-bold italic leading-snug ${rivalryMilestone.color}`}
                  >
                    {rivalryMilestone.text}
                  </p>
                </div>
              )}

              {/* Win Probability Predictor */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center mb-1.5 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-blue-500" /> Win Prob
                </div>
                <div className="flex justify-between text-[10px] font-bold mb-1 px-1">
                  <span className="text-primary dark:text-primary">
                    {p1WinProb}%
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {p2WinProb}%
                  </span>
                </div>
                <div className="h-2 w-full bg-indigo-500/20 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${p1WinProb}%` }}
                  />
                  <div
                    className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                    style={{ width: `${p2WinProb}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-lg">
                <img
                  src={p2?.avatar_url || ""}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative group w-full px-1 mx-auto">
                <PlayerSelect
                  value={p2Id}
                  onChange={setP2Id}
                  players={players}
                  placeholder="Player 2"
                  className="text-sm sm:text-xl font-black text-foreground dark:text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none focus:ring-0 focus:border-0 border-0 outline-none pr-8"
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-blue-500 dark:text-blue-400">
                  <ChevronDown className="w-4 h-4 drop-shadow-sm" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-row justify-center text-[10px] font-black mt-1 mx-auto min-h-[24px] w-full">
                {!!rankMap[p2?.id || ""]?.overall && (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/50">
                    OVR: #{rankMap[p2?.id || ""].overall}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.singles && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                    S: #{rankMap[p2?.id || ""].singles}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.doubles && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md border border-blue-200 dark:border-blue-800/50">
                    D: #{rankMap[p2?.id || ""].doubles}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.mixed && (
                  <span className="px-2 py-1 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400 rounded-md border border-fuchsia-200 dark:border-fuchsia-800/50">
                    XD: #{rankMap[p2?.id || ""].mixed}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {(h2hMatches.length > 0 || h2hTournamentMatches.length > 0) && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 w-full">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Match History
              </h3>
            </div>

            {matchTab === "tournament" && h2hTournamentMatches.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">No tournament matches between these players yet.</p>
            )}

            {matchTab === "tournament" && h2hTournamentMatches.map((m, i) => {
              const mp1 = players.find(p => p.id === m.player1_id);
              const mp2 = players.find(p => p.id === m.player2_id);
              const mp3 = players.find(p => p.id === m.player3_id);
              const mp4 = players.find(p => p.id === m.player4_id);

              const isTeam1 = m.player1_id === p1Id || m.player3_id === p1Id;
              const p1Won = (isTeam1 && m.winner_side === 1) || (!isTeam1 && m.winner_side === 2);
              const team1Won = m.winner_side === 1;

              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm transition-all duration-200 mb-2"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 pt-2.5 pb-1 gap-1 sm:gap-2">
                    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                       <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded font-bold">
                        {m.round_name}
                       </span>
                       <span className="text-[10px] font-bold text-muted-foreground mt-0.5 mr-2 sm:hidden">{m.match_code}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest line-clamp-1 mt-1 sm:mt-0 sm:flex-1 sm:text-center">
                      {m.tournaments?.name ?? "Tournament"}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground hidden sm:block whitespace-nowrap">{m.match_code}</span>
                  </div>

                  {/* Teams */}
                  <div className="px-3 pb-2.5 pt-1">
                    <div className="relative flex flex-col">
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${team1Won ? "bg-primary/5 dark:bg-primary/10" : ""}`}>
                        {team1Won ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${team1Won ? "text-primary dark:text-primary" : "text-slate-700 dark:text-slate-300"}`}>
                          {mp1?.full_name}{mp3 ? ` & ${mp3.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>

                      <div className="flex items-center justify-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">vs</span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
                      </div>

                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${!team1Won ? "bg-primary/5 dark:bg-primary/10" : ""}`}>
                        {!team1Won ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${!team1Won ? "text-primary dark:text-primary" : "text-slate-700 dark:text-slate-300"}`}>
                          {mp2?.full_name}{mp4 ? ` & ${mp4.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1 border-t border-amber-100 dark:border-amber-900/50 pt-2 pl-2 sm:justify-center sm:pl-0">
                      <BeautifulScoreDisplay score={m.score} />
                    </div>
                  </div>
                </div>
              );
            })}

            {matchTab === "club" && h2hMatches.map((m, i) => {
              const mp1 = players.find(p => p.id === m.player1_id);
              const mp2 = players.find(p => p.id === m.player2_id);
              const mp3 = players.find(p => p.id === m.team1_partner_id);
              const mp4 = players.find(p => p.id === m.team2_partner_id);
              
              const p1g = mp1?.gender?.toLowerCase();
              const p2g = mp2?.gender?.toLowerCase();
              const p3g = mp3?.gender?.toLowerCase();
              const p4g = mp4?.gender?.toLowerCase();
              
              let matchFormat = m.category;
              if (m.category === "Doubles") {
                const t1HasM = p1g === "male" || p3g === "male";
                const t1HasF = p1g === "female" || p3g === "female";
                const t2HasM = p2g === "male" || p4g === "male";
                const t2HasF = p2g === "female" || p4g === "female";
                
                if (t1HasM && t1HasF && t2HasM && t2HasF) matchFormat = "XD";
                else if (p1g === "male" && p3g === "male" && p2g === "male" && p4g === "male") matchFormat = "MD";
                else if (p1g === "female" && p3g === "female" && p2g === "female" && p4g === "female") matchFormat = "WD";
              } else if (m.category === "Singles") {
                if (p1g === "male" && p2g === "male") matchFormat = "MS";
                else if (p1g === "female" && p2g === "female") matchFormat = "WS";
              }

              const team1Won = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;

              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm transition-all duration-200 mb-2"
                >
                  {/* Header: date + format */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 sm:justify-center sm:relative">
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground whitespace-nowrap sm:absolute sm:left-3">
                      {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    {matchFormat && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200/70 dark:border-indigo-800/50">
                        {matchFormat}
                      </span>
                    )}
                  </div>

                  {/* Teams */}
                  <div className="px-3 pb-2 pt-1">
                    <div className="relative flex flex-col">
                      {/* Team 1 row */}
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${team1Won ? "bg-primary/5 dark:bg-primary/10" : ""}`}>
                        {team1Won ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${team1Won ? "text-primary dark:text-primary" : "text-slate-700 dark:text-slate-300"}`}>
                          {mp1?.full_name}{mp3 ? ` & ${mp3.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>

                      {/* VS divider */}
                      <div className="flex items-center justify-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">vs</span>
                        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700/50" />
                      </div>

                      {/* Team 2 row */}
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${!team1Won ? "bg-primary/5 dark:bg-primary/10" : ""}`}>
                        {!team1Won ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${!team1Won ? "text-primary dark:text-primary" : "text-slate-700 dark:text-slate-300"}`}>
                          {mp2?.full_name}{mp4 ? ` & ${mp4.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>
                    </div>

                    {/* Score chips */}
                    <div className="mt-1.5 flex flex-wrap gap-1 border-t border-slate-100 dark:border-slate-700/50 pt-2 pl-2 sm:justify-center sm:pl-0">
                      <BeautifulScoreDisplay score={m.score.split(" | ")[0]} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* Top Rivalries */}
        {topRivalries.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 mt-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-500" /> Club-Wide Top
              Rivalries
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topRivalries.map((r, i) => {
                const player1 = players.find((p) => p.id === r.p1);
                const player2 = players.find((p) => p.id === r.p2);
                if (!player1 || !player2) return null;
                const p1Wins = r.matches.filter(
                  (m) => m.winner_id === r.p1,
                ).length;
                const p2Wins = r.count - p1Wins;

                return (
                  <div
                    key={i}
                    onClick={() => {
                      setP1Id(r.p1);
                      setP2Id(r.p2);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-col items-center flex-1">
                      <img
                        src={player1.avatar_url}
                        className="w-8 h-8 rounded-full mb-1 object-cover"
                      />
                      <span className="text-[10px] font-bold text-center line-clamp-1">
                        {player1.full_name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <div className="text-base font-black text-slate-800 dark:text-slate-200">
                        {p1Wins} <span className="text-muted-foreground">-</span>{" "}
                        {p2Wins}
                      </div>
                      <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">
                        {r.count} matches
                      </span>
                    </div>

                    <div className="flex flex-col items-center flex-1">
                      <img
                        src={player2.avatar_url}
                        className="w-8 h-8 rounded-full mb-1 object-cover"
                      />
                      <span className="text-[10px] font-bold text-center line-clamp-1">
                        {player2.full_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
