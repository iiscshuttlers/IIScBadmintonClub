import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const queueScheduledNotification = vi.fn().mockResolvedValue(undefined);
const createInAppNotifications = vi.fn().mockResolvedValue(undefined);
const toastSuccess = vi.fn();

vi.mock("@/services/adminService", () => ({
  adminService: {
    queueScheduledNotification: (...a: unknown[]) => queueScheduledNotification(...a),
    createInAppNotifications: (...a: unknown[]) => createInAppNotifications(...a),
  },
}));
vi.mock("@/services/playerService", () => ({
  fetchPlayerList: async () => [{ id: "p1", full_name: "Player One" }, { id: "u1", full_name: "Umpire One" }],
}));
vi.mock("@/services/tournamentService", () => ({
  tournamentService: {
    fetchTournamentParticipants: async () => [{ player_id: "p1" }],
    fetchTournamentOfficials: async () => [{ user_id: "u1" }],
    fetchTournamentMatches: async () => [],
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { id: "admin1" } }) }));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() } }));
vi.mock("@/components/ui/PlayerSelect", () => ({ PlayerSelect: () => null }));

import { SendReminderSheet } from "./SendReminderSheet";

const open = () =>
  render(<SendReminderSheet open onClose={vi.fn()} tournament={{ id: "t1", name: "Open" }} />);

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText(/Title/), { target: { value: "Court 2" } });
  fireEvent.change(screen.getByPlaceholderText(/Message/), { target: { value: "Please report" } });
};

describe("SendReminderSheet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says in-app has no pop-up and turns Push on by default", async () => {
    open();
    await screen.findByText("1 recipient · 2 channels");
    expect(screen.getByText("Bell list, no pop-up")).toBeTruthy();
    expect(screen.getByText("Phone pop-up, within 2 min")).toBeTruthy();
  });

  it("queues push and delivers in-app now for an Officials send", async () => {
    open();
    await screen.findByText("1 recipient · 2 channels");
    fireEvent.click(screen.getByRole("button", { name: /Officials/ }));
    fill();
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));

    await waitFor(() => expect(createInAppNotifications).toHaveBeenCalled());
    // The queue only accepts all/tournament/team/custom audiences.
    expect(queueScheduledNotification).toHaveBeenCalledWith(
      expect.objectContaining({ audience: "custom", channels: ["push"], recipient_ids: ["u1"], status: "pending" }),
    );
    expect(createInAppNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: "u1", title: "Court 2", type: "tournament_reminder" }),
    ]);
    expect(toastSuccess).toHaveBeenCalledWith("In-app sent to 1 person · phone pop-up within 2 min");
  });

  it("warns that nothing pops up when Push is turned off", async () => {
    open();
    await screen.findByText("1 recipient · 2 channels");
    fireEvent.click(screen.getByRole("button", { name: /Push/ }));
    fill();
    fireEvent.click(screen.getByRole("button", { name: /^Send$/ }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(queueScheduledNotification).toHaveBeenCalledWith(
      expect.objectContaining({ audience: "tournament", channels: ["in_app"], status: "sent" }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("In-app sent to 1 person · no pop-up (Push was off)");
  });
});
