import { Trophy } from "lucide-react";
import type { PlayerProfileType } from "@/types";

interface PlayerHeroBannerProps {
  player: PlayerProfileType;
  eloRank: number | null;
  theme: "light" | "dark" | "system";
}

export function PlayerHeroBanner({ player, eloRank, theme }: PlayerHeroBannerProps) {
  const nameParts = player.fullName.trim().split(/\s+/);
  const heroLastWord = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
  const heroRestName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";

  return (
    <>
      {/* Profile Banner */}
      <div className="absolute top-0 left-0 w-full h-[380px] md:h-[460px] overflow-hidden">
        <img
          src="/profile_banner_dark.png"
          alt="Profile Banner"
          className="w-full h-full object-cover dark:hidden"
        />
        <img
          src="/profile_banner_light.png"
          alt="Profile Banner"
          className="w-full h-full object-cover hidden dark:block"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-white/20 to-transparent dark:from-black/65 dark:via-black/35 dark:to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-50 dark:from-[#060d1b] to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-12 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-8 items-end relative pointer-events-auto">
          {/* Avatar */}
          <div className="relative mt-8 md:mt-24 shrink-0 z-20">
            <div className="w-40 h-40 md:w-64 md:h-64 rounded-2xl border-4 border-slate-200/70 dark:border-white/35 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.55)] bg-slate-200 dark:bg-slate-800">
              {player.avatar ? (
                <img
                  src={player.avatar}
                  alt={player.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-slate-400">
                  {player.fullName.charAt(0)}
                </div>
              )}
            </div>
            {/* Rank badge */}
            {eloRank && (
              <div className="absolute -bottom-4 -right-4 bg-primary text-white px-4 py-2 rounded-lg font-black text-xl shadow-lg border-2 border-white dark:border-slate-950 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> #{eloRank}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2 md:pb-4 text-slate-900 dark:text-white mt-4 md:mt-0">
            <div className="flex flex-col">
              {heroRestName && (
                <div className="flex items-center gap-3">
                  <span
                    className="text-xl md:text-3xl font-bold uppercase tracking-[0.2em] text-white/95 dark:text-slate-900"
                    style={
                      theme === "light"
                        ? { textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)" }
                        : undefined
                    }
                  >
                    {heroRestName}
                  </span>
                  {player.is_retired && (
                    <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-rose-500 text-white rounded-md shadow-md border border-rose-400">
                      Retired
                    </span>
                  )}
                </div>
              )}
              {!heroRestName && player.is_retired && (
                <div className="mb-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-rose-500 text-white rounded-md shadow-md border border-rose-400">
                    Retired
                  </span>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-4">
                <h1
                  className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none text-white dark:text-slate-900"
                  style={
                    theme === "light"
                      ? { textShadow: "0 4px 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)" }
                      : undefined
                  }
                >
                  {heroLastWord}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
