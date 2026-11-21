import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AutoFeedTournament } from "@/lib/autoAnnouncements";

const OPEN_ID = "62c5341c-df12-4511-9253-a9a0e9546667";
const SOON_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const HIDDEN_ID = "50f648e9-28e0-451d-abe4-6b751a2d5e28";

let siteValue: unknown;
let rows: AutoFeedTournament[];

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/siteData", () => ({ fetchSiteData: vi.fn(async () => siteValue) }));
vi.mock("@/hooks/queries/useAutoFeedTournaments", () => ({
  useAutoFeedTournaments: () => ({ data: rows }),
}));

import { AnnouncementsSection } from "./AnnouncementsSection";

beforeAll(() => {
  // jsdom has no IntersectionObserver (used for the Feed's infinite scroll).
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 21, 12, 0, 0));
  siteValue = {
    recent: [
      { title: "Court Maintenance Notice", date: "2026-04-03", category: "facility", content: "All courts closed." },
    ],
    hiddenAuto: [`tournament:${HIDDEN_ID}:results`],
  };
  rows = [
    {
      id: SOON_ID,
      name: "Winter Open 2026",
      status: "upcoming",
      form_status: "open",
      form_url: "https://forms.example/winter",
      form_close_date: "2026-11-30T12:00:00Z",
      start_date: "2026-12-05",
      end_date: "2026-12-07",
      venue: "Gymkhana courts",
      created_at: "2026-11-10T06:00:00Z",
      tournament_matches: [],
    },
    {
      id: OPEN_ID,
      name: "Open Tournament August 2026",
      status: "archived",
      start_date: "2026-08-14",
      end_date: "2026-08-23",
      tournament_matches: [
        { category: "MS", round_name: "Final", match_code: "MS_F_01", winner_side: 1, team1_label: "Varun", team2_label: "Aneesh" },
      ],
    },
    { id: HIDDEN_ID, name: "IISM Trials 2026", status: "archived", start_date: "2026-10-16", end_date: "2026-10-18" },
  ];
});
afterEach(() => vi.useRealTimers());

function renderFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnnouncementsSection />
    </QueryClientProvider>,
  );
}

describe("AnnouncementsSection automatic tournament posts", () => {
  it("merges tournament posts with hand-written ones and leaves hidden ones out", async () => {
    renderFeed();

    const results = await screen.findAllByText("Results: Open Tournament August 2026");
    expect(results.length).toBeGreaterThan(0);
    expect(screen.getByText("Court Maintenance Notice")).toBeTruthy();
    expect(screen.queryByText("Results: IISM Trials 2026")).toBeNull();

    // Winners render as text with a link to the full results.
    const card = results[0].closest("[id^='feed-']") as HTMLElement;
    expect(within(card).getByText("Men's Singles:")).toBeTruthy();
    expect(within(card).getByText("Varun")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Full results" }).getAttribute("href")).toBe(
      `/tournaments/${OPEN_ID}/results`,
    );
  });

  it("pins an open registration post with its Register and View tournament links", async () => {
    renderFeed();

    const pinnedHeading = await screen.findByText("Important Announcements");
    const pinned = pinnedHeading.closest("section") as HTMLElement;
    const title = within(pinned).getByText("Registration open: Winter Open 2026");
    const card = title.closest("[id^='feed-']") as HTMLElement;

    const register = within(card).getByRole("link", { name: /Register/ });
    expect(register.getAttribute("href")).toBe("https://forms.example/winter");
    expect(register.getAttribute("target")).toBe("_blank");
    expect(within(card).getByRole("link", { name: "View tournament" }).getAttribute("href")).toBe(
      `/tournaments/${SOON_ID}`,
    );
    expect(within(card).getByText("Gymkhana courts")).toBeTruthy();
    expect(within(card).getByText(/^Closes /)).toBeTruthy();
  });
});
