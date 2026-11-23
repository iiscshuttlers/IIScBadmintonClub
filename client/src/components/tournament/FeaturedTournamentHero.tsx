import { Link } from "wouter";
import { ArrowRight, Calendar, MapPin, Users, Clock, ClipboardList } from "lucide-react";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { StatusChip } from "@/components/tournament/StatusChip";
import { EventKindLabel } from "@/components/tournament/EventKindLabel";
import { AnimatedScoreNumber } from "@/components/tournament/AnimatedScoreNumber";
import { STRETCHED_LINK, canRegisterFor, tournamentDateRange } from "@/components/tournament/TournamentCard";
import { getEventFamily } from "@/lib/tournamentTheme";
import { parseScoreSets, startsInLabel } from "@/lib/tournamentHub";
import type { LiveScorePeek } from "@/hooks/useLiveScoresFor";
import type { MyRole } from "@/hooks/useMyTournamentRoles";

export interface FeaturedTournamentHeroProps {
  /** A live or upcoming tournament (see pickFeaturedTournament). */
  tournament: any;
  href: string;
  liveScore?: LiveScorePeek;
  myRole?: MyRole;
  onRegister?: () => void;
}

/** The hub's top slot: the live tournament, or the next one to start. */
export function FeaturedTournamentHero({ tournament: t, href, liveScore, myRole, onRegister }: FeaturedTournamentHeroProps) {
  if (!t) return null;

  const isLive = t.status === "active";
  const dateRange = tournamentDateRange(t);
  const sets = isLive && liveScore ? parseScoreSets(liveScore.score) : [];
  const startsIn = startsInLabel(t);
  const canRegister = canRegisterFor(t) && !!onRegister;
  const entrants = typeof t.participant_count === "number" ? t.participant_count : 0;
  const liveCourts = isLive ? liveScore?.live_count ?? 0 : 0;

  return (
    <ThemeScope family={getEventFamily(t)}>
      <section
        aria-label={isLive ? "Live now" : "Next up"}
        className="group relative overflow-hidden rounded-3xl p-4 sm:p-6 bg-card border border-border hover:border-primary/50 shadow-xl transition-all"
      >
        <div className="flex items-center justify-between gap-3 sm:gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip state={t.status} />
              {startsIn && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
                  <Clock className="w-3 h-3" aria-hidden="true" /> {startsIn}
                </span>
              )}
              {liveCourts > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider text-live">
                  {liveCourts} court{liveCourts > 1 ? "s" : ""} live
                </span>
              )}
            </div>

            <div>
              <EventKindLabel tournament_type={t.tournament_type} format_family={t.format_family} counts_for_elo={t.counts_for_elo} />
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-display font-black text-foreground group-hover:text-primary transition-colors tracking-tight">
                <Link href={href} className={STRETCHED_LINK}>
                  {t.name}
                </Link>
              </h2>
            </div>

            {isLive && liveScore && (
              <div
                className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 rounded-2xl bg-live/15 border border-live/25 text-xs sm:text-sm"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse" aria-hidden="true" />
                <span className="font-bold text-foreground">
                  {liveScore.team1_label || "Side 1"} vs {liveScore.team2_label || "Side 2"}
                </span>
                {sets.length > 0 && (
                  <span className="flex items-center gap-1.5 font-mono font-black text-live tabular-nums">
                    {sets.map((s, i) => (
                      <span key={i} className="inline-flex items-center">
                        <AnimatedScoreNumber value={s.s1} />
                        <span className="text-live/80">-</span>
                        <AnimatedScoreNumber value={s.s2} />
                        {i < sets.length - 1 && <span className="text-live/60">,</span>}
                      </span>
                    ))}
                  </span>
                )}
                {liveScore.court_number && (
                  <span className="text-muted-foreground font-semibold text-xs">
                    Court {liveScore.court_number}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
              {dateRange && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" aria-hidden="true" /> {dateRange}
                </span>
              )}
              {t.venue && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{t.venue}</span>
                </span>
              )}
              {entrants > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4" aria-hidden="true" /> {entrants} entered
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {canRegister ? (
              <button
                type="button"
                onClick={onRegister}
                className="relative z-10 inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs sm:text-sm hover:brightness-105 active:scale-95 transition shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ClipboardList className="w-4 h-4" aria-hidden="true" />
                {myRole?.registration ? "Manage entry" : "Register"}
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-xs sm:text-sm shadow-md"
                aria-hidden="true"
              >
                {isLive ? "Watch live" : "Details"}
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
            )}
          </div>
        </div>
      </section>
    </ThemeScope>
  );
}
