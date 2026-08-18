/**
 * Shared helpers for talking to the FCM HTTP v1 API.
 */

/**
 * Decide whether an FCM send failure means the *token* is dead and should be
 * deleted from `user_push_tokens`.
 *
 * This deliberately does NOT treat every HTTP 400 as a stale token. In the v1
 * API a 400 is `INVALID_ARGUMENT`, which is overwhelmingly a malformed
 * *message payload* — a bad `android`/`webpush` field, an unknown key, etc.
 * Since the same payload is sent to every recipient, treating 400 as "stale"
 * deletes every push token in the database on the first bad deploy, and push
 * then stays silently broken until each user reinstalls or re-opens the app.
 *
 * Only these mean the token itself is gone:
 *   - HTTP 404 / `NOT_FOUND` / errorCode `UNREGISTERED` — app uninstalled or
 *     the token was rotated.
 *   - HTTP 400 whose error message specifically blames the token field.
 */
export function isDeadToken(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;

  let errorCode = "";
  let message = "";
  try {
    const parsed = JSON.parse(body);
    message = String(parsed?.error?.message ?? "");
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.errorCode) errorCode = String(d.errorCode);
        // INVALID_ARGUMENT details carry the offending field path.
        const violations = d?.fieldViolations;
        if (Array.isArray(violations)) {
          for (const v of violations) message += ` ${String(v?.field ?? "")}`;
        }
      }
    }
  } catch {
    // Non-JSON error body — fall back to the raw text.
    message = body;
  }

  if (errorCode === "UNREGISTERED" || errorCode === "INVALID_REGISTRATION") {
    return true;
  }

  // e.g. "The registration token is not a valid FCM registration token"
  // or a fieldViolation on "message.token".
  return /registration token|message\.token\b/i.test(message);
}

/**
 * True when the failure is a payload/config problem affecting *all* recipients,
 * so callers can stop hammering FCM with the rest of the token list.
 */
export function isFatalSendError(status: number): boolean {
  return status === 401 || status === 403;
}
