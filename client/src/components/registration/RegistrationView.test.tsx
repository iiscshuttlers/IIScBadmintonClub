import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RegistrationWindow } from "@/lib/registration/window";

const state = vi.hoisted(() => ({
  windows: {} as Record<string, RegistrationWindow>,
  rows: [] as unknown[],
  attention: { noPartner: [] as unknown[], sharedPartner: [] as unknown[], partnerNotOnApp: [] as unknown[], genderMismatch: [], genderUnknown: [] },
  conflicts: [] as unknown[],
  org: { waitlist: [] as unknown[], withdrawals: [] as unknown[], backup: { copied: 3, failed: 1, pending: 0 } },
}));
const services = vi.hoisted(() => ({
  setCategoryLock: vi.fn(() => Promise.resolve({ status: "locked" })),
  setCategorySettings: vi.fn(() => Promise.resolve({ status: "saved" })),
  setRegistrationTimeline: vi.fn(() => Promise.resolve({ status: "saved" })),
  organiserSaveEntry: vi.fn(() => Promise.resolve({ status: "saved", warnings: [] })),
  organiserRemoveEntry: vi.fn(() => Promise.resolve({ status: "removed" })),
  promoteFromWaitlist: vi.fn(),
  resolveWithdrawalRequest: vi.fn(() => Promise.resolve({ status: "walkover" })),
  sendEntryReminders: vi.fn(() => Promise.resolve({
    reminded: 1, no_email: 0, refused_categories: [], capped: false,
    skipped: [{ player_id: "g", name: "Guest Gita", reason: "not_on_app", payload: { kind: "incomplete_entry_manual", category: "MD", reason: "no_partner" } },
              { player_id: "d", name: "Dev", reason: "reminded_recently" }],
  })),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/tournament/registrationEntries", () => services);
vi.mock("@/hooks/useRegistration", () => ({
  useRegistrationWindows: () => state.windows,
  useCategorySettings: () => ({ data: [] }),
  useRegistrationEntries: () => ({ data: state.rows }),
  useRegistrationAttention: () => ({ data: state.attention }),
  usePartnerConflicts: () => ({ data: state.conflicts }),
  useOrganiserRegistration: () => ({ data: state.org }),
  usePickerPlayers: () => ({ data: [{ id: "a", full_name: "Asha", gender: "Male" }, { id: "b", full_name: "Bala", gender: "Male" }] }),
  useRegistrationMutation: (_t: string, fn: (a: unknown) => Promise<unknown>) => ({
    isPending: false,
    mutate: (args: unknown, opts?: { onSuccess?: (r: unknown) => void }) => Promise.resolve(fn(args)).then((r) => opts?.onSuccess?.(r)),
  }),
}));

import { RegistrationView } from "./RegistrationView";
import { reminderSummary } from "./RegistrationReminderSheet";

const open: RegistrationWindow = { state: "open", opensAt: null, closesAt: "2026-11-27T12:30:00Z", lockReason: null, canEdit: true };
const locked: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "manual", canEdit: false };
const drawn: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "draw", canEdit: false };
const T = { id: "t1", name: "Winter Open", categories: ["MD"], require_app_registration: true, status: "upcoming" };

const entry = (id: string, player: [string, string, boolean?], partner: [string, string, boolean?] | null) => ({
  id, tournament_id: "t1", category: "MD", player_id: player[0], partner_id: partner?.[0] ?? null, display_name: null, seed: 1,
  created_at: "2026-11-20T10:00:00Z", source: "app", looking_for_partner: false,
  player: { full_name: player[1], is_guest: !!player[2] }, partner: partner ? { full_name: partner[1], is_guest: !!partner[2] } : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.windows = { MD: open };
  state.rows = [entry("r1", ["d", "Dev"], null), entry("r2", ["g", "Guest Gita", true], null), entry("r3", ["a", "Asha"], ["c", "Chitra"]), entry("r4", ["b", "Bala"], ["c", "Chitra"])];
  state.attention = {
    noPartner: [{ row_id: "r1", category: "MD", player_id: "d", looking: false }, { row_id: "r2", category: "MD", player_id: "g", looking: false }],
    sharedPartner: [{ category: "MD", shared_player_id: "c", row_ids: ["r3", "r4"], other_player_ids: ["a", "b"] }],
    partnerNotOnApp: [], genderMismatch: [], genderUnknown: [],
  };
  state.conflicts = [];
  state.org = { waitlist: [], withdrawals: [], backup: { copied: 3, failed: 1, pending: 0 } };
});

describe("RegistrationView", () => {
  it("shows backup status and category counts", () => {
    render(<RegistrationView tournament={T} />);
    expect(screen.getByText(/Backup copies: 3 copied, 1 failed/)).toBeTruthy();
    expect(within(screen.getByTestId("category-row-MD")).getByText("2 no partner · 1 shared", { exact: false })).toBeTruthy();
  });

  it("locks and unlocks a category", () => {
    const { unmount } = render(<RegistrationView tournament={T} />);
    fireEvent.click(within(screen.getByTestId("category-row-MD")).getByText("Lock"));
    expect(services.setCategoryLock).toHaveBeenCalledWith("t1", "MD", true);
    unmount();
    state.windows = { MD: locked };
    render(<RegistrationView tournament={T} />);
    fireEvent.click(within(screen.getByTestId("category-row-MD")).getByText("Unlock"));
    expect(services.setCategoryLock).toHaveBeenCalledWith("t1", "MD", false, null);
  });

  it("filters entries and edits after the lock", () => {
    state.windows = { MD: locked };
    render(<RegistrationView tournament={T} />);
    fireEvent.click(screen.getByText("Shared partner (1)"));
    const list = screen.getByTestId("entries-list");
    expect(within(list).getByText("Asha & Chitra")).toBeTruthy();
    expect(within(list).queryByText("Dev")).toBeNull();
    // Organiser add works while locked.
    fireEvent.click(screen.getByText("Add entry"));
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("Partner"), { target: { value: "b" } });
    fireEvent.click(screen.getByText("Save"));
    expect(services.organiserSaveEntry).toHaveBeenCalledWith({ tournamentId: "t1", category: "MD", playerId: "a", partnerId: "b" });
  });

  it("duplicates banner names the shared player", () => {
    state.conflicts = [{ category: "MD", shared_player_id: "c", shared_name: "Chitra", row_ids: ["r3", "r4"], other_names: ["Asha", "Bala"], first_seen_at: null }];
    render(<RegistrationView tournament={T} />);
    expect(screen.getByTestId("duplicates-banner").textContent).toContain("Chitra is in 2 Men's Doubles pairs (with Asha and Bala)");
  });

  it("reminder sheet: recipients, guest WhatsApp copy, preview with note, result counts", async () => {
    render(<RegistrationView tournament={T} />);
    fireEvent.click(screen.getByText("No partner (2)"));
    fireEvent.click(screen.getByText("Remind (2)"));
    const sheet = screen.getByRole("dialog", { name: "Remind players" });
    expect(within(sheet).getByTestId("reminder-recipients").textContent).toBe("Dev");
    expect(within(sheet).getByText("Guest Gita: not on the app")).toBeTruthy();
    expect(within(sheet).getByText("Every open category · In-app, push and email")).toBeTruthy();
    fireEvent.change(within(sheet).getByRole("textbox"), { target: { value: "Draw on Sunday" } });
    expect(within(sheet).getByTestId("reminder-preview").textContent).toContain("Note from the organiser: Draw on Sunday");
    fireEvent.click(within(sheet).getByText("Remind 1"));
    expect(services.sendEntryReminders).toHaveBeenCalledWith({ tournamentId: "t1", kind: "no_partner", category: null, playerIds: ["d", "g"], note: "Draw on Sunday" });
    expect(await within(sheet).findByText(/Reminded 1 · skipped 1 · 1 not on the app/)).toBeTruthy();
    expect(within(sheet).getByText("Copy WhatsApp message for Guest Gita")).toBeTruthy();
  });

  it("reminder sheet is off for a locked category", () => {
    state.windows = { MD: locked };
    render(<RegistrationView tournament={T} />);
    fireEvent.click(within(screen.getByTestId("entries-list")).getAllByText("Remind")[0]);
    expect(screen.getByText("This category is locked, so reminders are off.")).toBeTruthy();
  });

  it("late withdrawal: walkover after the draw, remove before", () => {
    state.org.withdrawals = [{ id: "w1", category: "MD", player_ids: ["a", "c"], status: "pending", reason: "injured" }];
    state.windows = { MD: drawn };
    const { unmount } = render(<RegistrationView tournament={T} />);
    fireEvent.click(screen.getByText("Give walkover"));
    expect(services.resolveWithdrawalRequest).toHaveBeenCalledWith("w1", "walkover");
    unmount();
    state.windows = { MD: locked };
    state.org.withdrawals = [{ id: "w2", category: "MD", player_ids: ["a"], status: "waiting_opponent", reason: null }];
    render(<RegistrationView tournament={T} />);
    expect(screen.getByText("Walkover will apply when the opponent is known.")).toBeTruthy();
    fireEvent.click(screen.getByText("Remove entry"));
    expect(services.resolveWithdrawalRequest).toHaveBeenCalledWith("w2", "remove");
  });
});

describe("reminderSummary", () => {
  it("counts reminded, recent skips and guests", () => {
    expect(reminderSummary({ reminded: 5, no_email: 0, refused_categories: [], capped: false,
      skipped: [{ player_id: "1", name: null, reason: "reminded_recently" }, { player_id: "2", name: null, reason: "reminded_recently" }, { player_id: "3", name: null, reason: "not_on_app" }] }))
      .toBe("Reminded 5 · skipped 2 · 1 not on the app");
  });
});
