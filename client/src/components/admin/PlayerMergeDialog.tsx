import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  decidePlayerClaim,
  mergeBlockerText,
  mergePlayerIdentity,
  previewPlayerMerge,
  referenceTableLabel,
} from "@/services/identityService";

/**
 * Previewed, reasoned guest → member merge (WP8). Shows every record that will
 * move and blocks merges that would corrupt history. With `claimRequestId`,
 * approving also closes that ownership request.
 */
export function PlayerMergeDialog({
  open,
  onOpenChange,
  guestId,
  realId,
  claimRequestId,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  realId: string;
  claimRequestId?: number;
  onMerged?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId] = useState(() => crypto.randomUUID());

  const preview = useQuery({
    queryKey: ["player-merge-preview", guestId, realId],
    queryFn: () => previewPlayerMerge(guestId, realId),
    enabled: open,
    staleTime: 0,
    retry: 0,
  });

  const total = (preview.data?.references ?? []).reduce((s, r) => s + r.rows, 0);
  const blocked = (preview.data?.blockers.length ?? 0) > 0;

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      if (claimRequestId != null) {
        await decidePlayerClaim({ requestId: claimRequestId, approve: true, note: reason.trim(), operationId });
      } else {
        await mergePlayerIdentity({ guestId, realId, reason: reason.trim(), operationId });
      }
      onMerged?.();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Merge failed. Nothing was changed.");
      void preview.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{claimRequestId != null ? "Approve claim and link history" : "Link guest history to a member"}</DialogTitle>
          <DialogDescription>Review what will move before confirming. New merges are recorded with an exact reversal ledger.</DialogDescription>
        </DialogHeader>

        {preview.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Checking every record that references this guest…
          </p>
        ) : preview.isError ? (
          <p role="alert" className="text-sm text-danger">
            Couldn't preview this merge: {(preview.error as any)?.message ?? "unknown error"}. Nothing was changed.
          </p>
        ) : (
          preview.data && (
            <div className="space-y-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                <span className="break-words">{preview.data.guest.name ?? "Guest"} (guest)</span>
                <ArrowRight className="w-4 h-4" aria-label="into" />
                <span className="break-words">{preview.data.target.name ?? "Member"}</span>
              </p>

              <section aria-label="Records that will move">
                <p className="text-xs font-bold mb-1">Records that will move ({total})</p>
                {preview.data.references.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No records reference this guest.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {preview.data.references.map((r) => (
                      <li key={`${r.table}.${r.column}`} className="flex justify-between gap-2 text-xs">
                        <span>
                          {referenceTableLabel(r.table)} <span className="text-muted-foreground">({r.column.replace(/_/g, " ")})</span>
                        </span>
                        <span className="font-bold tabular-nums">{r.rows}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved links to the guest's profile will open the member's profile.
                  {preview.data.aliasRedirects > 0 && ` ${preview.data.aliasRedirects} earlier link(s) already pointing here will follow too.`}
                </p>
              </section>

              {blocked && (
                <ul className="space-y-1.5">
                  {preview.data.blockers.map((b) => (
                    <li key={b} className="flex gap-2 text-xs text-danger">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {mergeBlockerText(b)}
                    </li>
                  ))}
                  {preview.data.conflicts.map((c) => (
                    <li key={`${c.table}-${c.kind}`} className="text-xs text-muted-foreground pl-5">
                      {referenceTableLabel(c.table)}: {c.rows} {c.kind === "same_event_entry" ? "shared event entry" : "row(s) with both players"}
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p role="alert" className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> {error}
                </p>
              )}

              <div>
                <label htmlFor="merge-reason" className="block text-xs font-bold mb-1">
                  How was ownership verified? <span className="text-danger">*</span>
                </label>
                <textarea
                  id="merge-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full min-h-[88px] rounded-xl border border-border-strong bg-card p-3"
                  placeholder="e.g. Confirmed in person with the opponent; IISc email on the guest entry matches"
                />
                <p className="mt-1 text-xs text-muted-foreground">A matching name on its own is not verification.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onOpenChange(false)} className="min-h-[44px] rounded-xl border border-border-strong font-bold">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy || blocked || !reason.trim()}
                  className="min-h-[44px] rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />}
                  Link history
                </button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
