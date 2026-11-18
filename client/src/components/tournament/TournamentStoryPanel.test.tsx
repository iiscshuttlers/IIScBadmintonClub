import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MatchView } from "@/lib/matchView";
import { buildPublishedStoryRecord, buildTournamentStoryDraft, type PublishedStoryRecord } from "@/lib/tournamentStory";

let mockIsAdmin = false;
let mockViews: MatchView[] = [];
let mockDecidedStatus: "loading" | "ready" | "error" = "ready";
let mockRecord: PublishedStoryRecord | null = null;
const publishMutate = vi.fn();
const withdrawMutate = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: mockIsAdmin }) }));
vi.mock("@/hooks/queries/useMatchViews", () => ({
  useDecidedMatchViews: () => ({ views: mockViews, total: mockViews.length, status: mockDecidedStatus, retry: () => {} }),
}));
vi.mock("@/hooks/queries/useTournamentStory", () => ({
  useTournamentStory: () => ({
    record: mockRecord,
    status: "ready",
    retry: () => {},
    publish: { mutate: publishMutate, isPending: false },
    withdraw: { mutate: withdrawMutate, isPending: false },
  }),
}));

import { TournamentStoryPanel } from "./TournamentStoryPanel";

const TID = "t-1";

function final(over: Partial<MatchView> = {}): MatchView {
  return {
    id: "m-final",
    tournamentId: TID,
    discipline: "XD",
    categoryLabel: "Mixed Doubles",
    roundName: "Final",
    round: 3,
    matchNumber: 1,
    matchCode: "XD_F_1",
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "Asha / Ravi", playerIds: ["p1", "p2"], seed: 1, isWinner: true, isTbd: false, isBye: false },
      { label: "Meera / Kiran", playerIds: ["p3", "p4"], seed: 2, isWinner: false, isTbd: false, isBye: false },
    ],
    state: "completed",
    statusLabel: "Completed",
    games: [{ side1: 21, side2: 17 }, { side1: 21, side2: 15 }],
    scoreText: "21-17, 21-15",
    court: "1",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    nextMatchCode: null,
    ...over,
  };
}

function renderPanel() {
  return render(<TournamentStoryPanel tournamentId={TID} tournamentName="Autumn Cup" />);
}

beforeEach(() => {
  mockIsAdmin = false;
  mockViews = [final()];
  mockDecidedStatus = "ready";
  mockRecord = null;
  publishMutate.mockReset();
  withdrawMutate.mockReset();
});

describe("TournamentStoryPanel", () => {
  it("renders nothing for visitors when no story is published", () => {
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a published story with the organiser note kept separate and a match link", () => {
    const draft = buildTournamentStoryDraft({ id: TID, name: "Autumn Cup" }, mockViews);
    mockRecord = buildPublishedStoryRecord(draft, ["champ-m-final"], "Thanks to every volunteer.", "2026-11-14T12:00:00Z");
    renderPanel();
    expect(screen.getByText("From the organisers")).toBeInTheDocument();
    expect(screen.getByText("Thanks to every volunteer.")).toBeInTheDocument();
    expect(screen.getByText("Asha / Ravi crowned XD Champion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View match" })).toHaveAttribute("href", expect.stringContaining("m-final"));
    expect(screen.queryByText(/Review story/)).not.toBeInTheDocument();
  });

  it("withholds the champion after the final is corrected", () => {
    const draft = buildTournamentStoryDraft({ id: TID, name: "Autumn Cup" }, mockViews);
    mockRecord = buildPublishedStoryRecord(draft, ["champ-m-final"], "", "2026-11-14T12:00:00Z");
    mockViews = [
      final({
        sides: [
          { label: "Asha / Ravi", playerIds: ["p1", "p2"], seed: 1, isWinner: false, isTbd: false, isBye: false },
          { label: "Meera / Kiran", playerIds: ["p3", "p4"], seed: 2, isWinner: true, isTbd: false, isBye: false },
        ],
      }),
    ];
    renderPanel();
    expect(screen.queryByText(/crowned/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/1 item is hidden/);
  });

  it("does not show published facts while current results cannot be checked", () => {
    const draft = buildTournamentStoryDraft({ id: TID, name: "Autumn Cup" }, mockViews);
    mockRecord = buildPublishedStoryRecord(draft, ["champ-m-final"], "", "2026-11-14T12:00:00Z");
    mockDecidedStatus = "error";
    mockViews = [];
    mockIsAdmin = true;
    renderPanel();
    expect(screen.queryByText(/crowned/)).not.toBeInTheDocument();
    expect(screen.getByText(/could not be checked/)).toBeInTheDocument();
  });

  it("lets an admin publish a reviewed selection with a note", () => {
    mockIsAdmin = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Review story/ }));
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.change(screen.getByLabelText(/Organiser note/), { target: { value: "  Great finals.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Publish story" }));
    expect(publishMutate).toHaveBeenCalledTimes(1);
    const record = publishMutate.mock.calls[0][0] as PublishedStoryRecord;
    expect(record.items.map((i) => i.id)).toEqual(["champ-m-final"]);
    expect(record.editorialNote).toBe("Great finals.");
  });

  it("disables publishing when nothing is selected", () => {
    mockIsAdmin = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Review story/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Publish story" })).toBeDisabled();
  });
});
