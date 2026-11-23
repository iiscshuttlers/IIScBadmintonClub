import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase";
import {
  fetchCategorySettings, fetchMyRegistration, fetchOrganiserRegistration, fetchRegistrationEntries, fetchWaitlistCounts,
  isRegistrationFlagOn, organiserSaveEntry, registrationError, saveMyEntries, sendEntryReminders, setCategoryLock,
  withdrawMyEntry,
} from "./registrationEntries";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const from = vi.mocked(supabase.from);
const rpc = vi.mocked(supabase.rpc);

const on = { id: "t1", require_app_registration: true, format_family: "OPEN_EVENT", categories: ["MD"] };
const off = { id: "t2", require_app_registration: false, categories: ["MD"] };

/** A chainable query stub that resolves to `result` at the end of any chain. */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "order", "contains", "limit"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

describe("flag off makes no calls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isRegistrationFlagOn", () => {
    expect(isRegistrationFlagOn(on)).toBe(true);
    expect(isRegistrationFlagOn(off)).toBe(false);
    expect(isRegistrationFlagOn({ require_app_registration: true, format_family: "TEAM" })).toBe(false);
    expect(isRegistrationFlagOn(null)).toBe(false);
  });

  it("every tournament read returns empty without touching Supabase", async () => {
    await expect(fetchCategorySettings(off)).resolves.toEqual([]);
    await expect(fetchRegistrationEntries(off)).resolves.toEqual([]);
    await expect(fetchWaitlistCounts(off)).resolves.toEqual([]);
    await expect(fetchMyRegistration(off, "p1")).resolves.toMatchObject({ entries: [], requests: [] });
    await expect(fetchOrganiserRegistration(off)).resolves.toMatchObject({ waitlist: [], withdrawals: [] });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no player id: no calls either", async () => {
    await expect(fetchMyRegistration(on, null)).resolves.toMatchObject({ entries: [] });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("reads with the flag on", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads category settings for the tournament", async () => {
    const q = chain({ data: [{ category: "MD", locked_at: null }], error: null });
    from.mockReturnValue(q as never);
    await expect(fetchCategorySettings(on)).resolves.toEqual([{ category: "MD", locked_at: null }]);
    expect(from).toHaveBeenCalledWith("tournament_category_settings");
    expect(q.eq).toHaveBeenCalledWith("tournament_id", "t1");
  });

  it("never selects the participant email", async () => {
    const q = chain({ data: [], error: null });
    from.mockReturnValue(q as never);
    await fetchRegistrationEntries(on);
    const cols = (q.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(cols.split(",").map((c) => c.trim())).not.toContain("email");
  });

  it("surfaces read errors", async () => {
    from.mockReturnValue(chain({ data: null, error: { message: "permission denied for table x" } }) as never);
    await expect(fetchCategorySettings(on)).rejects.toThrow("permission denied");
  });

  it("summarises the backup outbox", async () => {
    from.mockImplementation(((table: string) => chain(
      table === "tournament_backup_outbox"
        ? { data: [{ sent_at: "x", attempts: 1 }, { sent_at: null, attempts: 3 }, { sent_at: null, attempts: 0 }], error: null }
        : { data: [], error: null },
    )) as never);
    await expect(fetchOrganiserRegistration(on)).resolves.toMatchObject({ backup: { copied: 1, failed: 1, pending: 1 } });
  });
});

describe("RPC payloads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("save sends the entries list and returns the results", async () => {
    rpc.mockResolvedValue({ data: { results: [{ category: "MD", status: "taken", with_name: "Asha" }] }, error: null } as never);
    const res = await saveMyEntries("t1", [{ category: "MD", partner_id: "c" }]);
    expect(rpc).toHaveBeenCalledWith("save_my_tournament_entries", { p_tournament_id: "t1", p_entries: [{ category: "MD", partner_id: "c" }] });
    expect(res[0]).toMatchObject({ status: "taken", with_name: "Asha" });
  });

  it("withdraw and lock map their arguments", async () => {
    rpc.mockResolvedValue({ data: { status: "withdrawn" }, error: null } as never);
    await withdrawMyEntry("t1", "MD");
    expect(rpc).toHaveBeenLastCalledWith("withdraw_my_entry", { p_tournament_id: "t1", p_category: "MD" });
    await setCategoryLock("t1", "MD", false, "2026-12-01T12:00:00Z");
    expect(rpc).toHaveBeenLastCalledWith("set_category_lock", { p_tournament_id: "t1", p_category: "MD", p_locked: false, p_new_closes_at: "2026-12-01T12:00:00Z" });
  });

  it("organiser save passes nulls for missing fields", async () => {
    rpc.mockResolvedValue({ data: { status: "saved", warnings: [] }, error: null } as never);
    await organiserSaveEntry({ tournamentId: "t1", category: "MD", playerId: "a" });
    expect(rpc).toHaveBeenCalledWith("organiser_save_entry", {
      p_tournament_id: "t1", p_category: "MD", p_participant_id: null, p_player_id: "a", p_partner_id: null, p_guest_partner: null,
    });
  });

  it("reminders: empty id list and blank note become null", async () => {
    rpc.mockResolvedValue({ data: { reminded: 0, skipped: [], no_email: 0, refused_categories: [], capped: false }, error: null } as never);
    await sendEntryReminders({ tournamentId: "t1", kind: "no_partner", playerIds: [], note: "  " });
    expect(rpc).toHaveBeenCalledWith("send_entry_reminders", {
      p_tournament_id: "t1", p_category: null, p_kind: "no_partner", p_player_ids: null, p_note: null,
    });
  });

  it("turns RPC errors into readable messages", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "registration_forbidden: organisers only" } } as never);
    await expect(setCategoryLock("t1", "MD", true)).rejects.toThrow("Only the tournament's organisers can do that. (organisers only)");
  });
});

describe("registrationError", () => {
  it("passes unknown messages through", () => {
    expect(registrationError({ message: "boom" }).message).toBe("boom");
    expect(registrationError(null).message).toBe("Something went wrong");
    expect(registrationError({ message: "registration_sign_in: x" }).message).toBe("Sign in and set up your profile to enter. (x)");
  });
});
