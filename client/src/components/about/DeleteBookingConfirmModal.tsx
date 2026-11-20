import React from "react";
import { Trash2 } from "lucide-react";

interface DeleteBookingConfirmModalProps {
  booking: {
    id: string;
    title: string;
    date: string;
    courts: string[];
  } | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

export function DeleteBookingConfirmModal({
  booking,
  onCancel,
  onConfirm,
}: DeleteBookingConfirmModalProps) {
  if (!booking) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-media/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm bg-card border border-border-strong/80 rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-danger/25 border border-danger/40 text-danger flex items-center justify-center mx-auto shadow-inner">
          <Trash2 className="w-6 h-6" />
        </div>

        <div>
          <h3 className="font-black text-base text-foreground">
            Delete Court Booking?
          </h3>
          <p className="text-xs text-soft mt-2 leading-relaxed">
            Are you sure you want to delete the booking for{" "}
            <strong className="text-foreground font-black">{booking.title}</strong> on{" "}
            <span className="text-success font-bold">
              {new Date(booking.date + "T12:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>{" "}
            ({booking.courts.map((c) => `Court C${c}`).join(", ")})?
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            This court will immediately become open to play for users.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-muted hover:bg-muted-strong text-soft transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(booking.id)}
            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-danger hover:bg-danger/90 text-danger-foreground transition-colors shadow-md shadow-danger/30 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
