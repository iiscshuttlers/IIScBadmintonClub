import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy,
  Swords,
  Flame,
  Users,
  Target,
  User,
  Sigma,
  UserPlus,
  ChevronUp,
  ArrowUpRight,
} from "lucide-react";
import type { PersonalMatch } from "@/hooks/usePlayerPersonal";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { StatCard } from "@/components/personal/StatCard";
import { PersonalMatchCardItem } from "@/components/personal/PersonalMatchesSection";

export interface PersonalHomeSectionProps {
  player: any;
  matches: PersonalMatch[];
  fullMatches: any[];
  currentUser: any;
}

export function PersonalHomeSection({
  player,
  matches,
  fullMatches,
  currentUser,
}: PersonalHomeSectionProps) {
  const [, setLocation] = useLocation();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { matches: allMatches } = usePlayerMatches(player?.id);

  const stats = useMemo(() => {
    const isWinner = (m: any) => {
      const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
      if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
      const isTeam1Winner = m.winner_side
        ? m.winner_side === 1
        : m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    };

    const isStraightSetWin = (m: any) => {
      if (!isWinner(m)) return false;
      const scoreStr = m.match_score || m.score || "";
      if (!scoreStr) return false;
      let lostASet = false;
      let playedSets = 0;
      const setStrs = scoreStr.split(/,| /).map((s: string) => s.trim()).filter(Boolean);
      for (const setStr of setStrs) {
        const parts = setStr.split("-");
        if (parts.length === 2) {
          const s1 = parseInt(parts[0], 10);
          const s2 = parseInt(parts[1], 10);
          if (isNaN(s1) || isNaN(s2)) continue;
          playedSets++;
          const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
          const team1WonSet = s1 > s2;
          if (!(isTeam1 ? team1WonSet : !team1WonSet)) {
            lostASet = true;
            break;
          }
        }
      }
      return !lostASet && playedSets > 0;
    };

    const allMatchesArr = allMatches || [];

    const friendlyMatches = allMatchesArr.filter((m) => m.is_friendly !== false);
    const tournamentMatches = allMatchesArr.filter((m) => m.is_friendly === false);

    const total = allMatchesArr.length;
    const wins = allMatchesArr.filter(isWinner).length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;

    const getForm = (arr: any[]) => {
      const recent = arr.slice(0, 10).map((m) => (isWinner(m) ? "W" : "L")).reverse();
      return recent.length > 0 ? recent.join(" ") : "No matches";
    };

    const streak = getForm(allMatchesArr);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const thisWeekMatches = allMatchesArr.filter(
      (m) => ((m as any).date || m.created_at || "") >= weekAgo
    );
    const thisWeek = thisWeekMatches.length;
    const thisWeekWins = thisWeekMatches.filter(isWinner).length;
    const thisWeekWinRate = thisWeek > 0 ? Math.round((thisWeekWins / thisWeek) * 100) : null;

    const friendlyWins = friendlyMatches.filter(isWinner).length;
    const tournamentWins = tournamentMatches.filter(isWinner).length;

    const isSingles = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return cat.includes("singles") || cat === "ms" || cat === "ws";
    };
    const isDoubles = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return (cat.includes("doubles") && !cat.includes("mixed")) || cat === "md" || cat === "wd";
    };
    const isMixed = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return cat.includes("mixed") || cat === "xd";
    };

    const friendlySingles = friendlyMatches.filter((m) => isSingles(m.category));
    const friendlyDoubles = friendlyMatches.filter((m) => isDoubles(m.category));
    const friendlyMixed = friendlyMatches.filter((m) => isMixed(m.category));

    const tournamentSingles = allMatchesArr.filter((m) => isSingles(m.category));
    const tournamentDoubles = allMatchesArr.filter((m) => isDoubles(m.category));
    const tournamentMixed = allMatchesArr.filter((m) => isMixed(m.category));

    return {
      wins,
      losses: total - wins,
      total,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(0) : "0",
      streak,
      thisWeek,
      thisWeekWinRate,
      elo: Math.round(player?.elo_rating ?? 1200),
      singlesElo: Math.round(player?.singles_elo ?? 1200),
      doublesElo: Math.round(player?.doubles_elo ?? 1200),
      mixedElo: Math.round(player?.mixed_elo ?? 1200),
      tournamentElo: Math.round(player?.tournament_elo ?? 1200),
      straightSets: allMatchesArr.filter(isStraightSetWin).length,
      friendly: { total: friendlyMatches.length, wins: friendlyWins, form: getForm(friendlyMatches) },
      tournament: { total: tournamentMatches.length, wins: tournamentWins, form: getForm(tournamentMatches), straightSets: tournamentMatches.filter(isStraightSetWin).length },
      friendlySingles: { total: friendlySingles.length, wins: friendlySingles.filter(isWinner).length, form: getForm(friendlySingles) },
      friendlyDoubles: { total: friendlyDoubles.length, wins: friendlyDoubles.filter(isWinner).length, form: getForm(friendlyDoubles) },
      friendlyMixed: { total: friendlyMixed.length, wins: friendlyMixed.filter(isWinner).length, form: getForm(friendlyMixed) },
      tournamentSingles: { total: tournamentSingles.length, wins: tournamentSingles.filter(isWinner).length, form: getForm(tournamentSingles), straightSets: tournamentSingles.filter(isStraightSetWin).length },
      tournamentDoubles: { total: tournamentDoubles.length, wins: tournamentDoubles.filter(isWinner).length, form: getForm(tournamentDoubles), straightSets: tournamentDoubles.filter(isStraightSetWin).length },
      tournamentMixed: { total: tournamentMixed.length, wins: tournamentMixed.filter(isWinner).length, form: getForm(tournamentMixed), straightSets: tournamentMixed.filter(isStraightSetWin).length },
    };
  }, [allMatches, player]);

  const recentMatches = fullMatches.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* This-week pulse */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sheen flex items-end justify-between gap-4 rounded-2xl border border-border bg-card/60 px-5 py-4 backdrop-blur-md"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            This week
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="gradient-text text-display text-4xl">{stats.thisWeek}</span>
            <span className="text-sm font-medium text-muted-foreground">matches played</span>
          </p>
        </div>
        {stats.thisWeekWinRate !== null && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {stats.thisWeekWinRate}% won
          </span>
        )}
      </motion.div>

      {/* Hero Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          onClick={() => setExpandedCard(expandedCard === "matches" ? null : "matches")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Swords}
            label="Total Matches"
            value={stats.total}
            sub={`${stats.wins}W · ${stats.losses}L`}
            color="var(--chart-2)"
            delay={0.05}
            expandable
            expanded={expandedCard === "matches"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "straightSets" ? null : "straightSets")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Trophy}
            label="Clean Sweeps"
            value={stats.straightSets}
            sub="2-0 wins"
            color="var(--chart-3)"
            delay={0.1}
            expandable
            expanded={expandedCard === "straightSets"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "winrate" ? null : "winrate")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Target}
            label="Win Rate"
            value={`${stats.winRate}%`}
            sub={`${stats.total} played`}
            color="var(--chart-4)"
            delay={0.15}
            expandable
            expanded={expandedCard === "winrate"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "streak" ? null : "streak")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Flame}
            label="Recent Form"
            value={
              stats.streak === "No matches" ? (
                "—"
              ) : (
                <span className="mx-auto flex max-w-[164px] flex-wrap justify-center gap-1">
                  {stats.streak.split(" ").map((r, i) => (
                    <span
                      key={i}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${
                        r === "W"
                          ? "bg-primary text-primary-foreground"
                          : "bg-series-b text-on-accent"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </span>
              )
            }
            color="var(--secondary)"
            delay={0.2}
            expandable
            expanded={expandedCard === "streak"}
          />
        </button>
      </div>

      {/* Expandable Breakdown Cards */}
      {expandedCard && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Sigma}
                label="Total"
                value={
                  expandedCard === "matches"
                    ? stats.tournament.total
                    : expandedCard === "straightSets"
                    ? stats.tournament.straightSets
                    : expandedCard === "winrate"
                    ? `${stats.tournament.total ? Math.round((stats.tournament.wins / stats.tournament.total) * 100) : 0}%`
                    : expandedCard === "streak"
                    ? stats.tournament.form
                    : stats.tournament.wins
                }
                sub={
                  expandedCard === "matches"
                    ? `${stats.tournament.wins} wins`
                    : expandedCard === "straightSets"
                    ? "2-0 wins"
                    : expandedCard === "streak"
                    ? "last 10"
                    : "overall"
                }
                color="var(--accent)"
                delay={0.29}
              />
              <StatCard
                icon={User}
                label="Singles"
                value={
                  expandedCard === "matches"
                    ? stats.tournamentSingles.total
                    : expandedCard === "straightSets"
                    ? stats.tournamentSingles.straightSets
                    : expandedCard === "winrate"
                    ? `${stats.tournamentSingles.total ? Math.round((stats.tournamentSingles.wins / stats.tournamentSingles.total) * 100) : 0}%`
                    : expandedCard === "streak"
                    ? stats.tournamentSingles.form
                    : stats.tournamentSingles.wins
                }
                sub={
                  expandedCard === "matches"
                    ? `${stats.tournamentSingles.wins} wins`
                    : expandedCard === "straightSets"
                    ? "2-0 wins"
                    : expandedCard === "streak"
                    ? "last 10"
                    : "singles"
                }
                color="var(--chart-4)"
                delay={0.3}
              />
              <StatCard
                icon={Users}
                label="Doubles"
                value={
                  expandedCard === "matches"
                    ? stats.tournamentDoubles.total
                    : expandedCard === "straightSets"
                    ? stats.tournamentDoubles.straightSets
                    : expandedCard === "winrate"
                    ? `${stats.tournamentDoubles.total ? Math.round((stats.tournamentDoubles.wins / stats.tournamentDoubles.total) * 100) : 0}%`
                    : expandedCard === "streak"
                    ? stats.tournamentDoubles.form
                    : stats.tournamentDoubles.wins
                }
                sub={
                  expandedCard === "matches"
                    ? `${stats.tournamentDoubles.wins} wins`
                    : expandedCard === "straightSets"
                    ? "2-0 wins"
                    : expandedCard === "streak"
                    ? "last 10"
                    : "doubles"
                }
                color="var(--chart-5)"
                delay={0.31}
              />
              <StatCard
                icon={UserPlus}
                label="Mixed"
                value={
                  expandedCard === "matches"
                    ? stats.tournamentMixed.total
                    : expandedCard === "straightSets"
                    ? stats.tournamentMixed.straightSets
                    : expandedCard === "winrate"
                    ? `${stats.tournamentMixed.total ? Math.round((stats.tournamentMixed.wins / stats.tournamentMixed.total) * 100) : 0}%`
                    : expandedCard === "streak"
                    ? stats.tournamentMixed.form
                    : stats.tournamentMixed.wins
                }
                sub={
                  expandedCard === "matches"
                    ? `${stats.tournamentMixed.wins} wins`
                    : expandedCard === "straightSets"
                    ? "2-0 wins"
                    : expandedCard === "streak"
                    ? "last 10"
                    : "mixed"
                }
                color="var(--chart-6)"
                delay={0.32}
              />
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={() => setExpandedCard(null)}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors bg-muted/80 px-4 py-2 rounded-full border border-border-strong shadow-sm"
              >
                <ChevronUp className="w-4 h-4" />
                Close Details
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="sheen rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Recent Matches</h2>
            </div>
            <button
              onClick={() => setLocation(`/player/${player.id}/personal/matches`)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-all hover:gap-1.5"
            >
              View all matches <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {recentMatches.map((m) => (
              <PersonalMatchCardItem key={m.id} match={m} currentUser={currentUser} />
            ))}
          </div>
        </motion.div>
      )}

      {matches.length === 0 && (
        <div className="bg-muted/80 rounded-2xl shadow-md border border-border-strong/50 p-8 text-center">
          <Trophy className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-semibold">No tournament matches yet</p>
        </div>
      )}
    </div>
  );
}
