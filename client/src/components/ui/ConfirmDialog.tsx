import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = confirmVariant === "danger";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/75 backdrop-blur-md"
          onClick={onCancel}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative bg-card rounded-3xl shadow-2xl border border-border p-6 w-full max-w-sm sm:max-w-md overflow-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-soft rounded-full hover:bg-muted transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                isDanger
                  ? "bg-danger/10 text-danger border border-danger/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <HelpCircle className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h2
                id="confirm-dialog-title"
                className="text-lg font-black text-foreground leading-tight"
              >
                {title}
              </h2>
              {description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-6 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-xl border border-border text-soft font-bold text-xs hover:bg-muted transition active:scale-95 text-center"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              autoFocus
              onClick={onConfirm}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition shadow-md active:scale-95 text-center ${
                isDanger
                  ? "bg-danger hover:bg-danger/90 text-danger-foreground shadow-danger/20"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
