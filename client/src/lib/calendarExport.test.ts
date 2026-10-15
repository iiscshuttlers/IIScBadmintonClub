import { describe, it, expect } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine, icsDateTime, matchesToEvents, tournamentToEvent } from "./calendarExport";

const NOW = new Date("2026-10-15T08:00:00Z");

describe("calendarExport", () => {
  it("escapes TEXT special characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets with a leading space", () => {
    const folded = foldIcsLine("SUMMARY:" + "x".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].length).toBe(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(" ")).toBe(true);
      expect(p.length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "x".repeat(200));
  });

  it("never splits a multi-byte character when folding", () => {
    const line = "SUMMARY:" + "🏸".repeat(40);
    expect(foldIcsLine(line).replace(/\r\n /g, "")).toBe(line);
  });

  it("formats UTC date-times", () => {
    expect(icsDateTime(new Date("2026-10-15T09:05:03Z"))).toBe("20261015T090503Z");
  });

  it("keeps only upcoming timed matches", () => {
    const events = matchesToEvents(
      [
        { id: "a", status: "scheduled", scheduled_at: "2026-10-16T10:00:00Z", team1_label: "Asha", team2_label: "Ravi", category: "WS", court_number: "3", tournaments: { name: "Spectrum" } },
        { id: "b", status: "completed", scheduled_at: "2026-10-16T11:00:00Z" },
        { id: "c", status: "scheduled", scheduled_at: null },
        { id: "d", status: "scheduled", scheduled_at: "2026-10-01T10:00:00Z" },
      ],
      30,
      NOW,
    );
    expect(events.map((e) => e.uid)).toEqual(["match-a@iiscshuttlers"]);
    expect(events[0].summary).toContain("WS · Asha vs Ravi · Court 3");
    expect(events[0].description).toContain("Spectrum");
  });

  it("builds a valid VCALENDAR with alarm and CRLF endings", () => {
    const [e] = matchesToEvents(
      [{ id: "a", status: "scheduled", scheduled_at: "2026-10-16T10:00:00Z", team1_label: "A", team2_label: "B" }],
      30,
      NOW,
    );
    const ics = buildIcs([e], "Test", NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261016T100000Z");
    expect(ics).toContain("DTEND:20261016T104500Z");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("makes tournaments all-day with an exclusive end date", () => {
    const e = tournamentToEvent({ id: "t1", name: "Invicta", start_date: "2026-11-01", end_date: "2026-11-02" })!;
    const ics = buildIcs([e], "Test", NOW);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261101");
    expect(ics).toContain("DTEND;VALUE=DATE:20261103");
    expect(tournamentToEvent({ id: "t2", name: "X", start_date: null })).toBeNull();
  });
});
