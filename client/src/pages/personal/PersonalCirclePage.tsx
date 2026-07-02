import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers, useBuddyRequests, useFollowers } from "@/hooks/usePlayers";
import { useSocialActions } from "@/hooks/useSocial";
import { useDirectoryFilters } from "@/hooks/useDirectoryFilters";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PlayerCard } from "@/components/players-directory/PlayerCard";
import type { Player } from "@/components/players-directory/PlayerCard";
import { DirectoryTab } from "@/components/players-directory/tabs/DirectoryTab";
import { Users, UserCheck, Clock, Search, UserPlus } from "lucide-react";

export default function PersonalCirclePage() {
  usePageMeta({
    title: "Circle",
    description: "Your badminton network and connections.",
  });

  const { profile: ownProfile, isAdmin } = useAuth();
  const { data: allPlayers = [], isLoading, isError: fetchError, refetch: fetchPlayers } = usePlayers();
  const { data: buddyRequestsRaw = [] } = useBuddyRequests(ownProfile?.id);
  const { data: followers = [] } = useFollowers(ownProfile?.id);

  const [, setLocation] = useLocation();
  const { handleBuddyAction: doBuddyAction, handleToggleFollow: doToggleFollow } = useSocialActions();

  const [activeTab, setActiveTab] = useState<"accepted" | "following" | "requests" | "directory">("accepted");
  const [visibleCount, setVisibleCount] = useState(24);

  // Connection Data
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

  const followingIds = new Set<string>((ownProfile as any)?.following || []);

  const filters = useDirectoryFilters(allPlayers, ownProfile?.id, buddyData.accepted);

  const handleAdminDelete = (id: string) => {
    // Admin delete functionality if needed
  };

  const handleAdminEdit = (id: string) => {
    setLocation(`/admin/players?edit=${id}`);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const counts = {
    accepted: buddyData.accepted.size,
    following: followingIds.size,
    followers: followers.length,
    requests: buddyData.sent.size + buddyData.received.size,
  };

  // Prepare players for non-directory tabs
  const getPlayersByIds = (ids: Set<string>) => allPlayers.filter((p) => ids.has(p.id));

  const acceptedPlayers = getPlayersByIds(buddyData.accepted);
  const followingPlayers = getPlayersByIds(followingIds);
  const sentRequestPlayers = getPlayersByIds(buddyData.sent);
  const receivedRequestPlayers = getPlayersByIds(buddyData.received);

  const commonPlayerCardProps = {
    isAdmin,
    onDelete: handleAdminDelete,
    onEdit: handleAdminEdit,
    onBuddyAction: (playerId: string, action: any) => doBuddyAction({ playerId, action }),
    onToggleFollow: (targetId: string) => doToggleFollow({ targetId, targetName: "" }),
    currentUserName: ownProfile?.full_name,
    currentUserId: ownProfile?.id,
    isPersonalView: true,
  };

  const getPlayerStateProps = (playerId: string) => ({
    isBuddy: buddyData.accepted.has(playerId),
    hasReceivedRequest: buddyData.received.has(playerId),
    hasSentRequest: buddyData.sent.has(playerId),
    isFollowing: followingIds.has(playerId),
  });

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground">Circle</h1>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
          Manage your badminton connections
        </p>
      </div>

      {/* Followers/Following Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 sm:grid-cols-3 max-w-2xl">
        <div className="text-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="text-xl font-bold text-primary dark:text-primary">{counts.accepted}</div>
          <div className="text-xs text-muted-foreground dark:text-muted-foreground font-semibold">Connected</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="text-xl font-bold text-primary dark:text-primary">{counts.following}</div>
          <div className="text-xs text-muted-foreground dark:text-muted-foreground font-semibold">Following</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="text-xl font-bold text-primary dark:text-primary">{counts.followers}</div>
          <div className="text-xs text-muted-foreground dark:text-muted-foreground font-semibold">Followers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 mb-4 sm:border-b sm:border-slate-200 sm:dark:border-slate-800 sm:overflow-x-auto sm:pb-2 sm:scrollbar-hide">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-sm font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "directory"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4" />
          Directory
        </button>
        <button
          onClick={() => setActiveTab("accepted")}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-sm font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "accepted"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Connected ({counts.accepted})
        </button>
        <button
          onClick={() => setActiveTab("following")}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-sm font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "following"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Following ({counts.following})
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-sm font-semibold transition-colors rounded-xl sm:rounded-none sm:border-b-2 whitespace-nowrap ${
            activeTab === "requests"
              ? "bg-primary/10 sm:bg-transparent border-primary text-primary dark:text-primary"
              : "bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Requests ({counts.requests})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "directory" ? (
        <DirectoryTab
          players={allPlayers}
          otherPlayersCount={allPlayers.length - 1}
          filteredPlayers={filters.filteredPlayers}
          loading={isLoading}
          fetchError={fetchError}
          fetchPlayers={fetchPlayers}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          ownProfile={ownProfile as Player}
          isAdmin={isAdmin}
          handleAdminDelete={handleAdminDelete}
          handleAdminEdit={handleAdminEdit}
          setSelectedOpponentId={() => {}}
          setIsLogMatchOpen={() => {}}
          setLocation={setLocation}
          myBuddyIds={buddyData.accepted}
          myBuddyRequests={{ received: buddyData.received, sent: buddyData.sent }}
          followingIds={followingIds}
          handleBuddyAction={(playerId, action) => doBuddyAction({ playerId, action })}
          handleToggleFollow={(targetId) => doToggleFollow({ targetId, targetName: "" })}
          isPersonalView={true}
          {...filters}
        />
      ) : activeTab === "requests" ? (
        <div className="space-y-8">
          {receivedRequestPlayers.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Received Requests
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {receivedRequestPlayers.map((player) => (
                  <PlayerCard key={player.id} player={player} {...commonPlayerCardProps} {...getPlayerStateProps(player.id)} />
                ))}
              </div>
            </div>
          )}
          {sentRequestPlayers.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" /> Sent Requests
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75 hover:opacity-100 transition-opacity">
                {sentRequestPlayers.map((player) => (
                  <PlayerCard key={player.id} player={player} {...commonPlayerCardProps} {...getPlayerStateProps(player.id)} />
                ))}
              </div>
            </div>
          )}
          {counts.requests === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground dark:text-muted-foreground">
                No pending requests right now. Check the Directory to send new ones!
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {(activeTab === "accepted" ? acceptedPlayers : followingPlayers).length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground dark:text-muted-foreground">
                {activeTab === "accepted" && "You haven't connected with anyone yet. Browse the Directory to send connection requests!"}
                {activeTab === "following" && "You aren't following anyone yet. Head over to the Directory to find players to follow!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeTab === "accepted" ? acceptedPlayers : followingPlayers).map((player: Player) => (
                <PlayerCard key={player.id} player={player} {...commonPlayerCardProps} {...getPlayerStateProps(player.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
