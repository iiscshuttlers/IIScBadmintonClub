import { describe, expect, it } from "vitest";
import {
  backupRetryAt, channelsToSend, dueFilter, isGroupKeyCollision, isStuck, retryDecision, selectTargets,
} from "../../supabase/functions/_shared/dispatchRules";

const players = [
  { id: "a", email: "a@x", pref_receive_push: true, pref_receive_email: true, pref_notify_whistle: true },
  { id: "b", email: "b@x", pref_receive_push: true, pref_receive_email: false, pref_notify_whistle: true },
  { id: "c", iisc_email: "c@iisc", pref_receive_push: false, pref_receive_email: true, pref_notify_whistle: false },
  { id: "d", email: null, iisc_email: null, pref_receive_push: true, pref_receive_email: true, pref_notify_whistle: true },
];

describe("selectTargets", () => {
  it("other kinds: today's behaviour (category and email prefs respected)", () => {
    const t = selectTargets(players, "pref_notify_whistle");
    expect(t.pushUserIds).toEqual(["a", "b", "d"]);
    expect(t.emails.map((e) => e.user_id)).toEqual(["a"]);
  });

  it("registration: email ignores pref_receive_email and the category pref; no address = no email", () => {
    const t = selectTargets(players, "pref_notify_whistle", { emailIgnoresPrefs: true });
    expect(t.emails.map((e) => e.user_id)).toEqual(["a", "b", "c"]);
    // Push is still gated as before.
    expect(t.pushUserIds).toEqual(["a", "b", "d"]);
  });
});

describe("retry", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  it("registration rows back off 5 min, 30 min, then fail on the third attempt", () => {
    expect(retryDecision("registration", 0, now)).toEqual({ status: "pending", attempts: 1, nextAttemptAt: "2026-11-23T10:05:00.000Z" });
    expect(retryDecision("registration", 1, now)).toEqual({ status: "pending", attempts: 2, nextAttemptAt: "2026-11-23T10:30:00.000Z" });
    expect(retryDecision("registration", 2, now)).toEqual({ status: "failed", attempts: 3 });
  });
  it("other kinds fail at once, as today", () => {
    expect(retryDecision("gallery_photos", 0, now)).toEqual({ status: "failed", attempts: 1 });
    expect(retryDecision(null, 0, now)).toEqual({ status: "failed", attempts: 1 });
  });
  it("a retry resends only missing channels", () => {
    expect(channelsToSend(["in_app", "push", "email"], ["in_app"])).toEqual(["push", "email"]);
    expect(channelsToSend(["in_app", "push", "email"], [])).toEqual(["in_app", "push", "email"]);
    expect(channelsToSend(["in_app"], ["in_app"])).toEqual([]);
  });
  it("stuck after 10 minutes in sending", () => {
    expect(isStuck("2026-11-23T09:49:00Z", now)).toBe(true);
    expect(isStuck("2026-11-23T09:55:00Z", now)).toBe(false);
    expect(isStuck(null, now)).toBe(true);
  });
  it("requeue collision detection", () => {
    expect(isGroupKeyCollision({ code: "23505" })).toBe(true);
    expect(isGroupKeyCollision({ message: 'duplicate key value violates unique constraint "scheduled_notifications_pending_group_uidx"' })).toBe(true);
    expect(isGroupKeyCollision({ code: "42501" })).toBe(false);
    expect(isGroupKeyCollision(null)).toBe(false);
  });
  it("due filter uses the retry time, else the scheduled time", () => {
    expect(dueFilter("T")).toBe("next_attempt_at.lte.T,and(next_attempt_at.is.null,scheduled_at.lte.T)");
  });
  it("backup copies retry with the same backoff and give up after 3", () => {
    expect(backupRetryAt(1, now)).toBe("2026-11-23T10:05:00.000Z");
    expect(backupRetryAt(2, now)).toBe("2026-11-23T10:30:00.000Z");
    expect(backupRetryAt(3, now)).toBeNull();
  });
});
