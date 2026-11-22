import { Trophy, ZoomIn } from "lucide-react";
import type { PlayerRow } from "@/types";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { FormChips } from "@/components/match/MatchPrimitives";
import { useRecentForm } from "@/hooks/queries/useRecentForm";
import { useRankingMovement } from "@/hooks/queries/useRankingMovement";
import { movementLabel } from "@/lib/rankMovement";
import { cssVar } from "@/lib/themeColors";

interface PlayerHeroBannerProps {
  player: PlayerRow;
  eloRank: number | null;
}

// The banner photo is dark in every theme, so hero text uses the fixed on-media
// colours (like the action buttons above it) with a dark halo, not theme text colours.
const HERO_TEXT_SHADOW = `0 2px 14px ${cssVar("scrim")}, 0 1px 3px ${cssVar("scrim")}`;

export function PlayerHeroBanner({ player, eloRank }: PlayerHeroBannerProps) {
  const nameParts = (player.full_name || "").trim().split(/\s+/);
  const heroLastWord = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
  const heroRestName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const form = useRecentForm([player.id]);
  const formEntries = form.data?.[player.id];
  const movement = useRankingMovement("overall", !!eloRank);
  const myMove = movement.data?.[player.id];
  const moveLabel = movementLabel(myMove);

  return (
    <>
      {/* Profile Banner: fills the page's hero wrapper (navigation bar + hero), so the
          text never runs past the photo on phones. One dark banner serves every theme. */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={`${import.meta.env.BASE_URL}profile_banner_dark.webp`}
          alt="Profile Banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-media/65 via-media/35 to-transparent" />
        {/* Blends into the page, inside the hero's bottom padding (below the text). */}
        <div className="absolute bottom-0 left-0 right-0 h-10 md:h-14 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-12 md:pb-16 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-6 items-end relative pointer-events-auto">
          {/* Avatar */}
          <div className="relative mt-8 md:mt-12 shrink-0 z-20">
            <div className="w-40 h-40 md:w-64 md:h-64 rounded-2xl border-4 border-foreground/35 overflow-hidden shadow-[0_8px_40px_color-mix(in_srgb,var(--scrim)_35%,transparent)] dark:shadow-[0_8px_40px_color-mix(in_srgb,var(--scrim)_80%,transparent)] bg-muted group relative">
              {player.avatar_url ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="w-full h-full cursor-pointer">
                      <img
                        src={player.avatar_url}
                        alt={player.full_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-media/0 group-hover:bg-media/20 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-8 h-8 text-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-1 sm:p-2 bg-transparent border-none shadow-none flex justify-center items-center [&>button]:text-on-media [&>button]:bg-media/50 [&>button]:hover:bg-media/70 [&>button]:rounded-full [&>button]:p-2 [&>button]:top-2 [&>button]:right-2 sm:[&>button]:top-4 sm:[&>button]:right-4 z-[100]" showCloseButton={true}>
                    <DialogTitle className="sr-only">{player.full_name}'s Profile Picture</DialogTitle>
                    <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
                      <TransformComponent wrapperStyle={{ width: "100%", height: "80vh" }} contentStyle={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img
                          src={player.avatar_url}
                          alt={player.full_name}
                          className="w-full h-full max-h-[80vh] object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-black text-muted-foreground">
                  {player.full_name.charAt(0)}
                </div>
              )}
            </div>
            {/* Rank badge */}
            {eloRank && (
              <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-black text-xl shadow-lg border-2 border-border flex items-center gap-2 z-30">
                <Trophy className="w-5 h-5" /> #{eloRank}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2 md:pb-4 text-on-media mt-4 md:mt-0">
            <div className="flex flex-col">
              {heroRestName && (
                <div className="flex items-center gap-3">
                  <span
                    className="text-xl md:text-3xl font-bold uppercase tracking-[0.2em] text-on-media"
                    style={{ textShadow: HERO_TEXT_SHADOW }}
                  >
                    {heroRestName}
                  </span>
                  {player.is_retired && (
                    <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-danger text-on-accent rounded-md shadow-md border border-danger">
                      Retired
                    </span>
                  )}
                </div>
              )}
              {!heroRestName && player.is_retired && (
                <div className="mb-2">
                  <span className="px-2.5 py-1 text-xs font-black uppercase tracking-widest bg-danger text-on-accent rounded-md shadow-md border border-danger">
                    Retired
                  </span>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-4">
                <h1
                  className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none text-on-media"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  {heroLastWord}
                </h1>
              </div>
              
              {player.joined_year && (
                <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2">
                  {/* Same treatment as the action buttons over the banner. */}
                  <span className="px-3 md:px-4 py-1.5 md:py-2 bg-media/45 border border-on-media/20 rounded-full text-[10px] md:text-xs font-black tracking-widest uppercase shadow-sm backdrop-blur-md text-on-media">
                    Member Since {player.joined_year}
                  </span>
                </div>
              )}

              {eloRank && (moveLabel || (myMove?.peakRank && myMove.peakRank < eloRank)) ? (
                <p className="mt-3 text-xs md:text-sm font-bold text-on-media/85" style={{ textShadow: HERO_TEXT_SHADOW }}>
                  Rank #{eloRank}
                  {moveLabel && <span title={moveLabel.long}> ({moveLabel.text}<span className="sr-only">: {moveLabel.long}</span>)</span>}
                  {myMove?.peakRank && myMove.peakRank < eloRank ? <> · peak #{myMove.peakRank}</> : null}
                </p>
              ) : null}

              {/* Last-5 tournament form; hidden for players with no tournament results. */}
              {(form.isPending && form.fetchStatus !== "idle") || (formEntries && formEntries.length > 0) ? (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-on-media/85" style={{ textShadow: HERO_TEXT_SHADOW }}>
                    Tournament form
                  </span>
                  <FormChips entries={formEntries} loading={form.isPending} size="md" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
