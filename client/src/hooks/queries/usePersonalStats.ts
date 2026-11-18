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

  const isWinner = (m: any) => {
    if (!player?.id) return false;
    const isTeam1 = m.player1_id === player.id || m.team1_partner_id === player.id;
    if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
    const isTeam1Winner = m.winner_side
      ? m.winner_side === 1
      : m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  };

  const tournamentMatches = fullMatches?.filter((m: any) => m.is_friendly === false) || [];
  const recentTournament = tournamentMatches
    .slice(0, 5)
    .map((m: any) => (isWinner(m) ? "W" : "L"))
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
