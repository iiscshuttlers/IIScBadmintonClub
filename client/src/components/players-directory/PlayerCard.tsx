import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Share2, Pencil, Trash2, Sword, BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { getEloTier } from "@/lib/tiers";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { getBaseShareUrl } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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
  return String(record);
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
    "bg-slate-100  dark:bg-slate-800      text-slate-600   dark:text-slate-300",
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
}: PlayerCardProps) {
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
        icon: <BellOff className="w-4 h-4 text-slate-500" />,
      });
    } else {
      setIsPinged(true);
      
      // Broadcast the ping to all listening clients (real-time, only works if app is open)
      supabase.channel("pings").send({
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
        className={`h-full w-full overflow-hidden cursor-pointer bg-white dark:bg-slate-900
        hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-xl hover:-translate-y-1
        transition-all duration-300 flex flex-col items-center text-center relative p-6 rounded-3xl border
        ${
          isOwn
            ? "border-primary dark:border-primary ring-2 ring-primary/20 shadow-primary/10 dark:shadow-none"
            : "border-slate-100 dark:border-slate-800 shadow-sm"
        }`}
      >
        {/* Top: Avatar & Department Badge */}
        <div className="relative mb-4">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${getEloTier(player.elo_rating).color} blur-md opacity-40 rounded-full scale-110`}
          />
          <div
            className={`relative w-20 h-20 rounded-full overflow-hidden border-2 shadow-md ${getEloTier(player.elo_rating).border}`}
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
                className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name || "")} flex items-center justify-center text-white font-black text-2xl`}
              >
                {(player.full_name || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Dept Badge */}
          {player.department && (
            <div className="absolute -bottom-1 -right-2 flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-900 shadow-sm" title={player.department}>
              {player.department.substring(0, 3)}
            </div>
          )}
          
          {/* Status Dot */}
          {player.status === "playing" && (
            <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
          )}
          {(player.status === "looking" || player.is_looking_to_play) && (
            <span className="absolute top-1 right-0 w-4 h-4 rounded-full bg-primary border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
          )}
        </div>

        {/* Center: Name & Rank */}
        <div className="flex flex-col items-center w-full mb-6">
          <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-0.5 w-full truncate px-2 min-h-[14px]">
            {displayFirst || "\u00A0"}
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white leading-none uppercase tracking-tight w-full truncate px-2">
            {lastName}
          </div>
          {player.is_retired && (
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm bg-rose-500 text-white shadow-sm">
              Retired
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
              ELO {player.elo_rating ?? "—"}
            </span>
            {winPct !== null && (
              <span className="text-[10px] font-bold text-primary dark:text-primary bg-primary/15 dark:bg-primary/30 px-2.5 py-1 rounded-md">
                {winPct}% WIN
              </span>
            )}
            {isHot && (
              <span className="text-[10px] flex items-center justify-center font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 rounded-md" title={`${streakLen} Match Win Streak!`}>
                🔥 HOT
              </span>
            )}
            {isCold && (
              <span className="text-[10px] flex items-center justify-center font-bold text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 px-2.5 py-1 rounded-md" title={`${streakLen} Match Losing Streak`}>
                🧊 COLD
              </span>
            )}
          </div>
        </div>

        {/* Bottom: Actions */}
        <div className="mt-auto w-full border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">

          {/* Row 1: Social actions (buddy + follow) — full-width pills */}
          {!isOwn && (onBuddyAction || onToggleFollow) && (
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
                      : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
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
                      : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:text-rose-500 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
          )}

          {/* Row 2: Admin + utility icon buttons */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {isAdmin && !isOwn && (
                <>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(player.id); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(player.id); }} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleShare}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/90/30 transition-colors"
                title="Share profile"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              {!isOwn && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePing(); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                    isPinged ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  }`}
                  title="Ping player"
                >
                  <BellRing className="w-3.5 h-3.5" />
                </button>
              )}
              {onLogMatch && !isOwn && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogMatch(player.id); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title="Log Match"
                >
                  <Sword className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

        </div>
        
        {/* 'You' badge */}
        {isOwn && (
          <span className="absolute top-4 left-4 bg-primary text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm">
            You
          </span>
        )}
      </Card>
    </motion.div>
  );
}
