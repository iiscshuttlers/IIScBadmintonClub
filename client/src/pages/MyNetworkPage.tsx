import { useEffect, useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/hooks/usePlayers";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerCard } from "@/components/players-directory/PlayerCard";
import type { Player } from "@/components/players-directory/PlayerCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Users } from "lucide-react";

export default function MyNetworkPage() {
  usePageMeta({
    title: "My Network",
    description: "Your badminton connections and buddies.",
  });

  const { profile: ownProfile } = useAuth();
  const { data: allPlayers = [], isLoading } = usePlayers();

  const myBuddyIds = useMemo(() => {
    return new Set<string>(((ownProfile as any)?.buddies as string[] | undefined) || []);
  }, [ownProfile]);

  const myBuddies = useMemo(() => {
    return allPlayers.filter((p: Player) => myBuddyIds.has(p.id));
  }, [allPlayers, myBuddyIds]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      <PageHeader
        badge="Connections"
        badgeIcon={<Users className="w-3.5 h-3.5" />}
        title="My Network"
        subtitle={`${myBuddies.length} ${myBuddies.length === 1 ? "buddy" : "buddies"}`}
        align="left"
      />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
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
    </div>
  );
}
