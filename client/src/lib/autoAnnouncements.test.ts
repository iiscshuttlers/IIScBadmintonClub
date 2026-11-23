import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoPostKey,
  buildAutoAnnouncement,
  buildAutoAnnouncements,
  feedWinners,
  registrationState,
  type AutoFeedTournament,
} from "./autoAnnouncements";

const ID = "11111111-2222-4333-8444-555555555555";
const NOW = new Date(2026, 10, 21, 12, 0, 0); // 21 Nov 2026, local noon

function t(over: Partial<AutoFeedTournament> = {}): AutoFeedTournament {
  return {
    id: ID,
    name: "Winter Open 2026",
    status: "upcoming",
    form_status: "open",
    form_url: "https://forms.example/winter",
    form_close_date: "2026-11-30T12:00:00Z",
    start_date: "2026-12-05",
    end_date: "2026-12-07",
    venue: "Gymkhana courts",
    eligibility: "Open to all IISc members",
    created_at: "2026-11-10T06:00:00Z",
    archived_at: null,
    require_app_registration: false,
    tournament_matches: [],
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("registrationState", () => {
  it("treats a passed deadline as closed", () => {
    expect(registrationState(t({ form_close_date: "2026-11-20T00:00:00Z" }), NOW)).toBe("closed");
  });
  it("keeps open and closing_soon before the deadline", () => {
    expect(registrationState(t(), NOW)).toBe("open");
    expect(registrationState(t({ form_status: "closing_soon" }), NOW)).toBe("closing_soon");
  });
  it("reports a disabled or missing form as none", () => {
    expect(registrationState(t({ form_status: "disabled" }), NOW)).toBe("none");
    expect(registrationState(t({ form_status: null }), NOW)).toBe("none");
  });
});

describe("buildAutoAnnouncement", () => {
  it("skips drafts and trashed tournaments", () => {
    expect(buildAutoAnnouncement(t({ status: "draft" }), NOW)).toBeNull();
    expect(buildAutoAnnouncement(t({ status: "deleted" }), NOW)).toBeNull();
  });

  it("posts open registration with the form link, closing time and event dates", () => {
    const post = buildAutoAnnouncement(t(), NOW)!;
    expect(post.key).toBe(autoPostKey(ID, "registration"));
    expect(post.title).toBe("Registration open: Winter Open 2026");
    expect(post.date).toBe("2026-11-10");
    expect(post.startDate).toBe("2026-12-05");
    expect(post.endDate).toBe("2026-12-07");
    expect(post.closesAt).toBe("2026-11-30T12:00:00Z");
    expect(post.lines).toEqual(["Registration is open.", "Open to all IISc members"]);
    expect(post.actions[0]).toEqual({ label: "Register", href: "https://forms.example/winter", external: true });
    expect(post.actions.at(-1)).toEqual({ label: "View tournament", href: `/tournaments/${ID}`, external: false });
  });

  it("sends in-app registration to My entry instead of the form", () => {
    const post = buildAutoAnnouncement(t({ require_app_registration: true }), NOW)!;
    expect(post.actions[0]).toEqual({ label: "Register", href: `/tournaments/${ID}?panel=my-entry`, external: false });
  });

  it("follows the in-app registration window, not form_status, when the flag is on", () => {
    const post = buildAutoAnnouncement(t({ require_app_registration: true, form_status: "disabled" }), NOW)!;
    expect(post.title).toMatch(/^Registration open/);
    const before = buildAutoAnnouncement(t({ require_app_registration: true, registration_opens_at: "2099-01-01T00:00:00Z" }), NOW)!;
    expect(before.title).toMatch(/^Coming up/);
  });

  it("drops a form link that is not http(s)", () => {
    const post = buildAutoAnnouncement(t({ form_url: "javascript:alert(1)" }), NOW)!;
    expect(post.actions.map((a) => a.label)).toEqual(["View tournament"]);
  });

  it("switches to registration closed once the deadline passes, dated by the deadline", () => {
    const post = buildAutoAnnouncement(t({ form_close_date: "2026-11-18T10:00:00Z" }), NOW)!;
    expect(post.title).toBe("Registration closed: Winter Open 2026");
    expect(post.date).toBe("2026-11-18");
    expect(post.closesAt).toBeUndefined();
    expect(post.actions.map((a) => a.label)).toEqual(["View tournament"]);
  });

  it("calls an upcoming tournament without a form 'Coming up'", () => {
    const post = buildAutoAnnouncement(t({ form_status: "disabled", eligibility: null }), NOW)!;
    expect(post.title).toBe("Coming up: Winter Open 2026");
    expect(post.lines).toEqual([]);
  });

  it("posts 'Under way' while today is inside the event dates", () => {
    const post = buildAutoAnnouncement(t({ start_date: "2026-11-20", end_date: "2026-11-22" }), NOW)!;
    expect(post.key).toBe(autoPostKey(ID, "underway"));
    expect(post.title).toBe("Under way: Winter Open 2026");
    expect(post.date).toBe("2026-11-20");
    expect(post.actions).toEqual([{ label: "Follow live", href: `/tournaments/${ID}/live`, external: false }]);
  });

  it("posts results with Final winners once the event is over", () => {
    const post = buildAutoAnnouncement(
      t({
        status: "archived",
        start_date: "2026-08-14",
        end_date: "2026-08-23",
        form_status: "open",
        tournament_matches: [
          { category: "XD", round_name: "Final", match_code: "XD_F_01", winner_side: 2, team1_label: "A & B", team2_label: "C  &  D" },
          { category: "MS", round_name: "Final", match_code: "MS_F_01", winner_side: 1, team1_label: "Varun", team2_label: "Aneesh" },
          { category: "MS", round_name: "Semifinal", match_code: "MS_SF_01", winner_side: 1, team1_label: "Varun", team2_label: "Manish" },
        ],
      }),
      NOW,
    )!;
    expect(post.key).toBe(autoPostKey(ID, "results"));
    expect(post.title).toBe("Results: Winter Open 2026");
    expect(post.date).toBe("2026-08-23");
    expect(post.lines).toEqual([]);
    expect(post.winners).toEqual([
      { category: "Men's Singles", winner: "Varun", runnerUp: "Aneesh" },
      { category: "Mixed Doubles", winner: "C & D", runnerUp: "A & B" },
    ]);
    expect(post.actions).toEqual([{ label: "Full results", href: `/tournaments/${ID}/results`, external: false }]);
  });

  it("says the tournament finished when no Final has a result", () => {
    const post = buildAutoAnnouncement(t({ status: "completed", start_date: "2026-10-01", end_date: "2026-10-02" }), NOW)!;
    expect(post.winners).toBeUndefined();
    expect(post.lines).toEqual(["Winter Open 2026 has finished."]);
  });
});

describe("feedWinners", () => {
  it("ignores undecided Finals and keeps unknown categories after the standard ones", () => {
    expect(
      feedWinners([
        { category: "Veterans", match_code: "VET_F_01", winner_side: 1, team1_label: "X", team2_label: "Y" },
        { category: "WS", round_name: "Final", winner_side: null, team1_label: "P", team2_label: "Q" },
        { category: "WS", round_name: "Final", winner_side: 1, team1_label: "Radhika", team2_label: "Madhu" },
      ]),
    ).toEqual([
      { category: "Women's Singles", winner: "Radhika", runnerUp: "Madhu" },
      { category: "Veterans", winner: "X", runnerUp: "Y" },
    ]);
  });
});

describe("buildAutoAnnouncements", () => {
  it("drops posts whose key an admin hid, but only for that stage", () => {
    const upcoming = t();
    const finished = t({ id: "99999999-2222-4333-8444-555555555555", status: "archived", start_date: "2026-08-01", end_date: "2026-08-02" });
    const posts = buildAutoAnnouncements([upcoming, finished], [autoPostKey(ID, "registration")], NOW);
    expect(posts.map((p) => p.key)).toEqual([autoPostKey(finished.id, "results")]);

    // Hiding the registration post does not hide the results post that follows it.
    const later = buildAutoAnnouncements([{ ...upcoming, status: "archived" }], [autoPostKey(ID, "registration")], NOW);
    expect(later.map((p) => p.key)).toEqual([autoPostKey(ID, "results")]);
  });

  it("returns an empty list for a non-array (e.g. a poisoned persisted cache)", () => {
    expect(buildAutoAnnouncements({} as never, [], NOW)).toEqual([]);
  });
});
