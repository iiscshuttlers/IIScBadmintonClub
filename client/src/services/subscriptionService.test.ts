import { vi, expect, it, describe, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import { subscriptionService } from "./subscriptionService";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("subscriptionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tournament subscriptions", () => {
    it("fetches user tournament subscriptions with tournament details", async () => {
      const mockData = [
        {
          id: "sub-1",
          user_id: "user-1",
          tournament_id: "tour-1",
          notify_match_call: true,
          notify_schedule_change: true,
          notify_result: true,
          is_muted: false,
          tournaments: { id: "tour-1", name: "Championship" },
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await subscriptionService.fetchTournamentSubscriptions("user-1");
      expect(result).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith("user_tournament_subscriptions");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("checks isFollowingTournament correctly", async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const isFollowing = await subscriptionService.isFollowingTournament("user-1", "tour-1");
      expect(isFollowing).toBe(true);
      expect(mockEq1).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("tournament_id", "tour-1");
    });

    it("follows tournament via upsert", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({ upsert: mockUpsert });

      await subscriptionService.followTournament("user-1", "tour-1", { notify_result: true });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          tournament_id: "tour-1",
          notify_result: true,
        }),
        { onConflict: "user_id,tournament_id" }
      );
    });

    it("unfollows tournament via delete", async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      (supabase.from as any).mockReturnValue({ delete: mockDelete });

      await subscriptionService.unfollowTournament("user-1", "tour-1");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith("user_id", "user-1");
      expect(mockEq2).toHaveBeenCalledWith("tournament_id", "tour-1");
    });
  });

  describe("following matches partition", () => {
    it("partitions matches into live, upcoming and completed correctly", async () => {
      // Mock subscriptions
      const mockTourOrder = vi.fn().mockResolvedValue({ data: [{ tournament_id: "tour-1" }], error: null });
      const mockTourEq = vi.fn().mockReturnValue({ order: mockTourOrder });
      const mockTourSelect = vi.fn().mockReturnValue({ eq: mockTourEq });

      const mockPlayerOrder = vi.fn().mockResolvedValue({ data: [{ player_id: "p-1" }], error: null });
      const mockPlayerEq = vi.fn().mockReturnValue({ order: mockPlayerOrder });
      const mockPlayerSelect = vi.fn().mockReturnValue({ eq: mockPlayerEq });

      const mockMatches = [
        { id: "m-live", tournament_id: "tour-1", status: "in_progress", scheduled_at: "2026-11-20T10:00:00Z" },
        { id: "m-upcoming", tournament_id: "tour-1", status: "scheduled", scheduled_at: "2026-11-20T11:00:00Z" },
        { id: "m-completed", tournament_id: "tour-1", status: "completed", scheduled_at: "2026-11-20T09:00:00Z" },
      ];
      const mockMatchesOrder = vi.fn().mockResolvedValue({ data: mockMatches, error: null });
      const mockMatchesSelect = vi.fn().mockReturnValue({ order: mockMatchesOrder });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "user_tournament_subscriptions") return { select: mockTourSelect };
        if (table === "user_player_subscriptions") return { select: mockPlayerSelect };
        if (table === "tournament_matches") return { select: mockMatchesSelect };
        return { select: vi.fn() };
      });

      const res = await subscriptionService.fetchFollowingMatches("user-1");
      expect(res.live.map((m) => m.id)).toEqual(["m-live"]);
      expect(res.upcoming.map((m) => m.id)).toEqual(["m-upcoming"]);
      expect(res.completed.map((m) => m.id)).toEqual(["m-completed"]);
      expect(res.all).toHaveLength(3);
    });
  });
});

