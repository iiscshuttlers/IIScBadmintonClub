import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RegistrationWindow } from "@/lib/registration/window";

const state = vi.hoisted(() => ({
  windows: {} as Record<string, RegistrationWindow>,
  mine: { entries: [] as unknown[], waitlist: [], requests: [] as unknown[], withdrawals: [] as unknown[], events: [] },
  positions: [] as { category: string; waitlist_position: number }[],
  rows: [] as unknown[],
  players: [] as unknown[],
  mutate: vi.fn(),
}));
const services = vi.hoisted(() => ({
  saveMyEntries: vi.fn(),
  answerPartnerRequest: vi.fn(),
  requestPartner: vi.fn(),
  leaveMyPair: vi.fn(),
  withdrawMyEntry: vi.fn(),
  requestLateWithdrawal: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("wouter", () => ({ Link: ({ href, children, onClick, className }: { href: string; children: unknown; onClick?: () => void; className?: string }) =>
  <a href={href} onClick={onClick} className={className}>{children as never}</a> }));
vi.mock("@/services/tournament/registrationEntries", () => services);
vi.mock("@/hooks/useRegistration", () => ({
  useRegistrationWindows: () => state.windows,
  useMyRegistration: () => ({ data: state.mine }),
  useMyWaitlistPositions: () => ({ data: state.positions }),
  useRegistrationEntries: () => ({ data: state.rows }),
  usePickerPlayers: () => ({ data: state.players }),
  // Run the mutation function at once and hand its result to onSuccess.
  useRegistrationMutation: (_t: string, fn: (a: unknown) => Promise<unknown>) => ({
    isPending: false,
    mutate: (args: unknown, opts?: { onSuccess?: (r: unknown) => void }) => {
      state.mutate(args);
      return Promise.resolve(fn(args)).then((r) => opts?.onSuccess?.(r));
    },
  }),
}));

import { MyEntryPanel } from "./MyEntryPanel";

const open: RegistrationWindow = { state: "open", opensAt: null, closesAt: "2026-11-27T12:30:00Z", lockReason: null, canEdit: true };
const locked: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "manual", canEdit: false };
const T = { id: "t1", name: "Winter Open", categories: ["MS", "MD"], require_app_registration: true, status: "upcoming" };
const ME = "me";

function renderPanel(extra: Partial<Parameters<typeof MyEntryPanel>[0]> = {}) {
  return render(<MyEntryPanel tournament={T} playerId={ME} playerGender="Male" signedIn {...extra} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.windows = { MS: open, MD: open };
  state.mine = { entries: [], waitlist: [], requests: [], withdrawals: [], events: [] };
  state.positions = [];
  state.rows = [];
  state.players = [];
});

describe("MyEntryPanel", () => {
  it("signed out: asks to sign in and remembers My entry as the return address", () => {
    render(<MyEntryPanel tournament={T} playerId={null} signedIn={false} initialCategory="MD" />);
    fireEvent.click(screen.getByText("Sign in to enter", { selector: "a" }));
    expect(sessionStorage.getItem("return_url")).toBe("/tournaments/t1?panel=my-entry&cat=MD");
  });

  it("no entry: offers Enter (singles) and partner choices (doubles)", () => {
    renderPanel();
    const ms = screen.getByTestId("entry-card-MS");
    expect(within(ms).getByText("Not entered")).toBeTruthy();
    expect(within(ms).getByText("Open · closes Fri 27 Nov, 6 PM")).toBeTruthy();
    fireEvent.click(within(ms).getByText("Enter"));
    expect(services.saveMyEntries).toHaveBeenCalledWith("t1", [{ category: "MS" }]);
    const md = screen.getByTestId("entry-card-MD");
    expect(within(md).getByText("Enter with a partner")).toBeTruthy();
    expect(within(md).getByText("Enter alone, looking for a partner")).toBeTruthy();
  });

  it("taken partner: explains who they're entered with and offers Ask", async () => {
    services.saveMyEntries.mockResolvedValue([{ category: "MD", status: "taken", partner_id: "c", with_player_id: "a", with_name: "Asha" }]);
    state.players = [{ id: "c", full_name: "Chitra Rao", gender: "Male" }];
    state.rows = [{ id: "r1", category: "MD", player_id: "a", partner_id: "c", player: { full_name: "Asha" }, partner: { full_name: "Chitra Rao" } }];
    renderPanel();
    fireEvent.click(screen.getByText("Enter with a partner"));
    const picker = screen.getByTestId("partner-picker");
    expect(within(picker).getByText("Entered with Asha")).toBeTruthy();
    // The picker itself offers Ask for a taken player.
    fireEvent.click(within(picker).getByText("Ask"));
    expect(services.requestPartner).toHaveBeenCalledWith("t1", "MD", "c");
  });

  it("a save refused as taken shows the reason with Ask them instead", async () => {
    services.saveMyEntries.mockResolvedValue([{ category: "MD", status: "taken", partner_id: "c", with_name: "Asha" }]);
    state.players = [{ id: "c", full_name: "Chitra Rao", gender: "Male" }];
    renderPanel();
    fireEvent.click(screen.getByText("Enter with a partner"));
    fireEvent.click(within(screen.getByTestId("partner-picker")).getByText("Pick"));
    expect(await screen.findByText("Already entered with Asha.")).toBeTruthy();
    fireEvent.click(screen.getByText("Ask them instead"));
    expect(services.requestPartner).toHaveBeenCalledWith("t1", "MD", "c");
  });

  it("an entered-alone player can be joined", () => {
    state.players = [{ id: "d", full_name: "Dev", gender: "Male" }];
    state.rows = [{ id: "r2", category: "MD", player_id: "d", partner_id: null, player: { full_name: "Dev" } }];
    services.saveMyEntries.mockResolvedValue([{ category: "MD", status: "joined" }]);
    renderPanel();
    fireEvent.click(screen.getByText("Enter with a partner"));
    const picker = screen.getByTestId("partner-picker");
    expect(within(picker).getByText("Entered alone: you can join")).toBeTruthy();
    fireEvent.click(within(picker).getByText("Join"));
    expect(services.saveMyEntries).toHaveBeenCalledWith("t1", [{ category: "MD", partner_id: "d" }]);
  });

  it("a received request can be switched to or declined", () => {
    state.mine.requests = [{ id: "q1", category: "MD", from_player_id: "b", to_player_id: ME, status: "pending", from_player: { full_name: "Bala" } }];
    renderPanel();
    const box = screen.getByLabelText("Partner requests");
    expect(within(box).getByText("Bala")).toBeTruthy();
    fireEvent.click(within(box).getByText("Switch"));
    expect(services.answerPartnerRequest).toHaveBeenCalledWith("q1", true);
    fireEvent.click(within(box).getByText("Stay"));
    expect(services.answerPartnerRequest).toHaveBeenCalledWith("q1", false);
  });

  it("a stale request is explained", () => {
    state.mine.requests = [{ id: "q2", category: "MD", from_player_id: ME, to_player_id: "c", status: "stale", stale_reason: "they now have a partner", to_player: { full_name: "Chitra" } }];
    renderPanel();
    expect(screen.getByTestId("sent-request").textContent).toContain("no longer applies (they now have a partner)");
  });

  it("paired entry: leave and withdraw; waitlist position shown", () => {
    state.mine.entries = [{ id: "r3", category: "MD", player_id: ME, partner_id: "b", partner: { full_name: "Bala" } }];
    state.positions = [{ category: "MS", waitlist_position: 3 }];
    renderPanel();
    const md = screen.getByTestId("entry-card-MD");
    expect(within(md).getByText("Bala")).toBeTruthy();
    fireEvent.click(within(md).getByText("Leave pair"));
    expect(services.leaveMyPair).toHaveBeenCalledWith("t1", "MD");
    fireEvent.click(within(md).getByText("Withdraw"));
    expect(services.withdrawMyEntry).toHaveBeenCalledWith("t1", "MD");
    expect(within(screen.getByTestId("entry-card-MS")).getByText("On the waitlist: #3")).toBeTruthy();
  });

  it("locked: read-only with Can't play?", () => {
    state.windows = { MS: locked, MD: locked };
    state.mine.entries = [{ id: "r4", category: "MS", player_id: ME, partner_id: null }];
    renderPanel();
    const ms = screen.getByTestId("entry-card-MS");
    expect(within(ms).queryByText("Withdraw")).toBeNull();
    fireEvent.click(within(ms).getByText("Can't play?"));
    fireEvent.change(within(ms).getByLabelText("Reason"), { target: { value: "Exams" } });
    fireEvent.click(within(ms).getByText("Ask to withdraw"));
    expect(services.requestLateWithdrawal).toHaveBeenCalledWith("t1", "MS", "Exams");
  });

  it("flag off (all categories hidden): nothing to enter", () => {
    state.windows = {};
    renderPanel();
    expect(screen.getByText("This tournament isn't taking entries right now.")).toBeTruthy();
    expect(screen.queryByTestId("entry-card-MS")).toBeNull();
  });

  it("asks for a gender before doubles when it's unknown", () => {
    renderPanel({ playerGender: null });
    expect(within(screen.getByTestId("entry-card-MD")).getByText(/Set your gender/)).toBeTruthy();
    expect(within(screen.getByTestId("entry-card-MS")).queryByText(/Set your gender/)).toBeNull();
  });
});
