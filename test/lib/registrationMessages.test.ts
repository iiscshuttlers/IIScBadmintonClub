import { describe, expect, it } from "vitest";
import {
  BACKUP_CSV_HEADER, REGISTRATION_KINDS, backupEmailBody, backupEmailSubject, buildRegistrationNotice,
  backupAction, categoryLabel, closingTomorrowText, csvRow, digestBody, digestCsv, digestSubject, formatIST, incompleteEntryText, registrationEmail, shareText,
} from "../../supabase/functions/_shared/registrationMessages";

const base = { tournament_name: "IISc Open 2026", category: "MD" };

describe("formatIST", () => {
  it("shows India time", () => {
    // 12:30 UTC = 6 PM IST, a Friday.
    expect(formatIST("2026-11-27T12:30:00Z")).toBe("Fri 27 Nov, 6 PM");
    expect(formatIST("2026-11-27T12:45:00Z")).toBe("Fri 27 Nov, 6:15 PM");
    // 20:00 UTC Friday = 1:30 AM Saturday in India.
    expect(formatIST("2026-11-27T20:00:00Z")).toBe("Sat 28 Nov, 1:30 AM");
    expect(formatIST("2026-11-27T12:30:00Z", { withYear: true })).toBe("Fri 27 Nov 2026, 6 PM");
  });
  it("is empty for nothing", () => {
    expect(formatIST(null)).toBe("");
    expect(formatIST("not a date")).toBe("");
  });
});

describe("buildRegistrationNotice", () => {
  it("has a text for every kind", () => {
    for (const kind of REGISTRATION_KINDS) {
      const n = buildRegistrationNotice({ ...base, kind, actor_name: "Asha" });
      expect(n.title.length).toBeGreaterThan(3);
      expect(n.body).not.toMatch(/undefined|null/);
    }
  });

  it("tells the partner who entered them", () => {
    expect(buildRegistrationNotice({ ...base, kind: "entered_as_partner", actor_name: "Ravi" }).body)
      .toBe("Ravi entered you as their partner in Men's Doubles at IISc Open 2026. Open My entry to see or change it.");
  });

  it("adds the organiser note to manual reminders only", () => {
    const manual = buildRegistrationNotice({ ...base, kind: "incomplete_entry_manual", reason: "no_partner", note: "Draw on Sunday" });
    expect(manual.body).toContain("Note from the organiser: Draw on Sunday");
    const auto = buildRegistrationNotice({ ...base, kind: "incomplete_entry_auto", reason: "no_partner", note: "x" });
    expect(auto.body).not.toContain("Note from");
  });

  it("caps the organiser note at 200 characters", () => {
    const n = buildRegistrationNotice({ ...base, kind: "incomplete_entry_manual", note: "x".repeat(300) });
    expect(n.body.match(/x+$/)?.[0].length).toBe(200);
  });

  it("summarises the day for hosts", () => {
    expect(buildRegistrationNotice({ ...base, kind: "daily_summary", summary: { entries: 14, new_entries: 3, no_partner: 2, shared: 1 } }).body)
      .toBe("14 entries · 3 new today · 2 without a partner · 1 shared partner.");
  });

  it("falls back for unknown kinds", () => {
    expect(buildRegistrationNotice({ kind: "mystery" }).title).toBe("Registration update: the tournament");
  });
});

describe("reminder texts", () => {
  it("no partner, with the IST deadline", () => {
    expect(incompleteEntryText({ ...base, kind: "x", reason: "no_partner", deadline: "2026-11-27T12:30:00Z" }))
      .toBe("You're entered in Men's Doubles without a partner. Pick a partner before Fri 27 Nov, 6 PM, or turn on 'Looking for a partner'.");
  });
  it("no partner, already looking", () => {
    expect(incompleteEntryText({ ...base, kind: "x", reason: "no_partner", looking: true })).toContain("open My entry to see the others looking");
  });
  it("the shared player", () => {
    expect(incompleteEntryText({ ...base, kind: "x", reason: "shared_player", pair_names: ["A", "B"] }))
      .toBe("You're entered in two Men's Doubles pairs (with A and B). Open My entry and leave the pair you're not playing in.");
  });
  it("the pairs sharing a player", () => {
    expect(incompleteEntryText({ ...base, kind: "x", reason: "shared_pair", partner_name: "C", other_name: "B" }))
      .toBe("Your partner C is also entered with B in Men's Doubles. Check with C, or pick another partner.");
  });
});

describe("email", () => {
  it("subject names the tournament; text has the link", () => {
    const e = registrationEmail({ ...base, kind: "partner_left", actor_name: "Ravi" }, "https://example.org/x");
    expect(e.subject).toBe("[IISc Open 2026] Your partner left your Men's Doubles pair");
    expect(e.text).toContain("Open: https://example.org/x");
  });
});

describe("share kit", () => {
  const cats = [
    { category: "MD", closesAt: "2026-11-27T12:30:00Z", state: "open" },
    { category: "XD", closesAt: null, state: "locked" },
  ];
  it("lists open categories with deadlines", () => {
    const t = shareText("IISc Open", cats, "https://x/t");
    expect(t).toContain("• Men's Doubles (closes Fri 27 Nov, 6 PM)");
    expect(t).not.toContain("Mixed");
    expect(t).toContain("https://x/t");
  });
  it("closing tomorrow lists still-open categories", () => {
    expect(closingTomorrowText("IISc Open", cats, "l")).toContain("Men's Doubles: closes Fri 27 Nov, 6 PM");
  });
});

describe("backup", () => {
  it("subject and Field: value body", () => {
    expect(backupEmailSubject("IISc Open", "Asha", "entered")).toBe("[Registration] IISc Open — Asha — entered");
    expect(backupEmailBody({ Category: "MD", Partner: "Ravi\nK", Phone: null })).toBe("Category: MD\nPartner: Ravi K\nPhone: ");
  });
  it("CSV escapes quotes, commas and formulas", () => {
    expect(csvRow(["a,b", 'say "hi"', "=SUM(A1)", null, 3])).toBe('"a,b","say ""hi""",\'=SUM(A1),,3');
    expect(BACKUP_CSV_HEADER[0]).toBe("Time (IST)");
  });
  it("labels categories", () => {
    expect(categoryLabel("xd")).toBe("Mixed Doubles");
    expect(categoryLabel("U19 BD")).toBe("U19 BD");
  });
});

describe("daily CSV digest", () => {
  const ev = (over: Record<string, unknown>) => ({
    created_at: "2026-11-23T10:00:00Z", tournament: "Open 2026", category: "MD", action: "entered",
    after: { player_name: "Asha", partner_name: "Bela", by: "player" }, before: null, ...over,
  });
  it("maps actions like the per-entry copy", () => {
    expect(["entered", "waitlisted", "promoted", "left", "withdrawn", "partner_changed"].map(backupAction))
      .toEqual(["entered", "entered", "entered", "left", "withdrawn", "changed"]);
  });
  it("writes the header, sorts oldest first, guards formulas and uses CRLF", () => {
    const csv = digestCsv([
      ev({ created_at: "2026-11-23T12:00:00Z", action: "left", after: null, before: { player_name: "=Chitra" } }),
      ev({ player_email: "a@x", player_phone: "98", partner_phone: "99" }),
      ev({ after: { player_name: "Dev", by: "organiser" } }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Time (IST),Tournament,Category,Action,Player,Player email,Player phone,Partner,Partner phone,Source,By");
    expect(lines[1]).toContain(",Open 2026,MD (Men's Doubles),entered,Asha,a@x,98,Bela,99,app,player");
    expect(lines[2]).toContain(",entered,Dev,,,,,organiser,organiser");
    expect(lines[3]).toContain(",left,'=Chitra,");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("subject and body", () => {
    expect(digestSubject("2026-11-23", 1)).toBe("[Registration digest] 2026-11-23 — 1 change");
    expect(digestSubject("2026-11-23", 3)).toBe("[Registration digest] 2026-11-23 — 3 changes");
    expect(digestBody("2026-11-23", { "Open 2026": 3, "Ladder": 1 })).toContain("Ladder: 1\nOpen 2026: 3");
  });
});
