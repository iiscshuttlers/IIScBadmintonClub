import { useMemo, useEffect, useState } from "react";
import {
  MapPin,
  User,
  Trophy,
  Users,
  Heart,
  Instagram,
  UserPlus,
  UserCheck,
  Swords,
} from "lucide-react";
import type { PlayerProfileType } from "@/types";
import { getEloTier } from "@/lib/tiers";
import { useSocialActions } from "@/hooks/useSocial";

interface PlayerActionBarProps {
  player: PlayerProfileType;
  currentUser: any;
  ownPlayerProfile: PlayerProfileType | null | undefined;
  setIsChallengeModalOpen: (v: boolean) => void;
}

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    setDisplay(value);
  }, [value]);
  return <span className={className}>{display}</span>;
}

export function PlayerActionBar({
  player,
  currentUser,
  ownPlayerProfile,
  setIsChallengeModalOpen,
}: PlayerActionBarProps) {
  const { handleToggleFollow, handleBuddyAction } = useSocialActions();

  const isFollowing = ownPlayerProfile?.following?.includes(player.id) ?? false;
  
  const buddyStatus = useMemo(() => {
    if (!ownPlayerProfile || !player) return null;
    const isBuddy = ownPlayerProfile.buddies?.includes(player.id) || player.buddies?.includes(ownPlayerProfile.id);
    if (isBuddy) return 'accepted';
    
    // Check if I sent request
    if (ownPlayerProfile.buddyRequests?.includes(player.id)) return 'sent';
    
    // Check if they sent request
    if (player.buddyRequests?.includes(ownPlayerProfile.id)) return 'received';
    
    return null;
  }, [ownPlayerProfile, player]);

  const onToggleFollow = () => {
    if (!player.id || !ownPlayerProfile) return;
    handleToggleFollow({ targetId: player.id, targetName: player.fullName });
  };

  const onBuddyAction = (action: 'send' | 'cancel' | 'accept' | 'remove') => {
    if (!player.id || !ownPlayerProfile) return;
    handleBuddyAction({ playerId: player.id, action, receiverName: player.fullName });
  };

  return (
    <div className="flex flex-col gap-5 w-full lg:w-2/3">
      {/* Instagram link */}
      {player.social?.instagram && (
        <a
          href={`https://instagram.com/${player.social.instagram.replace("@", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 w-max bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-900/50 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 font-bold rounded-2xl transition-all shadow-sm"
          title="Instagram"
        >
          <Instagram className="w-5 h-5" />
          <span className="text-sm tracking-widest">
            @{player.social.instagram.replace("@", "")}
          </span>
        </a>
      )}

      {/* Stats / Details Pill Row */}
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-rose-400" /> {player.department}
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm">
          {player.playingLevel}
        </span>
        {player.dominantHand && (
          <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
            <User className="w-4 h-4 text-violet-400" />{" "}
            {player.dominantHand.split("-")[0]} Hand
          </span>
        )}
      </div>

      {/* ELO Row */}
      <div className="flex flex-wrap gap-2">
        {player.elo_rating != null && (
          <span
            className={`px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-black uppercase shadow-sm flex items-center gap-1.5 ${
              getEloTier(player.elo_rating).bg
            } ${getEloTier(player.elo_rating).text}`}
          >
            <Trophy className="w-4 h-4" /> {getEloTier(player.elo_rating).name} •{" "}
            <AnimatedCounter value={player.elo_rating} /> OVR
          </span>
        )}
        {player.singles_elo != null && (
          <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-primary/40 dark:border-primary/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" /> S: {player.singles_elo}
          </span>
        )}
        {player.doubles_elo != null && (
          <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" /> D: {player.doubles_elo}
          </span>
        )}
        {player.mixed_elo != null && (
          <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500" /> XD: {player.mixed_elo}
          </span>
        )}
      </div>

      {/* Next Tier Progress Bar */}
      {player.elo_rating != null &&
        (() => {
          const tierOrder = [
            { name: "Bronze", minElo: 0 },
            { name: "Silver", minElo: 1000 },
            { name: "Gold", minElo: 1200 },
            { name: "Platinum", minElo: 1400 },
            { name: "Diamond", minElo: 1600 },
            { name: "Grandmaster", minElo: 1800 },
          ];
          const currentTierInfo = getEloTier(player.elo_rating);
          const currentIdx = tierOrder.findIndex(
            (t) => t.name === currentTierInfo.name
          );
          const nextTier = tierOrder[currentIdx + 1];

          if (!nextTier)
            return (
              <div className="mt-1 max-w-sm bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Max Tier Reached
                  </span>
                  <span className="text-xs font-black text-amber-500">👑</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" />
                </div>
              </div>
            );

          const currentMin = tierOrder[currentIdx].minElo;
          const progress = Math.min(
            100,
            Math.max(
              0,
              ((player.elo_rating - currentMin) /
                (nextTier.minElo - currentMin)) *
                100
            )
          );
          const remaining = nextTier.minElo - player.elo_rating;
          return (
            <div className="mt-1 max-w-sm bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                  {remaining} ELO to {nextTier.name}
                </span>
                <span className="text-[10px] font-black text-muted-foreground dark:text-slate-300">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })()}

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-3 mt-2">
        {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
          <>
            <button
              onClick={onToggleFollow}
              className={`flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider ${
                isFollowing
                  ? "bg-violet-600 text-foreground hover:bg-rose-500 group"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-foreground hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:border-violet-300 dark:hover:border-violet-700"
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4 group-hover:hidden" />
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Follow
                </>
              )}
            </button>
            {buddyStatus === 'accepted' ? (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to remove this buddy?")) {
                    onBuddyAction("remove");
                  }
                }}
                className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-rose-600 text-foreground hover:bg-rose-700"
              >
                <Heart className="w-4 h-4 fill-white text-foreground" />
                Buddy
              </button>
            ) : buddyStatus === 'received' ? (
              <button
                onClick={() => onBuddyAction("accept")}
                className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary"
              >
                <Heart className="w-4 h-4" />
                Accept Request
              </button>
            ) : buddyStatus === 'sent' ? (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to cancel the buddy request?")) {
                    onBuddyAction("cancel");
                  }
                }}
                className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-slate-600 text-foreground hover:bg-slate-700"
              >
                <Heart className="w-4 h-4" />
                Request Sent
              </button>
            ) : (
              <button
                onClick={() => onBuddyAction("send")}
                className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-foreground hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700"
              >
                <Heart className="w-4 h-4" />
                Add Buddy
              </button>
            )}
            <button
              onClick={() => !player.is_retired && setIsChallengeModalOpen(true)}
              disabled={player.is_retired}
              title={player.is_retired ? "Cannot challenge a retired player" : "Challenge"}
              className={`flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider ${
                player.is_retired
                  ? "bg-slate-300 dark:bg-slate-700 text-muted-foreground cursor-not-allowed border border-slate-300 dark:border-slate-600"
                  : "bg-orange-500 text-foreground hover:bg-orange-600 border border-orange-400"
              }`}
            >
              <Swords className="w-4 h-4" />
              Challenge
            </button>
          </>
        )}
      </div>
    </div>
  );
}
