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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
          <Trash2 className="w-6 h-6" />
        </div>

        <div>
          <h3 className="font-black text-base text-white">
            Delete Court Booking?
          </h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Are you sure you want to delete the booking for{" "}
            <strong className="text-white font-black">{booking.title}</strong> on{" "}
            <span className="text-emerald-400 font-bold">
              {new Date(booking.date + "T12:00:00").toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>{" "}
            ({booking.courts.map((c) => `Court C${c}`).join(", ")})?
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            This court will immediately become open to play for users.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(booking.id)}
            className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
