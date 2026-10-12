import React from "react";
import { Building2, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourtBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBookingId: string | null;
  bookingTournament: string;
  setBookingTournament: (v: string) => void;
  bookingDepartment: string;
  setBookingDepartment: (v: string) => void;
  bookingDates: string[];
  setBookingDates: React.Dispatch<React.SetStateAction<string[]>>;
  dateSelectionMode: "individual" | "range";
  setDateSelectionMode: (v: "individual" | "range") => void;
  newDateInput: string;
  setNewDateInput: (v: string) => void;
  dateRangeStart: string;
  setDateRangeStart: (v: string) => void;
  dateRangeEnd: string;
  setDateRangeEnd: (v: string) => void;
  applyDateRange: (start: string, end: string) => void;
  bookingCourts: string[];
  setBookingCourts: React.Dispatch<React.SetStateAction<string[]>>;
  bookingSlot: string;
  setBookingSlot: (v: string) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  isSavingBooking: boolean;
  onSaveBooking: () => void;
}

export function CourtBookingModal({
  isOpen,
  onClose,
  editingBookingId,
  bookingTournament,
  setBookingTournament,
  bookingDepartment,
  setBookingDepartment,
  bookingDates,
  setBookingDates,
  dateSelectionMode,
  setDateSelectionMode,
  newDateInput,
  setNewDateInput,
  dateRangeStart,
  setDateRangeStart,
  dateRangeEnd,
  setDateRangeEnd,
  applyDateRange,
  bookingCourts,
  setBookingCourts,
  bookingSlot,
  setBookingSlot,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  isSavingBooking,
  onSaveBooking,
}: CourtBookingModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                {editingBookingId ? "Edit Court Booking" : "Update / Add Court Booking"}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Administrator booking control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          {/* Tournament Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Tournament / Event Name *
            </label>
            <input
              type="text"
              value={bookingTournament}
              onChange={(e) => setBookingTournament(e.target.value)}
              placeholder="e.g. Mechanical Dept Annual Badminton Meet 2026"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Department / Organizing Body
            </label>
            <input
              type="text"
              value={bookingDepartment}
              onChange={(e) => setBookingDepartment(e.target.value)}
              placeholder="e.g. Mechanical Engineering, Gymkhana, IISc Sports Club"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Dates Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Booking Date(s) *
              </label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDateSelectionMode("individual")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-bold transition-colors",
                    dateSelectionMode === "individual"
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Single / Multi
                </button>
                <button
                  type="button"
                  onClick={() => setDateSelectionMode("range")}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-bold transition-colors",
                    dateSelectionMode === "range"
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Date Range
                </button>
              </div>
            </div>

            {dateSelectionMode === "range" ? (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Start Date</span>
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => {
                        setDateRangeStart(e.target.value);
                        applyDateRange(e.target.value, dateRangeEnd);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">End Date</span>
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => {
                        setDateRangeEnd(e.target.value);
                        applyDateRange(dateRangeStart, e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Select a start and end date to automatically populate consecutive days (max 30 days).
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDateInput && !bookingDates.includes(newDateInput)) {
                        setBookingDates((prev) => [...prev, newDateInput].sort());
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    Add Date
                  </button>
                </div>
              </div>
            )}

            {/* Selected Dates Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-1">
              {bookingDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/80 text-[11px] font-bold text-emerald-400"
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                  {bookingDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBookingDates((prev) => prev.filter((x) => x !== d))}
                      className="hover:text-rose-400 transition-colors ml-0.5"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Court Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Courts Reserved *
              </label>
              <span className="text-[10px] text-amber-400 font-bold">
                Max 1 court recommended by interim rules
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "1", label: "Court 1", sub: "East side" },
                { id: "2", label: "Court 2", sub: "Center court" },
                { id: "3", label: "Court 3", sub: "West side" },
              ].map((c) => {
                const isSelected = bookingCourts.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (bookingCourts.length > 1) {
                          setBookingCourts((prev) => prev.filter((x) => x !== c.id));
                        }
                      } else {
                        setBookingCourts((prev) => [...prev, c.id].sort());
                      }
                    }}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all",
                      isSelected
                        ? "bg-emerald-950/70 border-emerald-500 text-white shadow-md shadow-emerald-950/40"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">{c.label}</span>
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black",
                          isSelected
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-slate-800 text-slate-500"
                        )}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{c.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Timing / Slot *
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              {[
                { id: "09:00-13:00", label: "Morning Slot", sub: "9:00 AM – 1:00 PM" },
                { id: "13:00-17:00", label: "Afternoon Slot", sub: "1:00 PM – 5:00 PM" },
                { id: "custom", label: "Custom Time", sub: "Specify hours" },
              ].map((slot) => {
                const isSelected = bookingSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setBookingSlot(slot.id)}
                    className={cn(
                      "p-2.5 rounded-2xl border text-left transition-all",
                      isSelected
                        ? "bg-emerald-950/70 border-emerald-500 text-white shadow-md shadow-emerald-950/40"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    )}
                  >
                    <span className="font-bold text-xs block">{slot.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{slot.sub}</span>
                  </button>
                );
              })}
            </div>

            {bookingSlot === "custom" && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Start Time</span>
                    <input
                      type="time"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">End Time</span>
                    <input
                      type="time"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveBooking}
            disabled={isSavingBooking}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSavingBooking
              ? "Saving..."
              : editingBookingId
              ? "Update Booking"
              : "Save Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
