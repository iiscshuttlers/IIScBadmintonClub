import React from "react";
import { ShieldCheck, X } from "lucide-react";

interface CourtRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CourtRulesModal({ isOpen, onClose }: CourtRulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                Gymkhana Court Booking Rules
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Interim regulations for tournament bookings & play for users
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto text-xs text-slate-300 scrollbar-thin">
          <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-900/40 text-blue-200 leading-relaxed">
            <span className="font-bold text-white block mb-0.5">Interim Measure Notice</span>
            These guidelines remain in effect until the new Gymkhana 10-court badminton facility becomes operational, ensuring fair access for both tournament organizers and everyday players.
          </div>

          {/* Rule 1 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">1</span>
                Court Allocation
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                1 Court Max
              </span>
            </div>
            <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
              <li>Departmental and divisional tournaments may reserve a <strong className="text-slate-200">maximum of 1 court</strong> at a time.</li>
              <li>At least <strong className="text-slate-200">2 courts must remain open</strong> to play for users.</li>
              <li>Institute-level and inter-institute events may reserve up to 3 courts with prior Gymkhana approval.</li>
            </ul>
          </div>

          {/* Rule 2 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">2</span>
                Booking Timings
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                Day Slots Only
              </span>
            </div>
            <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
              <li>Departmental bookings are permitted only in two daytime windows: <strong className="text-slate-200">9:00 AM – 1:00 PM</strong> and <strong className="text-slate-200">1:00 PM – 5:00 PM</strong>.</li>
              <li><strong className="text-rose-400">No departmental bookings are allowed after 5:00 PM</strong> on weekdays or weekends.</li>
            </ul>
          </div>

          {/* Rule 3 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/15 border border-emerald-900/50 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-300 text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 font-bold flex items-center justify-center text-[11px]">3</span>
                Protected Evening Hours
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                5:00 PM – 10:20 PM
              </span>
            </div>
            <ul className="space-y-1 text-slate-300 list-disc list-inside pl-1 pt-1">
              <li>Evening hours are strictly preserved for play for users and recreational players.</li>
              <li>Only approved institute-level tournaments may be granted evening exceptions.</li>
            </ul>
          </div>

          {/* Rule 4 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">4</span>
                Duration Quotas by Participant Count
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                Capped Hours
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Maximum total court hours depend strictly on the number of registered players:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Up to 40</span>
                <span className="text-sm font-black text-white">8 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">41 – 60</span>
                <span className="text-sm font-black text-white">12 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">61 – 79</span>
                <span className="text-sm font-black text-white">16 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">80 or more</span>
                <span className="text-sm font-black text-white">20 hours max</span>
              </div>
            </div>
          </div>

          {/* Rule 5 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-white text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center text-[11px]">5</span>
                Advance Notice & Holidays
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                &ge; 7 Days
              </span>
            </div>
            <ul className="space-y-1 text-slate-400 list-disc list-inside pl-1 pt-1">
              <li>Organizers must submit booking requests at least <strong className="text-slate-200">7 days in advance</strong>.</li>
              <li>Requests must include tentative participant count, format, and proposed match schedule.</li>
              <li>Courts are completely <strong className="text-rose-400">closed on all Gymkhana-declared holidays</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-500/20"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
