import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RegistrationWindow } from "@/lib/registration/window";

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  settings: [] as unknown[],
  windows: {} as Record<string, RegistrationWindow>,
  regRows: [] as unknown[],
  wait: [] as unknown[],
  me: null as string | null,
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/services/tournamentService", () => ({ fetchParticipantsWithDepartments: () => Promise.resolve(state.rows) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: state.me ? { id: state.me } : null }) }));
vi.mock("@/hooks/useRegistration", () => ({
  useRegistrationWindows: () => state.windows,
  useCategorySettings: () => ({ data: state.settings }),
  useRegistrationEntries: () => ({ data: state.regRows }),
  useWaitlistCounts: () => ({ data: state.wait }),
}));

import { LivePlayersSection } from "./LivePlayersSection";

const open: RegistrationWindow = { state: "open", opensAt: null, closesAt: null, lockReason: null, canEdit: true };
const closed: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "deadline", canEdit: false };
const T = { id: "t1", require_app_registration: true, format_family: "OPEN_EVENT", categories: ["MD"], status: "upcoming" };

const row = (id: string, name: string, player_id: string, partner_id: string | null = null) =>
  ({ id, category: "MD", display_name: name, seed: 1, player_id, partner_id, player: { full_name: name, department: null }, partner: null });

function show(visibility: string | null, opts: { showParticipants?: boolean; window?: RegistrationWindow; flagOn?: boolean } = {}) {
  state.settings = [{ category: "MD", entries_visibility: visibility }];
  state.windows = opts.flagOn === false ? {} : { MD: opts.window ?? open };
  return render(
    <LivePlayersSection tournamentId="t1" categories={["MD"]} showParticipants={opts.showParticipants ?? true}
      tournament={opts.flagOn === false ? { ...T, require_app_registration: false } : T} />,
  );
}

beforeEach(() => {
  state.rows = [row("r1", "Asha", "a"), row("r2", "Bala", "b")];
  state.regRows = [];
  state.wait = [];
  state.me = null;
});

describe("Players tab per-category visibility", () => {
  it("as_entered: shows everyone with the status line and waitlist count", async () => {
    state.wait = [{ category: "MD", waiting: 2 }];
    show("as_entered", { showParticipants: false });
    expect(await screen.findByText("Asha")).toBeTruthy();
    expect(screen.getByTestId("category-status").textContent).toBe("Open · 2 entered · 2 on the waitlist");
  });

  it("null inherits show_participants (on)", async () => {
    show(null, { showParticipants: true });
    expect(await screen.findByText("Bala")).toBeTruthy();
  });

  it("null inherits show_participants (off): list hidden", async () => {
    show(null, { showParticipants: false });
    expect(await screen.findByTestId("category-hidden")).toBeTruthy();
    expect(screen.queryByText("Asha")).toBeNull();
  });

  it("after_close: hidden while open, shown once closed", async () => {
    const { unmount } = show("after_close");
    expect((await screen.findByTestId("category-hidden")).textContent).toMatch(/once this category closes/);
    expect(screen.queryByText("Asha")).toBeNull();
    unmount();
    show("after_close", { window: closed });
    expect(await screen.findByText("Asha")).toBeTruthy();
  });

  it("after_draw and hidden keep the list private", async () => {
    const { unmount } = show("after_draw", { window: closed });
    expect((await screen.findByTestId("category-hidden")).textContent).toMatch(/draw is made/);
    unmount();
    show("hidden", { window: closed });
    expect((await screen.findByTestId("category-hidden")).textContent).toMatch(/private/);
  });

  it("a signed-in player always sees their own entry", async () => {
    state.me = "b";
    show("hidden");
    expect(await screen.findByText("Bala")).toBeTruthy();
    expect(screen.queryByText("Asha")).toBeNull();
    expect(screen.getByText("Your entry")).toBeTruthy();
    expect(screen.getByTestId("category-hidden").textContent).toMatch(/Your own entry is shown below/);
  });

  it("marks players looking for a partner", async () => {
    state.regRows = [{ id: "r1", looking_for_partner: true }];
    show("as_entered");
    expect(await screen.findByText("Looking for a partner")).toBeTruthy();
  });

  it("flag off: today's behaviour (no status line)", async () => {
    show("hidden", { flagOn: false, showParticipants: true });
    expect(await screen.findByText("Asha")).toBeTruthy();
    expect(screen.queryByTestId("category-status")).toBeNull();
  });
});
