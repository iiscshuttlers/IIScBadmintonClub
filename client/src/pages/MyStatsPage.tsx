import { useEffect, useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { EloChart } from "@/components/player-profile/EloChart";
import { AchievementBadges } from "@/components/player-profile/AchievementBadges";
import { usePlayers } from "@/hooks/usePlayers";

export default function MyStatsPage() {
  usePageMeta({
    title: "My Stats",
    description: "Your badminton performance analytics and statistics.",
  });

  const { profile: ownProfile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: allPlayers = [] } = usePlayers();

  const [matchTypeFilter, setMatchTypeFilter] = useState<"ALL" | "FRIENDLY" | "TOURNAMENT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "SINGLES" | "DOUBLES" | "MIXED">("ALL");

  useEffect(() => {
    if (!ownProfile?.id) return;

    const fetchMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
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
          `player1_id.eq.${ownProfile.id},player2_id.eq.${ownProfile.id},team1_partner_id.eq.${ownProfile.id},team2_partner_id.eq.${ownProfile.id}`
        )
        .eq("status", "confirmed")
        .order("date", { ascending: false });

      if (!error && data) {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMatches();
  }, [ownProfile?.id]);

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

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          {(["ALL", "FRIENDLY", "TOURNAMENT"] as const).map(type => (
            <button
              key={type}
              onClick={() => setMatchTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${matchTypeFilter === type ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-muted-foreground hover:text-on-accent'}`}
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
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${categoryFilter === cat ? 'bg-white dark:bg-slate-700 text-accent shadow-sm' : 'text-muted-foreground hover:text-on-accent'}`}
            >
              {cat === "ALL" ? "ALL CATS" : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold mb-1">Detailed Analytics</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Your performance analytics and achievement badges
        </p>
      </div>

      {/* Achievement Badges */}
      <div className="mb-8">
        <AchievementBadges
          matches={filteredMatches}
          playerId={ownProfile!.id}
          elo={ownProfile?.elo_rating ?? 1200}
        />
      </div>

      {/* Performance Trends */}
      <div className="mb-8">
        <PerformanceTrends matches={filteredMatches} playerId={ownProfile!.id} />
      </div>

      {/* Analytics Widget */}
      <div className="mb-8">
        <PlayerAnalyticsWidget playerId={ownProfile!.id} playerElo={ownProfile!.elo_rating} matches={filteredMatches} allPlayers={allPlayers} />
      </div>

      {/* Elo Chart */}
      <div className="mb-8">
        <EloChart playerId={ownProfile!.id} matches={filteredMatches} currentElo={ownProfile!.elo_rating} />
      </div>

    </div>
  );
}
