import React from "react";
import { History, ChevronUp, ChevronDown, Search, Plus, Edit2, Trash2, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime12h } from "./courtSchedule.utils";
import type { CourtReservation, BookingDisplayItem } from "./courtSchedule.types";

interface CourtHistoryPanelProps {
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  historyTab: "upcoming" | "past" | "all";
  setHistoryTab: (tab: "upcoming" | "past" | "all") => void;
  historySearch: string;
  setHistorySearch: (q: string) => void;
  allBookingsHistory: CourtReservation[];
  filteredHistoryBookings: CourtReservation[];
  todayStr: string;
  isAuthorizedAdmin: boolean;
  onOpenAddBooking: () => void;
  onEditBooking: (booking: BookingDisplayItem) => void;
  onRequestDeleteBooking: (booking: { id: string; title: string; date: string; courts: string[] }) => void;
}

export function CourtHistoryPanel({
  showHistory,
  setShowHistory,
  historyTab,
  setHistoryTab,
  historySearch,
  setHistorySearch,
  allBookingsHistory,
  filteredHistoryBookings,
  todayStr,
  isAuthorizedAdmin,
  onOpenAddBooking,
  onEditBooking,
  onRequestDeleteBooking,
}: CourtHistoryPanelProps) {
  return (
    <div className="mt-4 sm:mt-5 border-t border-border pt-3 sm:pt-4">
      <button
        type="button"
        onClick={() => setShowHistory((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-background/70 hover:bg-background border border-border hover:border-border-strong transition-all text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-muted border border-border-strong text-success flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
            <History className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xs sm:text-sm text-foreground truncate">
              Booking History & Scheduled Events
            </h3>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
              {showHistory
                ? "Click to collapse"
                : "Click to expand all past & upcoming court reservations"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-3">
          <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-success/25 text-success border border-success/50 whitespace-nowrap shadow-sm">
            {allBookingsHistory.length} Record{allBookingsHistory.length !== 1 ? "s" : ""}
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-muted border border-border-strong flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Collapsed Body */}
      {showHistory && (
        <div className="mt-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Controls: Filter Tabs + Quick Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* Tabs */}
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-background border border-border shadow-inner overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setHistoryTab("upcoming")}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                  historyTab === "upcoming"
                    ? "bg-success text-success-foreground font-black shadow-md shadow-success/20"
                    : "text-muted-foreground hover:text-soft hover:bg-card"
                )}
              >
                <span>Upcoming</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "upcoming"
                      ? "bg-background/20 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {allBookingsHistory.filter((b) => b.date >= todayStr).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab("past")}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                  historyTab === "past"
                    ? "bg-success text-success-foreground font-black shadow-md shadow-success/20"
                    : "text-muted-foreground hover:text-soft hover:bg-card"
                )}
              >
                <span>Past</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "past"
                      ? "bg-background/20 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {allBookingsHistory.filter((b) => b.date < todayStr).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab("all")}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                  historyTab === "all"
                    ? "bg-success text-success-foreground font-black shadow-md shadow-success/20"
                    : "text-muted-foreground hover:text-soft hover:bg-card"
                )}
              >
                <span>All</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "all"
                      ? "bg-background/20 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {allBookingsHistory.length}
                </span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search tournament, department..."
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder-faint focus:outline-none focus:border-success"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Bookings List Cards */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredHistoryBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground rounded-2xl bg-background/50 border border-border/80">
                <p className="font-bold text-soft">No bookings match this filter.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try changing the tab or clearing the search query.
                </p>
                {isAuthorizedAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAddBooking}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-success-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Booking</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredHistoryBookings.map((item) => {
                  const isPast = item.date < todayStr;
                  const dateObj = new Date(item.date + "T12:00:00");
                  const dateFormatted = dateObj.toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-3 rounded-2xl border transition-all space-y-2 group relative",
                        isPast
                          ? "bg-background/40 border-border opacity-80 hover:opacity-100"
                          : "bg-background/80 border-border hover:border-border-strong shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                isPast
                                  ? "bg-muted text-muted-foreground border-border-strong"
                                  : "bg-success/20 text-success border-success/40"
                              )}
                            >
                              {isPast ? "Completed" : "Upcoming"}
                            </span>
                            {item.department && (
                              <span className="text-[10px] font-bold text-muted-foreground truncate">
                                {item.department}
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-xs sm:text-sm text-foreground mt-1 group-hover:text-success transition-colors line-clamp-2">
                            {item.tournament_name}
                          </h4>
                        </div>

                        {/* Admin Action Buttons (Edit / Delete) */}
                        {isAuthorizedAdmin && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onEditBooking({
                                  id: item.id,
                                  title: item.tournament_name,
                                  department: item.department,
                                  date: item.date,
                                  startTimeStr: item.start_time,
                                  endTimeStr: item.end_time,
                                  courts: item.courts,
                                  isManual: true,
                                  leftPercent: 0,
                                  widthPercent: 0,
                                })
                              }
                              className="p-1.5 rounded-lg bg-muted hover:bg-muted-strong text-soft hover:text-foreground transition-colors"
                              title="Edit booking"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onRequestDeleteBooking({
                                  id: item.id,
                                  title: item.tournament_name,
                                  date: item.date,
                                  courts: item.courts,
                                })
                              }
                              className="p-1.5 rounded-lg bg-danger/15 hover:bg-danger/20 border border-danger/35 text-danger hover:text-danger/80 transition-colors"
                              title="Delete booking"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-soft">
                          <Calendar className="w-3.5 h-3.5 text-success" />
                          {dateFormatted}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-soft">
                          <Clock className="w-3.5 h-3.5 text-danger" />
                          {formatTime12h(item.start_time)} – {formatTime12h(item.end_time)}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.courts.map((c) => (
                            <span
                              key={c}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-black border",
                                isPast
                                  ? "bg-muted text-muted-foreground border-border-strong"
                                  : "bg-success/20 text-success border-success/50"
                              )}
                            >
                              C{c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
