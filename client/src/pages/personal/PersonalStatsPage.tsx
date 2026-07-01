import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { EloChart } from "@/components/player-profile/EloChart";
import { AchievementBadges } from "@/components/player-profile/AchievementBadges";

export default function PersonalStatsPage() {
  usePageMeta({
    title: "Stats",
    description: "Your detailed badminton statistics and analytics.",
  });

  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Stats</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Your detailed performance analytics
        </p>
      </div>

      {/* Achievement Badges */}
      <div className="mb-8">
        <AchievementBadges
          matches={matches}
          playerId={profile!.id}
          elo={profile?.elo_rating ?? 1200}
        />
      </div>

      {/* Performance Trends */}
      <div className="mb-8">
        <PerformanceTrends matches={matches} />
      </div>

      {/* Analytics Widget */}
      <div className="mb-8">
        <PlayerAnalyticsWidget playerId={profile!.id} matches={matches} />
      </div>

      {/* Elo Chart */}
      <div className="mb-8">
        <EloChart playerId={profile!.id} matches={matches} />
      </div>

    </div>
  );
}
