import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChevronRight, ClipboardList, Trophy, Clock } from "lucide-react";
import { StatusChip } from "@/components/tournament/StatusChip";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventKindLabel } from "@/components/tournament/EventKindLabel";
import { TournamentRoleChips } from "@/components/tournament/TournamentRoleChips";
import { getEventFamily } from "@/lib/tournamentTheme";
import { categoryTextClass } from "@/lib/categoryColors";
import { formatDateRange, formatScoreLine, isPastStatus, startsInLabel } from "@/lib/tournamentHub";
import { cardIn } from "@/lib/motion";
import type { MyRole } from "@/hooks/useMyTournamentRoles";
import type { LiveScorePeek } from "@/hooks/useLiveScoresFor";

/** Champion rows shown on a card before collapsing the rest into "+N more". */
const MAX_CHAMPION_ROWS = 3;
/** Category chips shown before "+N more". */
const MAX_CATEGORY_CHIPS = 4;

export const tournamentDateRange = (t: { startDate?: string | null; endDate?: string | null }) =>
  formatDateRange(t.startDate, t.endDate);

/** Can the hub offer Register / Manage entry for this tournament? */
export const canRegisterFor = (t: { status?: string | null; require_app_registration?: boolean | null }) =>
  (t.status === "upcoming" || t.status === "active") && !!t.require_app_registration;

/**
 * Stretched-link classes: the title link covers the whole card, so the card
 * opens like a link (new tab, long-press share) without nesting buttons.
 * Anything else clickable on the card sits above it with `relative z-10`.
 */
export const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 after:content-[''] after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-primary";

export interface TournamentCardProps {
  t: any;
  href: string;
  myRole?: MyRole;
  liveScore?: LiveScorePeek;
  /** Another tournament has the same name: highlight the date to tell them apart. */
  disambiguate?: boolean;
  onRegister?: () => void;
}

export function TournamentCard({ t, href, myRole, liveScore, disambiguate = false, onRegister }: TournamentCardProps) {
  const family = getEventFamily(t);
  const finished = isPastStatus(t.status);
  const isLive = t.status === "active";
  const canRegister = canRegisterFor(t) && !!onRegister;
  const dateRange = tournamentDateRange(t);
  const scoreText = liveScore ? formatScoreLine(liveScore.score) : "";
  const liveCourts = isLive ? liveScore?.live_count ?? 0 : 0;
  const entrants = typeof t.participant_count === "number" ? t.participant_count : 0;
  const startsIn = startsInLabel(t);

  // Matches played so far, for a live tournament.
  const progress = isLive && t.match_total > 0
    ? { played: t.match_played ?? 0, total: t.match_total, pct: Math.round(((t.match_played ?? 0) / t.match_total) * 100) }
    : null;

  // Finals winners are { category, winner, runnerUp }; skip any without a name.
  const champions: any[] = finished && Array.isArray(t.winners)
    ? t.winners.filter((w: any) => (typeof w === "string" ? w : w?.winner))
    : [];
  // Categories whose champions are folded away, named so nothing is a mystery.
  const hiddenCategories: string[] = champions
    .slice(MAX_CHAMPION_ROWS)
    .map((w: any) => (typeof w === "string" ? null : w.category))
    .filter(Boolean);
  // Champions already name the categories; show chips only when there are none.
  const categories: string[] = champions.length === 0 && Array.isArray(t.categories) ? t.categories : [];

  return (
    <ThemeScope family={family} className="h-full">
      <motion.article
        variants={cardIn}
        initial="initial"
        animate="animate"
        exit="exit"
        className="group relative h-full flex flex-col bg-card/90 border border-border rounded-2xl p-4 sm:p-5 hover:border-primary/50 hover:shadow-xl active:scale-[0.99] transition-all duration-200 overflow-hidden"
      >
        {/* Title first, with a chevron: the whole card is the link. */}
        <div className="flex items-start gap-2">
          <motion.h3
            layoutId={`tourn-title-${t.id}`}
            className="flex-1 min-w-0 text-lg leading-snug font-display font-black text-foreground group-hover:text-primary transition-colors line-clamp-2"
          >
            <Link href={href} className={STRETCHED_LINK}>
              {t.name}
            </Link>
          </motion.h3>
          <ChevronRight
            className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition"
            aria-hidden="true"
          />
        </div>

        {/* The facts on one line: when, where, how many. */}
        {(dateRange || t.venue || entrants > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {[
              dateRange && (
                <span key="date" className={disambiguate ? "font-bold text-warning" : undefined}>{dateRange}</span>
              ),
              t.venue && <span key="venue" className="min-w-0 truncate">{t.venue}</span>,
              entrants > 0 && <span key="entrants">{entrants} entered</span>,
            ]
              .filter(Boolean)
              .flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep-${i}`} aria-hidden="true">·</span>, part]))}
          </p>
        )}

        {/* What the group heading doesn't say: LIVE, the countdown, the kind of
            event and your role, all on one line. */}
        <div className="mt-2 mb-3 last:mb-0 flex items-center justify-between gap-x-2 gap-y-1.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isLive && <StatusChip state="active" compact />}
            {liveCourts > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider text-live">
                {liveCourts} court{liveCourts > 1 ? "s" : ""} live
              </span>
            )}
            {startsIn && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Clock className="w-3 h-3" aria-hidden="true" /> {startsIn}
              </span>
            )}
            <EventKindLabel tournament_type={t.tournament_type} format_family={t.format_family} counts_for_elo={t.counts_for_elo} />
          </div>
          {myRole && <TournamentRoleChips role={myRole} />}
        </div>

        {progress && (
          <div className="mb-3 last:mb-0 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>Matches played</span>
              <span className="tabular-nums text-primary">{progress.played}/{progress.total}</span>
            </div>
            <div
              className="w-full h-1.5 bg-muted-strong rounded-full overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.played}
              aria-label="Matches played"
            >
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.max(progress.pct, 4)}%` }} />
            </div>
          </div>
        )}

        {isLive && liveScore && (
          <div className="mb-3 last:mb-0 p-2.5 rounded-xl bg-live/10 border border-live/30 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-live animate-pulse shrink-0" aria-hidden="true" />
            <span className="font-bold text-soft truncate min-w-0">
              {liveScore.team1_label || "Side 1"} vs {liveScore.team2_label || "Side 2"}
            </span>
            {scoreText && <span className="ml-auto font-mono font-black text-live shrink-0 tabular-nums">{scoreText}</span>}
            {liveScore.court_number && (
              <span className={`text-[10px] text-muted-foreground shrink-0 ${scoreText ? "" : "ml-auto"}`}>Ct {liveScore.court_number}</span>
            )}
          </div>
        )}

        {/* One row per category so long names wrap inside the card. */}
        {champions.length > 0 && (
          <div className="mb-3 last:mb-0 pt-3 border-t border-border/70">
            <p className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black uppercase tracking-wider text-gold">
              <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {champions.length > 1 ? "Champions" : "Champion"}
            </p>
            <ul className="space-y-1 text-xs">
              {champions.slice(0, MAX_CHAMPION_ROWS).map((w: any, i: number) => {
                const category = typeof w === "string" ? null : w.category;
                const name = typeof w === "string" ? w : w.winner;
                return (
                  <li key={`${category ?? ""}-${i}`} className="flex items-baseline gap-2">
                    {category && (
                      <span className={`shrink-0 min-w-7 max-w-[40%] truncate text-[11px] font-black ${categoryTextClass(category)}`}>
                        {category}
                      </span>
                    )}
                    <span className="font-semibold text-foreground wrap-anywhere">{name}</span>
                  </li>
                );
              })}
            </ul>
            {champions.length > MAX_CHAMPION_ROWS && (
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                {hiddenCategories.length > 0
                  ? `+ ${hiddenCategories.join(", ")}`
                  : `+${champions.length - MAX_CHAMPION_ROWS} more`}
              </p>
            )}
          </div>
        )}

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3 last:mb-0">
            {categories.slice(0, MAX_CATEGORY_CHIPS).map((c) => (
              <span key={c} className={`px-2 py-0.5 rounded-md bg-muted text-[11px] font-black ${categoryTextClass(c)}`}>
                {c}
              </span>
            ))}
            {categories.length > MAX_CATEGORY_CHIPS && (
              <span className="text-[11px] text-muted-foreground font-semibold">+{categories.length - MAX_CATEGORY_CHIPS} more</span>
            )}
          </div>
        )}

        {/* The one extra action, when registration is open. */}
        {canRegister && (
          <div className="mt-auto pt-1">
            <button
              type="button"
              onClick={onRegister}
              className="relative z-10 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:brightness-105 active:scale-95 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
              {myRole?.registration ? "Manage entry" : "Register"}
            </button>
          </div>
        )}
      </motion.article>
    </ThemeScope>
  );
}
