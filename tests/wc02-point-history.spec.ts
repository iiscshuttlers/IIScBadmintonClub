import { expect, test, type Page, type Route } from "@playwright/test";

const TOURNAMENT_ID = "00000000-0000-4000-8000-000000000201";
const MATCH_ID = "00000000-0000-4000-8000-000000000202";

type CoverageFixture = "complete" | "partial" | "corrected";

const scoringPoints = (count: number) =>
  Array.from({ length: count }, (_, index) => [1, 1, index + 1, 0, 1, 1_700_000_000_000 + index * 20_000]);

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function installPointHistoryFixture(page: Page, coverage: CoverageFixture) {
  const points = coverage === "partial" ? scoringPoints(11) : scoringPoints(21);
  const match = {
    id: MATCH_ID,
    tournament_id: TOURNAMENT_ID,
    category: "MS",
    match_code: "MS_F_1",
    round: 3,
    round_name: "Final",
    match_number: 1,
    team1_label: "Asha Rao",
    team2_label: "Bala Singh",
    player1_id: null,
    player2_id: null,
    player3_id: null,
    player4_id: null,
    court_number: "1",
    status: "completed",
    score: "21-0",
    sets_history: ["21-0"],
    scheduled_at: "2026-11-14T09:00:00.000Z",
    started_at: "2026-11-14T09:05:00.000Z",
    ended_at: "2026-11-14T09:18:00.000Z",
    winner_side: 1,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
    points_to_win: 21,
    golden_point: 30,
    best_of_sets: 3,
    umpired_by: null,
    scored_by: null,
  };
  const tournament = {
    id: TOURNAMENT_ID,
    slug: "wc02-point-history",
    name: "WC-02 Point History Fixture",
    status: "completed",
    start_date: "2026-11-14",
    end_date: "2026-11-14",
    venue: "Gymkhana Courts",
    categories: ["MS"],
    tournament_type: "open",
    format_family: "INDIVIDUAL",
    tournament_matches: [match],
  };

  await page.route("**/auth/v1/**", (route) => fulfillJson(route, { user: null }));
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const wantsObject = (request.headers().accept ?? "").includes("application/vnd.pgrst.object");

    if (table === "tournaments") return fulfillJson(route, tournament);
    if (table === "tournament_matches") return fulfillJson(route, match);
    if (table === "tournament_match_point_logs") {
      return fulfillJson(route, {
        points,
        point_count: points.length,
        final: true,
        superseded_by_correction: coverage === "corrected",
        updated_at: "2026-11-14T09:18:00.000Z",
      });
    }
    if (table === "tournament_participants" || table === "tournament_officials" || table === "players") {
      return fulfillJson(route, wantsObject ? null : []);
    }
    if (table === "site_data") return fulfillJson(route, wantsObject ? null : []);
    return fulfillJson(route, wantsObject ? null : []);
  });
}

for (const fixture of ["complete", "partial", "corrected"] as const) {
  test(`renders ${fixture} point-history coverage honestly on mobile`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installPointHistoryFixture(page, fixture);
    await page.goto(`/tournaments/${TOURNAMENT_ID}/matches/${MATCH_ID}/points`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Asha Rao versus Bala Singh" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Points progression" })).toBeVisible();

    if (fixture === "complete") {
      await expect(page.getByRole("status").filter({ hasText: "Complete point history" })).toContainText("21 scoring rallies");
    } else if (fixture === "partial") {
      await expect(page.getByRole("note")).toContainText("Partial point history");
    } else {
      await expect(page.getByRole("note")).toContainText("Corrected result");
    }

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(horizontalOverflow).toBe(false);
    await testInfo.attach(`wc02-${fixture}-375px`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
}
