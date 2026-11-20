import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { playerService } from "@/services/playerService";
import { decidePlayerClaim, fetchPendingClaimRequests, type ClaimRequest } from "@/services/identityService";
import { PlayerMergeDialog } from "@/components/admin/PlayerMergeDialog";

/** Pending "this guest record is me" requests (WP8). Approval goes through the merge preview. */
export function ClaimRequestsSection({ onResolved }: { onResolved?: () => void }) {
  const qc = useQueryClient();
  const [approving, setApproving] = useState<ClaimRequest | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["player_claim_requests", "pending"],
    queryFn: async () => {
      const requests = await fetchPendingClaimRequests();
      const ids = Array.from(new Set(requests.flatMap((r) => [r.guest_id, r.requester_id])));
      const names: Record<string, string> = {};
      if (ids.length) {
        const data = await playerService.getPlayerNamesByIds(ids);
        for (const p of data ?? []) names[p.id] = p.full_name ?? "Player";
      }
      return { requests, names };
    },
    retry: 0,
    staleTime: 0,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["player_claim_requests"] });
    onResolved?.();
  };

  const reject = async (id: number) => {
    setBusy(true);
    try {
      await decidePlayerClaim({ requestId: id, approve: false, note: note.trim(), operationId: crypto.randomUUID() });
      toast.success("Request rejected");
      setRejecting(null);
      setNote("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't reject the request");
    } finally {
      setBusy(false);
    }
  };

  // Feature not deployed, or nothing pending → stay out of the way.
  if (q.isError || (q.data && q.data.requests.length === 0)) return null;

  return (
    <section aria-labelledby="claim-requests-heading" className="bg-card rounded-3xl border border-warning/40 p-5 sm:p-6">
      <h2 id="claim-requests-heading" className="text-lg font-black flex items-center gap-2 mb-1">
        <UserCheck className="w-5 h-5 text-warning" aria-hidden /> Ownership requests
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Members asking to link a guest record to their profile. Verify before approving — a matching name is not proof.
      </p>
      {q.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading…
        </p>
      ) : (
        <ul className="space-y-3">
          {q.data!.requests.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border-strong p-3 text-sm">
              <p className="font-bold break-words">
                {q.data!.names[r.requester_id] ?? "Member"} → guest “{q.data!.names[r.guest_id] ?? "Guest"}”
              </p>
              <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</p>
              <p className="mt-1 italic break-words">“{r.evidence}”</p>
              {rejecting === r.id ? (
                <div className="mt-2 space-y-2">
                  <label htmlFor={`reject-${r.id}`} className="block text-xs font-bold">Reason shown to the member</label>
                  <input
                    id={`reject-${r.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-border-strong bg-card px-3"
                  />
                  <div className="flex gap-2">
                    <button className="min-h-[44px] px-4 rounded-xl border font-bold" onClick={() => setRejecting(null)}>Cancel</button>
                    <button
                      className="min-h-[44px] px-4 rounded-xl bg-danger text-danger-foreground font-bold disabled:opacity-50"
                      disabled={busy || !note.trim()}
                      onClick={() => void reject(r.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button className="min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground font-bold" onClick={() => setApproving(r)}>
                    Review &amp; approve
                  </button>
                  <button className="min-h-[44px] px-4 rounded-xl border border-border-strong font-bold" onClick={() => { setRejecting(r.id); setNote(""); }}>
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {approving && (
        <PlayerMergeDialog
          open
          onOpenChange={(o) => { if (!o) setApproving(null); }}
          guestId={approving.guest_id}
          realId={approving.requester_id}
          claimRequestId={approving.id}
          onMerged={() => {
            toast.success("Claim approved and history linked");
            void refresh();
          }}
        />
      )}
    </section>
  );
}
