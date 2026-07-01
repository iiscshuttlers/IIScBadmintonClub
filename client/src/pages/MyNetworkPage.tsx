import { useEffect, useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers, useBuddyRequests } from "@/hooks/usePlayers";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerCard } from "@/components/players-directory/PlayerCard";
import type { Player } from "@/components/players-directory/PlayerCard";

export default function MyNetworkPage() {
  usePageMeta({
    title: "My Network",
    description: "Your badminton connections and buddies.",
  });

  const { profile: ownProfile } = useAuth();
  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: buddyRequestsRaw = [] } = useBuddyRequests(ownProfile?.id);

  const myBuddyIds = useMemo(() => {
    const accepted = new Set<string>();
    buddyRequestsRaw.forEach((req: any) => {
      if (req.status === "accepted") {
        const otherPlayerId = req.sender_id === ownProfile?.id ? req.receiver_id : req.sender_id;
        accepted.add(otherPlayerId);
      }
    });
    return accepted;
  }, [buddyRequestsRaw, ownProfile?.id]);

  const myBuddies = useMemo(() => {
    return allPlayers.filter((p: Player) => myBuddyIds.has(p.id));
  }, [allPlayers, myBuddyIds]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">My Network</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          {myBuddies.length} {myBuddies.length === 1 ? "buddy" : "buddies"}
        </p>
      </div>

      {myBuddies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground dark:text-muted-foreground">
            You haven't connected with any buddies yet. Browse the Players directory to send connection requests!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myBuddies.map((player: Player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}
