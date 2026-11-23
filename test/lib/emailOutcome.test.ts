import { describe, it, expect } from "vitest";
import { emailOutcome, escapeHtml, rejectionMessage } from "../../supabase/functions/_shared/emailOutcome";

describe("emailOutcome", () => {
  it("reports nothing when there was nobody to email", () => {
    expect(emailOutcome(0, [], true)).toEqual({ total: 0, failed: 0, allFailed: false, note: null });
    // Opted-out recipients are not a failure, even without SMTP.
    expect(emailOutcome(0, [], false).allFailed).toBe(false);
  });

  it("is clean when every email was accepted", () => {
    expect(emailOutcome(3, [], true)).toEqual({ total: 3, failed: 0, allFailed: false, note: null });
  });

  it("fails the row when SMTP is not configured", () => {
    expect(emailOutcome(5, [], false)).toEqual({
      total: 5,
      failed: 5,
      allFailed: true,
      note: "email: SMTP credentials unavailable",
    });
  });

  it("fails the row when the server rejects every email", () => {
    const o = emailOutcome(2, ["535 Authentication failed", "535 Authentication failed"], true);
    expect(o.allFailed).toBe(true);
    expect(o.note).toBe("email: 2/2 failed: 535 Authentication failed");
  });

  it("keeps the row sent with a note when only some emails fail", () => {
    const o = emailOutcome(129, ["421 Too many\n  connections", "421 Too many connections"], true);
    expect(o.allFailed).toBe(false);
    expect(o.failed).toBe(2);
    expect(o.note).toBe("email: 2/129 failed: 421 Too many connections");
  });

  it("caps the note so it fits the error column", () => {
    const o = emailOutcome(1, ["x".repeat(1000)], true);
    expect(o.note!.length).toBe(300);
  });
});

describe("rejectionMessage", () => {
  it("reads errors, strings and error-like objects", () => {
    expect(rejectionMessage(new Error("ECONNREFUSED"))).toBe("ECONNREFUSED");
    expect(rejectionMessage("timeout")).toBe("timeout");
    expect(rejectionMessage({ message: "550 mailbox unavailable" })).toBe("550 mailbox unavailable");
    expect(rejectionMessage(42)).toBe("42");
  });
});

describe("escapeHtml", () => {
  it("shows organiser text as typed", () => {
    expect(escapeHtml(`Court 2 < 5pm & "bring" shuttles' <b>`)).toBe(
      "Court 2 &lt; 5pm &amp; &quot;bring&quot; shuttles&#39; &lt;b&gt;",
    );
  });
});
