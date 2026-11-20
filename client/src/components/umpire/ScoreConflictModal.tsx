import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, X, ArrowRight, UserCheck } from "lucide-react";
import type { ScoreConflictState } from "@/types/umpire";

export interface ScoreConflictModalProps {
  conflict: ScoreConflictState | null;
  isOpen: boolean;
  canCorrect: boolean;
  isResolving?: boolean;
  onKeepServerResult: () => Promise<void> | void;
  onApplyCorrection: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export function ScoreConflictModal({
  conflict,
  isOpen,
  canCorrect,
  isResolving = false,
  onKeepServerResult,
  onApplyCorrection,
  onClose,
}: ScoreConflictModalProps) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepServerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setErrorMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      const reasonInput = dialogRef.current?.querySelector<HTMLTextAreaElement>("#correction-reason");
      (reasonInput ?? keepServerRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, canCorrect, conflict?.downstreamStarted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isResolving) {
        onClose();
      }
      if (e.key === "Tab" && isOpen && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isResolving, onClose]);

  if (!isOpen || !conflict) return null;

  const handleApply = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErrorMsg("A detailed reason is required before applying a correction.");
      return;
    }
    setErrorMsg(null);
    try {
      await onApplyCorrection(trimmed);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to apply correction");
    }
  };

  const getWinnerName = (side: 1 | 2 | null | undefined) => {
    if (side === 1) return conflict.team1Label;
    if (side === 2) return conflict.team2Label;
    return "Undecided";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      aria-describedby="conflict-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-media/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div ref={dialogRef} className="relative w-full max-w-2xl bg-card border border-warning/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-warning/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 text-warning rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 id="conflict-dialog-title" className="text-lg font-bold text-foreground flex items-center gap-2">
                Score Revision Conflict
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
                  {conflict.category || "Tournament"} {conflict.matchNumber ? `• Match #${conflict.matchNumber}` : ""}
                </span>
              </h2>
              <p id="conflict-dialog-description" className="text-xs text-muted-foreground">
                This match was updated on another device or by another official.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isResolving}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Downstream warning if applicable */}
          {conflict.downstreamStarted && (
            <div className="p-4 rounded-xl bg-danger/15 border border-danger/30 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="text-xs text-danger space-y-1">
                <div className="font-semibold text-danger">Downstream Draw Match Already Active</div>
                <p>
                  A downstream match in the draw ({conflict.downstreamMatchCode ? `Match ${conflict.downstreamMatchCode}` : "Next Round"}) has already started or completed.
                  To protect tournament bracket integrity, simple score correction is locked.
                </p>
                <p className="text-danger/80">
                  Please keep the server result or contact the Tournament Administrator to perform a coordinated correction.
                </p>
              </div>
            </div>
          )}

          {/* Side by side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Version */}
            <div className="p-4 rounded-xl bg-muted/60 border border-border-strong/60 space-y-3">
              <div className="flex items-center justify-between border-b border-border-strong/60 pb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Device Score
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted-strong text-soft">
                  Rev {conflict.localRevision}
                </span>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground">Winner</div>
                <div className="text-sm font-bold text-success flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {getWinnerName(conflict.localWinnerSide)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground">Score & Sets</div>
                <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                  {conflict.localScore || "No score recorded"}
                </div>
                {conflict.localSets && conflict.localSets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {conflict.localSets.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 rounded bg-card border border-border-strong text-soft font-mono"
                      >
                        G{idx + 1}: {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Server Version */}
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 space-y-3">
              <div className="flex items-center justify-between border-b border-warning/20 pb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-warning">
                  Server Accepted Score
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                  Rev {conflict.serverRevision}
                </span>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground">Winner</div>
                <div className="text-sm font-bold text-gold flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-warning" />
                  {getWinnerName(conflict.serverWinnerSide)}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground">Score & Sets</div>
                <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                  {conflict.serverScore || "No score recorded"}
                </div>
                {conflict.serverSets && conflict.serverSets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {conflict.serverSets.map((s, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 rounded bg-card border border-warning/30 text-warning font-mono"
                      >
                        G{idx + 1}: {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribution */}
              {(conflict.lastActorName || conflict.lastUpdatedAt) && (
                <div className="pt-2 border-t border-warning/20 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-warning" />
                  <span>
                    Updated {conflict.lastActorName ? `by ${conflict.lastActorName}` : ""}
                    {conflict.lastUpdatedAt ? ` at ${new Date(conflict.lastUpdatedAt).toLocaleTimeString()}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reason Input (only if authorized and not downstream started) */}
          {canCorrect && !conflict.downstreamStarted && (
            <div className="space-y-2">
              <label htmlFor="correction-reason" className="block text-xs font-semibold text-soft">
                Reason for Correction <span className="text-danger">*</span>
              </label>
              <textarea
                id="correction-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required: State the reason for overriding the server result (e.g. Verified with players that second game score was 21-19, not 21-17)..."
                disabled={isResolving}
                className="w-full px-3 py-2 text-xs text-foreground bg-muted/80 border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-warning/50 focus:border-warning transition resize-none placeholder:text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                This correction will be permanently logged in the audit trail with your account, timestamp, and previous score history.
              </p>
            </div>
          )}

          {!canCorrect && (
            <div className="p-3 rounded-xl bg-muted/80 border border-border-strong text-xs text-soft">
              Only authorized tournament officials or administrators can override an accepted match result. If your local score is the correct one, please notify a tournament desk official.
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-danger/20 border border-danger/40 text-xs text-danger">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card/90">
          <button
            ref={keepServerRef}
            type="button"
            onClick={onKeepServerResult}
            disabled={isResolving}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border-strong bg-muted hover:bg-muted-strong text-soft text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isResolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            Keep Server Result
          </button>

          {canCorrect && !conflict.downstreamStarted && (
            <button
              type="button"
              onClick={handleApply}
              disabled={isResolving || !reason.trim()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-warning/20"
            >
              {isResolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Apply Correction
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

