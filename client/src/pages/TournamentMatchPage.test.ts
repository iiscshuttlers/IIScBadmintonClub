import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchVisibleTournamentIdForMatch } from "@/lib/matchRouteVisibility";

const MID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const TID = "3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";

const db = vi.hoisted(() => ({
  match: null as { data: unknown; error: unknown } | null,
  tournament: null as { data: unknown; error: unknown } | null,
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: db.from,
  },
}));

function query(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
}

describe("short match route visibility", () => {
  beforeEach(() => {
    db.match = { data: { tournament_id: TID }, error: null };
    db.tournament = { data: { id: TID }, error: null };
    db.from.mockReset();
    db.from.mockImplementation((table: string) => query(table === "tournament_matches" ? db.match! : db.tournament!));
  });

  it("does not query for an invalid match id", async () => {
    expect(await fetchVisibleTournamentIdForMatch("not-a-uuid")).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("returns the parent id only after the parent is visible", async () => {
    expect(await fetchVisibleTournamentIdForMatch(MID)).toBe(TID);
    expect(db.from).toHaveBeenNthCalledWith(1, "tournament_matches");
    expect(db.from).toHaveBeenNthCalledWith(2, "tournaments");
  });

  it("does not reveal the parent id when its RLS lookup returns no row", async () => {
    db.tournament = { data: null, error: null };
    expect(await fetchVisibleTournamentIdForMatch(MID)).toBeNull();
  });

  it("keeps a server failure distinct from not-found", async () => {
    db.match = { data: null, error: new Error("offline") };
    await expect(fetchVisibleTournamentIdForMatch(MID)).rejects.toThrow("offline");
  });
});
