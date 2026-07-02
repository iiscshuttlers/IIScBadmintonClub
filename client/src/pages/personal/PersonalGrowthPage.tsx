import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { TrendingUp, Award, Calendar } from "lucide-react";
import { BeautifulScoreDisplay } from "@/components/feed/BeautifulScoreDisplay";

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
          player2:players!player2_id(id, full_name, elo_rating),
          partner1:players!team1_partner_id(id, full_name),
          partner2:players!team2_partner_id(id, full_name)
        `
        )
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id},team1_partner_id.eq.${profile.id},team2_partner_id.eq.${profile.id}`)
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
    const isTeam1 = m.player1_id === profile?.id || m.team1_partner_id === profile?.id;
    const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  }).length;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Calculate ELO change (simple estimation)
  const eloChange =
    profile?.elo_rating && profile.created_at
      ? Math.round(profile.elo_rating - 1200)
      : 0;

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Growth</h1>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
          Track your progress and improvement
        </p>
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Win Rate */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/10 dark:from-primary/30 dark:to-primary/80/20 rounded-lg p-4 border border-primary/40 dark:border-primary/80">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary dark:text-primary" />
            <h3 className="text-sm font-bold text-primary dark:text-primary/30">
              Win Rate
            </h3>
          </div>
          <div className="text-2xl font-bold text-primary dark:text-primary/30 mb-1">
            {winRate}%
          </div>
          <p className="text-xs text-primary dark:text-primary/70">
            {wins} wins from {matches.length} matches
          </p>
        </div>

        {/* ELO Progress */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">
              ELO Growth
            </h3>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
            {eloChange > 0 ? "+" : ""}{eloChange}
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Since joining the club
          </p>
        </div>
      </div>

      {/* Match Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground dark:text-foreground">
            Match Timeline
          </h3>
        </div>

        {matches.length === 0 ? (
          <p className="text-muted-foreground dark:text-muted-foreground">
            No matches yet. Start playing to track your growth!
          </p>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 10).map((match) => {
              const isTeam1 = match.player1_id === profile?.id || match.team1_partner_id === profile?.id;
              const isTeam1Winner = match.winner_id === match.player1_id || match.winner_id === match.team1_partner_id;
              const won = isTeam1 ? isTeam1Winner : !isTeam1Winner;
              const scoreStr = (match.match_score || match.score || "").split(" | ")[0];
              const team1Name = `${match.player1?.full_name ?? "Unknown"}${match.partner1 ? ` & ${match.partner1.full_name}` : ""}`;
              const team2Name = `${match.player2?.full_name ?? "Unknown"}${match.partner2 ? ` & ${match.partner2.full_name}` : ""}`;
              const when = new Date(match.created_at || match.date);
              return (
                <div
                  key={match.id}
                  className={`p-2 rounded-lg flex items-center justify-between ${
                    won
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "bg-slate-50 dark:bg-slate-800"
                  }`}
                >
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        won
                          ? "text-primary dark:text-primary/30"
                          : "text-foreground dark:text-foreground"
                      }`}
                    >
                      {team1Name} <span className="text-rose-500 font-black">vs</span> {team2Name}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                      {when.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </p>
                    {scoreStr && (
                      <div className="mt-1.5">
                        <BeautifulScoreDisplay score={scoreStr} />
                      </div>
                    )}
                  </div>
                  <div
                    className={`font-black text-sm w-8 h-8 flex items-center justify-center rounded-lg shrink-0 ${
                      won
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-300 dark:bg-slate-700 text-foreground dark:text-foreground"
                    }`}
                  >
                    {won ? "W" : "L"}
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
