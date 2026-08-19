import { usePlayers, useAllTournamentMatches } from "@/hooks/usePlayers";
import { TournamentStandingsTab } from "@/components/events/TournamentStandingsTab";
import { Loader2 } from "lucide-react";

export function LiveStandingsSection() {
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: tournamentMatches = [], isLoading: matchesLoading } = useAllTournamentMatches();

  if (playersLoading || matchesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <TournamentStandingsTab matches={tournamentMatches} players={players} />;
}
