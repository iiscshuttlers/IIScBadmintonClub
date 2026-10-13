import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flag, X, ShieldBan, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// user_reports / user_blocks are new tables; generated types regenerate after
// the migration is applied (npx supabase db push). Cast until then.
const sb = supabase as any;

const REASONS = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate", label: "Inappropriate behavior or content" },
  { id: "impersonation", label: "Fake profile / impersonation" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Other" },
];

interface ReportPlayerModalProps {
  open: boolean;
  onClose: () => void;
  reportedPlayerId: string;
  reportedPlayerName?: string;
  reporterId: string | null | undefined;
}

export function ReportPlayerModal({ open, onClose, reportedPlayerId, reportedPlayerName, reporterId }: ReportPlayerModalProps) {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      setReason("harassment");
      setDetails("");
      setAlsoBlock(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!reporterId) {
      toast.error("Please sign in to report.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await sb.from("user_reports").insert({
        reporter_id: reporterId,
        reported_player_id: reportedPlayerId,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;

      if (alsoBlock) {
        await sb.from("user_blocks").upsert({ blocker_id: reporterId, blocked_id: reportedPlayerId });
      }

      toast.success("Report submitted. Our team will review it.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "You've already reported this player." : "Couldn't submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-rose-500/15 flex items-center justify-center">
            <Flag className="w-4 h-4 text-rose-500" />
          </div>
          <h2 id="report-title" className="text-sm font-black text-foreground flex-1">
            Report {reportedPlayerName || "player"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <fieldset>
            <legend className="text-xs font-bold text-muted-foreground mb-2">Why are you reporting this player?</legend>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label key={r.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-rose-500"
                  />
                  <span className="text-sm text-foreground">{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="report-details" className="text-xs font-bold text-muted-foreground">Details (optional)</label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Add anything that helps us review this…"
              className="mt-1 w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="accent-rose-500" />
            <ShieldBan className="w-4 h-4 text-muted-foreground" />
            Also block this player
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            Submit report
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
