import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  buildReadinessBoard,
  buildReadinessContext,
  courtBoard,
  freeCourts,
  type CheckinRow,
  type CourtCallRow,
  type ReadinessMatch,
} from "@/lib/matchReadiness";
import type { TournamentReadiness } from "@/hooks/queries/useCheckins";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: false, session: { user: { id: "karthik" } }, profile: { id: "karthik" } }) }));
vi.mock("@/services/tournamentService", () => ({ adminUpdateTournamentMatch: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));

const mutate = vi.fn();
const callPlayers = vi.fn(async () => ({ notified: 1, called: [] }));
vi.mock("@/hooks/queries/useCheckins", () => ({
  useCheckinAction: () => ({ mutate, isPending: false }),
  callPlayers: (...args: unknown[]) => callPlayers(...(args as [])),
}));

import { CheckinPanel, MatchStatusForPlayer } from "@/components/checkin/PlayerCheckin";
import { ReadySections, UmpireWhosHere, WalkoverCheckinRecord, startWarning, walkoverHint } from "@/components/checkin/OfficialBoard";
import { WhosHereRoster } from "@/components/checkin/OrganiserCheckin";
import { AllMatchesList } from "@/components/tournament/AllMatchesList";

const NOW = Date.parse("2026-11-20T10:44:00.000Z"); // 4:14 pm IST
const at = (mins: number) => new Date(NOW + mins * 60_000).toISOString();

const NAMES: Record<string, string> = {
  karthik: "Karthik R",
  arjun: "Arjun S",
  rahul: "Rahul M",
  vikram: "Vikram P",
  sanjay: "Sanjay T",
  aditya: "Aditya N",
  rohit: "Rohit V",
  divya: "Divya S",
  kiran: "Kiran B",
  leela: "Leela J",
};

function m(id: string, code: string, o: Partial<ReadinessMatch> = {}): ReadinessMatch & { tournament_id: string } {
  return {
    id,
    tournament_id: "t",
    status: "scheduled",
    match_code: code,
    category: code.slice(0, 2),
    round: 2,
    round_name: "Round 2",
    match_number: 1,
    scheduled_at: at(16),
    court_number: null,
    team1_label: "Side 1",
    team2_label: "Side 2",
    player1_id: null,
    player2_id: null,
    player3_id: null,
    player4_id: null,
    ...o,
  };
}

const ms = m("ms", "MS_R2_03", { player1_id: "karthik", player2_id: "arjun", team1_label: "Karthik R", team2_label: "Arjun S" });
const md = m("md", "MD_QF_02", {
  round_name: "Quarter-final",
  scheduled_at: at(61),
  player1_id: "karthik",
  player3_id: "rahul",
  player2_id: "vikram",
  player4_id: "sanjay",
  team1_label: "Karthik R & Rahul M",
  team2_label: "Vikram P & Sanjay T",
});
const live = m("live", "MS_R2_01", { status: "in_progress", court_number: "3", player1_id: "vikram", player2_id: "aditya" });
const xd = m("xd", "XD_R1_04", {
  round: 1,
  round_name: "Round 1",
  scheduled_at: at(26),
  court_number: "1",
  player1_id: "rohit",
  player3_id: "divya",
  player2_id: "kiran",
  player4_id: "leela",
  team1_label: "Rohit V & Divya S",
  team2_label: "Kiran B & Leela J",
});
const ws = m("ws", "WS_SF_01", { scheduled_at: null, player1_id: null, player2_id: null, team1_label: "Tara M", team2_label: "TBD" });

function here(player: string, mins: number, o: Partial<CheckinRow> = {}): CheckinRow {
  return {
    tournament_id: "t",
    player_id: player,
    state: "here",
    checked_in_at: at(mins),
    here_since: at(mins),
    break_until: null,
    break_started_at: null,
    checked_in_by: player,
    expires_at: at(240),
    ...o,
  };
}

function makeData(checkins: CheckinRow[], calls: CourtCallRow[] = []): TournamentReadiness {
  const matches = [ms, md, live, xd, ws];
  const ctx = buildReadinessContext(matches, checkins, { now: NOW, minRestMinutes: 15 });
  const courts = courtBoard([...matches, m("c2", "WS_X", { status: "completed", court_number: "2" })], calls, NOW);
  return {
    now: NOW,
    ctx,
    board: buildReadinessBoard(ctx),
    courts,
    free: freeCourts(courts),
    calls,
    names: NAMES,
    matches,
    checkins,
    tournament: { id: "t", status: "active", start_date: null, end_date: null, min_rest_minutes: 15 },
    loading: false,
    error: false,
    checkinsAvailable: true,
    refetch: () => {},
  } as unknown as TournamentReadiness;
}

beforeEach(() => {
  mutate.mockClear();
  callPlayers.mockClear();
});

describe("player check-in", () => {
  it("asks a player who hasn't checked in, without any location", () => {
    render(<CheckinPanel data={makeData([here("arjun", -3)])} tournamentId="t" myPlayerId="karthik" />);
    expect(screen.getByText("Are you at the venue?")).toBeInTheDocument();
    expect(screen.getByText(/No location is used/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /I'm here, ready to play/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ playerId: "karthik", action: "check_in" }));
  });

  it("offers breaks and leaving once checked in", () => {
    render(<CheckinPanel data={makeData([here("karthik", 0), here("arjun", -3)])} tournamentId="t" myPlayerId="karthik" />);
    expect(screen.getByText("You're checked in")).toBeInTheDocument();
    expect(screen.getByText(/Umpires can see you for MS_R2_03 and MD_QF_02/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ action: "break", minutes: 30 }));
    fireEvent.click(screen.getByRole("button", { name: "Until I'm back" }));
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ action: "break", minutes: null }));
    fireEvent.click(screen.getByRole("button", { name: "Leaving venue" }));
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ action: "check_out" }));
  });

  it("asks 'Still at the venue?' in the last 10 minutes", () => {
    render(<CheckinPanel data={makeData([here("karthik", -230, { expires_at: at(8) })])} tournamentId="t" myPlayerId="karthik" />);
    fireEvent.click(screen.getByRole("button", { name: "Stay checked in" }));
    expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ action: "renew" }));
  });

  it("shows both players here and the queue position", () => {
    const data = makeData([here("karthik", 0), here("arjun", -3)]);
    render(<MatchStatusForPlayer data={data} match={ms} myPlayerId="karthik" />);
    expect(screen.getByText("Both players here")).toBeInTheDocument();
    expect(screen.getByText(/1st in line for the next free court/)).toBeInTheDocument();
    expect(screen.getByText("Arjun S")).toBeInTheDocument();
    expect(screen.getAllByText(/^Here · /)).toHaveLength(2);
  });

  it("shows partner, opponent on court and opponent on a break", () => {
    const data = makeData([
      here("karthik", 0),
      here("rahul", -12),
      here("vikram", -30),
      here("sanjay", -20, { state: "break", break_until: at(26), break_started_at: at(-1) }),
    ]);
    render(<MatchStatusForPlayer data={data} match={md} myPlayerId="karthik" compact />);
    expect(screen.getByText("2 of 4 here")).toBeInTheDocument();
    expect(screen.getByText(/waiting for Vikram and Sanjay/)).toBeInTheDocument();
    expect(screen.getByText("On court · MS_R2_01 · C3")).toBeInTheDocument();
    expect(screen.getByText(/^On a break · back /)).toBeInTheDocument();
    expect(screen.getByText("(partner)")).toBeInTheDocument();
  });
});

describe("umpire", () => {
  const data = () =>
    makeData(
      [here("karthik", 0), here("arjun", -3), here("rohit", -29), here("divya", -24), here("rahul", -12), here("vikram", -30)],
      [{ id: "c1", match_id: "xd", called_at: at(-3), player_ids: null }],
    );

  it("lists courts, ready matches and who's missing", () => {
    render(<ReadySections data={data()} tournamentId="t" />);
    const courts = screen.getByRole("list", { name: "Courts" });
    expect(within(courts).getByText("Court 2")).toBeInTheDocument();
    expect(within(courts).getByText(/Live · MS_R2_01/)).toBeInTheDocument();
    expect(within(courts).getByText(/Called · XD_R1_04/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Put on Court 2 & call" })).toBeInTheDocument();
    // XD: side 2 not here → callable; MD: Vikram on court, Sanjay not here.
    expect(screen.getByText("Waiting for players")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Call missing \(2\)/ }));
    expect(callPlayers).toHaveBeenCalledWith("xd", ["kiran", "leela"]);
  });

  it("puts a ready match on court and calls it", async () => {
    render(<ReadySections data={data()} tournamentId="t" />);
    fireEvent.click(screen.getByRole("button", { name: "Put on Court 2 & call" }));
    await vi.waitFor(() => expect(callPlayers).toHaveBeenCalledWith("ms"));
  });

  it("shows who's here with Check in for them, and a soft warning", () => {
    const d = data();
    render(<UmpireWhosHere data={d} match={xd} tournamentId="t" />);
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check in Kiran B" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ playerId: "kiran", action: "check_in" }));
    expect(screen.getByText(/Called once/)).toBeInTheDocument();
    expect(startWarning(d, xd)).toBe("2 players haven't checked in. You can still start.");
    expect(startWarning(d, ms)).toBeNull();
  });

  it("shows the check-in record on the walkover sheet without choosing", () => {
    const d = data();
    render(<WalkoverCheckinRecord data={d} match={xd} />);
    expect(screen.getByText("Side 1 · both here")).toBeInTheDocument();
    expect(screen.getByText("Side 2 · nobody checked in")).toBeInTheDocument();
    expect(screen.getAllByText("Not checked in today")).toHaveLength(2);
    expect(screen.getByText("Everyone called")).toBeInTheDocument();
    expect(walkoverHint(d, xd)).toBe(1);
    expect(walkoverHint(d, md)).toBeNull();
  });
});

describe("organiser", () => {
  const data = () => makeData([here("karthik", 0), here("arjun", -3), here("rohit", -29), here("divya", -24)]);

  it("lists who's here with people who aren't here first, and checks in on their behalf", () => {
    render(<WhosHereRoster data={data()} tournamentId="t" />);
    const names = screen.getAllByRole("button", { expanded: false }).map((b) => b.textContent ?? "");
    expect(names[0]).toMatch(/^(Kiran B|Leela J|Rahul M|Sanjay T)/);
    fireEvent.click(screen.getByRole("button", { name: "Check in Kiran B" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ playerId: "kiran", action: "check_in" }));
    fireEvent.click(screen.getByRole("button", { name: /Here 4/ }));
    expect(screen.queryByText("Kiran B")).not.toBeInTheDocument();
  });

  it("groups all matches and puts a Call button only next to people who can come", () => {
    render(<AllMatchesList tournamentId="t" data={data()} />);
    expect(screen.getByText("Live · 1")).toBeInTheDocument();
    expect(screen.getByText("Upcoming · 3")).toBeInTheDocument();
    expect(screen.getByText("Unscheduled · 1")).toBeInTheDocument();
    // Vikram is playing MS_R2_01: no Call button for him.
    expect(screen.queryByRole("button", { name: "Call Vikram P" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Call Kiran B" }));
    expect(callPlayers).toHaveBeenCalledWith("xd", ["kiran"]);
    // XD: both of side 2 missing. MD: Vikram is on court, so only Rahul and Sanjay can be called.
    expect(screen.getByRole("button", { name: "Call both" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call missing (2)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Set time & court/ })).toBeInTheDocument();
    // No call on Court 1 in this fixture, so it is free and suggested first.
    expect(screen.getByRole("button", { name: "Put on Court 1" })).toBeInTheDocument();
  });

  it("filters to matches with someone missing", () => {
    render(<AllMatchesList tournamentId="t" data={data()} />);
    fireEvent.change(screen.getByLabelText("Players"), { target: { value: "missing" } });
    expect(screen.queryByText("MS_R2_03")).not.toBeInTheDocument();
    expect(screen.getByText("XD_R1_04")).toBeInTheDocument();
  });
});
