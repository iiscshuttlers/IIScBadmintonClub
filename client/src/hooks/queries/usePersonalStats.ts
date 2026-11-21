import { playerWon } from "@/lib/matchResult";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayer } from "@/services/playerService";
import { usePlayerPersonal } from "@/hooks/usePlayerPersonal";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";

export function usePersonalStats(playerId: string | undefined) {
  const { data: player, isLoading: isPlayerLoading } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => (playerId ? fetchPlayer(playerId) : null),
    enabled: !!playerId,
    staleTime: 60_000,
  });

  const { data: personalData, isLoading: isPersonalLoading } = usePlayerPersonal(playerId);
  const { matches: fullMatches, loading: isMatchesLoading } = usePlayerMatches(playerId);

  const matches = personalData?.matches ?? [];
  const motionSummary = personalData?.motion ?? null;
  const motionMatches = personalData?.motionMatches ?? [];
  const sensorAnalytics = personalData?.sensorAnalytics ?? [];
  const workRate = motionSummary ? motionSummary.runningPct + motionSummary.smashSprintPct * 2 : 0;

  const isWinner = (m: {
    player1_id?: string | null;
    team1_partner_id?: string | null;
    winner_side?: number | null;
    winner_id?: string | null;
  }) => {
    return playerWon(m, player?.id) === true;
  };

  const tournamentMatches = fullMatches?.filter((m) => m.is_friendly === false) || [];
  const recentTournament = tournamentMatches
    .slice(0, 5)
    .map((m) => (isWinner(m) ? "W" : "L"))
    .reverse();
  const tournamentStreak = recentTournament.join("");

  return {
    player,
    personalData,
    fullMatches: fullMatches ?? [],
    matches,
    motionSummary,
    motionMatches,
    sensorAnalytics,
    workRate,
    tournamentStreak,
    isLoading: isPlayerLoading || isPersonalLoading || isMatchesLoading,
  };
}
