import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { TrendingUp, Award, Calendar } from "lucide-react";

export default function PersonalGrowthPage() {
  usePageMeta({
    title: "Growth",
    description: "Your growth and progress tracking.",
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
          player1:players!player1_id(id, full_name, elo_rating),
          player2:players!player2_id(id, full_name, elo_rating)
        `
        )
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
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

  // Calculate win rate
  const wins = matches.filter((m) => {
    const isPlayer1 = m.player1_id === profile?.id;
    return isPlayer1 ? m.score1 > m.score2 : m.score2 > m.score1;
  }).length;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Calculate ELO change (simple estimation)
  const eloChange =
    profile?.elo_rating && profile.created_at
      ? Math.round(profile.elo_rating - 1200)
      : 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Growth</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Track your progress and improvement
        </p>
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Win Rate */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/30 dark:to-primary/80/20 rounded-xl p-6 border border-primary/40 dark:border-primary/80">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6 text-primary dark:text-primary" />
            <h3 className="text-lg font-bold text-primary dark:text-primary/30">
              Win Rate
            </h3>
          </div>
          <div className="text-4xl font-bold text-primary dark:text-primary/30 mb-2">
            {winRate}%
          </div>
          <p className="text-sm text-primary dark:text-primary/70">
            {wins} wins from {matches.length} matches
          </p>
        </div>

        {/* ELO Progress */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
              ELO Growth
            </h3>
          </div>
          <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-2">
            {eloChange > 0 ? "+" : ""}{eloChange}
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Since joining the club
          </p>
        </div>
      </div>

      {/* Match Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Match Timeline
          </h3>
        </div>

        {matches.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            No matches yet. Start playing to track your growth!
          </p>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 10).map((match) => {
              const isPlayer1 = match.player1_id === profile?.id;
              const won = isPlayer1 ? match.score1 > match.score2 : match.score2 > match.score1;
              return (
                <div
                  key={match.id}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    won
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "bg-slate-50 dark:bg-slate-800"
                  }`}
                >
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        won
                          ? "text-primary dark:text-primary/30"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {match.player1?.full_name} vs {match.player2?.full_name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {new Date(match.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={`font-bold text-sm px-3 py-1 rounded ${
                      won
                        ? "bg-primary text-white"
                        : "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white"
                    }`}
                  >
                    {isPlayer1 ? match.score1 : match.score2} -{" "}
                    {isPlayer1 ? match.score2 : match.score1}
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
