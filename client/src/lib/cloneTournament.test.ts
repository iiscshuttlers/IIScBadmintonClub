import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { buildClonePayload, cloneName } from "./cloneTournament";

describe("cloneTournament", () => {
  it("rolls the year forward or appends (copy)", () => {
    expect(cloneName("Invicta 2025", 2026)).toBe("Invicta 2026");
    expect(cloneName("Open Tournament August 2026", 2026)).toBe("Open Tournament August 2026 (copy)");
    expect(cloneName("Spectrum (copy)", 2026)).toBe("Spectrum (copy)");
  });

  it("copies settings but never people, dates, links or status", () => {
    const p = buildClonePayload(
      {
        id: "t1", name: "Invicta 2024", status: "archived", start_date: "2024-05-01", form_url: "https://x",
        archived_at: "2024-06-01", categories: ["MS"], counts_for_elo: true, tie_format_config: { a: 1 },
      },
      "me",
    );
    expect(p).toMatchObject({ status: "draft", created_by: "me", categories: ["MS"], counts_for_elo: true, tie_format_config: { a: 1 } });
    expect(p).not.toHaveProperty("id");
    expect(p).not.toHaveProperty("start_date");
    expect(p).not.toHaveProperty("form_url");
    expect(p).not.toHaveProperty("archived_at");
  });
});
