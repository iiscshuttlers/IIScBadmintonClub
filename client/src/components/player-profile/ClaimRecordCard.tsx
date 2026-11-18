import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { fetchMyClaimRequest, requestPlayerClaim } from "@/services/identityService";

/**
 * "Is this you?" on a guest record (WP8). Submitting creates a request for an
 * administrator to verify; it never links anything by itself, and a matching
 * name is not evidence.
 */
export function ClaimRecordCard({ guestId, guestName, requesterId }: { guestId: string; guestName: string; requesterId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["player_claim_requests", guestId, requesterId],
    queryFn: () => fetchMyClaimRequest(guestId, requesterId),
    retry: 0,
    staleTime: 60_000,
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestPlayerClaim(guestId, evidence.trim());
      toast.success("Request sent. An administrator will verify it before anything is linked.");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["player_claim_requests", guestId, requesterId] });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't send the request.");
    } finally {
      setBusy(false);
    }
  };

  // The claim feature is not deployed yet → render nothing rather than an error.
  if (existing.isError) return null;
  const req = existing.data;

  return (
    <section aria-label="Claim this record" className="mx-4 my-3 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
      <p className="flex items-center gap-2 font-bold">
        <UserCheck className="w-4 h-4" aria-hidden /> “{guestName}” is a guest record.
      </p>
      {req?.status === "pending" ? (
        <p className="mt-1">Your request to link this record is waiting for an administrator.</p>
      ) : req?.status === "rejected" ? (
        <p className="mt-1">Your earlier request was not approved{req.decision_note ? `: ${req.decision_note}` : "."}</p>
      ) : !open ? (
        <>
          <p className="mt-1 text-muted-foreground">
            If these matches are yours, ask an administrator to link them to your profile. They will check before anything changes.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 min-h-[44px] px-4 rounded-xl bg-amber-600 text-white font-bold"
          >
            This is me — request link
          </button>
        </>
      ) : (
        <div className="mt-2 space-y-2">
          <label htmlFor="claim-evidence" className="block text-xs font-bold">
            How can an administrator verify this is you?
          </label>
          <textarea
            id="claim-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            className="w-full min-h-[88px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
            placeholder="e.g. I played the 3 Oct friendly against Bina, who can confirm. A shared name alone is not enough."
          />
          {error && (
            <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-bold">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || evidence.trim().length < 10}
              className="min-h-[44px] px-4 rounded-xl bg-amber-600 text-white font-bold disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Send request
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
