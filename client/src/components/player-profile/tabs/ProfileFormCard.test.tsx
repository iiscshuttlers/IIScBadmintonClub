import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileFormCard } from "@/components/player-profile/tabs/ProfileFormCard";

const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
const row = (won: boolean, score: string) => ({
  status: "completed",
  player1_id: "me",
  player2_id: "them",
  winner_side: won ? 1 : 2,
  score,
  ended_at: recent,
});

describe("ProfileFormCard", () => {
  it("shows form, this week, straight-game wins and deciding games", () => {
    render(
      <ProfileFormCard
        playerId="me"
        matches={[row(true, "21-10, 21-12"), row(false, "21-19, 18-21, 15-21"), row(true, "19-21, 21-17, 21-18")]}
      />,
    );
    expect(screen.getByRole("heading", { name: /form & clutch/i })).toBeTruthy();
    expect(screen.getByText("Won 2 of the last 3")).toBeTruthy();
    expect(screen.getByText("3 matches in the last 7 days")).toBeTruthy();
    expect(screen.getByText("50% of wins without dropping a game")).toBeTruthy();
    expect(screen.getByText("Won 50% of matches that went to a third game")).toBeTruthy();
  });

  it("renders nothing without a decided match", () => {
    const { container } = render(<ProfileFormCard playerId="me" matches={[{ status: "scheduled", player1_id: "me", player2_id: "x" }]} />);
    expect(container.innerHTML).toBe("");
  });
});
