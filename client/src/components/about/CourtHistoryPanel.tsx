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
    <div className="mt-4 sm:mt-5 border-t border-slate-800 pt-3 sm:pt-4">
      <button
        type="button"
        onClick={() => setShowHistory((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
            <History className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xs sm:text-sm text-white truncate">
              Booking History & Scheduled Events
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
              {showHistory
                ? "Click to collapse"
                : "Click to expand all past & upcoming court reservations"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-3">
          <span className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 whitespace-nowrap shadow-sm">
            {allBookingsHistory.length} Record{allBookingsHistory.length !== 1 ? "s" : ""}
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
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
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setHistoryTab("upcoming")}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold whitespace-nowrap",
                  historyTab === "upcoming"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                )}
              >
                <span>Upcoming</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "upcoming"
                      ? "bg-slate-950/20 text-slate-950"
                      : "bg-slate-800 text-slate-400"
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
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                )}
              >
                <span>Past</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "past"
                      ? "bg-slate-950/20 text-slate-950"
                      : "bg-slate-800 text-slate-400"
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
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                )}
              >
                <span>All</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                    historyTab === "all"
                      ? "bg-slate-950/20 text-slate-950"
                      : "bg-slate-800 text-slate-400"
                  )}
                >
                  {allBookingsHistory.length}
                </span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search tournament, department..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* Bookings List Cards */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredHistoryBookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-950/50 border border-slate-800/80">
                <p className="font-bold text-slate-300">No bookings match this filter.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Try changing the tab or clearing the search query.
                </p>
                {isAuthorizedAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAddBooking}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
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
                          ? "bg-slate-950/40 border-slate-850 opacity-80 hover:opacity-100"
                          : "bg-slate-950/80 border-slate-800 hover:border-slate-700 shadow-sm"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                isPast
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-emerald-950 text-emerald-400 border-emerald-800"
                              )}
                            >
                              {isPast ? "Completed" : "Upcoming"}
                            </span>
                            {item.department && (
                              <span className="text-[10px] font-bold text-slate-400 truncate">
                                {item.department}
                              </span>
                            )}
                          </div>
                          <h4 className="font-black text-xs sm:text-sm text-white mt-1 group-hover:text-emerald-400 transition-colors line-clamp-2">
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
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
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
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-900/60 text-rose-400 hover:text-rose-200 transition-colors"
                              title="Delete booking"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-900 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          {dateFormatted}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-slate-200">
                          <Clock className="w-3.5 h-3.5 text-rose-400" />
                          {formatTime12h(item.start_time)} – {formatTime12h(item.end_time)}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.courts.map((c) => (
                            <span
                              key={c}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-black border",
                                isPast
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-emerald-950 text-emerald-400 border-emerald-800/80"
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
