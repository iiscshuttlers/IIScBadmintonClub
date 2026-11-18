import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { computeForm, type FormRow } from "@/services/formService";

function row(p: Partial<FormRow>): FormRow {
  return {
    id: "m",
    tournament_id: "t",
    category: "MS",
    match_code: null,
    round_name: "Final",
    team1_label: "Asha",
    team2_label: "Bala",
    player1_id: "a",
    player2_id: "b",
    player3_id: null,
    player4_id: null,
    winner_side: 1,
    status: "completed",
    ended_at: "2026-08-20T10:00:00Z",
    scheduled_at: null,
    created_at: null,
    ...p,
  };
}

describe("computeForm", () => {
  it("gives each side its own result and opponent", () => {
    const f = computeForm([row({})], ["a", "b"], 5);
    expect(f.a[0]).toMatchObject({ result: "W", opponentLabel: "Bala", eventLabel: "MS · Final", walkover: false });
    expect(f.b[0]).toMatchObject({ result: "L", opponentLabel: "Asha" });
  });

  it("orders newest first, falling back to scheduled time, and caps at n", () => {
    const f = computeForm(
      [
        row({ id: "old", ended_at: "2026-08-01T10:00:00Z" }),
        row({ id: "new", ended_at: null, scheduled_at: "2026-09-01T10:00:00Z" }),
        row({ id: "mid", ended_at: "2026-08-15T10:00:00Z" }),
      ],
      ["a"],
      2,
    );
    expect(f.a.map((e) => e.matchId)).toEqual(["new", "mid"]);
  });

  it("counts walkovers but skips cancelled, BYEs and missing winners", () => {
    const f = computeForm(
      [
        row({ id: "wo", status: "walkover", winner_side: 2 }),
        row({ id: "cx", status: "cancelled" }),
        row({ id: "bye", team2_label: "BYE" }),
        row({ id: "nw", winner_side: null }),
      ],
      ["a"],
      5,
    );
    expect(f.a).toHaveLength(1);
    expect(f.a[0]).toMatchObject({ matchId: "wo", result: "L", walkover: true });
  });

  it("attributes doubles results to partners on the same side", () => {
    const f = computeForm(
      [row({ category: "XD", player3_id: "c", player4_id: "d", team1_label: "A / C", team2_label: "B / D", winner_side: 2 })],
      ["c", "d", "z"],
      5,
    );
    expect(f.c[0].result).toBe("L");
    expect(f.d[0].result).toBe("W");
    expect(f.z).toEqual([]);
  });
});
