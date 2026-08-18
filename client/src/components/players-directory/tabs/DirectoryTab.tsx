// @ts-nocheck
import { motion, type Variants } from "framer-motion";
import { Users, Sword, Shield } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PlayerCard, type Player } from "@/components/players-directory/PlayerCard";
import { DirectoryFilters } from "@/components/players-directory/DirectoryFilters";
import { TeamsTab } from "@/components/players-directory/tabs/TeamsTab";
import { useState } from "react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

interface DirectoryTabProps {
  players: Player[];
  otherPlayersCount: number;
  filteredPlayers: Player[];
  loading: boolean;
  fetchError: boolean;
  fetchPlayers: () => void;
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  ownProfile: Player | null;
  isAdmin: boolean;
  handleAdminDelete: (id: string) => void;
  handleAdminEdit: (id: string) => void;
  setSelectedOpponentId: (id: string) => void;
  setIsLogMatchOpen: (open: boolean) => void;
  setLocation: (path: string) => void;

  // Filter props
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: "elo" | "singles" | "doubles" | "mixed" | "winpct" | "name" | "department" | "level";
  setSortBy: (s: any) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean) => void;
  levelFilter: string;
  setLevelFilter: (l: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (d: string) => void;
  allDepartments: string[];

  // Network/Buddy props
  myBuddyIds: Set<string>;
  myBuddyRequests: { received: Set<string>; sent: Set<string> };
  handleBuddyAction: (playerId: string, action: 'send'|'cancel'|'accept'|'remove') => void;
  followingIds: Set<string>;
  handleToggleFollow: (id: string) => void;
  isPersonalView?: boolean;
  rankMap?: Record<string, { overall: number; singles: number; doubles: number; mixed: number }>;
}

export function DirectoryTab({
  players,
  otherPlayersCount,
  filteredPlayers,
  loading,
  fetchError,
  fetchPlayers,
  visibleCount,
  setVisibleCount,
  ownProfile,
  isAdmin,
  handleAdminDelete,
  handleAdminEdit,
  setSelectedOpponentId,
  setIsLogMatchOpen,
  setLocation,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  showFilters,
  setShowFilters,
  levelFilter,
  setLevelFilter,
  departmentFilter,
  setDepartmentFilter,
  allDepartments,
  myBuddyIds,
  myBuddyRequests,
  handleBuddyAction,
  followingIds,
  handleToggleFollow,
  isPersonalView = false,
  rankMap = {},
}: DirectoryTabProps) {
  const [viewMode, setViewMode] = useState<"individuals" | "teams">("individuals");

  const recommended = (() => {
    if (loading || !ownProfile) return [];
    return players
      .filter(
        (p) =>
          p.id !== ownProfile.id &&
          p.status === "looking" &&
          Math.abs((p.elo_rating || 1200) - (ownProfile.elo_rating || 1200)) <= 150
      )
      .slice(0, 4);
  })();

  return (
    <>
      <DirectoryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        allDepartments={allDepartments}
        filteredPlayersCount={filteredPlayers.length}
        otherPlayersCount={otherPlayersCount}
      />

      {/* Directory Sub-Navigation (Individuals / Teams) */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-800 w-full sm:w-auto max-w-sm">
          <button
            onClick={() => setViewMode("individuals")}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              viewMode === "individuals"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" /> Individuals
          </button>
          <button
            onClick={() => setViewMode("teams")}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              viewMode === "teams"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-on-accent"
            }`}
          >
            <Shield className="w-4 h-4" /> Teams
          </button>
        </div>
      </div>

      {viewMode === "individuals" ? (
        <>
          {/* Recommended Opponents (Matchmaking) */}
          {!loading && ownProfile && recommended.length > 0 && !searchQuery && levelFilter === "All" && departmentFilter === "All" && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary/15 dark:bg-primary/50 rounded-lg">
              <Sword className="w-5 h-5 text-primary dark:text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Recommended Matches
              </h3>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Players with similar skill looking to play right now
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommended.map((player) => (
              <div key={"rec-" + player.id} className="cursor-pointer h-full" onClick={() => {
                if (window.location.pathname.startsWith("/personal")) setLocation(`/personal/player/${player.id}`);
                else setLocation(`/player/${player.id}`);
              }}>
                <PlayerCard
                  player={player}
                  isOwn={false}
                  isAdmin={isAdmin}
                  onDelete={handleAdminDelete}
                  onEdit={handleAdminEdit}
                  onLogMatch={() => {
                    setSelectedOpponentId(player.id);
                    setIsLogMatchOpen(true);
                  }}
                  isBuddy={myBuddyIds.has(player.id)}
                  hasReceivedRequest={myBuddyRequests.received.has(player.id)}
                  hasSentRequest={myBuddyRequests.sent.has(player.id)}
                  onBuddyAction={handleBuddyAction}
                  isFollowing={followingIds.has(player.id)}
                  onToggleFollow={handleToggleFollow}
                  currentUserName={ownProfile?.full_name}
                  currentUserId={ownProfile?.id}
                  isPersonalView={isPersonalView}
                  allRanks={rankMap[player.id]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directory grid (others) */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="h-56 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col p-5"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full rounded shimmer" />
                  <div className="h-3 w-2/3 rounded shimmer" />
                </div>
              </div>
              <div className="space-y-3 mt-auto">
                <div className="h-3 w-1/2 rounded shimmer" />
                <div className="h-8 w-full rounded-xl shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
          <p className="text-muted-foreground dark:text-slate-300 font-bold">
            {isSupabaseConfigured
              ? "No connection to server"
              : "Player directory is not configured"}
          </p>
          <p className="text-muted-foreground text-sm max-w-md">
            {isSupabaseConfigured
              ? "This app requires internet to load player data."
              : "The deployed site is missing Supabase environment variables."}
          </p>
          <button
            onClick={() => fetchPlayers()}
            className="mt-2 px-4 py-2 bg-primary hover:bg-primary text-primary-foreground text-sm font-bold rounded-xl transition"
          >
            Retry
          </button>
        </div>
      ) : filteredPlayers.length > 0 ? (
        <>
          {searchQuery || levelFilter !== "All" || departmentFilter !== "All" ? null : (
            <h2 className="text-xs uppercase tracking-widest font-black text-muted-foreground dark:text-muted-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> All Members
            </h2>
          )}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {filteredPlayers
              .filter(p => !(!searchQuery && levelFilter === "All" && departmentFilter === "All" && recommended.find(r => r.id === p.id)))
              .slice(0, visibleCount)
              .map((player) => (
              <motion.div
                key={player.id}
                variants={itemVariants}
                className="group h-full cursor-pointer"
                onClick={() => {
                  if (window.location.pathname.startsWith("/personal")) setLocation(`/personal/player/${player.id}`);
                  else setLocation(`/player/${player.id}`);
                }}
              >
                <PlayerCard
                  player={player}
                  isAdmin={isAdmin}
                  onDelete={handleAdminDelete}
                  onEdit={handleAdminEdit}
                  onLogMatch={
                    ownProfile
                      ? () => {
                          setSelectedOpponentId(player.id);
                          setIsLogMatchOpen(true);
                        }
                      : undefined
                  }
                  isBuddy={myBuddyIds.has(player.id)}
                  hasReceivedRequest={myBuddyRequests.received.has(player.id)}
                  hasSentRequest={myBuddyRequests.sent.has(player.id)}
                  onBuddyAction={ownProfile ? handleBuddyAction : undefined}
                  isFollowing={followingIds.has(player.id)}
                  onToggleFollow={ownProfile ? handleToggleFollow : undefined}
                  currentUserName={ownProfile?.full_name}
                  currentUserId={ownProfile?.id}
                  isPersonalView={isPersonalView}
                  allRanks={rankMap[player.id]}
                />
              </motion.div>
            ))}
          </motion.div>

          {visibleCount < filteredPlayers.length && (
            <div className="mt-12 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 24)}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 font-bold rounded-2xl transition shadow-sm border border-slate-300 dark:border-slate-700"
              >
                Load More Players
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground dark:text-slate-300 font-bold text-lg">
            No players found
          </p>
          <p className="text-muted-foreground mt-2 text-sm max-w-sm text-center">
            {searchQuery
              ? `No one matches "${searchQuery}". Try a different name or department.`
              : "There are no players matching these filters."}
          </p>
          {(searchQuery || levelFilter !== "All" || departmentFilter !== "All") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setLevelFilter("All");
                setDepartmentFilter("All");
              }}
              className="mt-6 px-6 py-2 bg-primary/15 hover:bg-primary/20 text-primary font-bold rounded-xl transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
      </>
      ) : (
        <div className="mt-4">
          <TeamsTab searchQuery={searchQuery} />
        </div>
      )}
    </>
  );
}
