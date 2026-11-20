import { matchPath, tournamentLink } from "@/lib/tournamentRoutes";
import { useEffect, useState } from "react";
import { fetchSiteData } from "@/lib/siteData";
import { fetchTournamentConfig, getTournaments } from "@/lib/tournaments";
import { tournamentService } from "@/services/tournamentService";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  Trophy,
  X,
  ChevronDown,
  ChevronUp,
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
    bg: "bg-danger/10",
    border: "border-danger/40",
    text: "text-danger",
    textDark: "text-danger",
    badge: "bg-danger/10 text-danger",
    solid: "bg-danger",
    hex: "#f43f5e",
    hexBg: "rgba(244, 63, 94, 0.1)",
  },
  {
    bg: "bg-individual/10",
    border: "border-individual/40",
    text: "text-individual",
    textDark: "text-individual",
    badge:
      "bg-individual/10 text-individual",
    solid: "bg-individual",
    hex: "#a855f7",
    hexBg: "rgba(168, 85, 247, 0.1)",
  },
  {
    bg: "bg-warning/10",
    border: "border-warning/40",
    text: "text-warning",
    textDark: "text-warning",
    badge:
      "bg-warning/10 text-warning",
    solid: "bg-warning",
    hex: "#f59e0b",
    hexBg: "rgba(245, 158, 11, 0.1)",
  },
  {
    bg: "bg-accent/10",
    border: "border-accent/40",
    text: "text-accent",
    textDark: "text-accent",
    badge: "bg-accent/10 text-accent",
    solid: "bg-accent",
    hex: "#06b6d4",
    hexBg: "rgba(6, 182, 212, 0.1)",
  },
  {
    bg: "bg-individual/10",
    border: "border-individual/40",
    text: "text-individual",
    textDark: "text-individual",
    badge:
      "bg-individual/10 text-individual",
    solid: "bg-individual",
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
  const [showHolidays, setShowHolidays] = useState(true);
  const [showComingUp, setShowComingUp] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const [eventsData, holidaysData, dbTournaments, scheduledMatches, tourneyCfg] = await Promise.all([
          fetchSiteData<CalendarEvent[]>("events", "events.json").catch(() => []),
          fetchSiteData<Holiday[]>("holidays", "holidays.json").catch(() => []),
          getTournaments().catch(() => []),
          tournamentService.fetchScheduledTournamentMatches().catch(() => []),
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
                link: tournamentLink(t),
              });
            }
          });
        }

        if (scheduledMatches && scheduledMatches.length > 0) {
          scheduledMatches.forEach((m: any) => {
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
              link: m.tournaments?.id && m.id ? matchPath(m.tournaments.id, m.id) : undefined,
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

  const holidayEvents = events.filter(e => e.type === "holiday").sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <section className="font-sans pb-32 lg:pb-12">
      <div className="container mx-auto px-4 relative z-20 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-6 bg-gradient-to-b from-info to-info rounded-full" />
          <h2 className="text-2xl font-black text-foreground">
            Match Calendar
          </h2>
        </div>
        <div className="flex flex-col gap-6">
          {/* Top Row: Calendar & Holidays */}
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6 items-stretch">
            {/* Left: Interactive Calendar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col"
            >
              <Card className="rounded-3xl shadow-xl border-border bg-card/80 backdrop-blur-xl overflow-hidden p-1 sm:p-2 max-w-full h-full flex flex-col justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="w-full max-w-sm mx-auto flex justify-center p-1 [&_.rdp-day]:!aspect-auto [&_.rdp-day]:h-8 sm:[&_.rdp-day]:h-9 [&_.rdp-week]:mt-0 [&_.rdp-month]:gap-1"
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="w-full h-full relative cursor-pointer">
                              <CalendarDayButton {...props} />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            sideOffset={4}
                            collisionPadding={20}
                            className="z-[100] bg-muted text-on-accent border-border-strong w-[85vw] sm:w-[60vw] md:w-auto md:min-w-[15rem] md:max-w-md max-h-[min(70vh,var(--radix-dropdown-menu-content-available-height))] shadow-2xl p-0 rounded-xl flex flex-col !overflow-hidden"
                          >
                            <div className="flex items-center justify-between p-2 border-b border-border-strong bg-muted shrink-0">
                              <span className="text-xs font-bold text-muted-foreground pl-2">
                                {dayEvents.length} Matches
                              </span>
                              <DropdownMenuItem className="p-1.5 rounded-lg hover:bg-muted-strong cursor-pointer focus:bg-muted-strong text-soft h-8 w-8 flex items-center justify-center">
                                <X className="w-4 h-4" />
                              </DropdownMenuItem>
                            </div>
                            <div className="space-y-2 p-2 overflow-y-auto flex-1 overscroll-contain">
                              {dayEvents.map((e, i) => {
                                let catColor = "text-soft";
                                if (e.type !== "holiday") {
                                  const cat = e.title.split(" • ")[0];
                                  if (cat === "MS") catColor = "text-info";
                                  else if (cat === "MD") catColor = "text-success";
                                  else if (cat === "WS") catColor = "text-individual";
                                  else if (cat === "WD") catColor = "text-individual";
                                  else if (cat === "XD") catColor = "text-secondary";
                                }
                                return (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 py-1"
                                  >
                                    <span
                                      className={`w-2 h-2 mt-1 shrink-0 rounded-full ${e.type === "holiday" ? getHolidayColor(e.title).solid : "bg-primary"}`}
                                    />
                                    <div className="flex flex-col gap-0.5 leading-tight pr-2">
                                      <span className={`font-semibold text-xs ${e.type === "holiday" ? "text-soft" : catColor}`}>
                                        {e.title}
                                      </span>
                                      {e.type !== "holiday" && e.date === dateStr && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[10px] w-fit bg-info/20 text-info px-1.5 py-0.5 rounded uppercase font-bold">
                                            Starts
                                          </span>
                                          {e.time && (
                                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> {e.time}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          </motion.div>
          {/* Right: Gymkhana Holidays Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col"
          >
            {holidayEvents.length > 0 && (
              <Card className="rounded-3xl shadow-lg border-border bg-card overflow-hidden flex flex-col p-0 gap-0">
                <button 
                  onClick={() => setShowHolidays(!showHolidays)}
                  className="w-full py-2 px-4 border-b border-border flex items-center justify-between bg-danger/10 shrink-0 cursor-pointer hover:bg-danger/15 transition-colors"
                >
                  <h3 className="font-bold text-xs text-danger flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Gymkhana Holidays {new Date().getFullYear()}
                  </h3>
                  {showHolidays ? <ChevronUp className="w-4 h-4 text-danger" /> : <ChevronDown className="w-4 h-4 text-danger" />}
                </button>
                {showHolidays && (
                  <div className="p-2 flex flex-wrap gap-1.5 overflow-y-auto">
                  {holidayEvents.slice(0, 12).map((h, idx) => {
                    const d = new Date(h.date);
                    const isPast = d.getTime() < new Date().getTime() - 86400000;
                    const hc = getHolidayColor(h.title);
                    return (
                      <div key={idx} className={`flex-auto min-w-[200px] flex items-center justify-between py-1 px-2.5 rounded-md border ${isPast ? 'opacity-60 grayscale' : ''} ${hc.bg} ${hc.border}`}>
                        <span className={`font-bold text-[11px] truncate mr-2 ${hc.textDark}`}>{h.title}</span>
                        <span className={`text-[10px] font-semibold whitespace-nowrap ${hc.text}`}>{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </div>
                    );
                  })}
                  </div>
                )}
              </Card>
            )}
          </motion.div>
        </div>

        {/* Bottom Row: Coming Up & Selected Date Details */}
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Upcoming Summary Card */}
            <Card className="rounded-3xl shadow-lg border-border bg-card overflow-hidden p-0 gap-0">
              <button 
                onClick={() => setShowComingUp(!showComingUp)}
                className="w-full py-2 px-4 border-b border-border flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <h3 className="font-bold text-sm text-soft">
                  Coming Up
                </h3>
                {showComingUp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showComingUp && (
                <div className="p-3 grid grid-cols-2 gap-2">
                {loading ? (
                  <div className="animate-pulse flex gap-2">
                    <div className="w-8 h-8 bg-soft rounded" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-soft rounded w-3/4" />
                      <div className="h-2 bg-soft rounded w-1/2" />
                    </div>
                  </div>
                ) : (
                  upcomingEvents.slice(0, 4).map((e, idx) => {
                    const d = new Date(e.date);
                    const isHoliday = e.type === "holiday";
                    const holidayColor = isHoliday
                      ? getHolidayColor(e.title)
                      : null;
                    const isMultiDayStart = e.endDate && e.date !== e.endDate;
                    return (
                      <div key={idx} className="flex gap-2 items-center">
                        <div
                          className={`flex flex-col items-center justify-center min-w-10 min-h-10 shrink-0 rounded-xl text-center px-1.5 py-1 border ${
                            isHoliday
                              ? `${holidayColor?.bg} ${holidayColor?.border}`
                              : isMultiDayStart
                                ? "bg-info/10 border-info/40"
                                : "bg-primary/20 border-primary/80"
                          }`}
                        >
                          <span
                            className={`text-[7px] font-black uppercase leading-[1] ${isHoliday ? holidayColor?.text : isMultiDayStart ? "text-info" : "text-primary"}`}
                          >
                            {d.toLocaleString("default", { weekday: "short" })}
                          </span>
                          <span
                            className={`text-[13px] font-black leading-none my-[1px] ${isHoliday ? holidayColor?.textDark : isMultiDayStart ? "text-info" : "text-primary"}`}
                          >
                            {d.getDate()}
                          </span>
                          <span
                            className={`text-[7px] font-bold uppercase leading-[1] ${isHoliday ? holidayColor?.text : isMultiDayStart ? "text-info" : "text-primary"}`}
                          >
                            {d.toLocaleString("default", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center overflow-hidden">
                          <h4 className="font-bold text-xs text-soft line-clamp-1">
                            {e.title}
                          </h4>
                          {e.time ? (
                            <div className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5 truncate">
                              <Clock className="w-2.5 h-2.5 shrink-0" /> {e.time}
                            </div>
                          ) : isHoliday ? (
                            <div
                              className={`text-[9px] ${holidayColor?.text} flex items-center gap-0.5 mt-0.5 font-bold truncate`}
                            >
                              Holiday
                            </div>
                          ) : isMultiDayStart ? (
                            <div className="text-[9px] text-info flex items-center gap-0.5 mt-0.5 font-bold truncate">
                              Starts
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
              )}
            </Card>

          </motion.div>

          {/* Right: Selected Date Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >

            <Card className="rounded-3xl shadow-xl border-border bg-card/80 backdrop-blur-xl max-w-full overflow-hidden p-0 gap-0">
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-left py-2 px-4 border-b border-border bg-muted/50 rounded-t-3xl flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
              >
                <div>
                  <h2 className="text-sm font-bold text-foreground leading-tight">
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Select a date"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedEvents.length} event
                    {selectedEvents.length !== 1 ? "s" : ""} scheduled
                  </p>
                </div>
                {showDetails ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </button>

              {showDetails && (
                <div className="p-3 md:p-4">
                {selectedEvents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedEvents.map((event, idx) => {
                      const isHoliday = event.type === "holiday";
                      const holidayColor = isHoliday
                        ? getHolidayColor(event.title)
                        : null;
                      return (
                        <div
                          key={idx}
                          className={`p-3 md:p-4 rounded-xl bg-card border border-border-strong shadow-sm relative overflow-hidden group ${isHoliday ? "opacity-80" : ""}`}
                        >
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 ${isHoliday ? holidayColor?.solid : "bg-primary"}`}
                          />
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-base font-bold text-foreground">
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
                                <span className="px-2 py-0.5 rounded-full bg-info/10 text-info text-xs font-bold uppercase">
                                  Tournament Starts
                                </span>
                              )}
                            {event.endDate &&
                              event.endDate === selectedDateStr &&
                              !isHoliday && (
                                <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold uppercase">
                                  Final Day
                                </span>
                              )}
                          </div>

                          {/* Date range */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-soft mb-2">
                            <CalendarDays className="w-3.5 h-3.5 text-info" />
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

                          <div className="flex flex-wrap gap-3 mb-3">
                            {event.time && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-soft">
                                <Clock className="w-3.5 h-3.5 text-primary" />{" "}
                                {event.time}
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-soft">
                                <MapPin className="w-3.5 h-3.5 text-primary" />{" "}
                                {event.location}
                              </div>
                            )}
                          </div>

                          {event.registrationDeadline && (
                            <div className="mb-4 inline-block px-3 py-1 bg-warning/10 border border-warning/40 rounded-md text-warning text-xs font-bold">
                              Registration Deadline:{" "}
                              {event.registrationDeadline}
                            </div>
                          )}

                          {event.link && (
                            <a href={event.link}>
                              <button className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition group-hover:underline">
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
                              className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition group-hover:underline mt-2"
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
                  <div className="flex items-center gap-3 py-3 px-4 justify-center md:justify-start bg-muted/30 rounded-xl">
                    <CalendarDays className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="text-left">
                      <h3 className="text-xs font-bold text-muted-foreground leading-none">
                        No Events Scheduled
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                        Enjoy the rest of your day!
                      </p>
                    </div>
                  </div>
                )}
                </div>
              )}
            </Card>

            {tournamentData && selectedDateStr && dateFilterHasMatches(tournamentData, selectedDateStr) && (
              <Card className="rounded-3xl shadow-xl border-border bg-card/80 backdrop-blur-xl mt-6 overflow-hidden max-w-full p-0 gap-0">
                <div className="bg-muted/50 p-5 md:p-6 border-b border-border">
                  <h3 className="text-xl font-black text-foreground flex items-center gap-2">
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
    </div>
    </section>
  );
}
