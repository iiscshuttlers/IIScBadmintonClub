import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Pencil, Trash2, Sword, BellRing, BellOff, Info } from "lucide-react";
import { toast } from "sonner";
import { RankMovementBadge } from "@/components/players-directory/RankMovementBadge";
import type { RankMovement } from "@/lib/rankMovement";
import { getEloTier } from "@/lib/tiers";
import { getDepartmentAcronym } from "@/data/departments";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { getBaseShareUrl } from "@/lib/utils";
import { sendPingNotification } from "@/services/socialService";
import { useAvailablePlayers } from "@/hooks/useAvailability";
import { useLocation } from "wouter";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import type { PlayerRow } from "@/types";

export type Player = PlayerRow;

const AVATAR_GRADIENTS = [
  "from-chart-1 to-chart-2",
  "from-chart-2 to-chart-4",
  "from-chart-4 to-chart-5",
  "from-chart-3 to-chart-6",
  "from-chart-5 to-chart-3",
  "from-chart-6 to-chart-1",
];

function avatarGradient(name: string) {
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}


export function formatWinLossRecord(record?: string | any): string {
  if (!record) return "0W - 0L";
  try {
    const parsed = typeof record === "string" ? JSON.parse(record) : record;
    if (
      parsed &&
      typeof parsed.wins === "number" &&
      typeof parsed.losses === "number"
    ) {
      return `${parsed.wins}W - ${parsed.losses}L`;
    }
  } catch {
    // Not JSON, continue to fallback
  }
  
  // Clean up any string format (e.g. "0w-0L", "0w - 0l", "0w-0l") to "0W - 0L"
  const strRecord = String(record).toUpperCase();
  const m = strRecord.match(/(\d+)\s*W\s*-?\s*(\d+)\s*L/);
  if (m) {
    return `${m[1]}W - ${m[2]}L`;
  }
  
  // If it's a simple dash format "0-0"
  const dashMatch = strRecord.match(/^(\d+)\s*-\s*(\d+)$/);
  if (dashMatch) {
    return `${dashMatch[1]}W - ${dashMatch[2]}L`;
  }

  return strRecord;
}

export function parseWinPct(record?: string | any): number | null {
  if (!record) return null;
  const formatted = formatWinLossRecord(record);
  const m = formatted.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
  if (!m) return null;
  const w = +m[1],
    l = +m[2];
  return w + l ? Math.round((w / (w + l)) * 100) : null;
}

const levelColor: Record<string, string> = {
  Advanced:
    "bg-warning/10    text-warning    border border-warning/20 ",
  Professional:
    "bg-warning/10    text-warning    border border-warning/20 ",
  Intermediate:
    "bg-primary/20 text-primary border border-primary/30",
  Beginner:
    "bg-muted       text-soft  ",
};

interface PlayerCardProps {
  player: Player;
  isOwn?: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onLogMatch?: (id: string) => void;
  onToggleFollow?: (id: string) => void;
  isFollowing?: boolean;
  currentUserName?: string;
  currentUserId?: string;
  isPersonalView?: boolean;
  allRanks?: { overall?: number; singles?: number; doubles?: number; mixed?: number };
  /** Weekly rank movement for the active metric (▲/▼/NEW/RE). */
  rankMovement?: RankMovement;
  activeMetric?: "overall" | "singles" | "doubles" | "mixed";
}

export function PlayerCard({
  player,
  isOwn = false,
  isAdmin = false,
  onDelete,
  onEdit,
  onLogMatch,
  onToggleFollow,
  isFollowing = false,
  currentUserName,
  currentUserId,
  isPersonalView = false,
  allRanks,
  rankMovement,
  activeMetric = "overall",
}: PlayerCardProps) {
  const [, setLocation] = useLocation();
  // "Available to play now" — auto-expiring presence (#31). Shared across all
  // cards via the ["presence"] query cache, so this is a single request.
  const { availableMap } = useAvailablePlayers();
  const isAvailableNow = availableMap.has(player.id);
  // Calibration Phase
  const totalMatches = (() => {
    if (!player.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split("-").map(Number);
    return (w || 0) + (l || 0);
  })();
  const isUnranked = false;
  const [isPinged, setIsPinged] = useState(false);
  const winPct = parseWinPct(player.win_loss_record);

  const currentStreak = player.recent_form?.[0];
  let streakLen = 0;
  if (player.recent_form && currentStreak) {
    for (const r of player.recent_form) {
      if (r === currentStreak) streakLen++;
      else break;
    }
  }
  const isHot = currentStreak === "W" && streakLen >= 3;
  const isCold = currentStreak === "L" && streakLen >= 3;

  const handlePing = () => {
    if (isOwn) return;
    if (isPinged) {
      setIsPinged(false);
      toast.success(`Ping to ${player.full_name} cancelled.`, {
        icon: <BellOff className="w-4 h-4 text-muted-foreground" />,
      });
    } else {
      setIsPinged(true);
      
      sendPingNotification(player.id, currentUserName || "A player");

      toast.success(
        `Ping sent to ${player.full_name}! They will be notified.`,
        {
          icon: <BellRing className="w-4 h-4 text-primary" />,
        },
      );
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${getBaseShareUrl()}/player/${player.id}`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: player.full_name,
          url,
          dialogTitle: "Share Profile",
        });
      } else if (navigator.share) {
        await navigator.share({ title: player.full_name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied!");
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("cancel")) {
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Profile link copied!"))
          .catch(() => {});
      }
    }
  };

  const cleanName = (player.full_name || "").trim();
  const nameParts = cleanName.split(/\s+/);
  const displayFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
  const emphasizeFirst = nameParts.length > 1 && lastName.length <= 2;

  const displayRank = allRanks ? allRanks[activeMetric] : undefined;

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(e, info) => {
        if (info.offset.x > 80) handlePing();
      }}
      className="h-full"
    >
      <Card
        onClick={() => {
          setLocation(`/player/${player.id}`);
        }}
        className={`h-full w-full overflow-hidden cursor-pointer bg-card 
        hover:bg-muted/50 hover:shadow-xl hover:-translate-y-1
        transition-all duration-300 flex flex-col relative p-2.5 sm:p-4 rounded-3xl border
        ${
          isOwn
            ? "border-primary ring-2 ring-primary/20 shadow-primary/10 dark:shadow-none"
            : "border-border shadow-sm"
        }`}
      >
        {/* Top: Ranking, Avatar, Name, Share */}
        <div className="flex items-center gap-4 w-full mb-0">
          
          {/* 0. Ranking number */}
          {displayRank ? (
            <div className="shrink-0 flex flex-col items-center justify-center w-8 sm:w-10">
              <span className="font-black text-xl sm:text-2xl text-muted-foreground">#{displayRank}</span>
              <RankMovementBadge movement={rankMovement} className="mt-0.5" />
            </div>
          ) : (
             <div className="shrink-0 w-8 sm:w-10" />
          )}

          {/* 1. Avatar side */}
          <div className="relative shrink-0 flex items-center justify-center pl-1">
            <div className="relative shrink-0">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${getEloTier(player.elo_rating).color} blur-md opacity-40 rounded-full scale-110`}
              />
              <div
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 shadow-md ${getEloTier(player.elo_rating).border}`}
              >
                {player.avatar_url ? (
                  <img
                    loading="lazy"
                    src={player.avatar_url}
                    alt={player.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name || "")} flex items-center justify-center text-on-accent font-black text-2xl`}
                  >
                    {(player.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Dept Badge */}
              <div className="absolute -bottom-1 -right-2 flex items-center justify-center min-w-8 h-8 px-1 rounded-full bg-muted text-[9px] font-black text-soft border-2 border-border shadow-sm" title={player.department || "Indian Institute of Science"}>
                {getDepartmentAcronym(player.department)}
              </div>
              
              {/* Status Dot — green means "available to play now" (the toggle),
                  amber means currently in a match. No dot otherwise, so a green
                  dot can only ever mean available. */}
              {isAvailableNow ? (
                <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-success border-2 border-border shadow-sm animate-pulse" title="Available to play now" />
              ) : (player as any).status === "playing" ? (
                <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-warning border-2 border-border shadow-sm animate-pulse" title="In a match" />
              ) : null}
            </div>
          </div>

          {/* 2. Name side */}
          <div className="flex-1 flex flex-col items-start min-w-0 text-left">
            <div className={emphasizeFirst 
              ? "text-[16px] sm:text-[18px] font-black text-foreground leading-tight uppercase tracking-tight w-full truncate" 
              : "text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] w-full truncate"
            }>
              {displayFirst || "\u00A0"}
            </div>
            <div className={emphasizeFirst 
              ? "text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] w-full truncate"
              : "text-[16px] sm:text-[18px] font-black text-foreground leading-tight uppercase tracking-tight w-full truncate"
            }>
              {lastName}
            </div>
            
            <div className="mt-0.5 flex flex-col items-start gap-1 flex-wrap">
              {isAvailableNow && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[9px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Available now
                </span>
              )}
              {player.is_retired && (
                <div className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-danger text-on-accent shadow-sm">
                  Retired
                </div>
              )}
              {isHot && (
                <span className="text-[8px] flex items-center justify-center font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded" title={`${streakLen} Match Win Streak!`}>
                  🔥 HOT
                </span>
              )}
              {isCold && (
                <span className="text-[8px] flex items-center justify-center font-bold text-info bg-info/10 px-1.5 py-0.5 rounded" title={`${streakLen} Match Losing Streak`}>
                  🧊 COLD
                </span>
              )}
            </div>
          </div>

          {/* 3. Action / Share side */}
          <div className="shrink-0 flex flex-col items-end justify-start self-start gap-2 -mt-1 -mr-1">
            <button
              onClick={handleShare}
              className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Share profile"
            >
              <div className="p-1.5 rounded-full bg-muted hover:bg-primary/20">
                <Share2 className="w-3.5 h-3.5" />
              </div>
            </button>
            {isPersonalView && !isOwn && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePing(); }}
                className={`flex items-center justify-center transition-colors ${
                  isPinged ? "text-warning" : "text-muted-foreground hover:text-warning"
                }`}
                title="Ping player"
              >
                <div className={`p-1.5 rounded-full ${isPinged ? "bg-warning/10" : "bg-muted hover:bg-warning/10"}`}>
                  <BellRing className="w-3.5 h-3.5" />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Admin Detailed Stats */}
        {/* Detailed Stats */}
        <div className="w-full mt-0 mb-2">
          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-wider border-b border-border pb-1">
            <span>Player Stats</span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info 
                    className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors cursor-help drop-shadow-sm" 
                    onClick={(e) => e.stopPropagation()} 
                  />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-card/95 backdrop-blur-md text-foreground border-border-strong/50 shadow-2xl z-50 rounded-xl px-4 py-3">
                  <div className="flex flex-col gap-2.5 min-w-[140px]">
                    <div className="font-bold border-b border-border-strong/50 pb-2 mb-0.5 text-xs tracking-wide text-foreground">Stats Format</div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">1</div>
                      <span className="text-[11px] font-medium text-soft">Ranking</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">2</div>
                      <span className="text-[11px] font-medium text-soft">Win-Loss Record</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">3</div>
                      <span className="text-[11px] font-medium text-soft">Win Percentage</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-warning/20 text-warning border border-warning/30 flex items-center justify-center text-[9px] font-black">4</div>
                        <span className="text-[11px] font-medium text-warning">ELO (Admin Only)</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-4 gap-1 text-[8.5px] sm:text-[9px] text-center font-medium">
            <div className="bg-muted rounded p-1 flex flex-col justify-between">
              <div className="text-[7.5px] sm:text-[8px] text-muted-foreground uppercase mb-0.5 font-bold">Overall</div>
              <div className="font-black text-[10px] sm:text-[11px] mb-0.5 text-individual">{allRanks?.overall ? `#${allRanks.overall}` : "UR"}</div>
              <div className="leading-tight">{formatWinLossRecord(player.win_loss_record)}</div>
              <div className="font-bold text-primary">{parseWinPct(player.win_loss_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[9px] sm:text-[10px] mt-0.5 text-warning" title="ELO Rating">{player.elo_rating ?? "—"}</div>}
            </div>
            <div className="bg-info/10 rounded p-1 text-info flex flex-col justify-between">
              <div className="text-[7.5px] sm:text-[8px] uppercase mb-0.5 font-bold">Singles</div>
              <div className="font-black text-[10px] sm:text-[11px] mb-0.5">{allRanks?.singles ? `#${allRanks.singles}` : "UR"}</div>
              <div className="leading-tight">{formatWinLossRecord(player.singles_record)}</div>
              <div className="font-bold">{parseWinPct(player.singles_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[9px] sm:text-[10px] mt-0.5 text-warning" title="Singles ELO">{player.singles_elo ?? "—"}</div>}
            </div>
            <div className="bg-success/10 rounded p-1 text-success flex flex-col justify-between">
              <div className="text-[7.5px] sm:text-[8px] uppercase mb-0.5 font-bold">Doubles</div>
              <div className="font-black text-[10px] sm:text-[11px] mb-0.5">{allRanks?.doubles ? `#${allRanks.doubles}` : "UR"}</div>
              <div className="leading-tight">{formatWinLossRecord(player.doubles_record)}</div>
              <div className="font-bold">{parseWinPct(player.doubles_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[9px] sm:text-[10px] mt-0.5 text-warning" title="Doubles ELO">{player.doubles_elo ?? "—"}</div>}
            </div>
            <div className="bg-individual/10 rounded p-1 text-individual flex flex-col justify-between">
              <div className="text-[7.5px] sm:text-[8px] uppercase mb-0.5 font-bold">Mixed</div>
              <div className="font-black text-[10px] sm:text-[11px] mb-0.5">{allRanks?.mixed ? `#${allRanks.mixed}` : "UR"}</div>
              <div className="leading-tight">{formatWinLossRecord(player.mixed_record)}</div>
              <div className="font-bold">{parseWinPct(player.mixed_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[9px] sm:text-[10px] mt-0.5 text-warning" title="Mixed ELO">{player.mixed_elo ?? "—"}</div>}
            </div>
          </div>
        </div>
        
        {/* ACTION BUTTONS */}
        {isPersonalView && !isOwn && onToggleFollow && (
          <div className="mt-auto w-full border-t border-border pt-3 space-y-2">
            {/* Row 1: Follow action — full-width pill */}
            <div className="flex gap-2">
              {onToggleFollow && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow(player.id);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                    isFollowing
                      ? "text-danger bg-danger/10 border-danger/30"
                      : "text-muted-foreground bg-muted border-border-strong hover:text-danger hover:border-danger hover:bg-danger/10"
                  }`}
                  title={isFollowing ? "Unfollow" : "Follow"}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill={isFollowing ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFollowing ? "0" : "2"}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>{isFollowing ? "Following" : "Follow"}</span>
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* 'You' badge */}
        {isOwn && (
          <span className="absolute top-4 left-4 bg-primary text-primary-foreground px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm">
            You
          </span>
        )}
      </Card>
    </motion.div>
  );
}
