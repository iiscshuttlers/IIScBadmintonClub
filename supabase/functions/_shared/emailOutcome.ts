/**
 * Pure helpers for the email channel of dispatch-scheduled-notifications (no
 * Deno imports, so vitest covers them: test/lib/emailOutcome.test.ts).
 *
 * A queue row used to be marked "sent" however its emails went, because each
 * send failure was only logged. emailOutcome() turns the per-address results
 * into what the row records:
 * - nobody to email (opted out, no address): nothing to report
 * - SMTP not configured, or every send rejected: allFailed, so the row fails
 * - some sends rejected: a note kept on the "sent" row ("partly sent")
 */

export interface EmailOutcome {
  /** Addresses the row tried to email. */
  total: number;
  failed: number;
  /** Every address failed (or SMTP is missing): mark the row failed. */
  allFailed: boolean;
  /** Text for scheduled_notifications.error, or null when all went out. */
  note: string | null;
}

const NOTE_MAX = 300;

export function emailOutcome(total: number, failures: string[], transportReady: boolean): EmailOutcome {
  if (total <= 0) return { total: 0, failed: 0, allFailed: false, note: null };
  if (!transportReady) {
    return { total, failed: total, allFailed: true, note: "email: SMTP credentials unavailable" };
  }
  const failed = Math.min(failures.length, total);
  if (failed === 0) return { total, failed: 0, allFailed: false, note: null };
  const first = (failures[0] || "unknown error").replace(/\s+/g, " ").trim();
  const note = `email: ${failed}/${total} failed: ${first}`.slice(0, NOTE_MAX);
  return { total, failed, allFailed: failed === total, note };
}

/** The message of a rejected sendMail promise. */
export function rejectionMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  const message = (reason as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : String(reason);
}

/** Organiser text goes into the email's HTML; "<", "&" and quotes must show as typed. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
