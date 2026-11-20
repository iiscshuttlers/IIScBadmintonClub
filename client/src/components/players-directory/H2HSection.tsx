import { useState, useEffect, useMemo } from "react";
import { playerService } from "@/services/playerService";
import { fetchCompletedTournamentMatchesWithNames } from "@/services/tournamentService";
import { Swords, Trophy, Activity, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { ChevronDown } from "lucide-react";

export function H2HSection() {
  const { session } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [p1Id, setP1Id] = useState<string>("");
  const [p2Id, setP2Id] = useState<string>("");
  const [tournamentMatches, setTournamentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const rankMap = useMemo(() => calculateRanksMap(players), [players]);

  useEffect(() => {
    playerService.getAllPublicPlayers()
      .then((data) => {
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

    fetchCompletedTournamentMatchesWithNames()
      .then((data) => {
        if (data) setTournamentMatches(data);
      });
  }, [session?.user?.id]);

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

  const p1Wins = t1TournamentWins;
  const p2Wins = t2TournamentWins;
  const totalMatchesPlayed = h2hTournamentMatches.length;

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
        color: "text-info",
      };
    if (p1Wins === p2Wins)
      return {
        text: `Dead even at ${p1Wins}-${p2Wins}! This rivalry is a toss-up â€” next match decides the bragging rights.`,
        color: "text-warning",
      };
    const leader = p1Wins > p2Wins ? p1 : p2;
    const trailer = p1Wins > p2Wins ? p2 : p1;
    const leaderWins = Math.max(p1Wins, p2Wins);
    const trailerWins = Math.min(p1Wins, p2Wins);
    const gap = leaderWins - trailerWins;
    if (gap === 1)
      return {
        text: `${trailer.full_name} is 1 win away from tying the series! Can they even it up?`,
        color: "text-danger",
      };
    if (gap === 2)
      return {
        text: `${leader.full_name} leads ${leaderWins}-${trailerWins}. ${trailer.full_name} needs to win 2 straight to level the series.`,
        color: "text-secondary",
      };
    if (leaderWins >= 5 && gap >= 3)
      return {
        text: `${leader.full_name} dominates this rivalry ${leaderWins}-${trailerWins}. ${trailer.full_name} is in desperate need of a comeback!`,
        color: "text-danger",
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

    const orderedMatches = [...h2hTournamentMatches]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const m of orderedMatches) {
      const isT1 = m.player1_id === p1Id || m.player3_id === p1Id;
      const isP1Winner = (isT1 && m.winner_side === 1) || (!isT1 && m.winner_side === 2);

      if (isP1Winner) {
        currentP1Streak++;
        maxP1Streak = Math.max(maxP1Streak, currentP1Streak);
        currentP2Streak = 0;
      } else {
        currentP2Streak++;
        maxP2Streak = Math.max(maxP2Streak, currentP2Streak);
        currentP1Streak = 0;
      }

      const scorePart = m.score || "";
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
  }, [h2hTournamentMatches, p1Id]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Activity className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="font-sans animate-in fade-in zoom-in-95 duration-300 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center justify-center gap-2">
            <Swords className="w-6 h-6 text-primary" /> Head-to-Head
          </h1>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-border shadow-lg">
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
                  className="text-sm sm:text-xl font-black text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 focus:border-0/90 border-0 outline-none pr-8"
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-primary">
                  <ChevronDown className="w-4 h-4 drop-shadow-sm" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-row justify-center text-[10px] font-black mt-1 mx-auto min-h-[24px] w-full">
                {!!rankMap[p1?.id || ""]?.overall && (
                  <span className="px-2 py-1 bg-warning/10 text-warning rounded-md border border-warning/30">
                    OVR: #{rankMap[p1?.id || ""].overall}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.singles && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                    S: #{rankMap[p1?.id || ""].singles}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.doubles && (
                  <span className="px-2 py-1 bg-info/10 text-info rounded-md border border-info/30">
                    D: #{rankMap[p1?.id || ""].doubles}
                  </span>
                )}
                {!!rankMap[p1?.id || ""]?.mixed && (
                  <span className="px-2 py-1 bg-individual/10 text-individual rounded-md border border-individual/30">
                    XD: #{rankMap[p1?.id || ""].mixed}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center w-full px-2">
              <div className="text-3xl sm:text-4xl font-black text-foreground mb-1">
                {p1Wins}{" "}
                <span className="text-muted-foreground">-</span>{" "}
                {p2Wins}
              </div>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                {totalMatchesPlayed} Matches
              </div>

              {/* Link to Deep Analytics */}
              {p1Id && p2Id && (
                <Link href={`/compare/${p1Id}/${p2Id}`}>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-[10px] font-black uppercase tracking-wider mb-4 hover:scale-105 transition-transform shadow-md">
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                  </button>
                </Link>
              )}

              {/* H2H wins visual bar */}
              {totalMatchesPlayed > 0 && (
                <div className="w-full mb-3" aria-label={`Head to head wins: ${p1?.full_name} ${p1Wins} vs ${p2?.full_name} ${p2Wins}`}>
                  <div className="flex h-3 rounded-full overflow-hidden w-full shadow-inner bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${totalMatchesPlayed > 0 ? (p1Wins / totalMatchesPlayed) * 100 : 50}%` }}
                    />
                    <div
                      className="h-full bg-info transition-all duration-1000 ease-out"
                      style={{ width: `${totalMatchesPlayed > 0 ? (p2Wins / totalMatchesPlayed) * 100 : 50}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold mt-1 px-0.5">
                    <span className="text-primary">{p1Wins} W</span>
                    <span className="text-info">{p2Wins} W</span>
                  </div>
                </div>
              )}

              {/* Points Scored & Streaks Breakdown */}
              {(h2hPointStats.p1Points > 0 || h2hPointStats.p2Points > 0) && (
                <div className="w-full mb-3 p-2 bg-muted/40 rounded-xl border border-border-strong/40 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <span>Pts</span>
                    <span className="text-soft font-bold">{h2hPointStats.p1Points} - {h2hPointStats.p2Points}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex bg-muted-strong">
                    <div
                      className="h-full bg-success transition-all duration-700"
                      style={{ width: `${(h2hPointStats.p1Points / (h2hPointStats.p1Points + h2hPointStats.p2Points || 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-individual transition-all duration-700"
                      style={{ width: `${(h2hPointStats.p2Points / (h2hPointStats.p1Points + h2hPointStats.p2Points || 1)) * 100}%` }}
                    />
                  </div>
                  {(h2hPointStats.maxP1Streak > 1 || h2hPointStats.maxP2Streak > 1) && (
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground pt-1 border-t border-border-strong/50">
                      <span className="text-success">Streak: {h2hPointStats.maxP1Streak}</span>
                      <span className="text-individual">Streak: {h2hPointStats.maxP2Streak}</span>
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
              <div className="w-full bg-muted/50 p-2.5 rounded-xl border border-border-strong/50">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center mb-1.5 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-info" /> Win Prob
                </div>
                <div className="flex justify-between text-[10px] font-bold mb-1 px-1">
                  <span className="text-primary">
                    {p1WinProb}%
                  </span>
                  <span className="text-info">
                    {p2WinProb}%
                  </span>
                </div>
                <div className="h-2 w-full bg-info/20 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${p1WinProb}%` }}
                  />
                  <div
                    className="h-full bg-info transition-all duration-1000 ease-out"
                    style={{ width: `${p2WinProb}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 border-border shadow-lg">
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
                  className="text-sm sm:text-xl font-black text-foreground bg-transparent appearance-none text-center cursor-pointer hover:bg-muted px-2 sm:px-6 py-1 rounded-xl w-full focus:outline-none/90 focus:ring-0 focus:border-0/90 border-0 outline-none pr-8"
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none text-info">
                  <ChevronDown className="w-4 h-4 drop-shadow-sm" />
                </div>
              </div>
              <div className="flex gap-1.5 flex-row justify-center text-[10px] font-black mt-1 mx-auto min-h-[24px] w-full">
                {!!rankMap[p2?.id || ""]?.overall && (
                  <span className="px-2 py-1 bg-warning/10 text-warning rounded-md border border-warning/30">
                    OVR: #{rankMap[p2?.id || ""].overall}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.singles && (
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                    S: #{rankMap[p2?.id || ""].singles}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.doubles && (
                  <span className="px-2 py-1 bg-info/10 text-info rounded-md border border-info/30">
                    D: #{rankMap[p2?.id || ""].doubles}
                  </span>
                )}
                {!!rankMap[p2?.id || ""]?.mixed && (
                  <span className="px-2 py-1 bg-individual/10 text-individual rounded-md border border-individual/30">
                    XD: #{rankMap[p2?.id || ""].mixed}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {h2hTournamentMatches.length > 0 && (
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 w-full">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Match History
              </h3>
            </div>

            {h2hTournamentMatches.map((m, i) => {
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
                  className="group relative overflow-hidden rounded-xl border border-warning/35 bg-warning/10 shadow-sm transition-all duration-200 mb-2"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 pt-2.5 pb-1 gap-1 sm:gap-2">
                    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                       <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded font-bold">
                        {m.round_name}
                       </span>
                       <span className="text-[10px] font-bold text-muted-foreground mt-0.5 mr-2 sm:hidden">{m.match_code}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-black text-warning uppercase tracking-widest line-clamp-1 mt-1 sm:mt-0 sm:flex-1 sm:text-center">
                      {m.tournaments?.name ?? "Tournament"}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground hidden sm:block whitespace-nowrap">{m.match_code}</span>
                  </div>

                  {/* Teams */}
                  <div className="px-3 pb-2.5 pt-1">
                    <div className="relative flex flex-col">
                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${team1Won ? "bg-primary/10" : ""}`}>
                        {team1Won ? <Trophy className="w-3.5 h-3.5 text-gold shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${team1Won ? "text-primary" : "text-soft"}`}>
                          {mp1?.full_name}{mp3 ? ` & ${mp3.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>

                      <div className="flex items-center justify-center gap-3 py-1">
                        <div className="flex-1 h-px bg-muted-strong/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-danger">vs</span>
                        <div className="flex-1 h-px bg-muted-strong/50" />
                      </div>

                      <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 sm:justify-center ${!team1Won ? "bg-primary/10" : ""}`}>
                        {!team1Won ? <Trophy className="w-3.5 h-3.5 text-gold shrink-0" /> : <div className="w-3.5 h-3.5 shrink-0" />}
                        <span className={`flex-1 text-xs sm:text-sm font-bold leading-tight sm:flex-none sm:text-center ${!team1Won ? "text-primary" : "text-soft"}`}>
                          {mp2?.full_name}{mp4 ? ` & ${mp4.full_name}` : ""}
                        </span>
                        <div className="w-3.5 h-3.5 shrink-0 hidden sm:block opacity-0" />
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1 border-t border-warning/30 pt-2 pl-2 sm:justify-center sm:pl-0">
                      <BeautifulScoreDisplay score={m.score} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
