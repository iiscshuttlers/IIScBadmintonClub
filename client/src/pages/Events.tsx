import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Trophy,
  Radio,
  Medal,
  ArrowRight,
  Clock,
  Info,
  Timer,
  Award,
  GraduationCap,
  Star,
  type LucideIcon,
} from "lucide-react";
import { getTournaments, fetchTournamentConfig, DEFAULT_TOURNAMENT_CONFIG, type TournamentConfig } from "@/lib/tournaments";
import {
  ARCHIVED_TOURNAMENTS,
  ArchivedTournament,
  type TournamentStatus,
} from "@/data/tournamentArchive";
import { usePageMeta } from "@/hooks/usePageMeta";
import { InfoModal } from "@/components/InfoModal";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import ScheduleCalendar from "./ScheduleCalendar";
import { TournamentSection } from "@/components/events/TournamentSection";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { useHashTab } from "@/hooks/useHashTab";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};


const MILESTONE_ICONS: LucideIcon[] = [Trophy, Medal, Award, GraduationCap, Star];

const MILESTONES = [
  ...[...ARCHIVED_TOURNAMENTS]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5)
    .map((t, i) => {
      const colors = [
        "border-amber-400",
        "border-emerald-500",
        "border-blue-500",
        "border-purple-500",
        "border-orange-400",
      ];
      return {
        year: t.startDate,
        title: t.name,
        desc: t.description,
        icon: (MILESTONE_ICONS[i] ?? Trophy) as LucideIcon,
        color: colors[i] ?? "border-slate-400",
        upcoming: false,
      };
    }),
];

type LiveTournament = {
  id: string;
  slug?: string;
  name: string;
  subtitle?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: TournamentStatus;
  location?: string;
  type?: string;
  categories?: string[];
};

function EventSkeleton() {
  return (
    <div className="rounded-3xl border border-gray-200 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800 p-8 space-y-5 animate-pulse">
      <div className="flex gap-3">
        <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-slate-700" />
        <div className="h-6 w-36 rounded-full bg-gray-200 dark:bg-slate-700" />
      </div>
      <div className="h-8 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-slate-700" />
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-slate-700" />
      </div>
      <div className="h-5 w-28 rounded bg-gray-200 dark:bg-slate-700" />
    </div>
  );
}

function NoUpcomingEvents() {
  return (
    <div className="rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/10 p-14 text-center">
      <Calendar className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-blue-900 dark:text-white mb-2">
        No upcoming tournaments
      </h3>
      <p className="text-gray-500 dark:text-slate-400 max-w-md mx-auto">
        No events are scheduled right now — check back soon, or browse our
        completed events below.
      </p>
    </div>
  );
}

function UpcomingCountdown({ event }: { event: any }) {
  const calcTime = () => {
    const diff = new Date(event.startDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };

  const [time, setTime] = useState(calcTime);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => setTime(calcTime()), 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [event.startDate]);

  if (!time) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-blue-950 to-emerald-950 text-white p-8 mb-8 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 hero-pattern" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest mb-2">
            <Clock className="w-4 h-4" />
            Next Tournament
          </div>
          <h2 className="text-3xl font-bold">{event.name}</h2>
          <p className="text-gray-400 mt-1 text-sm">{event.startDate}</p>
        </div>
        <div className="flex gap-3 text-center">
          {[
            ["Days", time.days],
            ["Hrs", time.hours],
            ["Min", time.minutes],
            ["Sec", time.seconds],
          ].map(([label, val]) => (
            <div
              key={label as string}
              className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 min-w-[64px]"
            >
              <div className="text-3xl font-black tabular-nums">
                {String(val).padStart(2, "0")}
              </div>
              <div className="text-xs text-emerald-300 font-bold mt-1">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Events() {
  usePageMeta({
    title: "Events & Championships",
    description:
      "Browse live, upcoming and completed badminton tournaments at IISc.",
  });

  const TOURNAMENT_SUB_TABS = ["notices", "schedule", "broadcast", "brackets", "past", "umpire"];
  const [activeTab, setActiveTab] = useHashTab(
    ["calendar", "tournament", "history", ...TOURNAMENT_SUB_TABS] as const,
    "calendar"
  );
  // Treat any tournament sub-tab hash as "tournament" at the top level
  const effectiveTab = TOURNAMENT_SUB_TABS.includes(activeTab as string)
    ? "tournament"
    : activeTab as "calendar" | "tournament" | "history";
  const [events, setEvents] = useState<LiveTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentCfg, setTournamentCfg] = useState<TournamentConfig>(DEFAULT_TOURNAMENT_CONFIG);

  const { data: queryEvents, isLoading: isEventsLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const data = await getTournaments();
      return data.map((e: any) => ({ ...e, status: e.status as TournamentStatus }));
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (queryEvents) {
      setEvents(queryEvents);
      setLoading(false);
    }
  }, [queryEvents]);

  useEffect(() => {
    fetchTournamentConfig().then(setTournamentCfg).catch(() => {});
  }, []);

  const live = events.filter((e) => e.status === "live");
  const upcoming = events.filter((e) => e.status === "upcoming");
  const completed: any[] = [
    ...ARCHIVED_TOURNAMENTS,
    ...events.filter(
      (e) =>
        e.status === "completed" &&
        !ARCHIVED_TOURNAMENTS.some((archived) => archived.slug === e.slug),
    ),
  ];

  const getTypeLabel = (type: string) => {
    if (type === "open") return "Open Tournament";
    if (type === "team") return "Team Event";
    if (type === "special") return "Special Event";
    return type;
  };

  const renderCard = (item: any | ArchivedTournament, liveMode = false) => {
    const isUpcoming = item.status === "upcoming";

    const cardContent = (
      <Card className="rounded-3xl border border-emerald-100 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full overflow-hidden">
        {/* Top accent strip based on status */}
        <div
          className={`h-1 w-full ${liveMode ? "bg-gradient-to-r from-red-500 to-orange-500 animate-pulse" : isUpcoming ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-slate-300 to-slate-400"}`}
        />
        <CardContent className="p-8 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {liveMode && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            )}

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                item.type === "open"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : item.type === "team"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
              }`}
            >
              {getTypeLabel(item.type)}
            </span>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              {item.startDate}
            </div>
          </div>

          <h3 className="text-2xl font-black text-blue-900 dark:text-white leading-tight">
            {item.name}
          </h3>

          <p className="text-gray-600 dark:text-slate-400">
            {item.description}
          </p>

          {"winners" in item && item.winners && (
            <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
              {item.winners.slice(0, 4).map((result: any) => (
                <div
                  key={result.category}
                  className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    <Medal className="w-3.5 h-3.5" />
                    {result.category}
                  </div>
                  <p className="mt-1 font-bold text-blue-950 dark:text-white text-sm flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> {result.winner}
                  </p>
                </div>
              ))}
            </div>
          )}

          {"podium" in item && item.podium && (
            <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
              {item.podium.map((team: string, index: number) => (
                <div
                  key={team}
                  className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/50 px-4 py-3"
                >
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    {index === 0
                      ? <Trophy className="w-3.5 h-3.5 inline-block text-amber-500 mr-1" />
                      : index === 1
                        ? <Medal className="w-3.5 h-3.5 inline-block text-slate-400 mr-1" />
                        : index === 2
                          ? <Award className="w-3.5 h-3.5 inline-block text-orange-400 mr-1" />
                          : `#${index + 1} `}
                    Rank {index + 1}
                  </p>
                  <p className="mt-1 font-bold text-blue-950 dark:text-white text-sm">
                    {team}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            {isUpcoming
              ? item.slug
                ? "View Details"
                : "Coming Soon"
              : item.status === "live"
                ? "View live fixtures"
                : "View results"}
            <ArrowRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    );

    if (isUpcoming) {
      if (item.slug) {
        const href =
          `/events/${item.slug}`;
        return (
          <Link href={href} key={item.id}>
            {cardContent}
          </Link>
        );
      }
      return (
        <div
          key={item.id}
          onClick={() =>
            toast.info("Details coming soon.", {
              icon: <Info className="w-4 h-4" />,
            })
          }
          className="h-full cursor-pointer"
        >
          {cardContent}
        </div>
      );
    }

    return (
      <Link href={`/events/${item.slug}`} key={item.id}>
        {cardContent}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-semibold mb-5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Tournaments & Events
            <InfoModal
              title="EVENTS & CHAMPIONSHIPS"
              items={[
                { badge: "LIVE", title: "Live Tournaments", desc: "View real-time brackets, fixtures, and results during active championships." },
                { badge: "ARCHIVE", title: "Hall of Fame", desc: "Look back at the history of previous tournaments and our champions." }
              ]}
              triggerClassName="text-white hover:text-emerald-200"
            />
          </div>
          <h1
            className="text-5xl md:text-6xl font-black mb-5"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Events & Championships
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Live tournaments, upcoming competitions and archived results.
          </p>

          <div className="mt-10 w-full flex justify-center">
            <div className="flex flex-wrap sm:flex-nowrap bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("calendar")}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                  effectiveTab === "calendar"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Calendar className="w-4 h-4" /> Event Calendar
              </button>
              {tournamentCfg.enabled && (
                <button
                  onClick={() => setActiveTab("tournament")}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-1 basis-[45%] sm:basis-auto shrink-0 ${
                    effectiveTab === "tournament"
                      ? "bg-rose-500 text-white shadow-md scale-100 shadow-rose-500/30"
                      : "text-white/80 hover:text-rose-400 hover:bg-rose-500/10 scale-95"
                  }`}
                >
                  <Timer className="w-4 h-4" /> {tournamentCfg.name}
                </button>
              )}
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-1 basis-[100%] sm:basis-auto shrink-0 ${
                  effectiveTab === "history"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Clock className="w-4 h-4" /> History
              </button>
            </div>
          </div>
        </div>
      </section>

      {effectiveTab === "tournament" && tournamentCfg.enabled && (
        <TournamentSection />
      )}

      {effectiveTab === "history" && (
        <section className="py-20 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-14"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full" />
                <h2
                  className="text-3xl font-black text-blue-900 dark:text-white"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  Tournament History
                </h2>
              </div>
              <p className="text-gray-500 dark:text-slate-400">
                Key moments from recent years
              </p>
            </motion.div>

            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-blue-500 to-purple-500 opacity-30" />
                <div className="space-y-8">
                  {MILESTONES.map((m, i) => (
                    <motion.div
                      key={i}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, margin: "-40px" }}
                      className="flex gap-5 relative"
                    >
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-2xl ${m.upcoming ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-white dark:bg-slate-800"} border-2 ${m.color} flex items-center justify-center text-xl shadow-sm z-10`}
                      >
                        <m.icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                      </div>
                      <div
                        className={`flex-1 rounded-2xl p-5 hover:shadow-md transition-shadow ${m.upcoming ? "bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                            {m.year}
                          </span>
                          {m.upcoming && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              Upcoming
                            </span>
                          )}
                        </div>
                        <h3
                          className={`font-black text-base mb-1 ${m.upcoming ? "text-emerald-800 dark:text-emerald-300" : "text-blue-900 dark:text-white"}`}
                        >
                          {m.title}
                        </h3>
                        <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                          {m.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}



      {effectiveTab === "calendar" && (
        <>
          {/* ── 1. Match Calendar ───────────────────────────────────────────── */}
      <ScheduleCalendar />

      {/* ── 3. All Tournaments (Live, Upcoming, Completed) ──────────────── */}
      <section className="py-16 container mx-auto px-4 space-y-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
          <h2 className="text-3xl font-black text-blue-900 dark:text-white">
            All Tournaments
          </h2>
        </div>

        {loading && (
          <div className="grid md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <EventSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && live.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center gap-2 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 px-3 py-1.5 rounded-full text-sm font-bold pulse-glow">
                <Radio className="w-4 h-4" />
                LIVE NOW
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {live.map((item) => renderCard(item, true))}
            </div>
          </div>
        )}

        {!loading && upcoming.length === 0 && live.length === 0 && (
          <NoUpcomingEvents />
        )}

        {!loading && upcoming.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-white">
                Upcoming
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {upcoming.map((item) => renderCard(item))}
            </div>
          </div>
        )}

        {!loading && completed.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
              <h2 className="text-3xl font-black text-blue-900 dark:text-white">
                Completed
              </h2>
              <Trophy className="text-amber-500 ml-1" />
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {completed.map((item) => renderCard(item))}
            </div>
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
