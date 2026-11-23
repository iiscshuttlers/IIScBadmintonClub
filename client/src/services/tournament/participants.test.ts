import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import { bulkImportParticipants, updateTournamentParticipants } from "./participants";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const from = vi.mocked(supabase.from);
const rpc = vi.mocked(supabase.rpc);

describe("updateTournamentParticipants", () => {
  beforeEach(() => vi.clearAllMocks());

  it("attempts every update and throws if any failed", async () => {
    const eq = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } })
      .mockResolvedValueOnce({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update } as never);

    await expect(
      updateTournamentParticipants([
        { id: "a", patch: { seed: 1 } },
        { id: "b", patch: { seed: 2 } },
        { id: "c", patch: { seed: 3 } },
      ]),
    ).rejects.toThrow("1 of 3 participant updates failed: permission denied");
    expect(update).toHaveBeenCalledTimes(3);
  });

  it("resolves when every update succeeds", async () => {
    from.mockReturnValue({ update: () => ({ eq: async () => ({ error: null }) }) } as never);
    await expect(updateTournamentParticipants([{ id: "a", patch: { seed: 1 } }])).resolves.toBeUndefined();
  });
});

describe("bulkImportParticipants", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockTable = (insertResults: Array<{ error: { message: string } | null }>) => {
    const insert = vi.fn();
    insertResults.forEach((r) => insert.mockResolvedValueOnce(r));
    const select = () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) });
    from.mockReturnValue({ select, insert } as never);
    return insert;
  };

  it("keeps importing after a failed row and names what did not import", async () => {
    const insert = mockTable([{ error: null }, { error: { message: "duplicate entry" } }, { error: null }]);
    rpc.mockResolvedValue({ error: null } as never);

    await expect(
      bulkImportParticipants({
        tournamentId: "t1",
        category: "MS",
        entries: [
          { playerId: "p1", partnerId: null, displayName: "Asha", seed: null, email: null },
          { playerId: "p2", partnerId: null, displayName: "Bela", seed: null, email: null },
          { playerId: "p3", partnerId: null, displayName: "Chitra", seed: null, email: null },
        ],
      }),
    ).rejects.toThrow("Imported 2 of 3. Not imported: Bela (duplicate entry)");
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("marks fallback-form rows source 'form' only when asked", async () => {
    const insert = mockTable([{ error: null }, { error: null }]);
    const entry = { playerId: "p1", partnerId: null, displayName: "Asha", seed: null, email: null };
    await bulkImportParticipants({ tournamentId: "t1", category: "MS", entries: [entry], source: "form" });
    await bulkImportParticipants({ tournamentId: "t1", category: "MS", entries: [entry] });
    expect(insert.mock.calls[0][0]).toMatchObject({ source: "form" });
    expect(insert.mock.calls[1][0]).not.toHaveProperty("source");
  });

  it("does not fail an entry when filling a contact number fails", async () => {
    mockTable([{ error: null }]);
    rpc.mockResolvedValue({ error: { message: "rpc down" } } as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      bulkImportParticipants({
        tournamentId: "t1",
        category: "MS",
        entries: [{ playerId: "p1", partnerId: null, displayName: "Asha", seed: 1, email: null, phone1: "9999999999" }],
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stops before inserting when the existing entries can't be read", async () => {
    const insert = vi.fn();
    from.mockReturnValue({
      select: () => ({ eq: () => ({ eq: async () => ({ data: null, error: { message: "offline" } }) }) }),
      insert,
    } as never);
    await expect(
      bulkImportParticipants({ tournamentId: "t1", category: "MS", entries: [] }),
    ).rejects.toMatchObject({ message: "offline" });
    expect(insert).not.toHaveBeenCalled();
  });
});
