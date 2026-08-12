import { Trophy, ZoomIn } from "lucide-react";
import type { PlayerProfileType } from "@/types";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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
          src={`${import.meta.env.BASE_URL}profile_banner_light.png`}
          alt="Profile Banner"
          className="w-full h-full object-cover dark:hidden"
        />
        <img
          src={`${import.meta.env.BASE_URL}profile_banner_dark.png`}
          alt="Profile Banner"
          className="w-full h-full object-cover hidden dark:block"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-white/20 to-transparent dark:from-black/65 dark:via-black/35 dark:to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-50 dark:from-[#060d1b] to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-12 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-6 items-end relative pointer-events-auto">
          {/* Avatar */}
          <div className="relative mt-8 md:mt-12 shrink-0 z-20">
            <div className="w-40 h-40 md:w-64 md:h-64 rounded-2xl border-4 border-slate-200/70 dark:border-white/35 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.55)] bg-slate-200 dark:bg-slate-800 group relative">
              {player.avatar ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="w-full h-full cursor-pointer">
                      <img
                        src={player.avatar}
                        alt={player.fullName}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-1 sm:p-2 bg-transparent border-none shadow-none flex justify-center items-center [&>button]:text-white [&>button]:bg-black/50 [&>button]:hover:bg-black/70 [&>button]:rounded-full [&>button]:p-2 [&>button]:top-2 [&>button]:right-2 sm:[&>button]:top-4 sm:[&>button]:right-4 z-[100]" showCloseButton={true}>
                    <DialogTitle className="sr-only">{player.fullName}'s Profile Picture</DialogTitle>
                    <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
                      <TransformComponent wrapperStyle={{ width: "100%", height: "80vh" }} contentStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img
                          src={player.avatar}
                          alt={player.fullName}
                          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-muted-foreground">
                  {player.fullName.charAt(0)}
                </div>
              )}
            </div>
            {/* Rank badge */}
            {eloRank && (
              <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-black text-xl shadow-lg border-2 border-white dark:border-slate-950 flex items-center gap-2 z-30">
                <Trophy className="w-5 h-5" /> #{eloRank}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2 md:pb-4 text-foreground dark:text-foreground mt-4 md:mt-0">
            <div className="flex flex-col">
              {heroRestName && (
                <div className="flex items-center gap-3">
                  <span
                    className="text-xl md:text-3xl font-bold uppercase tracking-[0.2em] text-slate-800 dark:text-foreground"
                    style={
                      theme === "light"
                        ? { textShadow: "0 2px 12px rgba(255,255,255,0.8), 0 1px 4px rgba(255,255,255,0.6)" }
                        : undefined
                    }
                  >
                    {heroRestName}
                  </span>
                  {player.is_retired && (
                    <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-rose-500 text-foreground rounded-md shadow-md border border-rose-400">
                      Retired
                    </span>
                  )}
                </div>
              )}
              {!heroRestName && player.is_retired && (
                <div className="mb-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-rose-500 text-foreground rounded-md shadow-md border border-rose-400">
                    Retired
                  </span>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-4">
                <h1
                  className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none text-slate-900 dark:text-foreground"
                  style={
                    theme === "light"
                      ? { textShadow: "0 2px 16px rgba(255,255,255,0.8), 0 1px 4px rgba(255,255,255,0.6)" }
                      : undefined
                  }
                >
                  {heroLastWord}
                </h1>
              </div>
              
              {player.joinedYear && (
                <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2">
                  <span className="px-3 md:px-4 py-1.5 md:py-2 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-full text-[10px] md:text-xs font-black tracking-widest uppercase shadow-sm backdrop-blur-md text-slate-800 dark:text-slate-200">
                    Member Since {player.joinedYear}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
