import { useEffect, useState } from "react";
import {
  MapPin,
  User,
  Trophy,
  Users,
  Heart,
  Instagram,
} from "lucide-react";
import type { PlayerRow } from "@/types";
import { getEloTier } from "@/lib/tiers";

interface PlayerActionBarProps {
  player: PlayerRow;
  currentUser: any;
  ownPlayerProfile: PlayerRow | null | undefined;
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
  return (
    <div className="flex flex-col gap-5 w-full lg:w-2/3">
      {/* Instagram link */}
      {player.instagram && (
        <a
          href={`https://instagram.com/${player.instagram.replace("@", "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 w-max bg-card border border-individual/30 text-individual hover:bg-individual/10 font-bold rounded-2xl transition-all shadow-sm"
          title="Instagram"
        >
          <Instagram className="w-5 h-5" />
          <span className="text-sm tracking-widest">
            @{player.instagram.replace("@", "")}
          </span>
        </a>
      )}

      {/* Stats / Details Pill Row */}
      <div className="flex flex-col gap-2">
        {player.department && (
          <div className="flex">
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border text-soft text-sm font-bold uppercase shadow-sm flex items-center gap-1.5 w-fit">
              <MapPin className="w-4 h-4 text-danger" /> {player.department}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {player.playing_level && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border text-soft text-sm font-bold uppercase shadow-sm">
              {player.playing_level}
            </span>
          )}
          {player.dominant_hand && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-border text-soft text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
              <User className="w-4 h-4 text-individual" />{" "}
              {player.dominant_hand.split("-")[0]} Hand
            </span>
          )}
        </div>
      </div>

      {/* Ranking Row */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {player.elo_rating != null && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-gold/30 text-soft text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-gold" /> OVR: {eloRank?.overall ? `#${eloRank.overall}` : "N/A"}
            </span>
          )}
          {player.singles_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-primary/50 text-soft text-sm font-bold shadow-sm flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" /> S: {eloRank?.singles ? `#${eloRank.singles}` : "N/A"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {player.doubles_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-info/30 text-soft text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-info" /> D: {eloRank?.doubles ? `#${eloRank.doubles}` : "N/A"}
            </span>
          )}
          {player.mixed_elo != null && (
            <span className="px-3 py-1.5 rounded-lg bg-card border border-danger/30 text-soft text-sm font-bold shadow-sm flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-danger" /> XD: {eloRank?.mixed ? `#${eloRank.mixed}` : "N/A"}
            </span>
          )}
        </div>
      </div>


    </div>
  );
}
