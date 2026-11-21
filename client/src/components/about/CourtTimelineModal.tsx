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
      className="fixed inset-0 z-50 bg-media/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-card border border-border-strong/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="h-1.5 bg-gradient-to-r from-team via-success to-info" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-team/15 border border-team/30 text-team flex items-center justify-center flex-shrink-0 shadow-inner">
              <CalendarRange className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-lg text-foreground tracking-tight">
                Facility Schedule & Holiday Timeline
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Chronological overview of court tournament reservations & Gymkhana holiday closures
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close timeline"
            className="p-1.5 rounded-xl bg-muted/80 hover:bg-muted-strong text-muted-foreground hover:text-foreground transition-colors"
            title="Close timeline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs Header */}
        <div className="px-4 sm:px-5 py-2.5 bg-background border-b border-border flex items-center justify-between gap-3 overflow-x-auto scrollbar-none flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-card/90 border border-border shadow-inner flex-shrink-0">
            <button
              type="button"
              onClick={() => setTimelineFilter("all")}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                timelineFilter === "all"
                  ? "bg-team text-team-foreground font-black shadow-md shadow-team/25"
                  : "text-muted-foreground hover:text-soft hover:bg-muted/60"
              )}
            >
              <span>All Events</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "all"
                    ? "bg-background/25 text-foreground font-black"
                    : "bg-muted text-muted-foreground border border-border-strong"
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
                  ? "bg-success text-success-foreground font-black shadow-md shadow-success/25"
                  : "text-muted-foreground hover:text-soft hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  timelineFilter === "tournaments" ? "bg-background" : "bg-success"
                )}
              />
              <span>Tournaments</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "tournaments"
                    ? "bg-background/25 text-foreground font-black"
                    : "bg-muted text-muted-foreground border border-border-strong"
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
                  ? "bg-danger text-danger-foreground font-black shadow-md shadow-danger/25"
                  : "text-muted-foreground hover:text-soft hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  timelineFilter === "holidays" ? "bg-background" : "bg-danger"
                )}
              />
              <span>Holidays</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] text-center inline-flex items-center justify-center leading-none",
                  timelineFilter === "holidays"
                    ? "bg-background/25 text-foreground font-black"
                    : "bg-muted text-muted-foreground border border-border-strong"
                )}
              >
                {holidaysCount}
              </span>
            </button>
          </div>

          <span className="text-[10px] text-muted-foreground hidden sm:inline whitespace-nowrap">
            Click any event to view schedule
          </span>
        </div>

        {/* Scrollable Timeline Body */}
        <div className="px-4 sm:px-6 pb-6 pt-0 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {timelineGroups.length === 0 ? (
            <div className="my-6 p-12 text-center text-xs text-muted-foreground rounded-3xl bg-background/40 border border-border space-y-1">
              <CalendarX className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-bold text-soft">No events found.</p>
              <p className="text-[11px] text-muted-foreground">
                No bookings or holidays match the current filter.
              </p>
            </div>
          ) : (
            timelineGroups.map((group, groupIdx) => {
              const monthColorThemes = [
                { border: "border-team/40", badge: "bg-team/25 text-team border-team/40", dot: "from-team to-success" },
                { border: "border-info/40", badge: "bg-info/25 text-info border-info/40", dot: "from-info to-info" },
                { border: "border-warning/40", badge: "bg-warning/25 text-warning border-warning/40", dot: "from-warning to-secondary" },
                { border: "border-success/40", badge: "bg-success/25 text-success border-success/40", dot: "from-success to-team" },
                { border: "border-individual/40", badge: "bg-individual/25 text-individual border-individual/40", dot: "from-individual to-individual" },
              ];
              const theme = monthColorThemes[groupIdx % monthColorThemes.length];

              return (
                <div key={group.monthKey} className="space-y-3 pt-3">
                  <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-background/80 backdrop-blur-md border-b border-border/80 shadow-md">
                    <div className={cn(
                      "py-2.5 px-3.5 sm:px-4 rounded-2xl bg-card/90 border shadow-lg flex items-center justify-between gap-3",
                      theme.border
                    )}>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-3 h-3 rounded-full bg-gradient-to-tr shadow-sm", theme.dot)} />
                        <h4 className="font-black text-sm sm:text-base text-foreground tracking-wide uppercase">
                          {group.monthLabel}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold">
                        {group.bookingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/50 whitespace-nowrap">
                            {group.bookingCount} Booking{group.bookingCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {group.holidayCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-danger/20 text-danger border border-danger/50 whitespace-nowrap">
                            {group.holidayCount} Holiday{group.holidayCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-6 sm:pl-8 space-y-3.5 border-l-2 border-border ml-4 sm:ml-5 pt-1 pb-2">
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
                                ? "bg-danger/20 border-danger text-danger shadow-danger/60"
                                : "bg-success/20 border-success text-success shadow-success/60"
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
                                ? "bg-gradient-to-r from-danger/15 via-danger/10 to-card border-danger/35 hover:border-danger/80 shadow-md shadow-danger/15 hover:shadow-danger/30"
                                : "bg-gradient-to-r from-card via-card to-success/10 border-success/25 hover:border-success/80 shadow-md shadow-success/15 hover:shadow-success/30"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    isHoliday
                                      ? "bg-danger/25 text-danger border-danger"
                                      : "bg-success/20 text-success border-success/40"
                                  )}
                                >
                                  {isHoliday ? "Gymkhana Holiday" : "Tournament Booking"}
                                </span>

                                {!isHoliday && item.courts && (
                                  <div className="flex items-center gap-1">
                                    {item.courts.map((c) => (
                                      <span
                                        key={c}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-black bg-success/20 text-success border border-success/40"
                                      >
                                        Court C{c}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <span className="text-[11px] sm:text-xs font-bold text-soft">
                                  {formattedDate}
                                </span>
                              </div>

                              {!isHoliday && item.startTime && item.endTime && (
                                <span className="text-[11px] sm:text-xs font-bold text-soft flex items-center gap-1 bg-background/70 px-2.5 py-1 rounded-lg border border-border self-start sm:self-auto">
                                  <Clock className="w-3.5 h-3.5 text-danger" />
                                  {formatTime12h(item.startTime)} – {formatTime12h(item.endTime)}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-baseline justify-between gap-2">
                              <div>
                                <h5
                                  className={cn(
                                    "font-black text-sm sm:text-base",
                                    isHoliday ? "text-danger" : "text-foreground"
                                  )}
                                >
                                  {item.title}
                                </h5>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {isHoliday
                                    ? "Facility & all 3 courts are closed to all play on this day."
                                    : item.department
                                    ? `${item.department} Department`
                                    : "Court reserved for tournament play"}
                                </p>
                              </div>

                              <span className="text-[10px] font-bold text-success group-hover:underline flex-shrink-0 self-end">
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
        <div className="p-3.5 sm:p-4 bg-background border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground text-[11px] hidden sm:inline">
            Click any tournament or holiday card to view its court schedule on that day
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-muted hover:bg-muted-strong text-soft transition-colors"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
