import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { StatCard } from "@/components/personal/StatCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MatchCard } from "@/components/feed/MatchCard";
import {
  Swords,
  TrendingUp,
  Target,
  Flame,
  Users,
  User,
  UserPlus,
  Sigma,
  ArrowUpRight,
  Plus,
  Search,
  ChevronUp,
} from "lucide-react";
import { NotificationsMenu } from "@/components/NotificationsMenu";

interface MatchRow {
  id: string;
  date: string | null;
  status: string | null;
  winner_id: string | null;
  is_friendly?: boolean | null;
  category?: string | null;
  score?: string | null;
  match_score?: string | null;
  player1?: any;
  player2?: any;
  partner1?: any;
  partner2?: any;
  [key: string]: any;
}

export default function PersonalHomePage() {
  usePageMeta({
    title: "Dashboard",
    description: "Your personal badminton dashboard.",
  });

  const { profile } = useAuth();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null);
  
  const statsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-close expanded cards when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (statsContainerRef.current && !statsContainerRef.current.contains(event.target as Node)) {
        setExpandedCard(null);
      }
    }

    if (expandedCard) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [expandedCard]);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:players!player1_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo),
          player2:players!player2_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo),
          partner1:players!team1_partner_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo),
          partner2:players!team2_partner_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo)
        `
        )
        .or(
          `player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id}`
        )
        .eq("status", "confirmed")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error fetching matches:", error);
      }

      setMatches((data as unknown as MatchRow[]) ?? []);
      setLoading(false);
    };

    fetchData();
  }, [profile?.id]);

  const stats = useMemo(() => {
    const isWinner = (m: MatchRow) => {
      const isTeam1 = m.player1_id === profile?.id || m.team1_partner_id === profile?.id;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    };

    const total = matches.length;
    const wins = matches.filter(isWinner).length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;

    const getForm = (arr: MatchRow[]) => {
      const recent = arr.slice(0, 10).map(m => isWinner(m) ? "W" : "L").reverse();
      return recent.length > 0 ? recent.join(" ") : "No matches";
    };

    // Current form string (last 10 matches)
    const streak = getForm(matches);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const thisWeekMatches = matches.filter((m) => (m.date ?? "") >= weekAgo);
    const thisWeek = thisWeekMatches.length;
    const thisWeekWins = thisWeekMatches.filter(isWinner).length;
    const thisWeekWinRate = thisWeek ? Math.round((thisWeekWins / thisWeek) * 100) : null;

    // Break down by match type
    const friendlyMatches = matches.filter((m) => m.is_friendly !== false);
    const tournamentMatches = matches.filter((m) => m.is_friendly === false);
    const friendlyWins = friendlyMatches.filter(isWinner).length;
    const tournamentWins = tournamentMatches.filter(isWinner).length;

    // Break down by category
    const singlesMatches = matches.filter((m) => m.category?.toLowerCase().includes("singles"));
    const doublesMatches = matches.filter((m) => m.category?.toLowerCase().includes("doubles") && !m.category?.toLowerCase().includes("mixed"));
    const mixedMatches = matches.filter((m) => m.category?.toLowerCase().includes("mixed"));

    // Combined breakdowns
    const friendlySingles = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("singles"));
    const friendlyDoubles = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("doubles") && !m.category?.toLowerCase().includes("mixed"));
    const friendlyMixed = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("mixed"));
    const tournamentSingles = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("singles"));
    const tournamentDoubles = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("doubles") && !m.category?.toLowerCase().includes("mixed"));
    const tournamentMixed = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("mixed"));

    return {
      total,
      wins,
      winRate,
      streak,
      thisWeek,
      thisWeekWinRate,
      elo: Math.round(profile?.elo_rating ?? 1200),
      singlesElo: Math.round(profile?.singles_elo ?? 1200),
      doublesElo: Math.round(profile?.doubles_elo ?? 1200),
      mixedElo: Math.round(profile?.mixed_elo ?? 1200),
      tournamentElo: Math.round(profile?.tournament_elo ?? 1200),
      friendly: { total: friendlyMatches.length, wins: friendlyWins, form: getForm(friendlyMatches) },
      tournament: { total: tournamentMatches.length, wins: tournamentWins, form: getForm(tournamentMatches) },
      singles: { total: singlesMatches.length, wins: singlesMatches.filter(isWinner).length, form: getForm(singlesMatches) },
      doubles: { total: doublesMatches.length, wins: doublesMatches.filter(isWinner).length, form: getForm(doublesMatches) },
      mixed: { total: mixedMatches.length, wins: mixedMatches.filter(isWinner).length, form: getForm(mixedMatches) },
      // Friendly breakdowns
      friendlySingles: { total: friendlySingles.length, wins: friendlySingles.filter(isWinner).length, form: getForm(friendlySingles) },
      friendlyDoubles: { total: friendlyDoubles.length, wins: friendlyDoubles.filter(isWinner).length, form: getForm(friendlyDoubles) },
      friendlyMixed: { total: friendlyMixed.length, wins: friendlyMixed.filter(isWinner).length, form: getForm(friendlyMixed) },
      // Tournament breakdowns
      tournamentSingles: { total: tournamentSingles.length, wins: tournamentSingles.filter(isWinner).length, form: getForm(tournamentSingles) },
      tournamentDoubles: { total: tournamentDoubles.length, wins: tournamentDoubles.filter(isWinner).length, form: getForm(tournamentDoubles) },
      tournamentMixed: { total: tournamentMixed.length, wins: tournamentMixed.filter(isWinner).length, form: getForm(tournamentMixed) },
      connections: (profile?.following as string[] | null)?.length ?? 0,
    };
  }, [matches, profile]);

  if (loading) {
    return <PageSkeleton />;
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Player";
  const initial = firstName.charAt(0).toUpperCase();
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const recent = matches.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border px-5 pt-8 pb-7 lg:px-8 lg:pt-10">
        <div className="grid-texture absolute inset-0 opacity-60" />
        <div className="orb orb-volt absolute -top-24 -right-16 h-72 w-72" />
        <div className="orb orb-cyan absolute -bottom-16 left-1/4 h-44 w-44" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={firstName}
                  className="h-16 w-16 rounded-full border-2 border-primary/40 object-cover"
                />
              ) : (
                <div className="gradient-bg flex h-16 w-16 items-center justify-center rounded-full text-2xl font-extrabold text-primary-foreground">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{greeting()},</p>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-0.5 truncate text-3xl font-extrabold leading-none tracking-tight lg:text-4xl"
                >
                  {firstName}
                </motion.h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold capitalize text-primary">
                    {profile?.playing_level ?? "Player"}
                  </span>
                  {stats.streak !== "No matches" && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                      <Flame className="h-3.5 w-3.5" />
                      {stats.streak}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">

              <button
                onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                aria-label="Log Match"
                className="shrink-0 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-full h-11 w-11 sm:w-auto sm:rounded-lg sm:px-4 shadow-sm hover:opacity-90 transition"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">Log Match</span>
              </button>
            </div>
          </div>

          {/* This-week pulse */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="sheen mt-6 flex items-end justify-between gap-4 rounded-2xl border border-border bg-card/60 px-5 py-4 backdrop-blur-md"
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
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Win rate
              </p>
              <p className="text-display mt-1 text-2xl text-accent">
                {stats.thisWeekWinRate !== null ? stats.thisWeekWinRate : "-"}
                {stats.thisWeekWinRate !== null && (
                  <span className="text-sm font-medium text-muted-foreground">%</span>
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
        {/* Main Stats Grid - 4 Cards with Clickable Indicators */}
        <div ref={statsContainerRef} className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            onClick={() => setExpandedCard(expandedCard === "matches" ? null : "matches")}
            className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full"
          >
            <StatCard
              icon={Swords}
              label="Total Matches"
              value={stats.total}
              sub={`${stats.wins} wins`}
              color="var(--primary)"
              delay={0.05}
              expandable
              expanded={expandedCard === "matches"}
            />
          </button>
          <button
            onClick={() => setExpandedCard(expandedCard === "elo" ? null : "elo")}
            className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full"
          >
            <StatCard
              icon={TrendingUp}
              label="Overall ELO"
              value={stats.elo}
              sub="rating"
              color="var(--accent)"
              delay={0.1}
              expandable
              expanded={expandedCard === "elo"}
            />
          </button>
          <button
            onClick={() => setExpandedCard(expandedCard === "winrate" ? null : "winrate")}
            className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full"
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
            className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full"
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
                            : "bg-rose-500 text-white"
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
              {/* Friendly Row */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Friendly Matches</div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  icon={Sigma}
                  label="Total"
                  value={expandedCard === "matches" ? stats.friendly.total : expandedCard === "elo" ? stats.elo : expandedCard === "winrate" ? `${stats.friendly.total ? Math.round((stats.friendly.wins / stats.friendly.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendly.form : stats.friendly.wins}
                  sub={expandedCard === "matches" ? `${stats.friendly.wins} wins` : expandedCard === "elo" ? "overall" : expandedCard === "streak" ? "last 10" : "overall"}
                  color="var(--primary)"
                  delay={0.25}
                />
                <StatCard
                  icon={User}
                  label="Singles"
                  value={expandedCard === "matches" ? stats.friendlySingles.total : expandedCard === "elo" ? stats.singlesElo : expandedCard === "winrate" ? `${stats.friendlySingles.total ? Math.round((stats.friendlySingles.wins / stats.friendlySingles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlySingles.form : stats.friendlySingles.wins}
                  sub={expandedCard === "matches" ? `${stats.friendlySingles.wins} wins` : expandedCard === "streak" ? "last 10" : "singles"}
                  color="var(--chart-1)"
                  delay={0.26}
                />
                <StatCard
                  icon={Users}
                  label="Doubles"
                  value={expandedCard === "matches" ? stats.friendlyDoubles.total : expandedCard === "elo" ? stats.doublesElo : expandedCard === "winrate" ? `${stats.friendlyDoubles.total ? Math.round((stats.friendlyDoubles.wins / stats.friendlyDoubles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlyDoubles.form : stats.friendlyDoubles.wins}
                  sub={expandedCard === "matches" ? `${stats.friendlyDoubles.wins} wins` : expandedCard === "streak" ? "last 10" : "doubles"}
                  color="var(--chart-2)"
                  delay={0.27}
                />
                <StatCard
                  icon={UserPlus}
                  label="Mixed"
                  value={expandedCard === "matches" ? stats.friendlyMixed.total : expandedCard === "elo" ? stats.mixedElo : expandedCard === "winrate" ? `${stats.friendlyMixed.total ? Math.round((stats.friendlyMixed.wins / stats.friendlyMixed.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlyMixed.form : stats.friendlyMixed.wins}
                  sub={expandedCard === "matches" ? `${stats.friendlyMixed.wins} wins` : expandedCard === "streak" ? "last 10" : "mixed"}
                  color="var(--chart-3)"
                  delay={0.28}
                />
              </div>

              {/* Tournament Row */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Tournament Matches</div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  icon={Sigma}
                  label="Total"
                  value={expandedCard === "matches" ? stats.tournament.total : expandedCard === "elo" ? stats.tournamentElo : expandedCard === "winrate" ? `${stats.tournament.total ? Math.round((stats.tournament.wins / stats.tournament.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournament.form : stats.tournament.wins}
                  sub={expandedCard === "matches" ? `${stats.tournament.wins} wins` : expandedCard === "streak" ? "last 10" : "overall"}
                  color="var(--accent)"
                  delay={0.29}
                />
                <StatCard
                  icon={User}
                  label="Singles"
                  value={expandedCard === "matches" ? stats.tournamentSingles.total : expandedCard === "elo" ? profile?.tournament_singles_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentSingles.total ? Math.round((stats.tournamentSingles.wins / stats.tournamentSingles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentSingles.form : stats.tournamentSingles.wins}
                  sub={expandedCard === "matches" ? `${stats.tournamentSingles.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "singles"}
                  color="var(--chart-4)"
                  delay={0.3}
                />
                <StatCard
                  icon={Users}
                  label="Doubles"
                  value={expandedCard === "matches" ? stats.tournamentDoubles.total : expandedCard === "elo" ? profile?.tournament_doubles_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentDoubles.total ? Math.round((stats.tournamentDoubles.wins / stats.tournamentDoubles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentDoubles.form : stats.tournamentDoubles.wins}
                  sub={expandedCard === "matches" ? `${stats.tournamentDoubles.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "doubles"}
                  color="var(--chart-5)"
                  delay={0.31}
                />
                <StatCard
                  icon={UserPlus}
                  label="Mixed"
                  value={expandedCard === "matches" ? stats.tournamentMixed.total : expandedCard === "elo" ? profile?.tournament_mixed_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentMixed.total ? Math.round((stats.tournamentMixed.wins / stats.tournamentMixed.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentMixed.form : stats.tournamentMixed.wins}
                  sub={expandedCard === "matches" ? `${stats.tournamentMixed.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "mixed"}
                  color="var(--chart-6)"
                  delay={0.32}
                />
              </div>

              {/* Close Button at the bottom */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setExpandedCard(null)}
                  className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <ChevronUp className="w-4 h-4" />
                  Close Details
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </div>

        {/* Recent Matches */}
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
            <Link
              href="/personal/stats"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary transition-all hover:gap-1.5"
            >
              View stats <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="py-8 text-center">
              <Swords className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No matches yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Play a match to see your history here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((m) => {
                const isTeam1 = m.player1?.id === profile?.id || m.partner1?.id === profile?.id;
                const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
                const won = isTeam1 ? isTeam1Winner : !isTeam1Winner;
                const myPartner = isTeam1
                  ? m.player1?.id === profile?.id ? m.partner1 : m.player1
                  : m.player2?.id === profile?.id ? m.partner2 : m.player2;
                const opp1 = isTeam1 ? m.player2 : m.player1;
                const opp2 = isTeam1 ? m.partner2 : m.partner1;

                const vsString = opp2
                  ? `${opp1?.full_name ?? "Unknown"} & ${opp2?.full_name ?? "Unknown"}`
                  : opp1?.full_name;

                let scoreText = m.score || m.match_score || "";
                scoreText = scoreText.replace(/\s*\[.*$/, "").trim();
                const sets = scoreText.split(",").map((s: string) => s.trim()).filter(Boolean);

                const parsedSets = sets.map(s => {
                  const parts = s.split("-");
                  if (parts.length !== 2) return null;
                  const p1 = parseInt(parts[0], 10);
                  const p2 = parseInt(parts[1], 10);
                  if (isNaN(p1) || isNaN(p2)) return null;
                  const myScore = isTeam1 ? p1 : p2;
                  const oppScore = isTeam1 ? p2 : p1;
                  const iWonSet = myScore > oppScore;
                  return { p1, p2, myScore, oppScore, iWonSet };
                }).filter(Boolean);

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatch(m)}
                    className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 cursor-pointer transition-colors hover:bg-muted/70"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                        won
                          ? "bg-primary/15 text-primary"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {won ? "W" : "L"}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="text-sm leading-snug">
                        <span className="text-muted-foreground font-medium">vs</span>{" "}
                        <span className="font-bold text-foreground">{vsString ?? "Opponent"}</span>
                      </p>
                      {myPartner && (
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                          w/ <span className="font-semibold text-foreground/90">{myPartner.full_name}</span>
                        </p>
                      )}
                      <p className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
                        {(m.created_at || m.date) ? new Date(m.created_at || m.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ""}
                      </p>
                      {parsedSets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {parsedSets.map((set, i: number) => {
                            if (!set) return null;
                            const myColor = set.iWonSet ? "text-primary" : "text-destructive";
                            const oppColor = "text-muted-foreground";
                            return (
                              <div
                                key={i}
                                className={`flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-black shadow-sm ${
                                  set.iWonSet ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"
                                }`}
                              >
                                <span className={isTeam1 ? myColor : oppColor}>{set.p1}</span>
                                <span className="mx-0.5 text-[9px] text-muted-foreground/40 font-medium">-</span>
                                <span className={!isTeam1 ? myColor : oppColor}>{set.p2}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {matches.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 5)}
                  className="w-full rounded-xl bg-muted/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/70"
                >
                  Load More
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Connections nudge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="sheen flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {stats.connections} connections
              </p>
              <p className="text-xs text-muted-foreground">Players you follow</p>
            </div>
          </div>
          <Link
            href="/personal/circle"
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary transition-all hover:gap-1.5"
          >
            View circle <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>

      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-0 shadow-none">
          {selectedMatch && (
            <MatchCard
              match={selectedMatch}
              currentUser={profile}
              isKudosed={false}
              kudosCount={0}
              hideActions
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
