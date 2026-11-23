/**
 * Manual reminder for incomplete entries (no partner / shared partner).
 * Same layout idea as SendReminderSheet (which stays untouched), but this one
 * always goes in-app, by push AND by email: registration notices ignore the
 * email opt-out. The server recomputes the audience; the ids here only narrow it.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Send, X } from "lucide-react";
import { sendEntryReminders } from "@/services/tournament/registrationEntries";
import { useRegistrationMutation } from "@/hooks/useRegistration";
import type { ReminderKind, ReminderResult, ReminderSkip } from "@/types/registration";
import { incompleteEntryText, notOnAppMessage, type RegistrationPayload } from "../../../../supabase/functions/_shared/registrationMessages";
import { myEntryPath } from "@/lib/tournamentRoutes";
import { categoryLabel } from "./registrationText";

export interface ReminderRecipient {
  playerId: string;
  name: string;
  category: string;
  /** For the preview text. */
  payload: RegistrationPayload;
  isGuest?: boolean;
  /** No e-mail address on file (still reminded in-app and by push). */
  noEmail?: boolean;
  lastRemindedAt?: string | null;
}

interface Props {
  tournamentId: string;
  kind: ReminderKind;
  /** null = every open category. */
  category: string | null;
  recipients: ReminderRecipient[];
  locked?: boolean;
  onClose: () => void;
}

const COOLDOWN_MS = 12 * 60 * 60 * 1000;

export function reminderSummary(r: ReminderResult): string {
  const notOnApp = r.skipped.filter((s) => s.reason === "not_on_app").length;
  const recent = r.skipped.length - notOnApp;
  return [`Reminded ${r.reminded}`, recent ? `skipped ${recent}` : "", notOnApp ? `${notOnApp} not on the app` : ""].filter(Boolean).join(" · ");
}

function hoursAgo(iso: string): string {
  const h = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 3_600_000));
  return `${h} h ago`;
}

export function RegistrationReminderSheet({ tournamentId, kind, category, recipients, locked, onClose }: Props) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ReminderResult | null>(null);
  const send = useRegistrationMutation(tournamentId, () =>
    sendEntryReminders({ tournamentId, kind, category, playerIds: recipients.map((r) => r.playerId), note }));

  const due = recipients.filter((r) => !r.isGuest && !(r.lastRemindedAt && Date.now() - Date.parse(r.lastRemindedAt) < COOLDOWN_MS));
  const recent = recipients.filter((r) => !r.isGuest && r.lastRemindedAt && Date.now() - Date.parse(r.lastRemindedAt) < COOLDOWN_MS);
  const guests = recipients.filter((r) => r.isGuest);
  const noEmail = due.filter((r) => r.noEmail).length;
  const preview = useMemo(() => {
    const first = due[0] ?? recipients[0];
    if (!first) return "";
    const body = incompleteEntryText(first.payload);
    return note.trim() ? `${body}\n\nNote from the organiser: ${note.trim().slice(0, 200)}` : body;
  }, [due, recipients, note]);

  const copyFor = async (p: RegistrationPayload, cat: string) => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}${myEntryPath(tournamentId, cat)}`;
    try {
      await navigator.clipboard.writeText(notOnAppMessage(p, link));
      toast.success("WhatsApp message copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div role="dialog" aria-label="Remind players" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/50 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-foreground">
              {kind === "no_partner" ? "Remind players with no partner" : kind === "shared_partner" ? "Remind shared-partner pairs" : "Remind all incomplete entries"}
            </h3>
            <p className="text-xs text-muted-foreground">{category ? categoryLabel(category) : "Every open category"} · In-app, push and email</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {locked ? (
          <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">This category is locked, so reminders are off.</p>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">Recipients ({due.length})</div>
              <p className="mt-1 text-sm text-foreground" data-testid="reminder-recipients">{due.map((r) => r.name).join(", ") || "Nobody is due a reminder."}</p>
              {noEmail > 0 && <p className="mt-1 text-xs text-muted-foreground">No email address for {noEmail} (in-app and push only).</p>}
              {recent.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {recent.map((r) => <li key={r.playerId + r.category}>{r.name}: reminded {hoursAgo(r.lastRemindedAt!)}, skipped</li>)}
                </ul>
              )}
              {guests.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {guests.map((g) => (
                    <li key={g.playerId + g.category} className="flex items-center justify-between gap-2">
                      <span>{g.name}: not on the app</span>
                      <button type="button" onClick={() => copyFor(g.payload, g.category)} className="inline-flex items-center gap-1 font-bold text-primary">
                        <Copy className="h-3 w-3" aria-hidden /> Copy WhatsApp message
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-muted/60 p-3 text-sm text-soft whitespace-pre-line" data-testid="reminder-preview">{preview}</div>

            <label className="mt-3 block text-xs font-bold text-muted-foreground">
              Note (optional, {200 - note.length} left)
              <textarea value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-card p-2 text-sm text-foreground outline-none" />
            </label>

            {result ? (
              <div className="mt-4 rounded-xl bg-success/10 p-3 text-sm text-foreground" role="status">
                {reminderSummary(result)}
                {result.skipped.filter((s: ReminderSkip) => s.reason === "not_on_app").map((s) => (
                  <button key={s.player_id} type="button" onClick={() => copyFor((s.payload ?? {}) as unknown as RegistrationPayload, s.category ?? category ?? "")}
                    className="mt-1 flex items-center gap-1 text-xs font-bold text-primary">
                    <Copy className="h-3 w-3" aria-hidden /> Copy WhatsApp message for {s.name}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" disabled={send.isPending || due.length === 0}
                onClick={() => send.mutate(undefined, {
                  onSuccess: (r) => { setResult(r); toast.success(reminderSummary(r)); },
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send"),
                })}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground disabled:opacity-50">
                <Send className="h-4 w-4" aria-hidden /> Remind {due.length}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
