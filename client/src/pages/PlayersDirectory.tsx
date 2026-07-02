import { useEffect, useState, useRef, useMemo, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSocialActions } from "@/hooks/useSocial";
import { useLocation } from "wouter";
import { Users, Trophy, Swords, Heart, Shield } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { Player } from "@/components/players-directory/PlayerCard";
import { usePlayers, usePendingMatches, useBuddyRequests, useFollowers } from "@/hooks/usePlayers";
import { useHashTab } from "@/hooks/useHashTab";
import { useDirectoryFilters } from "@/hooks/useDirectoryFilters";

import { LeaderboardSection } from "@/components/players-directory/LeaderboardSection";
import { AuthBanner } from "@/components/players-directory/AuthBanner";
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
  const queryClient = useQueryClient();
  const [processingMatches, setProcessingMatches] = useState<Set<string>>(new Set());
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
    ["directory", "leaderboard", ...LEADERBOARD_SUB_TABS] as const,
    "directory"
  );
  const effectiveTab = LEADERBOARD_SUB_TABS.includes(activeTab as string)
    ? "leaderboard"
    : activeTab as "directory" | "leaderboard";

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
    if (processingMatches.has(matchId)) return;
    setProcessingMatches((prev) => new Set(prev).add(matchId));
    try {
      const { data, error } = await supabase.rpc("accept_friendly_match", {
        match_uuid: matchId,
        confirmer_id: ownProfile?.id,
      });
      if (error) {
        if (error.message.includes("Match is already") || error.message.includes("already accepted")) {
          toast.success("Match was already confirmed!");
        } else {
          throw error;
        }
      } else if (data?.confirmed === false) {
        // Doubles — quorum not yet reached
        toast.success(`Accepted! ${data.accepted} of ${data.required} players have agreed.`);
      } else {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#10b981", "#3b82f6", "#f59e0b"] });
        toast.success("Match Confirmed! Elo Ratings Updated. 🎉");
      }
      queryClient.invalidateQueries({ queryKey: ["matches", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["matches", "all_completed"] });
    } catch (e: any) {
      toast.error("Error confirming match: " + e.message);
    } finally {
      setProcessingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    if (processingMatches.has(matchId)) return;
    setProcessingMatches((prev) => new Set(prev).add(matchId));
    try {
      const { error } = await supabase.rpc("reject_friendly_match", {
        match_uuid: matchId,
        rejecter_id: ownProfile?.id,
      });
      if (error) {
        if (error.message.includes("Match is already")) {
          toast.success("Match was already processed!");
        } else {
          throw error;
        }
      } else {
        toast.success("Match Rejected.");
      }
      queryClient.invalidateQueries({ queryKey: ["matches", "pending"] });
    } catch (e: any) {
      toast.error("Error rejecting match: " + e.message);
    } finally {
      setProcessingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const handleAdminDelete = async (playerId: string) => {
    if (confirm("Are you sure you want to delete this player? They can be restored within 30 days.")) {
      try {
        const { error } = await supabase.rpc("soft_delete_player", {
          player_id: playerId,
          admin_id: session?.user?.id,
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
      <section className="bg-gradient-to-r from-teal-800 via-emerald-700 to-lime-600 text-foreground py-4 sm:py-6 relative overflow-hidden shrink-0">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="w-full md:w-auto flex justify-center">
              <div className="grid grid-cols-2 md:flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setActiveTab("directory")}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    effectiveTab === "directory" ? "bg-white text-slate-900 shadow-md" : "text-foreground/80 hover:text-foreground hover:bg-white/10"
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" /> Directory
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-sm font-black transition-all ${
                    effectiveTab === "leaderboard" ? "bg-white text-slate-900 shadow-md" : "text-foreground/80 hover:text-foreground hover:bg-white/10"
                  }`}
                >
                  <Trophy className="w-4 h-4 shrink-0" /> Rankings
                </button>
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
          processingMatches={processingMatches}
        />

        {effectiveTab === "leaderboard" ? (
          <div className="mt-8">
            <LeaderboardSection players={players} />
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
              handleToggleFollow={handleToggleFollow}
              followingIds={followingIds}
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
