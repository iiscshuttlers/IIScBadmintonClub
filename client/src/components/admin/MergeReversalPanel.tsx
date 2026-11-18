import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchReversiblePlayerMerges,
  reversePlayerIdentityMerge,
  type ReversiblePlayerMerge,
} from "@/services/identityService";

export function MergeReversalPanel({ onReversed }: { onReversed?: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<ReversiblePlayerMerge | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["player-identity-merges", "reversible"],
    queryFn: fetchReversiblePlayerMerges,
    retry: 0,
    staleTime: 0,
  });

  if (q.isError || (!q.isPending && (q.data?.length ?? 0) === 0)) return null;

  const reverse = async () => {
    if (!selected || !reason.trim()) return;
    setBusy(true);
    try {
      const result = await reversePlayerIdentityMerge(selected.operation_id, reason.trim());
      toast.success(result.applied ? "Identity merge reversed" : "Merge was already reversed");
      setSelected(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["player-identity-merges"] });
      onReversed?.();
    } catch (error: any) {
      toast.error(error?.message ?? "The merge could not be reversed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="merge-reversal-heading" className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <h2 id="merge-reversal-heading" className="flex items-center gap-2 text-lg font-black">
        <History className="h-5 w-5 text-sky-500" aria-hidden /> Reversible identity merges
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Restore a guest and only the exact rows recorded when a recent merge was applied.</p>
      {q.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {q.data!.map((merge) => (
            <li key={merge.operation_id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{merge.guest_name ?? "Guest"} → {merge.target_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(merge.merged_at).toLocaleString("en-IN")}</p>
                </div>
                <button type="button" onClick={() => { setSelected(merge); setReason(""); }} className="min-h-[44px] rounded-xl border border-amber-400 px-4 font-bold text-amber-700 dark:text-amber-300">
                  Review reversal
                </button>
              </div>
              {selected?.operation_id === merge.operation_id && (
                <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="text-xs">This recreates the guest record and restores the recorded references. Any later change to those rows blocks the transaction.</p>
                  <label htmlFor={`reverse-${merge.operation_id}`} className="block text-xs font-bold">Reason for reversal</label>
                  <textarea id={`reverse-${merge.operation_id}`} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[72px] w-full rounded-xl border bg-white p-3 dark:bg-slate-900" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelected(null)} className="min-h-[44px] rounded-xl border px-4 font-bold">Cancel</button>
                    <button type="button" onClick={() => void reverse()} disabled={busy || !reason.trim()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 font-bold text-white disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reverse merge
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
