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
      className="fixed inset-0 z-50 bg-media/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] bg-card border border-border-strong/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-background border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-success/15 border border-success/25 text-success flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-foreground">
                Gymkhana Court Booking Rules
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Interim regulations for tournament bookings & play for users
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl bg-muted hover:bg-muted-strong text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto text-xs text-soft scrollbar-thin">
          <div className="p-3.5 rounded-2xl bg-info/10 border border-info/25 text-info leading-relaxed">
            <span className="font-bold text-foreground block mb-0.5">Interim Measure Notice</span>
            These guidelines remain in effect until the new Gymkhana 10-court badminton facility becomes operational, ensuring fair access for both tournament organizers and everyday players.
          </div>

          {/* Rule 1 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-background/60 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted text-success font-bold flex items-center justify-center text-[11px]">1</span>
                Court Allocation
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-soft">
                1 Court Max
              </span>
            </div>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside pl-1 pt-1">
              <li>Departmental and divisional tournaments may reserve a <strong className="text-soft">maximum of 1 court</strong> at a time.</li>
              <li>At least <strong className="text-soft">2 courts must remain open</strong> to play for users.</li>
              <li>Institute-level and inter-institute events may reserve up to 3 courts with prior Gymkhana approval.</li>
            </ul>
          </div>

          {/* Rule 2 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-background/60 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted text-success font-bold flex items-center justify-center text-[11px]">2</span>
                Booking Timings
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-soft">
                Day Slots Only
              </span>
            </div>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside pl-1 pt-1">
              <li>Departmental bookings are permitted only in two daytime windows: <strong className="text-soft">9:00 AM – 1:00 PM</strong> and <strong className="text-soft">1:00 PM – 5:00 PM</strong>.</li>
              <li><strong className="text-danger">No departmental bookings are allowed after 5:00 PM</strong> on weekdays or weekends.</li>
            </ul>
          </div>

          {/* Rule 3 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-success/5 border border-success/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-success text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-success/20 text-success font-bold flex items-center justify-center text-[11px]">3</span>
                Protected Evening Hours
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/40">
                5:00 PM – 10:20 PM
              </span>
            </div>
            <ul className="space-y-1 text-soft list-disc list-inside pl-1 pt-1">
              <li>Evening hours are strictly preserved for play for users and recreational players.</li>
              <li>Only approved institute-level tournaments may be granted evening exceptions.</li>
            </ul>
          </div>

          {/* Rule 4 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-background/60 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted text-success font-bold flex items-center justify-center text-[11px]">4</span>
                Duration Quotas by Participant Count
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-soft">
                Capped Hours
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Maximum total court hours depend strictly on the number of registered players:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block">Up to 40</span>
                <span className="text-sm font-black text-foreground">8 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block">41 – 60</span>
                <span className="text-sm font-black text-foreground">12 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block">61 – 79</span>
                <span className="text-sm font-black text-foreground">16 hours max</span>
              </div>
              <div className="p-2.5 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block">80 or more</span>
                <span className="text-sm font-black text-foreground">20 hours max</span>
              </div>
            </div>
          </div>

          {/* Rule 5 */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-background/60 border border-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-foreground text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted text-success font-bold flex items-center justify-center text-[11px]">5</span>
                Advance Notice & Holidays
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-soft">
                &ge; 7 Days
              </span>
            </div>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside pl-1 pt-1">
              <li>Organizers must submit booking requests at least <strong className="text-soft">7 days in advance</strong>.</li>
              <li>Requests must include tentative participant count, format, and proposed match schedule.</li>
              <li>Courts are completely <strong className="text-danger">closed on all Gymkhana-declared holidays</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-background border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-success-foreground transition-colors shadow-md shadow-success/20"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
