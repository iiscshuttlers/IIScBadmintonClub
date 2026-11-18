import { describe, expect, it } from "vitest";
import {
  isInQuietHours,
  deduplicateAndFilterRecipients,
  formatTargetedAlert,
  type CandidateRecipient,
} from "./followingAlerts";

describe("followingAlerts", () => {
  describe("isInQuietHours", () => {
    it("returns false if quiet start or end are not provided", () => {
      expect(isInQuietHours(null, null, "23:00")).toBe(false);
      expect(isInQuietHours("22:00", "", "23:00")).toBe(false);
    });

    it("evaluates overnight quiet hours correctly (e.g. 22:00 to 07:00)", () => {
      // 23:30 is inside 22:00 -> 07:00
      expect(isInQuietHours("22:00", "07:00", "23:30")).toBe(true);
      // 03:15 is inside 22:00 -> 07:00
      expect(isInQuietHours("22:00", "07:00", "03:15")).toBe(true);
      // 14:00 is outside 22:00 -> 07:00
      expect(isInQuietHours("22:00", "07:00", "14:00")).toBe(false);
      // boundary: 22:00 is inside
      expect(isInQuietHours("22:00", "07:00", "22:00")).toBe(true);
      // boundary: 07:00 is inside
      expect(isInQuietHours("22:00", "07:00", "07:00")).toBe(true);
      // 07:01 is outside
      expect(isInQuietHours("22:00", "07:00", "07:01")).toBe(false);
    });

    it("evaluates daytime quiet hours correctly (e.g. 13:00 to 15:00)", () => {
      expect(isInQuietHours("13:00", "15:00", "14:15")).toBe(true);
      expect(isInQuietHours("13:00", "15:00", "12:59")).toBe(false);
      expect(isInQuietHours("13:00", "15:00", "15:01")).toBe(false);
    });
  });

  describe("deduplicateAndFilterRecipients", () => {
    const candidateUser1FromPlayer: CandidateRecipient = {
      userId: "user-1",
      source: "player_follow",
      isMuted: false,
      notifyMatchCall: true,
      notifyScheduleChange: true,
      notifyResult: true,
    };

    const candidateUser1FromTournament: CandidateRecipient = {
      userId: "user-1",
      source: "tournament_follow",
      isMuted: false,
      notifyMatchCall: true,
      notifyScheduleChange: true,
      notifyResult: true,
    };

    const candidateMutedUser: CandidateRecipient = {
      userId: "user-muted",
      source: "tournament_follow",
      isMuted: true,
    };

    const candidateResultDisabledUser: CandidateRecipient = {
      userId: "user-no-result",
      source: "player_follow",
      isMuted: false,
      notifyResult: false,
    };

    const candidateQuietUser: CandidateRecipient = {
      userId: "user-quiet",
      source: "player_follow",
      isMuted: false,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    };

    it("deduplicates overlapping player and tournament follows into a single alert", () => {
      const candidates = [candidateUser1FromPlayer, candidateUser1FromTournament];
      const eligible = deduplicateAndFilterRecipients(candidates, "result");
      expect(eligible).toEqual(["user-1"]);
    });

    it("filters out muted subscriptions", () => {
      const candidates = [candidateUser1FromPlayer, candidateMutedUser];
      const eligible = deduplicateAndFilterRecipients(candidates, "match_call");
      expect(eligible).toEqual(["user-1"]);
    });

    it("filters out users who disabled notifications for that specific event type", () => {
      const candidates = [candidateUser1FromPlayer, candidateResultDisabledUser];
      const eligible = deduplicateAndFilterRecipients(candidates, "result");
      expect(eligible).toEqual(["user-1"]);

      // But allowed for schedule_change
      const eligibleSchedule = deduplicateAndFilterRecipients(candidates, "schedule_change");
      expect(eligibleSchedule).toEqual(["user-1", "user-no-result"]);
    });

    it("filters out users currently inside active quiet hours", () => {
      const candidates = [candidateUser1FromPlayer, candidateQuietUser];
      // At 23:30 (nighttime)
      const eligibleNight = deduplicateAndFilterRecipients(candidates, "result", "23:30");
      expect(eligibleNight).toEqual(["user-1"]);

      // At 11:00 (daytime)
      const eligibleDay = deduplicateAndFilterRecipients(candidates, "result", "11:00");
      expect(eligibleDay).toEqual(["user-1", "user-quiet"]);
    });
  });

  describe("formatTargetedAlert", () => {
    it("formats match call with court number and canonical match link", () => {
      const alert = formatTargetedAlert({
        eventType: "match_call",
        side1: "Srikanth",
        side2: "Lakshya",
        court: "2",
        category: "MS",
        tournamentId: "t-123",
        matchId: "m-456",
      });
      expect(alert.title).toBe("📣 Court 2 is ready for you");
      expect(alert.body).toContain("MS · Srikanth vs Lakshya — please report to the court now.");
      expect(alert.url).toBe("/tournaments/t-123/matches/m-456");
    });

    it("formats schedule change alert with court and scheduled time", () => {
      const alert = formatTargetedAlert({
        eventType: "schedule_change",
        side1: "Team Alpha",
        side2: "Team Beta",
        court: "Court 3",
        scheduledTime: "10:30 AM",
        category: "MD",
        tournamentId: "t-123",
      });
      expect(alert.title).toBe("🏸 Schedule Update: Team Alpha vs Team Beta");
      expect(alert.body).toBe("MD · Match scheduled on Court 3 at 10:30 AM.");
      expect(alert.url).toBe("/tournaments/t-123");
    });

    it("formats result alert with final score", () => {
      const alert = formatTargetedAlert({
        eventType: "result",
        side1: "Satwik / Chirag",
        side2: "Alfian / Ardianto",
        score: "21-18, 21-19",
        category: "MD",
      });
      expect(alert.title).toBe("🏸 Match Result: Satwik / Chirag vs Alfian / Ardianto");
      expect(alert.body).toContain("Final score: 21-18, 21-19. Tap to view full scorecard.");
    });
  });
});

