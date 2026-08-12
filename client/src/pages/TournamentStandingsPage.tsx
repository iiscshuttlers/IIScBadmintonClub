import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePlayers, useAllTournamentMatches } from "@/hooks/usePlayers";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSiteData } from "@/lib/siteData";
import { TournamentStandingsTab } from "@/components/events/TournamentStandingsTab";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Trophy, Clock } from "lucide-react";

export default function TournamentStandingsPage() {
  usePageMeta({
    title: "Tournament Standings",
    description: "Current standings for tournament matches.",
  });

  const { isAdmin } = useAuth();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: tournamentMatches = [], isLoading: matchesLoading } = useAllTournamentMatches();
  
  const [showStandings, setShowStandings] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if standings are enabled in club_settings
    fetchSiteData<any>("club_settings", "config_fallback.json")
      .then((data: any) => {
        const isEnabled = !!data?.showTournamentStandings;
        setShowStandings(isEnabled);
      })
      .catch(() => {
        // Fallback to false if missing
        setShowStandings(false);
      });
  }, []);

  if (playersLoading || matchesLoading || showStandings === null) {
    return <PageSkeleton />;
  }

  // Only Admins bypass the toggle
  if (!showStandings && !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-black text-foreground dark:text-foreground mb-4 text-center">Coming Soon</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Tournament standings are currently being calculated. Check back later to see the rankings!
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-foreground dark:text-foreground flex items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-500" />
          Tournament Standings
        </h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Rankings based purely on confirmed tournament matches.
        </p>
      </div>

      <TournamentStandingsTab matches={tournamentMatches} players={players} />
    </div>
  );
}
