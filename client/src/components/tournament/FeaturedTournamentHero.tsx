import { Trophy, Radio, ArrowRight, Calendar, MapPin, Users, Clock } from "lucide-react";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { StatusChip } from "@/components/tournament/StatusChip";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { AnimatedScoreNumber } from "@/components/tournament/AnimatedScoreNumber";
import { AvatarStack } from "@/components/tournament/AvatarStack";
import { getEventFamily } from "@/lib/tournamentTheme";
import type { LiveScorePeek } from "@/hooks/useLiveScoresFor";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

function parseSets(score: any): Array<{ s1: number | string; s2: number | string }> {
  if (!score) return [];
  if (Array.isArray(score.sets) && score.sets.length > 0) {
    return score.sets.map((s: any) => ({
      s1: s.team1 ?? s.side1 ?? 0,
      s2: s.team2 ?? s.side2 ?? 0,
    }));
  }
  if (score.current) {
    return [{ s1: score.current.team1 ?? 0, s2: score.current.team2 ?? 0 }];
  }
  return [];
}

export interface FeaturedTournamentHeroProps {
  tournament: any;
  liveScore?: LiveScorePeek;
  onOpen: () => void;
}

export function FeaturedTournamentHero({
  tournament: t,
  liveScore,
  onOpen,
}: FeaturedTournamentHeroProps) {
  if (!t) return null;

  const family = getEventFamily(t);
  const isLive = t.status === "active";
  const startStr = fmtDate(t.startDate);
  const endStr = fmtDate(t.endDate);
  const dateStr = startStr && endStr && startStr !== endStr ? `${startStr} – ${endStr}` : startStr || endStr;
  const sets = liveScore ? parseSets(liveScore.score) : [];

  // Countdown computation for upcoming tournament
  const countdownText = (() => {
    if (isLive || !t.startDate) return null;
    const now = new Date().setHours(0, 0, 0, 0);
    const target = new Date(t.startDate).setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((target - now) / 86400000);
    if (diffDays <= 0) return "Starts today";
    if (diffDays === 1) return "Starts tomorrow";
    return `Starts in ${diffDays} days`;
  })();

  return (
    <ThemeScope family={family} className="mb-6">
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-slate-900 border border-slate-800 hover:border-primary/50 shadow-xl transition-all cursor-pointer group active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip state={t.status} />
              {countdownText ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
                  <Clock className="w-3 h-3" aria-hidden="true" /> {countdownText}
                </span>
              ) : !isLive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-slate-700">
                  <Trophy className="w-3 h-3 text-primary" aria-hidden="true" /> Featured
                </span>
              )}
              <EventTypeBadge
                tournament_type={t.tournament_type}
                format_family={t.format_family}
                compact
              />
              <RankedBadge ranked={t.counts_for_elo} compact />
            </div>

            <div>
              <h2
                className="text-xl sm:text-2xl lg:text-3xl font-black text-white group-hover:text-primary transition-colors tracking-tight"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                {t.name}
              </h2>
              {t.subtitle && (
                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                  {t.subtitle}
                </p>
              )}
            </div>

            {/* W3: Big Live Scoreline with Number Roll */}
            {isLive && liveScore && (
              <div
                className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-xs sm:text-sm shadow-inner"
                aria-label={`Live match score: ${liveScore.team1_label || "Side 1"} versus ${liveScore.team2_label || "Side 2"}`}
              >
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span className="font-bold text-white tracking-wide">
                  {liveScore.team1_label || "Side 1"} vs {liveScore.team2_label || "Side 2"}
                </span>

                {sets.length > 0 ? (
                  <div className="flex items-center gap-2 font-mono font-black text-rose-300 text-sm sm:text-base bg-rose-950/70 px-2.5 py-0.5 rounded-lg border border-rose-800/50">
                    {sets.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center">
                        {idx > 0 && <span className="text-rose-500/60 mx-1">,</span>}
                        <AnimatedScoreNumber value={s.s1} />
                        <span className="text-rose-500/80 mx-0.5">-</span>
                        <AnimatedScoreNumber value={s.s2} />
                      </span>
                    ))}
                  </div>
                ) : null}

                {liveScore.court_number && (
                  <span className="text-rose-300/80 font-semibold text-xs ml-1 bg-rose-900/40 px-2 py-0.5 rounded-md">
                    Court {liveScore.court_number}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-400 flex-wrap pt-1">
              {dateStr && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>{dateStr}</span>
                </div>
              )}
              {t.venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>{t.venue}</span>
                </div>
              )}
              {typeof t.participant_count === "number" && t.participant_count > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <AvatarStack
                    totalCount={t.participant_count}
                    avatars={t.sample_participants || []}
                    size="sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 self-stretch md:self-auto flex items-center justify-end">
            <button
              type="button"
              aria-label={`Enter tournament hub for ${t.name}`}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-950 font-black text-xs sm:text-sm hover:brightness-105 active:scale-95 transition shadow-md focus-visible:ring-2 focus-visible:ring-primary"
            >
              Enter Tournament Hub <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </ThemeScope>
  );
}
