import React from "react";
import { X, CheckCircle2, AlertCircle, Plus, Edit2, Trash2 } from "lucide-react";
import { formatTime12h } from "./courtSchedule.utils";
import type { BookingDisplayItem } from "./courtSchedule.types";

export interface CourtStatusInfo {
  isHoliday: boolean;
  isBooked: boolean;
  summary: string;
  detail: string;
}

interface CourtDetailsModalProps {
  selectedCourtDetails: number | null;
  onClose: () => void;
  selectedDate: string;
  courtInfo: CourtStatusInfo;
  bookings: BookingDisplayItem[];
  isAuthorizedAdmin: boolean;
  onOpenAddBooking: (courtNumber: number) => void;
  onEditBooking: (booking: BookingDisplayItem) => void;
  onRequestDeleteBooking: (booking: { id: string; title: string; date: string; courts: string[] }) => void;
}

export function CourtDetailsModal({
  selectedCourtDetails,
  onClose,
  selectedDate,
  courtInfo,
  bookings,
  isAuthorizedAdmin,
  onOpenAddBooking,
  onEditBooking,
  onRequestDeleteBooking,
}: CourtDetailsModalProps) {
  if (selectedCourtDetails === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-media/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-card border border-border-strong/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-background border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-muted border border-border-strong text-success font-black text-xs sm:text-sm flex items-center justify-center shadow-inner">
              C{selectedCourtDetails}
            </span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-foreground">
                Court C{selectedCourtDetails} Details
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto">
          {courtInfo.isHoliday ? (
            <div className="p-4 rounded-2xl bg-danger/15 border border-danger/35 text-xs text-danger">
              <span className="font-black text-danger block text-sm mb-1">
                Facility Closed
              </span>
              {courtInfo.summary}
            </div>
          ) : !courtInfo.isBooked ? (
            <div className="p-4 rounded-2xl bg-success/15 border border-success/40 text-success text-xs flex items-center gap-3.5 shadow-inner">
              <div className="w-10 h-10 rounded-xl bg-success/20 border border-success/60 flex items-center justify-center text-success flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-sm text-success">
                  Court is open to play for users
                </p>
                <p className="text-success/90 mt-0.5 font-medium">
                  {courtInfo.detail}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Primary Status Banner */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-danger/10 border border-danger/35 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-black text-xs sm:text-sm text-danger leading-snug">
                      {courtInfo.summary}
                    </p>
                    <p className="text-danger/80 mt-1 font-medium text-[11px]">
                      {courtInfo.detail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Booking Breakdown List */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-soft">
                  Scheduled Bookings on Court C{selectedCourtDetails}:
                </p>
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-background border border-border flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <span className="font-black text-foreground text-sm block">
                        {b.title}
                      </span>
                      {b.department && (
                        <span className="text-soft text-xs block font-semibold">
                          {b.department} Department
                        </span>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-danger/25 text-danger border border-danger/40 font-bold text-[11px]">
                          {formatTime12h(b.startTimeStr)} – {formatTime12h(b.endTimeStr)}
                        </span>
                        {b.isManual && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            Manual Booking
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Admin Edit / Delete Actions */}
                    {isAuthorizedAdmin && b.isManual && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditBooking(b)}
                          title="Edit booking"
                          className="p-1.5 rounded-lg bg-muted text-soft hover:text-foreground hover:bg-muted-strong transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            onRequestDeleteBooking({
                              id: b.id,
                              title: b.title,
                              date: b.date || selectedDate,
                              courts: b.courts || [String(selectedCourtDetails)],
                            })
                          }
                          title="Delete booking"
                          className="p-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border text-[11px] text-muted-foreground">
                All other hours are open to play for users.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-background border-t border-border flex items-center justify-between">
          {isAuthorizedAdmin && (
            <button
              onClick={() => onOpenAddBooking(selectedCourtDetails)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-success-foreground transition-all shadow-md shadow-success/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Update / Add Booking</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold bg-muted hover:bg-muted-strong text-soft transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
