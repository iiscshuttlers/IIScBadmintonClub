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
  eloRank?: any;
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
  eloRank,
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
      <div className="flex flex-col gap-2">
        {player.department && (
          <div className="flex">
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5 w-fit">
              <MapPin className="w-4 h-4 text-rose-400" /> {player.department}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {player.playingLevel && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm">
              {player.playingLevel}
            </span>
          )}
          {player.dominantHand && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
              <User className="w-4 h-4 text-violet-400" />{" "}
              {player.dominantHand.split("-")[0]} Hand
            </span>
          )}
        </div>
      </div>

      {/* Ranking Row */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {player.elo_rating != null && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" /> OVR: {eloRank?.overall ? `#${eloRank.overall}` : "N/A"}
            </span>
          )}
          {player.singles_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-primary/40 dark:border-primary/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" /> S: {eloRank?.singles ? `#${eloRank.singles}` : "N/A"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {player.doubles_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-500" /> D: {eloRank?.doubles ? `#${eloRank.doubles}` : "N/A"}
            </span>
          )}
          {player.mixed_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" /> XD: {eloRank?.mixed ? `#${eloRank.mixed}` : "N/A"}
            </span>
          )}
        </div>
      </div>


    </div>
  );
}
