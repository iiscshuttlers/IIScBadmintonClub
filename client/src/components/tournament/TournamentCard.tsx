import { motion } from "framer-motion";
import {
  Calendar, MapPin, Radio, Clock, CheckCircle2,
  ArrowRight, Users, Shield, Award, ClipboardList, Trophy
} from "lucide-react";
import { StatusChip } from "@/components/tournament/StatusChip";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { AvatarStack } from "@/components/tournament/AvatarStack";
import { getEventFamily } from "@/lib/tournamentTheme";
import { cardIn } from "@/lib/motion";
import type { MyRole } from "@/hooks/useMyTournamentRoles";
import type { LiveScorePeek } from "@/hooks/useLiveScoresFor";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

function formatLiveScore(score: any): string {
  if (!score) return "";
  if (typeof score === "string") return score;
  if (Array.isArray(score.sets) && score.sets.length > 0) {
    const sets = score.sets
      .map((s: any) => `${s.team1 ?? s.side1 ?? 0}-${s.team2 ?? s.side2 ?? 0}`)
      .join(", ");
    return sets;
  }
  if (score.current) {
    return `${score.current.team1 ?? 0}-${score.current.team2 ?? 0}`;
  }
  return "";
}

export interface TournamentCardProps {
  t: any;
  myRole?: MyRole;
  liveScore?: LiveScorePeek;
  isAuthed?: boolean;
  disambiguate?: boolean;
  onOpen: () => void;
  onRegister?: () => void;
}

export function TournamentCard({
  t,
  myRole,
  liveScore,
  isAuthed = false,
  disambiguate = false,
  onOpen,
  onRegister,
}: TournamentCardProps) {
  const family = getEventFamily(t);

  const canRegister =
    (t.status === "upcoming" || t.status === "active") &&
    t.require_app_registration &&
    onRegister;

  // Format date range nicely
  const startStr = fmtDate(t.startDate);
  const endStr = fmtDate(t.endDate);
  const dateRangeStr = startStr && endStr && startStr !== endStr
    ? `${startStr} – ${endStr}`
    : startStr || endStr;

  const scoreText = liveScore ? formatLiveScore(liveScore.score) : "";

  // Progress computation for active tournaments
  const matchStats = (() => {
    if (t.status !== "active" || !Array.isArray(t.tournament_matches) || t.tournament_matches.length === 0) {
      return null;
    }
    const total = t.tournament_matches.length;
    const completed = t.tournament_matches.filter((m: any) => m.status === "completed").length;
    const liveMatches = t.tournament_matches.filter((m: any) => m.status === "in_progress" || m.status === "active").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, liveMatches, pct };
  })();

  // Extract winner names if available on completed tournament
  const winnersList = (() => {
    if (t.status !== "completed") return [];
    if (Array.isArray(t.winners) && t.winners.length > 0) return t.winners;
    return [];
  })();

  return (
    <ThemeScope family={family} className="h-full">
      <motion.article
        variants={cardIn}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onOpen}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="group relative h-full flex flex-col bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* Top Badges & Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusChip state={t.status} />
            <EventTypeBadge
              tournament_type={t.tournament_type}
              format_family={t.format_family}
              compact
            />
            <RankedBadge ranked={t.counts_for_elo} compact />
            {t.status === "active" && matchStats && matchStats.liveMatches > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {matchStats.liveMatches} court{matchStats.liveMatches > 1 ? "s" : ""} live
              </span>
            )}
          </div>

          {/* Role Ribbon / Badge */}
          {myRole && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {myRole.isCreator && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  <Shield className="w-3 h-3" /> Organizer
                </span>
              )}
              {myRole.roles.has("REFEREE") && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Referee
                </span>
              )}
              {myRole.roles.has("UMPIRE") && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  Umpire
                </span>
              )}
              {myRole.registration && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md ${
                    myRole.registration === "approved"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : myRole.registration === "pending"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Award className="w-3 h-3" />
                  {myRole.registration === "approved" ? "Registered" : `Entry: ${myRole.registration}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Title & Description with layoutId morphing */}
        <div className="mb-3">
          <motion.h2
            layoutId={`tourn-title-${t.id}`}
            className="text-lg font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {t.name}
          </motion.h2>
          {disambiguate && (dateRangeStr || t.venue) && (
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1.5 truncate">
              <span>{[dateRangeStr, t.venue].filter(Boolean).join(" · ")}</span>
            </p>
          )}
          {t.subtitle && (
            <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-1">
              {t.subtitle}
            </p>
          )}
        </div>

        {/* Progress Strip on Active Tournaments */}
        {matchStats && (
          <div className="mb-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>Match Progress</span>
              <span className="font-mono text-primary">{matchStats.completed}/{matchStats.total} ({matchStats.pct}%)</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.max(matchStats.pct, 5)}%` }}
              />
            </div>
          </div>
        )}

        {/* Winner Chips on Completed Tournaments */}
        {winnersList.length > 0 && (
          <div className="mb-3 p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/40 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 truncate">
              Champion: <span className="font-black">{winnersList.map((w: any) => typeof w === "string" ? w : w.name || w.player_name).join(", ")}</span>
            </div>
          </div>
        )}

        {/* Live Score Peek */}
        {t.status === "active" && liveScore && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {liveScore.team1_label || "Side 1"} vs {liveScore.team2_label || "Side 2"}
              </span>
            </div>
            {scoreText && (
              <span className="font-mono font-black text-rose-600 dark:text-rose-400 shrink-0 ml-2">
                {scoreText}
              </span>
            )}
            {liveScore.court_number && (
              <span className="text-[10px] text-muted-foreground ml-1.5 shrink-0">
                Ct {liveScore.court_number}
              </span>
            )}
          </div>
        )}

        {/* Meta details (Dates, Venue, Entrants) */}
        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
          {dateRangeStr && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{dateRangeStr}</span>
            </div>
          )}
          {t.venue && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">{t.venue}</span>
            </div>
          )}
          {typeof t.participant_count === "number" && t.participant_count > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <AvatarStack
                totalCount={t.participant_count}
                avatars={t.sample_participants || []}
                size="xs"
              />
            </div>
          )}
        </div>

        {/* Categories Chips */}
        {Array.isArray(t.categories) && t.categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {t.categories.slice(0, 4).map((c: string) => (
              <span
                key={c}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold"
              >
                {c}
              </span>
            ))}
            {t.categories.length > 4 && (
              <span className="text-[11px] text-muted-foreground font-semibold">
                +{t.categories.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Action Footers */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {canRegister ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRegister();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-slate-950 text-xs font-black hover:brightness-105 active:scale-95 transition shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              {myRole?.registration ? "Manage entry" : "Register"}
            </button>
          ) : (
            <span className="text-xs font-bold text-slate-500">
              {t.status === "completed" ? "View results" : "View matches"}
            </span>
          )}

          <div className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform ml-auto">
            Open <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </motion.article>
    </ThemeScope>
  );
}
