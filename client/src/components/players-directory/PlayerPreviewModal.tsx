import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { 
  X, 
  ExternalLink, 
  Trophy, 
  Zap, 
  Shield, 
  Swords, 
  Sparkles, 
  Activity, 
  User, 
  Loader2,
  Calendar,
  Layers,
  ChevronRight
} from "lucide-react";
import { getEloTier } from "@/lib/tiers";
import { getDepartmentAcronym } from "@/data/departments";
import { formatWinLossRecord, parseWinPct } from "./PlayerCard";

export interface ClickablePlayerData {
  id: string;
  full_name?: string;
  name?: string;
  nickname?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  elo_rating?: number | null;
  singles_elo?: number | null;
  doubles_elo?: number | null;
  mixed_elo?: number | null;
  win_loss_record?: string | null;
  playing_level?: string | null;
  playing_style?: string | null;
  dominant_hand?: string | null;
  is_guest?: boolean | null;
  current_racket?: string | null;
  email?: string | null;
  role?: string | null;
}

interface PlayerPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: ClickablePlayerData | string;
}

export function PlayerPreviewModal({ isOpen, onClose, player }: PlayerPreviewModalProps) {
  const [, setLocation] = useLocation();
  const [playerData, setPlayerData] = useState<ClickablePlayerData | null>(
    typeof player === "object" ? player : null
  );
  const [loading, setLoading] = useState<boolean>(typeof player === "string");

  const playerId = typeof player === "string" ? player : player.id;

  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !playerId) return;

    // If we only have partial player data (or a string ID), fetch full profile fields
    async function fetchFullPlayerData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("players")
          .select(`
            id, full_name, nickname, department, avatar_url,
            elo_rating, singles_elo, doubles_elo, mixed_elo,
            win_loss_record, playing_level, playing_style,
            dominant_hand, is_guest, current_racket, email, role
          `)
          .eq("id", playerId)
          .maybeSingle();

        if (!error && data && isMounted) {
          setPlayerData(data as ClickablePlayerData);
        } else if (typeof player === "object" && isMounted) {
          setPlayerData(player);
        }
      } catch (err) {
        console.error("Failed to fetch player preview:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchFullPlayerData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, playerId]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = playerData?.full_name || playerData?.name || "Player Profile";
  const elo = playerData?.elo_rating || 1200;
  const tier = getEloTier(elo);
  const dept = playerData?.department ? getDepartmentAcronym(playerData.department) : null;
  const winLoss = formatWinLossRecord(playerData?.win_loss_record);
  const winPct = parseWinPct(playerData?.win_loss_record);

  const handleOpenFullProfile = () => {
    onClose();
    setLocation(`/player/${playerId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with gradient accent */}
        <div className={`h-24 w-full bg-gradient-to-r ${tier.color} p-4 flex items-start justify-between relative overflow-hidden`}>
          {/* Subtle frosted sheen & glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/20 blur-xl pointer-events-none" />

          {/* Tier Pill */}
          <div className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-[11px] font-black uppercase tracking-wider shadow-md">
            <span>{tier.icon}</span>
            <span className="font-extrabold">{tier.name}</span>
            <span className="opacity-40">·</span>
            <span className="font-black tracking-normal">{elo} ELO</span>
          </div>

          <button
            onClick={onClose}
            className="relative z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-all cursor-pointer backdrop-blur-md border border-white/10"
            aria-label="Close popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="px-5 pb-5 pt-0 relative flex-1 flex flex-col">
          {/* Avatar Floating over banner */}
          <div className="flex justify-between items-end -mt-10 mb-3">
            <div className={`w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 shadow-xl overflow-hidden flex items-center justify-center font-black text-xl text-slate-700 dark:text-slate-200 shrink-0 ring-2 ${tier.border}/40`}>
              {playerData?.avatar_url ? (
                <img 
                  src={playerData.avatar_url} 
                  alt={displayName} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>

            {/* Quick Status / Department Badge */}
            {dept && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[11px] border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                {dept}
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">Loading player details...</span>
            </div>
          ) : (
            <>
              {/* Player Name and Quick Tags */}
              <div className="mb-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 leading-tight">
                    {displayName}
                  </h3>
                  {playerData?.is_guest && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Guest
                    </span>
                  )}
                </div>

                {playerData?.nickname && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                    "{playerData.nickname}"
                  </p>
                )}
              </div>

              {/* Stat Chips Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                {/* Win / Loss Record */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Match Record
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-100">{winLoss}</span>
                    {winPct !== null && (
                      <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                        ({winPct}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Level / Style */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-primary shrink-0" /> Level & Style
                  </span>
                  <span className="font-black text-xs text-slate-800 dark:text-slate-200 mt-1.5 truncate">
                    {playerData?.playing_level || "Club Member"}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 truncate">
                    {playerData?.playing_style || "All-Round"}
                  </span>
                </div>
              </div>

              {/* Elo Ratings Breakdown if available */}
              {(playerData?.singles_elo || playerData?.doubles_elo || playerData?.mixed_elo) && (
                <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 mb-3.5 flex items-center justify-between text-center divide-x divide-slate-200 dark:divide-slate-800 shadow-2xs">
                  <div className="flex-1 px-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Singles</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {playerData.singles_elo || "—"}
                    </span>
                  </div>
                  <div className="flex-1 px-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Doubles</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {playerData.doubles_elo || "—"}
                    </span>
                  </div>
                  <div className="flex-1 px-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Mixed</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {playerData.mixed_elo || "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Racket or Extra Spec */}
              {playerData?.current_racket && (
                <div className="mb-4 text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 px-1 truncate">
                  <Swords className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">Racket: <strong className="text-slate-700 dark:text-slate-200">{playerData.current_racket}</strong></span>
                </div>
              )}
            </>
          )}

          {/* Action: Open Full Profile Button */}
          <button
            type="button"
            onClick={handleOpenFullProfile}
            className="w-full mt-auto py-2.5 px-4 rounded-xl bg-primary hover:brightness-110 active:scale-[0.98] text-primary-foreground font-black text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-primary/20 transition-all cursor-pointer"
          >
            <span>Open Full Public Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
