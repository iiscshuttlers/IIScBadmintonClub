import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { fetchRail } from "@/components/home/HomeMatchRail";
import { MyTournamentCard } from "@/components/home/MyTournamentCard";
import { toMatchView } from "@/lib/matchView";
import { buildMyTournamentSummary } from "@/lib/homeRail";
import { useMyTournamentCheckin } from "@/components/checkin/PlayerCheckin";

/**
 * "Your next match" for a signed-in player, shown above a tournament's tabs.
 * Shares the Home rail's query (same key), so it costs no extra request when
 * the player arrives from Home. Renders nothing for viewers who aren't playing.
 */
export function TournamentNextMatch({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const { session } = useAuth();
  const { myPlayerId } = useNavigationAuth();
  const userId = session?.user?.id ?? null;

  const q = useQuery({
    queryKey: ["tournament_matches", "home-rail", userId, myPlayerId ?? null],
    enabled: !!userId && !!myPlayerId,
    queryFn: () => fetchRail(userId!, myPlayerId ?? null),
    staleTime: 30_000,
    retry: 1,
  });

  const summary = useMemo(() => {
    const views = (q.data?.rows ?? [])
      .filter((r) => r.tournament_id === tournamentId)
      .map((r) => toMatchView(r));
    return buildMyTournamentSummary(views, myPlayerId ?? null);
  }, [q.data, tournamentId, myPlayerId]);
  // "I'm here" check-in and opponent/partner status (signed-in players only).
  const checkin = useMyTournamentCheckin(summary ? tournamentId : null, myPlayerId ?? null);

  if (!summary || !myPlayerId) return null;
  return (
    <div className="mb-4 text-left">
      <MyTournamentCard summary={summary} myPlayerId={myPlayerId} tournamentNames={{ [tournamentId]: tournamentName }} checkin={checkin} />
    </div>
  );
}
