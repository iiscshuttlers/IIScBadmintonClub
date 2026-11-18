import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, History, Loader2, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  auditActionLabel,
  blockerMessage,
  blockersFor,
  classifyCorrectionError,
  eloEffectMessage,
  parseGamesInput,
  winnerFromGames,
  type CorrectionPreview,
} from "@/lib/correctionPreview";
import { fetchAuditEvents, previewTournamentMatchCorrection, undoTournamentMatchCorrection } from "@/services/correctionService";
import { applyTournamentMatchCorrection } from "@/services/tournamentService";

/**
 * Controlled result correction (WP7):
 *   edit → read-only server preview → confirm with reason → apply.
 * The revision shown in the preview is the one sent to the server, so a
 * change by anyone else in between is rejected rather than overwritten.
 */
export function MatchCorrectionDialog({
  open,
  onOpenChange,
  matchId,
  team1Label,
  team2Label,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  team1Label: string;
  team2Label: string;
  onApplied?: () => void;
}) {
  const qc = useQueryClient();
  const [gamesText, setGamesText] = useState("");
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [winnerTouched, setWinnerTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState<CorrectionPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  // Current server state (refreshed by realtime via the tournament_matches prefix).
  const current = useQuery({
    queryKey: ["tournament_matches", "correction-preview", matchId],
    queryFn: () => previewTournamentMatchCorrection(matchId, null),
    enabled: open,
    staleTime: 0,
    retry: 0,
  });
  const history = useQuery({
    queryKey: ["tournament_matches", "audit-events", matchId],
    queryFn: () => fetchAuditEvents(matchId),
    enabled: open,
    staleTime: 0,
    retry: 0,
  });

  // Seed the form from the server result when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setReviewed(null);
    setNotice(null);
    setReason("");
    setUndoReason("");
    setWinnerTouched(false);
    setOperationId(crypto.randomUUID());
  }, [open, matchId]);
  useEffect(() => {
    if (open && current.data && !gamesText && !reviewed) {
      setGamesText(current.data.sets.join(", "));
      setWinner(current.data.winnerSide);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current.data]);

  const parsed = useMemo(() => parseGamesInput(gamesText), [gamesText]);
  const derivedWinner = parsed.error ? null : winnerFromGames(parsed.games);
  const proposedWinner = winnerTouched ? winner : derivedWinner ?? winner;
  const label = (side: 1 | 2 | null) => (side === 1 ? team1Label : side === 2 ? team2Label : "—");

  const base = reviewed ?? current.data ?? null;
  const blockers = base ? blockersFor(base, proposedWinner) : [];
  const unchanged =
    !!current.data &&
    proposedWinner === current.data.winnerSide &&
    parsed.games.join(",") === current.data.sets.join(",");
  const winnerMismatch = derivedWinner != null && proposedWinner != null && derivedWinner !== proposedWinner;

  const close = () => {
    setGamesText("");
    onOpenChange(false);
  };

  const review = async () => {
    setNotice(null);
    try {
      // Fresh read at review time: this revision is what the server will verify.
      const p = await previewTournamentMatchCorrection(matchId, proposedWinner);
      setReviewed(p);
    } catch (e: any) {
      setNotice(e?.message ?? "Couldn't load the correction preview.");
    }
  };

  const refreshAfterChange = async (message: string) => {
    setReviewed(null);
    setNotice(message);
    setOperationId(crypto.randomUUID());
    await Promise.all([current.refetch(), history.refetch()]);
  };

  const apply = async () => {
    if (!reviewed || proposedWinner == null || parsed.error) return;
    setSubmitting(true);
    try {
      const res = await applyTournamentMatchCorrection({
        matchId,
        winnerSide: proposedWinner,
        score: parsed.games.join(", "),
        sets: parsed.games,
        expectedRevision: reviewed.revision,
        reason: reason.trim(),
        operationId,
      });
      toast.success(res.applied ? "Correction applied and recorded" : "Correction was already applied");
      await qc.invalidateQueries({ queryKey: ["tournament_matches"] });
      onApplied?.();
      close();
    } catch (e: any) {
      const kind = classifyCorrectionError(e);
      if (kind === "stale") await refreshAfterChange("The result changed after your preview. Nothing was saved — review the new state below.");
      else if (kind === "downstream") await refreshAfterChange(blockerMessage("downstream_started"));
      else if (kind === "winner_change") setNotice(blockerMessage(base?.isTeamRubber ? "team_winner_change" : "ranked_winner_change"));
      else if (kind === "forbidden") setNotice("You are not an official for this match, so you can't correct it.");
      else setNotice(e?.message ?? "Correction failed. Nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const undo = async () => {
    const p = current.data;
    if (!p?.undoableEventId || !undoReason.trim()) return;
    setSubmitting(true);
    try {
      await undoTournamentMatchCorrection({
        eventId: p.undoableEventId,
        expectedRevision: p.revision,
        reason: undoReason.trim(),
        operationId,
      });
      toast.success("Correction undone and recorded");
      await qc.invalidateQueries({ queryKey: ["tournament_matches"] });
      onApplied?.();
      close();
    } catch (e: any) {
      const kind = classifyCorrectionError(e);
      if (kind === "stale" || kind === "superseded")
        await refreshAfterChange("The result changed since this correction, so it can no longer be undone. Review the current result.");
      else if (kind === "downstream") await refreshAfterChange(blockerMessage("downstream_started"));
      else setNotice(e?.message ?? "Undo failed. Nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Correct result</DialogTitle>
          <DialogDescription>
            {team1Label} vs {team2Label}
            {current.data?.matchCode ? ` · ${current.data.matchCode}` : ""}
          </DialogDescription>
        </DialogHeader>

        {current.isPending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading the current result…
          </p>
        )}
        {current.isError && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {classifyCorrectionError(current.error as any) === "forbidden"
              ? "You are not an official for this match, so you can't correct it."
              : `Couldn't load the current result: ${(current.error as any)?.message ?? "unknown error"}`}
          </p>
        )}

        {current.data && (
          <div className="space-y-4 text-sm">
            <section aria-label="Current result" className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Current server result</p>
              <p className="mt-1 font-bold">
                Winner: {label(current.data.winnerSide)} · <span className="font-mono">{current.data.score ?? "no score"}</span>
              </p>
              <p className="text-xs text-muted-foreground">Revision {current.data.revision}</p>
            </section>

            {notice && (
              <p role="alert" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden /> {notice}
              </p>
            )}

            {!reviewed ? (
              <>
                <div>
                  <label htmlFor="corr-games" className="block text-xs font-bold mb-1">Corrected game scores</label>
                  <input
                    id="corr-games"
                    className={inputCls}
                    value={gamesText}
                    onChange={(e) => setGamesText(e.target.value)}
                    placeholder="21-19, 18-21, 21-17"
                    aria-invalid={!!parsed.error}
                    aria-describedby="corr-games-help"
                    inputMode="text"
                  />
                  <p id="corr-games-help" className={`mt-1 text-xs ${parsed.error ? "text-[var(--danger)]" : "text-muted-foreground"}`}>
                    {parsed.error ?? `Scores are written ${team1Label} first.`}
                  </p>
                </div>

                <fieldset>
                  <legend className="text-xs font-bold mb-1">Winner</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 2] as const).map((side) => (
                      <label
                        key={side}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-h-[44px] cursor-pointer ${proposedWinner === side ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"}`}
                      >
                        <input
                          type="radio"
                          name="corr-winner"
                          checked={proposedWinner === side}
                          onChange={() => {
                            setWinner(side);
                            setWinnerTouched(true);
                          }}
                        />
                        <span className="break-words">{label(side)}</span>
                      </label>
                    ))}
                  </div>
                  {winnerMismatch && (
                    <p className="mt-1 text-xs text-[var(--danger)]">The selected winner did not win more games.</p>
                  )}
                </fieldset>

                {blockers.length > 0 && (
                  <ul className="space-y-1.5">
                    {blockers.map((b) => (
                      <li key={b} className="flex gap-2 text-xs text-[var(--danger)]">
                        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {blockerMessage(b)}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={review}
                  disabled={!!parsed.error || proposedWinner == null || winnerMismatch || unchanged || blockers.length > 0}
                  className="w-full min-h-[44px] rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
                >
                  {unchanged ? "No change to review" : "Review impact"}
                </button>
              </>
            ) : (
              <section aria-label="Correction preview" className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Preview (read-only)</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono">{reviewed.score}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-label="becomes" />
                    <span className="font-mono font-bold">{parsed.games.join(", ")}</span>
                  </p>
                  <p className="mt-1">
                    Winner: {label(reviewed.winnerSide)}
                    {proposedWinner !== reviewed.winnerSide ? ` → ${label(proposedWinner)}` : " (unchanged)"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{eloEffectMessage({
                    eloEffect: !reviewed.countsForElo
                      ? "not_ranked"
                      : proposedWinner !== reviewed.winnerSide
                        ? "requires_recalculation"
                        : "unchanged",
                  })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Will be checked against revision {reviewed.revision}.</p>
                </div>

                <div>
                  <p className="text-xs font-bold mb-1">Later matches fed by this result</p>
                  {reviewed.downstream.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None — this result does not feed another match.</p>
                  ) : (
                    <ul className="space-y-1">
                      {reviewed.downstream.map((d) => (
                        <li key={d.matchId} className="text-xs">
                          <span className="font-bold">{d.matchCode}</span> ({d.path === "winner" ? "winner goes" : "loser goes"} to slot {d.position ?? "?"}) — {d.started ? "already started: locked" : `${d.status}; ${proposedWinner !== reviewed.winnerSide ? "the slot will be updated" : "no change"}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {blockersFor(reviewed, proposedWinner).map((b) => (
                  <p key={b} className="flex gap-2 text-xs text-[var(--danger)]">
                    <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {blockerMessage(b)}
                  </p>
                ))}

                <div>
                  <label htmlFor="corr-reason" className="block text-xs font-bold mb-1">
                    Reason <span className="text-[var(--danger)]">*</span>
                  </label>
                  <textarea
                    id="corr-reason"
                    className={`${inputCls} min-h-[88px]`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Score sheet signed by both players shows 18-21 in game 2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recorded permanently with your account, the time, and the before/after result.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReviewed(null)} className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={submitting || !reason.trim() || blockersFor(reviewed, proposedWinner).length > 0}
                    className="min-h-[44px] rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />}
                    Apply correction
                  </button>
                </div>
              </section>
            )}

            {current.data.undoableEventId != null && !reviewed && (
              <section aria-label="Undo last correction" className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 space-y-2">
                <p className="text-xs font-bold">The current result came from a correction. You can undo it (recorded as a new action).</p>
                <label htmlFor="undo-reason" className="sr-only">Reason for undo</label>
                <input
                  id="undo-reason"
                  className={inputCls}
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  placeholder="Reason for undoing"
                />
                <button
                  type="button"
                  onClick={undo}
                  disabled={submitting || !undoReason.trim()}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--danger)] text-[var(--danger)] font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden /> Undo last correction
                </button>
              </section>
            )}

            <section aria-label="Audit history">
              <p className="flex items-center gap-1.5 text-xs font-bold mb-1">
                <History className="w-3.5 h-3.5" aria-hidden /> History
              </p>
              {history.isError ? (
                <p className="text-xs text-muted-foreground">History unavailable.</p>
              ) : (history.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{history.isPending ? "Loading…" : "No recorded changes."}</p>
              ) : (
                <ol className="space-y-1.5">
                  {(history.data ?? []).map((e) => (
                    <li key={e.id} className="text-xs">
                      <span className="font-bold">{auditActionLabel(e.action)}</span>{" "}
                      <span className="text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {e.actor_email ? ` · ${e.actor_email}` : ""}
                      </span>
                      {(e.before?.score != null || e.after?.score != null) && (
                        <span className="block font-mono">{String(e.before?.score ?? "—")} → {String(e.after?.score ?? "—")}</span>
                      )}
                      {e.reason && <span className="block italic">“{e.reason}”</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
