import { useEffect, useState } from "react";
import { fetchSiteData } from "@/lib/siteData";
import { fetchTournamentConfig, getTournaments } from "@/lib/tournaments";
import { supabase } from "@/lib/supabase";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ScheduleView } from "@/pages/ScheduleView";

interface CalendarEvent {
  date: string;
  endDate?: string;
  title: string;
  link?: string;
  registrationDeadline?: string;
  time?: string;
  location?: string;
  type?: "event" | "holiday";
  url?: string;
}

interface Holiday {
  date: string;
  name: string;
}

const HOLIDAY_COLORS = [
  {
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
    text: "text-rose-500",
    textDark: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
    solid: "bg-rose-500",
    hex: "#f43f5e",
    hexBg: "rgba(244, 63, 94, 0.1)",
  },
  {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-500",
    textDark: "text-purple-600 dark:text-purple-400",
    badge:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    solid: "bg-purple-500",
    hex: "#a855f7",
    hexBg: "rgba(168, 85, 247, 0.1)",
  },
  {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-500",
    textDark: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    solid: "bg-amber-500",
    hex: "#f59e0b",
    hexBg: "rgba(245, 158, 11, 0.1)",
  },
  {
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    border: "border-cyan-200 dark:border-cyan-800",
    text: "text-cyan-500",
    textDark: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    solid: "bg-cyan-500",
    hex: "#06b6d4",
    hexBg: "rgba(6, 182, 212, 0.1)",
  },
  {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-900/20",
    border: "border-fuchsia-200 dark:border-fuchsia-800",
    text: "text-fuchsia-500",
    textDark: "text-fuchsia-600 dark:text-fuchsia-400",
    badge:
      "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400",
    solid: "bg-fuchsia-500",
    hex: "#d946ef",
    hexBg: "rgba(217, 70, 239, 0.1)",
  },
];

function getHolidayColorIndex(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % HOLIDAY_COLORS.length;
}

function getHolidayColor(title: string) {
  return HOLIDAY_COLORS[getHolidayColorIndex(title)];
}

function dateFilterHasMatches(tData: any, date: string) {
  if (!tData || !tData.matches) return false;
  const allM = Object.entries(tData.matches).flatMap(
    ([format, matches]: [string, any]) =>
      (matches as any[]).map((m) => ({ ...m, format })),
  );
  return allM.some(m => {
    if (!m.Date) return false;
    // Support YYYY-MM-DD, DD/MM/YYYY, etc. by parsing the date string
    try {
      // If it's already YYYY-MM-DD and matches exactly
      if (m.Date === date) return true;
      // Otherwise try parsing it
      const d = new Date(m.Date);
      if (isNaN(d.getTime())) return false;
      const normalized = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return normalized === date;
    } catch {
      return false;
    }
  });
}

export default function ScheduleCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [loading, setLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const [eventsData, holidaysData, dbTournaments, matchSnap, tourneyCfg] = await Promise.all([
          fetchSiteData<CalendarEvent[]>("events", "events.json").catch(() => []),
          fetchSiteData<Holiday[]>("holidays", "holidays.json").catch(() => []),
          getTournaments().catch(() => []),
          supabase.from("tournament_matches").select("*, tournaments(name, id)").not("scheduled_at", "is", null),
          fetchTournamentConfig().catch(() => null),
        ]);

        const merged: CalendarEvent[] = [...(eventsData || [])];
        if (holidaysData) {
          holidaysData.forEach((h) => {
            merged.push({
              date: h.date,
              title: h.name,
              type: "holiday",
              location: "Gymkhana",
            });
          });
        }
        
        if (dbTournaments && dbTournaments.length > 0) {
          dbTournaments.forEach((t: any) => {
            if (t.startDate && t.status !== "draft") {
              merged.push({
                date: t.startDate,
                endDate: t.endDate || t.startDate,
                title: t.name,
                type: "event",
                location: t.venue || "Gymkhana",
                link: `/pulse?t=${t.status}&tid=${t.slug || t.id}#tournament`,
              });
            }
          });
        }

        if (matchSnap && matchSnap.data) {
          matchSnap.data.forEach((m: any) => {
            if (!m.scheduled_at) return;
            const localDate = new Date(m.scheduled_at);
            const matchDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
            const timeStr = localDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
            const title = `${m.category} • ${m.match_code} (${m.team1_label || 'TBD'} vs ${m.team2_label || 'TBD'})`;
            
            merged.push({
              date: matchDate,
              title: title,
              time: timeStr,
              type: "event",
              location: m.court_number ? `Court ${m.court_number}` : "Gymkhana",
              link: m.tournaments?.id ? `/pulse?t=live&tid=${m.tournaments.id}#tournament` : undefined,
            });
          });
        }

        setEvents(merged);
      } catch (err) {
        console.error("Failed to load events/holidays:", err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  // Normalise selected date to YYYY-MM-DD for comparison (using local time to avoid UTC shift bugs)
  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : undefined;

  const selectedEvents = events.filter((e) => {
    if (!selectedDateStr) return false;
    if (e.date === selectedDateStr) return true;
    if (e.endDate && selectedDateStr >= e.date && selectedDateStr <= e.endDate)
      return true;
    if (e.registrationDeadline === selectedDateStr) return true;
    return false;
  });
  const upcomingEvents = events
    .filter((e) => {
      const end = e.endDate ? new Date(e.endDate) : new Date(e.date);
      end.setHours(23, 59, 59, 999);
      return end >= new Date();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const eventStartDates: Date[] = [];
  const eventOngoingDates: Date[] = [];
  events.forEach((e) => {
    if (e.type === "holiday") return;
    const start = new Date(e.date);
    eventStartDates.push(start);
    if (e.endDate) {
      const end = new Date(e.endDate);
      let curr = new Date(start);
      curr.setDate(curr.getDate() + 1);
      while (curr <= end) {
        eventOngoingDates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
    }
  });

  const deadlineDates = events
    .filter((e) => e.registrationDeadline)
    .map((e) => new Date(e.registrationDeadline as string));

  return (
    <section className="font-sans pb-32 lg:pb-12">
      <div className="container mx-auto px-4 relative z-20 pt-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
          <h2 className="text-3xl font-black text-blue-900 dark:text-foreground">
            Match Calendar
          </h2>
        </div>
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6">
          {/* Left: Interactive Calendar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden p-2 sm:p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="w-full flex justify-center p-2"
                modifiers={{
                  hasEventStart: eventStartDates,
                  hasEventOngoing: eventOngoingDates,
                  hasHoliday_0: events
                    .filter(
                      (e) =>
                        e.type === "holiday" &&
                        getHolidayColorIndex(e.title) === 0,
                    )
                    .map((e) => new Date(e.date)),
                  hasHoliday_1: events
                    .filter(
                      (e) =>
                        e.type === "holiday" &&
                        getHolidayColorIndex(e.title) === 1,
                    )
                    .map((e) => new Date(e.date)),
                  hasHoliday_2: events
                    .filter(
                      (e) =>
                        e.type === "holiday" &&
                        getHolidayColorIndex(e.title) === 2,
                    )
                    .map((e) => new Date(e.date)),
                  hasHoliday_3: events
                    .filter(
                      (e) =>
                        e.type === "holiday" &&
                        getHolidayColorIndex(e.title) === 3,
                    )
                    .map((e) => new Date(e.date)),
                  hasHoliday_4: events
                    .filter(
                      (e) =>
                        e.type === "holiday" &&
                        getHolidayColorIndex(e.title) === 4,
                    )
                    .map((e) => new Date(e.date)),
                  hasDeadline: deadlineDates,
                }}
                components={{
                  DayButton: (props) => {
                    const d = props.day.date;
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const dayEvents = events.filter((e) => {
                      if (e.date === dateStr) return true;
                      if (
                        e.endDate &&
                        dateStr >= e.date &&
                        dateStr <= e.endDate
                      )
                        return true;
                      return false;
                    });

                    if (dayEvents.length > 0) {
                      return (
                        <TooltipProvider>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <div className="w-full h-full relative cursor-pointer">
                                <CalendarDayButton {...props} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="z-50 bg-slate-800 text-foreground border-slate-700">
                              <div className="space-y-1.5 p-1">
                                {dayEvents.map((e, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2"
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${e.type === "holiday" ? getHolidayColor(e.title).solid : "bg-primary"}`}
                                    />
                                    <span className="font-semibold text-xs">
                                      {e.title}
                                    </span>
                                    {e.type !== "holiday" &&
                                      e.date === dateStr && (
                                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold">
                                          Starts
                                        </span>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }
                    return <CalendarDayButton {...props} />;
                  },
                }}
                modifiersStyles={{
                  hasEventStart: {
                    fontWeight: "900",
                    color: "#0ea5e9",
                    backgroundColor: "rgba(14, 165, 233, 0.15)",
                  },
                  hasEventOngoing: {
                    fontWeight: "900",
                    color: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                  },
                  hasHoliday_0: {
                    fontWeight: "900",
                    color: HOLIDAY_COLORS[0].hex,
                    backgroundColor: HOLIDAY_COLORS[0].hexBg,
                  },
                  hasHoliday_1: {
                    fontWeight: "900",
                    color: HOLIDAY_COLORS[1].hex,
                    backgroundColor: HOLIDAY_COLORS[1].hexBg,
                  },
                  hasHoliday_2: {
                    fontWeight: "900",
                    color: HOLIDAY_COLORS[2].hex,
                    backgroundColor: HOLIDAY_COLORS[2].hexBg,
                  },
                  hasHoliday_3: {
                    fontWeight: "900",
                    color: HOLIDAY_COLORS[3].hex,
                    backgroundColor: HOLIDAY_COLORS[3].hexBg,
                  },
                  hasHoliday_4: {
                    fontWeight: "900",
                    color: HOLIDAY_COLORS[4].hex,
                    backgroundColor: HOLIDAY_COLORS[4].hexBg,
                  },
                  hasDeadline: {
                    fontWeight: "900",
                    color: "#f59e0b",
                    backgroundColor: "rgba(245, 158, 11, 0.2)",
                  },
                }}
              />
            </Card>

            {/* Upcoming Summary Card */}
            <Card className="rounded-3xl shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-6 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  Coming Up
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {loading ? (
                  <div className="animate-pulse flex gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                ) : (
                  upcomingEvents.slice(0, 3).map((e, idx) => {
                    const d = new Date(e.date);
                    const isHoliday = e.type === "holiday";
                    const holidayColor = isHoliday
                      ? getHolidayColor(e.title)
                      : null;
                    const isMultiDayStart = e.endDate && e.date !== e.endDate;
                    return (
                      <div key={idx} className="flex gap-4">
                        <div
                          className={`flex flex-col items-center justify-center w-14 shrink-0 rounded-xl text-center p-1.5 border ${
                            isHoliday
                              ? `${holidayColor?.bg} ${holidayColor?.border}`
                              : isMultiDayStart
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                : "bg-primary/10 dark:bg-primary/20 border-primary/40 dark:border-primary/80"
                          }`}
                        >
                          <span
                            className={`text-[9px] font-black uppercase ${isHoliday ? holidayColor?.text : isMultiDayStart ? "text-blue-600" : "text-primary"}`}
                          >
                            {d.toLocaleString("default", { weekday: "short" })}
                          </span>
                          <span
                            className={`text-xl font-black leading-none my-0.5 ${isHoliday ? holidayColor?.textDark : isMultiDayStart ? "text-blue-700 dark:text-blue-400" : "text-primary dark:text-primary"}`}
                          >
                            {d.getDate()}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase ${isHoliday ? holidayColor?.text : isMultiDayStart ? "text-blue-500" : "text-primary"}`}
                          >
                            {d.toLocaleString("default", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
                            {e.title}
                          </h4>
                          {e.time ? (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" /> {e.time}
                            </div>
                          ) : isHoliday ? (
                            <div
                              className={`text-xs ${holidayColor?.text} flex items-center gap-1 mt-1 font-semibold`}
                            >
                              Holiday
                            </div>
                          ) : isMultiDayStart ? (
                            <div className="text-xs text-blue-500 flex items-center gap-1 mt-1 font-semibold">
                              Tournament Starts
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
                {upcomingEvents.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground italic">
                    No upcoming events scheduled.
                  </p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Right: Selected Date Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl min-h-[500px]">
              <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-3xl">
                <h2 className="text-2xl font-black text-slate-800 dark:text-foreground">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Select a date"}
                </h2>
                <p className="text-muted-foreground dark:text-muted-foreground mt-1">
                  {selectedEvents.length} event
                  {selectedEvents.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>

              <div className="p-5 md:p-6">
                {selectedEvents.length > 0 ? (
                  <div className="space-y-6">
                    {selectedEvents.map((event, idx) => {
                      const isHoliday = event.type === "holiday";
                      const holidayColor = isHoliday
                        ? getHolidayColor(event.title)
                        : null;
                      return (
                        <div
                          key={idx}
                          className={`p-4 md:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group ${isHoliday ? "opacity-80" : ""}`}
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1.5 ${isHoliday ? holidayColor?.solid : "bg-primary"}`}
                          />
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <h3 className="text-xl font-bold text-foreground dark:text-foreground">
                              {event.title}
                            </h3>
                            {isHoliday && (
                              <span
                                className={`px-2 py-0.5 rounded-full ${holidayColor?.badge} text-xs font-bold uppercase`}
                              >
                                Holiday
                              </span>
                            )}
                            {event.endDate &&
                              event.date === selectedDateStr &&
                              !isHoliday && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase">
                                  Tournament Starts
                                </span>
                              )}
                            {event.endDate &&
                              event.endDate === selectedDateStr &&
                              !isHoliday && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase">
                                  Final Day
                                </span>
                              )}
                          </div>

                          {/* Date range */}
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground dark:text-slate-300 mb-3">
                            <CalendarDays className="w-4 h-4 text-blue-500" />
                            {new Date(event.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            {event.endDate && event.endDate !== event.date && (
                              <span>
                                {" "}
                                —{" "}
                                {new Date(event.endDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 mb-4">
                            {event.time && (
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground dark:text-slate-300">
                                <Clock className="w-4 h-4 text-primary" />{" "}
                                {event.time}
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground dark:text-slate-300">
                                <MapPin className="w-4 h-4 text-primary" />{" "}
                                {event.location}
                              </div>
                            )}
                          </div>

                          {event.registrationDeadline && (
                            <div className="mb-4 inline-block px-3 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-amber-700 dark:text-amber-400 text-xs font-bold">
                              Registration Deadline:{" "}
                              {event.registrationDeadline}
                            </div>
                          )}

                          {event.link && (
                            <a href={event.link}>
                              <button className="flex items-center gap-2 text-sm font-bold text-primary dark:text-primary hover:text-primary transition group-hover:underline">
                                View Event Details{" "}
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </a>
                          )}
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm font-bold text-primary dark:text-primary hover:text-primary transition group-hover:underline mt-2"
                            >
                              External Link{" "}
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {selectedEvents.length === 0 && (!tournamentData || !dateFilterHasMatches(tournamentData, selectedDateStr)) && (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-muted-foreground">
                      <CalendarDays className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-muted-foreground dark:text-slate-300">
                      No Events Scheduled
                    </h3>
                    <p className="text-muted-foreground dark:text-muted-foreground mt-1 max-w-sm">
                      There are no matches or practice sessions scheduled for
                      this date. Enjoy the rest!
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {tournamentData && selectedDateStr && dateFilterHasMatches(tournamentData, selectedDateStr) && (
              <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl mt-6 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 md:p-6 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xl font-black text-slate-800 dark:text-foreground flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Tournament Matches
                  </h3>
                </div>
                <ScheduleView tournamentData={tournamentData} dateFilter={selectedDateStr} />
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
