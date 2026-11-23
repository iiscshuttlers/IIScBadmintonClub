import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

/**
 * The organiser console's shell: which views it offers and which one it opens
 * on for each stage of an event. The views' own content is stubbed.
 */

const queries = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
const readiness = vi.hoisted(() => ({ value: { matches: [] as unknown[], checkinsAvailable: true } }));
const listProps = vi.hoisted(() => ({ last: null as null | { initialStatus?: string; initialCourt?: string } }));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: queries.data[String(queryKey[0])],
    isLoading: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: false, user: { id: "host" }, profile: { id: "p-host" }, session: { user: { id: "host" } } }),
}));
vi.mock("@/contexts/TeamModalContext", () => ({ useTeamModal: () => ({ openTeamModal: vi.fn() }) }));
vi.mock("@/hooks/queries/useCheckins", () => ({ useTournamentReadiness: () => readiness.value }));
vi.mock("@/services/tournamentService", () => ({
  fetchAllTournamentMatchRows: vi.fn(),
  countTournamentEntries: vi.fn(),
  fetchTournamentMatchesByNumber: vi.fn(),
}));
vi.mock("@/services/teamService", () => ({ teamService: {} }));
vi.mock("@/components/umpire/TieUmpireConsole", () => ({ TieUmpireConsole: () => null }));
vi.mock("@/components/tournament/AllMatchesList", () => ({
  AllMatchesList: (p: { initialStatus?: string; initialCourt?: string }) => {
    listProps.last = p;
    return <div>MATCH LIST</div>;
  },
}));
vi.mock("@/components/checkin/OrganiserCheckin", () => ({
  CheckinStatCards: () => <div>CHECK-IN STATS</div>,
  CourtsAndQueue: () => <div>COURTS AND QUEUE</div>,
  WhosHereRoster: () => <div>WHO'S HERE</div>,
}));
vi.mock("./HostSetupSections", () => ({
  canHostSetup: (t: { id?: string; created_by?: string } | null, userId?: string) => !!t?.id && t.created_by === userId,
  HostSetupSections: () => <div>SET-UP SECTIONS</div>,
}));

import { OrganizerDashboard } from "./OrganizerDashboard";

const match = (id: string, status: string, court: string | null = "1") => ({
  id, status, category: "MS", court_number: court, match_code: id,
});

const individual = (createdBy = "host") => ({ id: "t1", name: "Club Open", format_family: "OPEN_EVENT", created_by: createdBy }) as any;
const team = (createdBy = "host") => ({ id: "t2", name: "Team Cup", format_family: "TEAM", created_by: createdBy }) as any;

const tabs = () => within(screen.getByRole("tablist", { name: "Organiser views" })).getAllByRole("tab").map((t) => t.textContent);
const selected = () => screen.getByRole("tab", { selected: true }).textContent;

beforeEach(() => {
  queries.data = {};
  readiness.value = { matches: [], checkinsAvailable: true };
  listProps.last = null;
});

describe("OrganizerDashboard views", () => {
  it("opens on Now while matches are being played, and a card opens the filtered list", () => {
    const ms = [match("a", "completed"), match("b", "in_progress"), match("c", "scheduled", null)];
    queries.data = { organizer_ind_matches: ms, organizer_ind_entry_count: 8 };
    readiness.value = { matches: ms, checkinsAvailable: true };
    render(<OrganizerDashboard tournamentId="t1" tournament={individual()} />);

    expect(tabs()).toEqual(["Now", "Matches3", "Check-in", "Set-up"]);
    expect(selected()).toBe("Now");
    expect(screen.getByText("CHECK-IN STATS")).toBeTruthy();
    expect(screen.queryByText("MATCH LIST")).toBeNull();

    // "Without a court" counts the scheduled match with no court.
    fireEvent.click(screen.getByRole("button", { name: /Without a court/ }));
    expect(selected()).toBe("Matches3");
    expect(listProps.last).toMatchObject({ initialStatus: "all", initialCourt: "none" });

    // Opening a view directly starts it unfiltered.
    fireEvent.click(screen.getByRole("tab", { name: "Now" }));
    fireEvent.click(screen.getByRole("tab", { name: /^Matches/ }));
    expect(listProps.last).toMatchObject({ initialStatus: "all", initialCourt: "" });
  });

  it("opens a finished event on its match list, with no Now or Check-in", () => {
    const ms = [match("a", "completed"), match("b", "completed")];
    queries.data = { organizer_ind_matches: ms, organizer_ind_entry_count: 4 };
    readiness.value = { matches: ms, checkinsAvailable: true };
    render(<OrganizerDashboard tournamentId="t1" tournament={individual()} />);

    expect(tabs()).toEqual(["Matches2", "Set-up"]);
    expect(selected()).toBe("Matches2");
    expect(screen.getByText("MATCH LIST")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Set-up" }));
    expect(screen.getByText("SET-UP SECTIONS")).toBeTruthy();
  });

  it("opens on Set-up for the host before the draw; others get just the list", () => {
    queries.data = { organizer_ind_matches: [], organizer_ind_entry_count: 0 };
    const { unmount } = render(<OrganizerDashboard tournamentId="t1" tournament={individual()} />);
    expect(selected()).toBe("Set-up");
    expect(screen.getByText("SET-UP SECTIONS")).toBeTruthy();
    unmount();

    // Not the creator: one view, so no switcher at all.
    render(<OrganizerDashboard tournamentId="t1" tournament={individual("someone-else")} />);
    expect(screen.queryByRole("tablist", { name: "Organiser views" })).toBeNull();
    expect(screen.getByText("MATCH LIST")).toBeTruthy();
  });

  it("gives team events Ties, Teams and Set-up", () => {
    queries.data = {
      organizer_ties: [{ id: "tie1", tie_code: "T1", state: "SCHEDULED", lineup_locked_a: true, lineup_locked_b: false, team_a: { name: "Aces" }, team_b: { name: "Birdies" } }],
      organizer_matches: [],
      organizer_teams: [{ id: "a", name: "Aces", members: [] }, { id: "b", name: "Birdies", members: [] }],
    };
    render(<OrganizerDashboard tournamentId="t2" tournament={team()} />);

    expect(tabs()).toEqual(["Ties1", "Teams2", "Set-up"]);
    expect(selected()).toBe("Ties1");
    expect(screen.getByText("Aces vs Birdies")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^Teams/ }));
    expect(screen.getByText(/Team rosters/)).toBeTruthy();
    expect(screen.queryByText("Aces vs Birdies")).toBeNull();
  });
});
