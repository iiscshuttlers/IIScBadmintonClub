import { useEffect, useState, useRef, useMemo, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocialActions } from "@/hooks/useSocial";
import { useLocation } from "wouter";
import { Users, Trophy, Swords, Heart } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { Player } from "@/components/players-directory/PlayerCard";
import { usePlayers, usePendingMatches, useBuddyRequests, useFollowers } from "@/hooks/usePlayers";
import { useHashTab } from "@/hooks/useHashTab";
import { useDirectoryFilters } from "@/hooks/useDirectoryFilters";

import { LeaderboardSection } from "@/components/players-directory/LeaderboardSection";
import { H2HSection } from "@/components/players-directory/H2HSection";
import { AuthBanner } from "@/components/players-directory/AuthBanner";
import { NetworkTab } from "@/components/players-directory/tabs/NetworkTab";
import { DirectoryTab } from "@/components/players-directory/tabs/DirectoryTab";

const LogMatchModal = lazy(() => import("@/components/LogMatchModal"));

/* ── Main page ──────────────────────────────────────────────────────── */
export default function PlayersDirectory() {
  usePageMeta({
    title: "Player Directory",
    description: "Search and discover member profiles, styles, playing levels, and equipment within IISc Badminton Club.",
  });

  const [, setLocation] = useLocation();

  /* Auth + own-profile state */
  const { session: authSession, isInitializing: authLoading, profile, isAdmin } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [ownProfile, setOwnProfile] = useState<Player | null>(null);

  useEffect(() => {
    setSession(authSession);
    if (authSession && profile && ownProfile?.id !== (profile as any).id) {
      setOwnProfile((prev: any) => prev ? { ...prev, ...(profile as any) } : (profile as any));
    } else if (!authSession) {
      setOwnProfile(null);
    }
  }, [authSession, profile]);

  /* Directory state */
  const { data: rawPlayers, isLoading: loading, isError: fetchError, refetch: fetchPlayers } = usePlayers();
  const players = rawPlayers || [];

  const { data: pendingMatches = [] } = usePendingMatches(ownProfile?.id);
  const { data: buddyRequestsRaw = [] } = useBuddyRequests(ownProfile?.id);
  const { data: followers = [] } = useFollowers(ownProfile?.id);

  const buddyRequests = useMemo(() => {
    const map = new Map<string, {id: string; status: string; senderId: string}>();
    buddyRequestsRaw.forEach((req: any) => {
      const otherPlayerId = req.sender_id === ownProfile?.id ? req.receiver_id : req.sender_id;
      map.set(otherPlayerId, { id: req.id, status: req.status, senderId: req.sender_id });
    });
    return map;
  }, [buddyRequestsRaw, ownProfile?.id]);

  const myBuddyRequests = useMemo(() => {
    const accepted = new Set<string>();
    const received = new Set<string>();
    const sent = new Set<string>();
    buddyRequests.forEach((req, playerId) => {
      if (req.status === "accepted") accepted.add(playerId);
      else if (req.senderId === ownProfile?.id) sent.add(playerId);
      else received.add(playerId);
    });
    return { accepted, received, sent };
  }, [buddyRequests, ownProfile?.id]);
  const myBuddyIds = myBuddyRequests.accepted;

  const followingIds = new Set<string>((ownProfile as any)?.following || []);

  const filters = useDirectoryFilters(players, session?.user?.id, myBuddyIds);
  const [visibleCount, setVisibleCount] = useState(24);

  const LEADERBOARD_SUB_TABS = ["elo", "ironman"];
  const [activeTab, setActiveTab] = useHashTab(
    ["directory", "leaderboard", "network", "h2h", ...LEADERBOARD_SUB_TABS] as const,
    "directory"
  );
  const effectiveTab = LEADERBOARD_SUB_TABS.includes(activeTab as string)
    ? "leaderboard"
    : activeTab as "directory" | "leaderboard" | "network" | "h2h";

  const { handleBuddyAction: doBuddyAction, handleToggleFollow: doToggleFollow } = useSocialActions();

  /* Match modal state */
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);

  const handleBuddyAction = (playerId: string, action: 'send'|'cancel'|'accept'|'remove') => {
    doBuddyAction({ playerId, action, receiverName: ownProfile?.full_name });
  };

  const handleToggleFollow = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    const isFollowing = followingIds.has(playerId);
    const newFollowing = new Set(followingIds);
    if (isFollowing) newFollowing.delete(playerId);
    else newFollowing.add(playerId);
    setOwnProfile((prev: any) => prev ? { ...prev, following: Array.from(newFollowing) } : prev);

    doToggleFollow({ targetId: playerId, targetName: player?.full_name || 'player' }).catch(() => {
       setOwnProfile((prev: any) => prev ? { ...prev, following: Array.from(followingIds) } : prev);
    });
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("confirm_friendly_match", {
        match_uuid: matchId,
        confirmer_id: ownProfile?.id,
      });
      if (error) throw error;
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#3b82f6", "#f59e0b"] });
      toast.success("Match Confirmed! Elo Ratings Updated. 🎉");
    } catch (e: any) {
      toast.error("Error confirming match: " + e.message);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("reject_friendly_match", {
        match_uuid: matchId,
        rejecter_id: ownProfile?.id,
      });
      if (error) throw error;
      toast.success("Match Rejected.");
    } catch (e: any) {
      toast.error("Error rejecting match: " + e.message);
    }
  };

  const handleAdminDelete = async (playerId: string) => {
    if (confirm("Are you sure you want to delete this player? They can be restored within 30 days.")) {
      try {
        const { error } = await supabase.rpc("soft_delete_player", {
          player_id: playerId,
          admin_email: session?.user?.email,
        });
        if (error) throw error;
        toast.success("Player successfully soft-deleted.");
      } catch (err: any) {
        toast.error("Delete failed: " + err.message);
      }
    }
  };

  const handleAdminEdit = (playerId: string) => {
    setLocation(`/player/${playerId}/edit`);
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="flex-1 w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <section className="bg-gradient-to-r from-blue-900 via-indigo-950 to-emerald-900 text-white py-6 sm:py-8 relative overflow-hidden shrink-0">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="w-full md:w-auto flex justify-center">
              <div className="grid grid-cols-2 sm:flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab("directory")}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    effectiveTab === "directory" ? "bg-white text-emerald-700 shadow-md" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" /> Directory
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    effectiveTab === "leaderboard" ? "bg-white text-emerald-700 shadow-md" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Trophy className="w-4 h-4 shrink-0" /> Rankings
                </button>
                <button
                  onClick={() => setActiveTab("h2h")}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    effectiveTab === "h2h" ? "bg-white text-rose-700 shadow-md" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Swords className="w-4 h-4 shrink-0" /> H2H
                </button>
                {session && ownProfile && (
                  <button
                    onClick={() => setActiveTab("network")}
                    className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                      effectiveTab === "network" ? "bg-white text-violet-700 shadow-md" : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Heart className="w-4 h-4 shrink-0" /> Network
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 max-w-7xl">
        <AuthBanner
          session={session}
          ownProfile={ownProfile}
          authLoading={authLoading}
          pendingMatches={pendingMatches}
          onConfirmMatch={handleConfirmMatch}
          onRejectMatch={handleRejectMatch}
        />

        {effectiveTab === "h2h" ? (
          <div className="mt-8">
            <H2HSection />
          </div>
        ) : effectiveTab === "leaderboard" ? (
          <div className="mt-8">
            <LeaderboardSection players={players} />
          </div>
        ) : effectiveTab === "network" ? (
          <div className="mt-8">
            <NetworkTab
              players={players}
              myBuddyIds={myBuddyIds}
              ownProfile={ownProfile}
              setLocation={setLocation}
              setSelectedOpponentId={setSelectedOpponentId}
              setIsLogMatchOpen={setIsLogMatchOpen}
              followingIds={followingIds}
              followers={followers}
              myBuddyRequests={myBuddyRequests}
              isAdmin={isAdmin}
              handleAdminDelete={handleAdminDelete}
              handleAdminEdit={handleAdminEdit}
              handleBuddyAction={handleBuddyAction}
              handleToggleFollow={handleToggleFollow}
            />
          </div>
        ) : (
          <div className="mt-8">
            <DirectoryTab
              players={players}
              otherPlayersCount={players.length - (ownProfile ? 1 : 0)}
              filteredPlayers={filters.filteredPlayers}
              loading={loading}
              fetchError={fetchError}
              fetchPlayers={fetchPlayers as any}
              visibleCount={visibleCount}
              setVisibleCount={setVisibleCount}
              ownProfile={ownProfile}
              isAdmin={isAdmin}
              handleAdminDelete={handleAdminDelete}
              handleAdminEdit={handleAdminEdit}
              setSelectedOpponentId={setSelectedOpponentId}
              setIsLogMatchOpen={setIsLogMatchOpen}
              setLocation={setLocation}
              searchQuery={filters.searchQuery}
              setSearchQuery={filters.setSearchQuery}
              sortBy={filters.sortBy}
              setSortBy={filters.setSortBy}
              showFilters={filters.showFilters}
              setShowFilters={filters.setShowFilters}
              levelFilter={filters.levelFilter}
              setLevelFilter={filters.setLevelFilter}
              departmentFilter={filters.departmentFilter}
              setDepartmentFilter={filters.setDepartmentFilter}
              allDepartments={filters.allDepartments}
              myBuddyIds={myBuddyIds}
              myBuddyRequests={myBuddyRequests}
              handleBuddyAction={handleBuddyAction}
              followingIds={followingIds}
              handleToggleFollow={handleToggleFollow}
            />
          </div>
        )}
      </section>

      <Suspense fallback={null}>
        {isLogMatchOpen && selectedOpponentId && ownProfile && (
          <LogMatchModal
            isOpen={isLogMatchOpen}
            onClose={() => {
              setIsLogMatchOpen(false);
              setSelectedOpponentId(null);
            }}
            defaultOpponentId={selectedOpponentId}
            currentUser={ownProfile}
            onSuccess={() => fetchPlayers()}
            userEmail={session?.user?.email}
          />
        )}
      </Suspense>
    </div>
  );
}
