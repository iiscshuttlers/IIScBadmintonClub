import { motion, type Variants } from "framer-motion";
import { Trophy, Users } from "lucide-react";
import { useLocation } from "wouter";
import { PlayerCard, type Player } from "./PlayerCard";
import { isSupabaseConfigured } from "@/lib/supabase";

interface DirectoryGridProps {
  players: Player[];
  loading: boolean;
  fetchError: boolean;
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  fetchPlayers: () => void;
  
  // Auth & Actions
  isAdmin: boolean;
  ownProfile: Player | null;
  myBuddyIds: Set<string>;
  myBuddyRequests: { received: Set<string>; sent: Set<string> };
  followingIds: Set<string>;
  actions: {
    handleAdminDelete: (id: string) => void;
    handleAdminEdit: (player: Player) => void;
    handleBuddyAction: (id: string, action: string) => void;
    handleToggleFollow: (id: string) => void;
    openLogMatch: (id: string) => void;
  };
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } as any },
};

export function DirectoryGrid({
  players,
  loading,
  fetchError,
  visibleCount,
  setVisibleCount,
  hasActiveFilters,
  onResetFilters,
  fetchPlayers,
  isAdmin,
  ownProfile,
  myBuddyIds,
  myBuddyRequests,
  followingIds,
  actions,
}: DirectoryGridProps) {
  const [, setLocation] = useLocation();

  if (loading) {
    return (
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
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <p className="text-slate-700 dark:text-slate-300 font-bold">
          {isSupabaseConfigured
            ? "No connection to server"
            : "Player directory is not configured"}
        </p>
        <p className="text-slate-400 text-sm max-w-md">
          {isSupabaseConfigured
            ? "This app requires internet to load player data."
            : "The deployed site is missing Supabase environment variables."}
        </p>
        <button
          onClick={fetchPlayers}
          className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-12 text-center border border-dashed border-slate-200 dark:border-slate-800">
        <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          No players found
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
          Try adjusting your search or filters.
        </p>
        <button
          onClick={onResetFilters}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition text-xs"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <>
      {!hasActiveFilters && (
        <h2 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> All Members
        </h2>
      )}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {players.slice(0, visibleCount).map((player) => (
          <motion.div
            key={player.id}
            variants={itemVariants}
            className="group h-full cursor-pointer"
            onClick={() => setLocation(`/player/${player.id}`)}
          >
            <PlayerCard
              player={player as any}
              isAdmin={isAdmin}
              onDelete={actions.handleAdminDelete}
              onEdit={() => actions.handleAdminEdit(player as any)}
              onLogMatch={
                ownProfile
                  ? () => actions.openLogMatch(player.id)
                  : undefined
              }
              isBuddy={myBuddyIds.has(player.id)}
              hasReceivedRequest={myBuddyRequests.received.has(player.id)}
              hasSentRequest={myBuddyRequests.sent.has(player.id)}
              onBuddyAction={ownProfile ? actions.handleBuddyAction : undefined}
              isFollowing={followingIds.has(player.id)}
              onToggleFollow={ownProfile ? (id) => actions.handleToggleFollow(id) : undefined}
              currentUserName={ownProfile?.full_name}
              currentUserId={ownProfile?.id}
            />
          </motion.div>
        ))}
      </motion.div>

      {visibleCount < players.length && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => setVisibleCount((v) => v + 24)}
            className="px-8 py-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center gap-2"
          >
            Load More Players
          </button>
        </div>
      )}
    </>
  );
}
