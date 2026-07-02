import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { StatCard } from "@/components/personal/StatCard";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { EloChart } from "@/components/player-profile/EloChart";
import { AchievementBadges } from "@/components/player-profile/AchievementBadges";
import { Swords, Trophy, Target, TrendingUp, BarChart3, Users } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { H2HSection } from "@/components/players-directory/H2HSection";

export default function PersonalStatsPage() {
  usePageMeta({
    title: "Stats",
    description: "Your detailed badminton statistics and analytics.",
  });

  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: allPlayers = [] } = usePlayers();

  const [matchTypeFilter, setMatchTypeFilter] = useState<"ALL" | "FRIENDLY" | "TOURNAMENT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "SINGLES" | "DOUBLES" | "MIXED">("ALL");

  const [activeTab, setActiveTab] = useState<"overview" | "h2h">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") === "h2h" ? "h2h" : "overview";
    }
    return "overview";
  });

  useEffect(() => {
    if (!profile?.id) return;

    const fetchMatches = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:players!player1_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo),
          player2:players!player2_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo),
          partner1:players!team1_partner_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo),
          partner2:players!team2_partner_id(id, full_name, avatar_url, elo_rating, singles_elo, doubles_elo, mixed_elo)
        `
        )
        .or(
          `player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id}`
        )
        .eq("status", "confirmed")
        .order("date", { ascending: false });

      if (data) {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMatches();
  }, [profile?.id]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (matchTypeFilter === "FRIENDLY" && m.is_friendly === false) return false;
      if (matchTypeFilter === "TOURNAMENT" && m.is_friendly !== false) return false;

      if (categoryFilter === "SINGLES" && !m.category?.toLowerCase().includes("singles")) return false;
      if (categoryFilter === "DOUBLES" && (!m.category?.toLowerCase().includes("doubles") || m.category?.toLowerCase().includes("mixed"))) return false;
      if (categoryFilter === "MIXED" && !m.category?.toLowerCase().includes("mixed")) return false;

      return true;
    });
  }, [matches, matchTypeFilter, categoryFilter]);

  const summary = useMemo(() => {
    const total = filteredMatches.length;
    const wins = filteredMatches.filter((m) => {
      const isTeam1 = m.player1_id === profile?.id || m.team1_partner_id === profile?.id;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    }).length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    return {
      total,
      wins,
      winRate,
      elo: Math.round(profile?.elo_rating ?? 1200),
    };
  }, [filteredMatches, profile]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Analytics</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Your game, by the numbers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto hide-scrollbar w-full justify-center">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("h2h")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "h2h"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Swords className="w-4 h-4" />
          Head-to-Head
        </button>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          {(["ALL", "FRIENDLY", "TOURNAMENT"] as const).map(type => (
            <button
              key={type}
              onClick={() => setMatchTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${matchTypeFilter === type ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {type === "ALL" ? "OVERALL" : type}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          {(["ALL", "SINGLES", "DOUBLES", "MIXED"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${categoryFilter === cat ? 'bg-white dark:bg-slate-700 text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {cat === "ALL" ? "ALL CATS" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Glow stat grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Swords}
          label="Matches"
          value={summary.total}
          sub="confirmed"
          color="var(--primary)"
          delay={0.05}
        />
        <StatCard
          icon={Trophy}
          label="Wins"
          value={summary.wins}
          sub={`${summary.total - summary.wins} losses`}
          color="var(--accent)"
          delay={0.1}
        />
        <StatCard
          icon={Target}
          label="Win Rate"
          value={`${summary.winRate}%`}
          sub="all time"
          color="var(--chart-4)"
          delay={0.15}
        />
        <StatCard
          icon={TrendingUp}
          label="ELO Rating"
          value={summary.elo}
          sub="current"
          color="var(--secondary)"
          delay={0.2}
        />
      </div>

      {/* Achievement Badges */}
      <div className="mb-8">
        <AchievementBadges
          matches={filteredMatches}
          playerId={profile!.id}
          elo={profile?.elo_rating ?? 1200}
        />
      </div>

      {/* Performance Trends */}
      <div className="mb-8">
        <PerformanceTrends matches={filteredMatches} playerId={profile!.id} />
      </div>

      {/* Analytics Widget */}
      <div className="mb-8">
        <PlayerAnalyticsWidget playerId={profile!.id} playerElo={profile!.elo_rating} matches={filteredMatches} allPlayers={allPlayers} />
      </div>

      {/* Elo Chart */}
      <div className="mb-8">
        <EloChart playerId={profile!.id} matches={filteredMatches} currentElo={profile!.elo_rating} />
      </div>
        </>
      ) : (
        <H2HSection />
      )}

    </div>
  );
}
