import React from "react";
import { X, CalendarRange, CalendarX, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime12h } from "./courtSchedule.utils";
import type { CourtReservation } from "./courtSchedule.types";

export interface TimelineGroupItem {
  id: string;
  type: "booking" | "holiday";
  date: string;
  title: string;
  courts?: string[];
  department?: string;
  startTime?: string;
  endTime?: string;
}

export interface TimelineGroup {
  monthKey: string;
  monthLabel: string;
  bookingCount: number;
  holidayCount: number;
  items: TimelineGroupItem[];
}

interface CourtTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  timelineFilter: "all" | "tournaments" | "holidays";
  setTimelineFilter: (f: "all" | "tournaments" | "holidays") => void;
  reservationsCount: number;
  holidaysCount: number;
  timelineGroups: TimelineGroup[];
  onSelectDate: (date: string, formattedDate: string) => void;
}

export function CourtTimelineModal({
  isOpen,
  onClose,
  timelineFilter,
  setTimelineFilter,
  reservationsCount,
  holidaysCount,
  timelineGroups,
  onSelectDate,
}: CourtTimelineModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-sky-500" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center flex-shrink-0 shadow-inner">
              <CalendarRange className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-lg text-white tracking-tight">
                Facility Schedule & Holiday Timeline
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Chronological overview of court tournament reservations & Gymkhana holiday closures
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Close timeline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs Header */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner flex-shrink-0">
            <button
              type="button"
              onClick={() => setTimelineFilter("all")}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                timelineFilter === "all"
                  ? "bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <span>All Events</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "all"
                    ? "bg-slate-950/25 text-slate-950 font-black"
                    : "bg-slate-800 text-slate-400 border border-slate-750"
                )}
              >
                {reservationsCount + holidaysCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimelineFilter("tournaments")}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                timelineFilter === "tournaments"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  timelineFilter === "tournaments" ? "bg-slate-950" : "bg-emerald-400"
                )}
              />
              <span>Tournaments</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "tournaments"
                    ? "bg-slate-950/25 text-slate-950 font-black"
                    : "bg-slate-800 text-slate-400 border border-slate-750"
                )}
              >
                {reservationsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTimelineFilter("holidays")}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                timelineFilter === "holidays"
                  ? "bg-rose-500 text-slate-950 font-black shadow-md shadow-rose-500/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  timelineFilter === "holidays" ? "bg-slate-950" : "bg-rose-400"
                )}
              />
              <span>Holidays</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "holidays"
                    ? "bg-slate-950/25 text-slate-950 font-black"
                    : "bg-slate-800 text-slate-400 border border-slate-750"
                )}
              >
                {holidaysCount}
              </span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 hidden sm:inline whitespace-nowrap">
            Click any event to view schedule
          </span>
        </div>

        {/* Scrollable Timeline Body */}
        <div className="px-4 sm:px-6 pb-6 pt-0 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {timelineGroups.length === 0 ? (
            <div className="my-6 p-12 text-center text-xs text-slate-400 rounded-3xl bg-slate-950/40 border border-slate-800 space-y-1">
              <CalendarX className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="font-bold text-slate-300">No events found.</p>
              <p className="text-[11px] text-slate-500">
                No bookings or holidays match the current filter.
              </p>
            </div>
          ) : (
            timelineGroups.map((group, groupIdx) => {
              const monthColorThemes = [
                { border: "border-teal-500/40", badge: "bg-teal-950/80 text-teal-300 border-teal-800", dot: "from-teal-400 to-emerald-500" },
                { border: "border-sky-500/40", badge: "bg-sky-950/80 text-sky-300 border-sky-800", dot: "from-sky-400 to-indigo-500" },
                { border: "border-amber-500/40", badge: "bg-amber-950/80 text-amber-300 border-amber-800", dot: "from-amber-400 to-orange-500" },
                { border: "border-emerald-500/40", badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800", dot: "from-emerald-400 to-teal-500" },
                { border: "border-purple-500/40", badge: "bg-purple-950/80 text-purple-300 border-purple-800", dot: "from-purple-400 to-pink-500" },
              ];
              const theme = monthColorThemes[groupIdx % monthColorThemes.length];

              return (
                <div key={group.monthKey} className="space-y-3 pt-3">
                  <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 shadow-md">
                    <div className={cn(
                      "py-2.5 px-3.5 sm:px-4 rounded-2xl bg-slate-900/90 border shadow-lg flex items-center justify-between gap-3",
                      theme.border
                    )}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-3 h-3 rounded-full bg-gradient-to-tr shadow-sm", theme.dot)} />
                        <h4 className="font-black text-sm sm:text-base text-white tracking-wide uppercase">
                          {group.monthLabel}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                        {group.bookingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80 whitespace-nowrap">
                            {group.bookingCount} Booking{group.bookingCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {group.holidayCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800/80 whitespace-nowrap">
                            {group.holidayCount} Holiday{group.holidayCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-6 sm:pl-8 space-y-3.5 border-l-2 border-slate-800 ml-4 sm:ml-5 pt-1 pb-2">
                    {group.items.map((item) => {
                      const isHoliday = item.type === "holiday";
                      const d = new Date(item.date + "T12:00:00");
                      const formattedDate = d.toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <div key={item.id} className="relative group">
                          <div
                            className={cn(
                              "absolute -left-[31px] sm:-left-[39px] top-3.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-lg border-2 transition-transform group-hover:scale-110",
                              isHoliday
                                ? "bg-rose-950 border-rose-500 text-rose-400 shadow-rose-950/60"
                                : "bg-emerald-950 border-emerald-500 text-emerald-400 shadow-emerald-950/60"
                            )}
                          >
                            {isHoliday ? (
                              <CalendarX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                          </div>

                          <div
                            onClick={() => onSelectDate(item.date, formattedDate)}
                            className={cn(
                              "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer",
                              isHoliday
                                ? "bg-gradient-to-r from-rose-950/40 via-rose-950/20 to-slate-900 border-rose-900/60 hover:border-rose-500/80 shadow-md shadow-rose-950/15 hover:shadow-rose-950/30"
                                : "bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 border-emerald-900/40 hover:border-emerald-500/80 shadow-md shadow-emerald-950/15 hover:shadow-emerald-950/30"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    isHoliday
                                      ? "bg-rose-900/80 text-rose-200 border-rose-700"
                                      : "bg-emerald-950 text-emerald-400 border-emerald-800"
                                  )}
                                >
                                  {isHoliday ? "Gymkhana Holiday" : "Tournament Booking"}
                                </span>

                                {!isHoliday && item.courts && (
                                  <div className="flex items-center gap-1">
                                    {item.courts.map((c) => (
                                      <span
                                        key={c}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-800"
                                      >
                                        Court C{c}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <span className="text-[11px] sm:text-xs font-bold text-slate-300">
                                  {formattedDate}
                                </span>
                              </div>

                              {!isHoliday && item.startTime && item.endTime && (
                                <span className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                                  {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-baseline justify-between gap-2">
                              <div>
                                <h5
                                  className={cn(
                                    "font-black text-sm sm:text-base",
                                    isHoliday ? "text-rose-200" : "text-white"
                                  )}
                                >
                                  {item.title}
                                </h5>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {isHoliday
                                    ? "Facility & all 3 courts are closed to all play on this day."
                                    : item.department
                                    ? `${item.department} Department`
                                    : "Court reserved for tournament play"}
                                </p>
                              </div>

                              <span className="text-[10px] font-bold text-emerald-400 group-hover:underline flex-shrink-0 self-end">
                                View in Schedule →
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            Click any tournament or holiday card to view its court schedule on that day
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
