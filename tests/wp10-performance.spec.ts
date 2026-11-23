import { expect, test, type Page, type Route } from "@playwright/test";

const TOURNAMENT_ID = "00000000-0000-4000-8000-000000000001";
const PLAYER_ID = "00000000-0000-4000-8000-000000000101";
const CATEGORIES = ["MS", "WS", "MD", "WD", "XD"];

const percentile = (values: number[], p: number) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)];
};

const tournamentMatches = Array.from({ length: 127 }, (_, index) => ({
  id: `00000000-0000-4001-8000-${String(index + 1).padStart(12, "0")}`,
  tournament_id: TOURNAMENT_ID,
  category: CATEGORIES[index % CATEGORIES.length],
  match_code: `${CATEGORIES[index % CATEGORIES.length]}_${index + 1}`,
  round: Math.floor(index / 64) + 1,
  round_name: index > 122 ? "Final" : `Round ${Math.floor(index / 64) + 1}`,
  match_number: index + 1,
  status: index < 4 ? "in_progress" : "scheduled",
  winner_side: null,
  team1_label: `Fixture Player ${index * 2 + 1}`,
  team2_label: `Fixture Player ${index * 2 + 2}`,
  court_number: String((index % 6) + 1),
  scheduled_at: new Date(Date.UTC(2026, 10, 14, 3 + Math.floor(index / 6), (index % 6) * 10)).toISOString(),
  started_at: index < 4 ? new Date(Date.UTC(2026, 10, 14, 3, index * 10)).toISOString() : null,
  ended_at: null,
  player1_id: PLAYER_ID,
  player2_id: null,
  player3_id: null,
  player4_id: null,
  score: null,
  sets_history: [],
  result_revision: 0,
}));

const baseTournament = {
  id: TOURNAMENT_ID,
  slug: "wp10-realistic-fixture",
  name: "WP10 Realistic Fixture",
  description: "128-player, five-discipline qualification fixture",
  status: "active",
  start_date: "2026-11-14",
  end_date: "2026-11-14",
  venue: "Gymkhana Courts",
  categories: CATEGORIES,
  tournament_type: "open",
  format_family: "INDIVIDUAL",
  counts_for_elo: true,
  bracket_format: "single_elimination",
  created_at: "2026-11-01T00:00:00.000Z",
  created_by: null,
  archived_at: null,
  require_app_registration: false,
  min_rest_minutes: 15,
  estimated_match_minutes: 30,
  unavailable_court_periods: [],
  tournament_matches: tournamentMatches,
  tournament_participants: [{ count: 128 }],
};

const tournamentList = Array.from({ length: 48 }, (_, index) => ({
  ...baseTournament,
  id: index === 0 ? TOURNAMENT_ID : `00000000-0000-4000-8001-${String(index).padStart(12, "0")}`,
  slug: `fixture-${index + 1}`,
  name: index === 0 ? baseTournament.name : `Qualification Tournament ${index + 1}`,
  status: index % 3 === 0 ? "active" : index % 3 === 1 ? "upcoming" : "completed",
  start_date: index % 3 === 1 ? "2026-12-01" : index % 3 === 2 ? "2026-10-01" : "2026-11-14",
  end_date: index % 3 === 1 ? "2026-12-02" : index % 3 === 2 ? "2026-10-02" : "2026-11-14",
  tournament_matches: tournamentMatches.slice(0, 31),
  tournament_participants: [{ count: 32 }],
}));

const players = Array.from({ length: 256 }, (_, index) => ({
  id: index === 0 ? PLAYER_ID : `00000000-0000-4000-8002-${String(index).padStart(12, "0")}`,
  full_name: `Fixture Player ${index + 1}`,
  nickname: null,
  avatar_url: null,
  department: "Qualification",
  gender: index % 2 ? "female" : "male",
  elo_rating: 1800 - index,
  singles_elo: 1800 - index,
  doubles_elo: 1750 - index,
  mixed_elo: 1700 - index,
  playing_level: "advanced",
  is_guest: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
}));

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": "0-255/256" },
    body: JSON.stringify(body),
  });
}

async function installFixtureApi(page: Page) {
  await page.route("**/auth/v1/**", (route) => fulfillJson(route, { user: null }));
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const wantsObject = (request.headers().accept ?? "").includes("application/vnd.pgrst.object");

    if (table === "tournaments") {
      const selected = url.searchParams.has("id") ? baseTournament : tournamentList;
      return fulfillJson(route, wantsObject && !Array.isArray(selected) ? selected : selected);
    }
    if (table === "players") {
      const selected = url.searchParams.has("id") ? players[0] : players;
      return fulfillJson(route, wantsObject && !Array.isArray(selected) ? selected : selected);
    }
    if (table === "tournament_matches" || table === "matches") {
      return fulfillJson(route, tournamentMatches.slice(0, table === "matches" ? 64 : 127));
    }
    if (table === "site_data") {
      return fulfillJson(route, wantsObject ? { value: { showTournamentStandings: true } } : [{ value: { showTournamentStandings: true } }]);
    }
    if (table === "elo_calculation_logs") return fulfillJson(route, []);
    return fulfillJson(route, wantsObject ? null : []);
  });
}

async function timedOpen(page: Page, path: string, ready: () => Promise<void>) {
  const started = performance.now();
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await ready();
  return Math.round((performance.now() - started) * 10) / 10;
}

test("captures WP10 realistic-fixture performance baselines", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await installFixtureApi(page);

  const activeSockets = new Set<object>();
  let peakSockets = 0;
  page.on("websocket", (socket) => {
    activeSockets.add(socket);
    peakSockets = Math.max(peakSockets, activeSockets.size);
    socket.on("close", () => activeSockets.delete(socket));
  });

  // Warm lazy chunks and the dev server before collecting the baseline.
  await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Tournaments", exact: true })).toBeVisible();

  const tournamentOpeningMs: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    tournamentOpeningMs.push(await timedOpen(
      page,
      `/tournaments/${TOURNAMENT_ID}`,
      async () => expect(page.getByText("WP10 Realistic Fixture").first()).toBeVisible(),
    ));
  }

  await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "Search tournaments" });
  await expect(search).toBeVisible();
  const filterStarted = performance.now();
  await search.fill("Qualification Tournament 47");
  await expect(page.getByText("Qualification Tournament 47").first()).toBeVisible();
  const matchCentreFilterMs = Math.round((performance.now() - filterStarted) * 10) / 10;

  await page.goto("/test-umpire-engine", { waitUntil: "domcontentloaded" });
  const dismissTour = page.getByRole("button", { name: "Dismiss tour" });
  if (await dismissTour.isVisible()) await dismissTour.click();
  const score = page.getByTestId("t1-score").first();
  const scoreTwo = page.getByTestId("t2-score").first();
  const addPoint = page.getByTestId("btn-add-point-t1").first();
  const addPointTwo = page.getByTestId("btn-add-point-t2").first();
  await expect(score).toHaveText("0");
  await expect(scoreTwo).toHaveText("0");
  const confirmationSamples: number[] = [];
  for (let sample = 1; sample <= 20; sample += 1) {
    const isTeamOne = sample % 2 === 1;
    const nextScore = Math.ceil(sample / 2);
    const started = performance.now();
    await (isTeamOne ? addPoint : addPointTwo).click();
    await expect(isTeamOne ? score : scoreTwo).toHaveText(String(nextScore));
    confirmationSamples.push(Math.round((performance.now() - started) * 10) / 10);
  }

  const rankingLoadingMs = await timedOpen(
    page,
    "/standings",
    async () => expect(page.getByRole("heading", { name: "Tournament Standings" })).toBeVisible(),
  );

  const browserMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : null,
      resourceCount: performance.getEntriesByType("resource").length,
    };
  });

  const results = {
    fixture: { tournaments: 48, players: 256, matchesPerPrimaryTournament: 127, disciplines: CATEGORIES },
    tournamentOpeningMs: {
      samples: tournamentOpeningMs,
      median: percentile(tournamentOpeningMs, 0.5),
      p95: percentile(tournamentOpeningMs, 0.95),
    },
    matchCentreFilterMs,
    liveScoreConfirmationMs: {
      median: percentile(confirmationSamples, 0.5),
      p95: percentile(confirmationSamples, 0.95),
    },
    profileRankingLoadingMs: rankingLoadingMs,
    activeRealtimeSubscriptions: {
      currentWebSockets: activeSockets.size,
      peakWebSockets: peakSockets,
    },
    browserMetrics,
    note: "Local Chromium/Vite baseline with deterministic REST fixtures; no release budgets were enforced.",
  };

  console.log(`WP10_PERFORMANCE_BASELINE=${JSON.stringify(results)}`);
  await testInfo.attach("wp10-performance-baseline.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
});
