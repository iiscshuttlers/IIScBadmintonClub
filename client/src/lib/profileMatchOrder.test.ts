import { describe, expect, it } from "vitest";
import { orderProfileMatches } from "@/lib/profileMatchOrder";

type M = {
  id: string;
  fmt: string;
  status: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  court_number?: string | null;
};

const ORDER = ["Singles", "Doubles", "Mixed Doubles"];
const order = (ms: M[]) => orderProfileMatches(ms, (m) => m.fmt, ORDER).map((m) => m.id);

describe("orderProfileMatches", () => {
  it("groups by format in the given order", () => {
    const ms: M[] = [
      { id: "xd", fmt: "Mixed Doubles", status: "completed", ended_at: "2026-08-21T10:00:00Z" },
      { id: "ms", fmt: "Singles", status: "completed", ended_at: "2026-08-01T10:00:00Z" },
      { id: "md", fmt: "Doubles", status: "completed", ended_at: "2026-08-10T10:00:00Z" },
    ];
    expect(order(ms)).toEqual(["ms", "md", "xd"]);
  });

  it("within a format: live, then upcoming, then completed", () => {
    const ms: M[] = [
      { id: "done", fmt: "Singles", status: "completed", ended_at: "2026-11-20T10:00:00Z" },
      { id: "next", fmt: "Singles", status: "scheduled", scheduled_at: "2026-11-23T10:00:00Z" },
      { id: "live", fmt: "Singles", status: "in_progress", started_at: "2026-11-22T09:00:00Z" },
      { id: "wo", fmt: "Singles", status: "walkover", ended_at: "2026-11-21T10:00:00Z" },
    ];
    expect(order(ms)).toEqual(["live", "next", "wo", "done"]);
  });

  it("completed matches are latest first, falling back to scheduled then created time", () => {
    const ms: M[] = [
      { id: "aug19", fmt: "Mixed Doubles", status: "completed", ended_at: "2026-08-19T13:30:00Z" },
      { id: "aug23", fmt: "Mixed Doubles", status: "completed", scheduled_at: "2026-08-23T13:00:00Z" },
      { id: "aug21", fmt: "Mixed Doubles", status: "completed", ended_at: "2026-08-21T16:30:00Z" },
      { id: "created", fmt: "Mixed Doubles", status: "walkover", created_at: "2026-08-20T00:00:00Z" },
    ];
    expect(order(ms)).toEqual(["aug23", "aug21", "created", "aug19"]);
  });

  it("upcoming matches are soonest first, unscheduled last", () => {
    const ms: M[] = [
      { id: "tbd", fmt: "Doubles", status: "scheduled" },
      { id: "later", fmt: "Doubles", status: "scheduled", scheduled_at: "2026-11-25T10:00:00Z" },
      { id: "soon", fmt: "Doubles", status: "scheduled", scheduled_at: "2026-11-23T10:00:00Z" },
    ];
    expect(order(ms)).toEqual(["soon", "later", "tbd"]);
  });

  it("puts unknown formats after the known ones", () => {
    const ms: M[] = [
      { id: "odd", fmt: "Other", status: "completed" },
      { id: "ms", fmt: "Singles", status: "completed" },
    ];
    expect(order(ms)).toEqual(["ms", "odd"]);
  });
});
