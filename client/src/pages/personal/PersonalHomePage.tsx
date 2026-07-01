import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Activity, TrendingUp, Users, Trophy } from "lucide-react";

export default function PersonalHomePage() {
  usePageMeta({
    title: "Dashboard",
    description: "Your personal badminton dashboard.",
  });

  const { profile } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch recent matches
      const { data: matches } = await supabase
        .from("matches")
        .select(
          `
          *,
          player1:players!player1_id(id, full_name, avatar_url),
          player2:players!player2_id(id, full_name, avatar_url)
        `
        )
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(5);

      if (matches) {
        setRecentMatches(matches);
      }

      setLoading(false);
    };

    fetchData();
  }, [profile?.id]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">
          Welcome back, {profile?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Here's your badminton activity overview
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/30 dark:to-primary/80/20 rounded-xl p-4 border border-primary/40 dark:border-primary/80">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-primary dark:text-primary" />
            <span className="text-sm text-primary dark:text-primary/70 font-medium">
              Matches
            </span>
          </div>
          <div className="text-2xl font-bold text-primary dark:text-primary/30">
            {recentMatches.length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              ELO Rating
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {Math.round(profile?.elo_rating || 1200)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
              Connections
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {(profile?.following as any[])?.length || 0}
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span className="text-sm text-rose-700 dark:text-rose-300 font-medium">
              Member Since
            </span>
          </div>
          <div className="text-sm font-bold text-rose-900 dark:text-rose-100">
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "Unknown"}
          </div>
        </div>
      </div>

      {/* Recent Matches */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-xl font-bold text-foreground dark:text-foreground mb-4">
          Recent Matches
        </h2>
        {recentMatches.length === 0 ? (
          <p className="text-muted-foreground dark:text-muted-foreground">
            No recent matches. Start playing to see your history!
          </p>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-foreground dark:text-foreground">
                    {match.player1?.full_name} vs {match.player2?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    {new Date(match.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground dark:text-foreground">
                    {match.score1} - {match.score2}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
