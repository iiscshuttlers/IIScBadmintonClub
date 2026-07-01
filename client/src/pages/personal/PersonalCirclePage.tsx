import { useEffect, useState, useMemo } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers, useBuddyRequests } from "@/hooks/usePlayers";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerCard } from "@/components/players-directory/PlayerCard";
import type { Player } from "@/components/players-directory/PlayerCard";
import { Users, UserCheck, Clock } from "lucide-react";

export default function PersonalCirclePage() {
  usePageMeta({
    title: "Circle",
    description: "Your badminton network and connections.",
  });

  const { profile: ownProfile } = useAuth();
  const { data: allPlayers = [], isLoading } = usePlayers();
  const { data: buddyRequestsRaw = [] } = useBuddyRequests(ownProfile?.id);

  const [activeTab, setActiveTab] = useState<"accepted" | "sent" | "received">("accepted");

  const buddyData = useMemo(() => {
    const accepted = new Set<string>();
    const sent = new Set<string>();
    const received = new Set<string>();

    buddyRequestsRaw.forEach((req: any) => {
      const otherPlayerId =
        req.sender_id === ownProfile?.id ? req.receiver_id : req.sender_id;

      if (req.status === "accepted") {
        accepted.add(otherPlayerId);
      } else if (req.sender_id === ownProfile?.id) {
        sent.add(otherPlayerId);
      } else {
        received.add(otherPlayerId);
      }
    });

    return { accepted, sent, received };
  }, [buddyRequestsRaw, ownProfile?.id]);

  const displayedPlayers = useMemo(() => {
    const playerIds =
      activeTab === "accepted"
        ? buddyData.accepted
        : activeTab === "sent"
          ? buddyData.sent
          : buddyData.received;

    return allPlayers.filter((p: Player) => playerIds.has(p.id));
  }, [allPlayers, buddyData, activeTab]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  const counts = {
    accepted: buddyData.accepted.size,
    sent: buddyData.sent.size,
    received: buddyData.received.size,
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground dark:text-foreground">Circle</h1>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2">
          Manage your badminton connections
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("accepted")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === "accepted"
              ? "border-primary text-primary dark:text-primary"
              : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Connected ({counts.accepted})
        </button>
        <button
          onClick={() => setActiveTab("sent")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === "sent"
              ? "border-primary text-primary dark:text-primary"
              : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending ({counts.sent})
        </button>
        <button
          onClick={() => setActiveTab("received")}
          className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === "received"
              ? "border-primary text-primary dark:text-primary"
              : "border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Requests ({counts.received})
        </button>
      </div>

      {/* Players Grid */}
      {displayedPlayers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground dark:text-muted-foreground">
            {activeTab === "accepted" &&
              "You haven't connected with anyone yet. Browse the Players directory to send connection requests!"}
            {activeTab === "sent" &&
              "No pending requests. Your connections will appear here once they accept."}
            {activeTab === "received" &&
              "No connection requests. When others request to connect, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPlayers.map((player: Player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}
