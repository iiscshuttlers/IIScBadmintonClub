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

export interface Player {
  id: string;
  full_name: string;
  nickname?: string;
  department: string;
  joined_year: number;
  playing_level: string;
  playing_style: string;
  dominant_hand: string;
  avatar_url: string;
  current_racket?: string;
  user_id?: string;
  elo_rating?: number;
  win_loss_record?: string;
  recent_form?: string[];
  is_approved?: boolean;
  is_looking_to_play?: boolean;
  status?: string;
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-500",
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
    "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30",
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
  onToggleBuddy?: (id: string) => void;
  onToggleFollow?: (id: string) => void;
  isBuddy?: boolean;
  isFollowing?: boolean;
  currentUserName?: string;
}

export function PlayerCard({
  player,
  isOwn = false,
  isAdmin = false,
  onDelete,
  onEdit,
  onLogMatch,
  onToggleBuddy,
  onToggleFollow,
  isBuddy = false,
  isFollowing = false,
  currentUserName,
}: PlayerCardProps) {
  // Calibration Phase
  const totalMatches = (() => {
    if (!player.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split("-").map(Number);
    return (w || 0) + (l || 0);
  })();
  const isUnranked = totalMatches < 5;
  const [isPinged, setIsPinged] = useState(false);
  const winPct = parseWinPct(player.win_loss_record);

  const handlePing = () => {
    if (isOwn) return;
    if (isPinged) {
      setIsPinged(false);
      toast.success(`Ping to ${player.full_name} cancelled.`, {
        icon: <BellOff className="w-4 h-4 text-slate-500" />,
      });
    } else {
      setIsPinged(true);
      
      // Broadcast the ping to all listening clients
      supabase.channel("pings").send({
        type: "broadcast",
        event: "ping",
        payload: {
          target_id: player.id,
          sender_name: currentUserName || "A player",
        },
      });

      toast.success(
        `Ping sent to ${player.full_name}! They will be notified.`,
        {
          icon: <BellRing className="w-4 h-4 text-emerald-500" />,
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

  const nameParts = player.full_name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const displayFirst = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : firstName;

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
        className={`w-full overflow-hidden cursor-pointer border-b bg-white dark:bg-slate-900
        hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-md hover:-translate-y-0.5
        transition-all duration-200 flex items-center group relative p-3 rounded-2xl
        ${
          isOwn
            ? "border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/30"
            : "border-slate-100 dark:border-slate-800"
        }`}
      >
        {/* Left Side: Avatar & Department Badge */}
        <div className="relative shrink-0 mr-4">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${getEloTier(player.elo_rating).color} blur-sm opacity-30 rounded-full`}
          />
          <div
            className={`relative w-16 h-16 rounded-full overflow-hidden border-2 shadow-sm ${getEloTier(player.elo_rating).border}`}
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
                className={`w-full h-full bg-gradient-to-br ${avatarGradient(player.full_name)} flex items-center justify-center text-white font-black text-xl`}
              >
                {player.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Dept Badge */}
          <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-900 shadow-sm" title={player.department}>
            {player.department.substring(0, 3)}
          </div>
          
          {/* Status Dot */}
          {player.status === "playing" && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
          )}
          {(player.status === "looking" || player.is_looking_to_play) && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse" />
          )}
        </div>

        {/* Center: Name & Rank */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-[2px] truncate font-bold">
            {displayFirst}
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none uppercase truncate tracking-tight">
            {lastName}
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              ELO {player.elo_rating ?? "—"}
            </span>
            {winPct !== null && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                {winPct}% WIN
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0 ml-2">
           {/* Admin Actions */}
           {isAdmin && !isOwn && (
             <div className="flex flex-row sm:flex-col gap-1 mb-1 sm:mb-0 sm:mr-2 sm:border-r border-slate-100 dark:border-slate-800 pr-0 sm:pr-2">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit?.(player.id); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(player.id); }} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
             </div>
           )}

           <div className="flex items-center gap-1">
             {/* User Actions */}
             {onToggleBuddy && !isOwn && (
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   onToggleBuddy(player.id);
                 }}
                 className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                   isBuddy
                     ? "text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/30"
                     : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                 }`}
                 title={isBuddy ? "Remove from Buddies" : "Add to Buddies"}
               >
                 <svg className="w-4 h-4" fill={isBuddy ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isBuddy ? "0" : "2"}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                 </svg>
               </button>
             )}
             {onToggleFollow && !isOwn && (
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   onToggleFollow(player.id);
                 }}
                 className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                   isFollowing
                     ? "text-violet-500 hover:text-violet-600 bg-violet-50 dark:bg-violet-950/30"
                     : "text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                 }`}
                 title={isFollowing ? "Unfollow" : "Follow"}
               >
                 {isFollowing ? (
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9 8v-1c0-2.66 5.33-4 8-4s8 1.34 8 4v1H3zm18-6v-3h-3v-2h3V6h2v3h3v2h-3v3h-2z" /></svg>
                 ) : (
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                 )}
               </button>
             )}
             <button
               onClick={handleShare}
               className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
             >
               <Share2 className="w-4 h-4" />
             </button>
             
             {!isOwn && (
               <button
                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePing(); }}
                 className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                   isPinged ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                 }`}
                 title="Ping player"
               >
                 {isPinged ? <BellRing className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
               </button>
             )}

             {onLogMatch && !isOwn && (
               <button
                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogMatch(player.id); }}
                 className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                 title="Log Match"
               >
                 <Sword className="w-4 h-4" />
               </button>
             )}
           </div>
        </div>
        
        {/* 'You' badge */}
        {isOwn && (
          <span className="absolute top-2 right-4 text-[9px] font-black uppercase text-emerald-500">
            You
          </span>
        )}
      </Card>
    </motion.div>
  );
}
