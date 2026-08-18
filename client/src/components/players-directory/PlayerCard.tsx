import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Pencil, Trash2, Sword, BellRing, BellOff, Info } from "lucide-react";
import { toast } from "sonner";
import { getEloTier } from "@/lib/tiers";
import { getDepartmentAcronym } from "@/data/departments";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { getBaseShareUrl } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import type { PlayerRow } from "@/types";

export type Player = PlayerRow;

const AVATAR_GRADIENTS = [
  "from-primary to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500",
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
    "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Professional:
    "bg-amber-50   dark:bg-amber-950/20  text-amber-700   dark:text-amber-400  border border-amber-100  dark:border-amber-900/30",
  Intermediate:
    "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border border-primary/30 dark:border-primary/30",
  Beginner:
    "bg-slate-100  dark:bg-slate-800      text-muted-foreground   dark:text-slate-300",
};

interface PlayerCardProps {
  player: Player;
  isOwn?: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onLogMatch?: (id: string) => void;
  onBuddyAction?: (id: string, action: 'send'|'cancel'|'accept'|'remove') => void;
  onToggleFollow?: (id: string) => void;
  isBuddy?: boolean;
  hasSentRequest?: boolean;
  hasReceivedRequest?: boolean;
  isFollowing?: boolean;
  currentUserName?: string;
  currentUserId?: string;
  isPersonalView?: boolean;
  allRanks?: { overall?: number; singles?: number; doubles?: number; mixed?: number };
}

export function PlayerCard({
  player,
  isOwn = false,
  isAdmin = false,
  onDelete,
  onEdit,
  onLogMatch,
  onBuddyAction,
  onToggleFollow,
  isBuddy = false,
  hasSentRequest = false,
  hasReceivedRequest = false,
  isFollowing = false,
  currentUserName,
  currentUserId,
  isPersonalView = false,
  allRanks,
}: PlayerCardProps) {
  const [, setLocation] = useLocation();
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
      
      // Broadcast the ping to all listening clients (real-time, only works if app is open)
      supabase.channel("global-notifications").send({
        type: "broadcast",
        event: "ping",
        payload: {
          target_id: player.id,
          sender_name: currentUserName || "A player",
        },
      });

      // Also persist a notification so it appears in the notification panel
      supabase.rpc("send_ping_notification", {
        p_target_id: player.id,
        p_sender_name: currentUserName || "A player",
      }).then(({ error }) => {
        if (error) console.warn("Failed to persist ping notification:", error.message);
      });

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
          if (window.location.pathname.startsWith("/personal")) {
            setLocation(`/personal/player/${player.id}`);
          } else {
            setLocation(`/player/${player.id}`);
          }
        }}
        className={`h-full w-full overflow-hidden cursor-pointer bg-white dark:bg-slate-900
        hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-xl hover:-translate-y-1
        transition-all duration-300 flex flex-col relative p-4 sm:p-5 rounded-3xl border
        ${
          isOwn
            ? "border-primary dark:border-primary ring-2 ring-primary/20 shadow-primary/10 dark:shadow-none"
            : "border-slate-100 dark:border-slate-800 shadow-sm"
        }`}
      >
        {/* Top: Avatar, Name, Share */}
        <div className="grid grid-cols-[45%_45%_10%] gap-1 w-full mb-3 items-center">
          
          {/* 1. Avatar side (45%) */}
          <div className="flex justify-start items-center relative w-full">
            <div className="relative shrink-0">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${getEloTier(player.elo_rating).color} blur-md opacity-40 rounded-full scale-110`}
              />
              <div
                className={`relative w-16 h-16 rounded-full overflow-hidden border-2 shadow-md ${getEloTier(player.elo_rating).border}`}
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
                    className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name || "")} flex items-center justify-center text-foreground font-black text-2xl`}
                  >
                    {(player.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Dept Badge */}
              <div className="absolute -bottom-1 -right-2 flex items-center justify-center min-w-8 h-8 px-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-muted-foreground dark:text-slate-300 border-2 border-white dark:border-slate-900 shadow-sm" title={player.department || "Indian Institute of Science"}>
                {getDepartmentAcronym(player.department)}
              </div>
              
              {/* Status Dot */}
              {(player as any).status === "playing" && (
                <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
              )}
              {((player as any).status === "looking" || player.is_looking_to_play) && (
                <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-primary border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
              )}
            </div>
          </div>

          {/* 2. Name side (45%) */}
          <div className="flex flex-col items-start w-full min-w-0 text-left pr-1">
            <div className={emphasizeFirst 
              ? "text-[18px] sm:text-[20px] font-black text-foreground dark:text-foreground leading-tight uppercase tracking-tight w-full truncate" 
              : "text-[9px] font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-[0.2em] mb-0.5 w-full truncate"
            }>
              {displayFirst || "\u00A0"}
            </div>
            <div className={emphasizeFirst 
              ? "text-[9px] font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-[0.2em] mb-0.5 w-full truncate"
              : "text-[18px] sm:text-[20px] font-black text-foreground dark:text-foreground leading-tight uppercase tracking-tight w-full truncate"
            }>
              {lastName}
            </div>
            
            <div className="mt-1 flex flex-col items-start gap-1 flex-wrap">
              {player.is_retired && (
                <div className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500 text-on-accent shadow-sm">
                  Retired
                </div>
              )}
              {isHot && (
                <span className="text-[8px] flex items-center justify-center font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded" title={`${streakLen} Match Win Streak!`}>
                  🔥 HOT
                </span>
              )}
              {isCold && (
                <span className="text-[8px] flex items-center justify-center font-bold text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 px-1.5 py-0.5 rounded" title={`${streakLen} Match Losing Streak`}>
                  🧊 COLD
                </span>
              )}
            </div>
          </div>

          {/* 3. Action / Share side (10%) */}
          <div className="flex flex-col items-end justify-start self-start w-full gap-2 -mt-2 -mr-2">
            <button
              onClick={handleShare}
              className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Share profile"
            >
              <div className="p-2 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-primary/10 dark:hover:bg-primary/90/30">
                <Share2 className="w-4 h-4" />
              </div>
            </button>
            {isPersonalView && !isOwn && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePing(); }}
                className={`flex items-center justify-center transition-colors ${
                  isPinged ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                }`}
                title="Ping player"
              >
                <div className={`p-2 rounded-full ${isPinged ? "bg-amber-50 dark:bg-amber-950/30" : "bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"}`}>
                  <BellRing className="w-4 h-4" />
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Admin Detailed Stats */}
        {/* Detailed Stats */}
        <div className="w-full mt-1 mb-3 px-1">
          <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wider pl-1 border-b border-slate-100 dark:border-slate-800 pb-1">
            <span>Player Stats</span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info 
                    className="w-3.5 h-3.5 text-slate-400 hover:text-primary transition-colors cursor-help drop-shadow-sm" 
                    onClick={(e) => e.stopPropagation()} 
                  />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-slate-900/95 backdrop-blur-md text-slate-100 border-slate-700/50 shadow-2xl z-50 rounded-xl px-4 py-3">
                  <div className="flex flex-col gap-2.5 min-w-[140px]">
                    <div className="font-bold border-b border-slate-700/50 pb-2 mb-0.5 text-xs tracking-wide text-white">Stats Format</div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">1</div>
                      <span className="text-[11px] font-medium text-slate-200">Ranking</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">2</div>
                      <span className="text-[11px] font-medium text-slate-200">Win-Loss Record</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-[9px] font-black">3</div>
                      <span className="text-[11px] font-medium text-slate-200">Win Percentage</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center text-[9px] font-black">4</div>
                        <span className="text-[11px] font-medium text-amber-400">ELO (Admin Only)</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[9px] text-center font-medium">
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-1.5 flex flex-col justify-between">
              <div className="text-[8px] text-muted-foreground uppercase mb-1 font-bold">Overall</div>
              <div className="font-black text-[11px] mb-1 text-violet-600 dark:text-violet-400">{allRanks?.overall ? `#${allRanks.overall}` : "UR"}</div>
              <div>{formatWinLossRecord(player.win_loss_record)}</div>
              <div className="font-bold text-primary mt-0.5">{parseWinPct(player.win_loss_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[10px] mt-1 text-amber-600 dark:text-amber-500" title="ELO Rating">{player.elo_rating ?? "—"}</div>}
            </div>
            <div className="bg-sky-50 dark:bg-sky-950/30 rounded p-1.5 text-sky-700 dark:text-sky-400 flex flex-col justify-between">
              <div className="text-[8px] uppercase mb-1 font-bold">Singles</div>
              <div className="font-black text-[11px] mb-1">{allRanks?.singles ? `#${allRanks.singles}` : "UR"}</div>
              <div>{formatWinLossRecord(player.singles_record)}</div>
              <div className="font-bold mt-0.5">{parseWinPct(player.singles_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[10px] mt-1 text-amber-600 dark:text-amber-500" title="Singles ELO">{player.singles_elo ?? "—"}</div>}
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1.5 text-emerald-700 dark:text-emerald-400 flex flex-col justify-between">
              <div className="text-[8px] uppercase mb-1 font-bold">Doubles</div>
              <div className="font-black text-[11px] mb-1">{allRanks?.doubles ? `#${allRanks.doubles}` : "UR"}</div>
              <div>{formatWinLossRecord(player.doubles_record)}</div>
              <div className="font-bold mt-0.5">{parseWinPct(player.doubles_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[10px] mt-1 text-amber-600 dark:text-amber-500" title="Doubles ELO">{player.doubles_elo ?? "—"}</div>}
            </div>
            <div className="bg-pink-50 dark:bg-pink-950/30 rounded p-1.5 text-pink-700 dark:text-pink-400 flex flex-col justify-between">
              <div className="text-[8px] uppercase mb-1 font-bold">Mixed</div>
              <div className="font-black text-[11px] mb-1">{allRanks?.mixed ? `#${allRanks.mixed}` : "UR"}</div>
              <div>{formatWinLossRecord(player.mixed_record)}</div>
              <div className="font-bold mt-0.5">{parseWinPct(player.mixed_record) ?? 0}%</div>
              {isAdmin && <div className="font-black text-[10px] mt-1 text-amber-600 dark:text-amber-500" title="Mixed ELO">{player.mixed_elo ?? "—"}</div>}
            </div>
          </div>
        </div>
        
        {/* ACTION BUTTONS */}
        {isPersonalView && !isOwn && (onBuddyAction || onToggleFollow) && (
          <div className="mt-auto w-full border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
            {/* Row 1: Social actions (buddy + follow) — full-width pills */}
            <div className="flex gap-2">
              {onBuddyAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isBuddy) {
                      if (confirm("Are you sure you want to remove this buddy?")) {
                        onBuddyAction(player.id, 'remove');
                      }
                    } else if (hasReceivedRequest) {
                      onBuddyAction(player.id, 'accept');
                    } else if (hasSentRequest) {
                      if (confirm("Are you sure you want to cancel the buddy request?")) {
                        onBuddyAction(player.id, 'cancel');
                      }
                    } else {
                      onBuddyAction(player.id, 'send');
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                    isBuddy
                      ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50"
                      : hasReceivedRequest
                      ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/30 border-primary/40 dark:border-primary/50"
                      : hasSentRequest
                      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
                      : "text-muted-foreground dark:text-muted-foreground bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                  }`}
                  title={isBuddy ? "Remove Buddy" : hasReceivedRequest ? "Accept Request" : hasSentRequest ? "Cancel Request" : "Add Buddy"}
                >
                  {isBuddy ? (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9 8v-1c0-2.66 5.33-4 8-4s8 1.34 8 4v1H3z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  )}
                  <span>{isBuddy ? "Buddy" : hasReceivedRequest ? "Accept" : hasSentRequest ? "Pending" : "Add Buddy"}</span>
                </button>
              )}
              {onToggleFollow && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow(player.id);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                    isFollowing
                      ? "text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50"
                      : "text-muted-foreground dark:text-muted-foreground bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:text-rose-500 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
