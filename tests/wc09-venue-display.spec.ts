import { expect, test, type Page, type Route } from "@playwright/test";

const TOURNAMENT_ID = "00000000-0000-4000-8000-000000000909";
const tournament = {
  id: TOURNAMENT_ID,
  name: "IISc World-Class Open",
  status: "active",
  start_date: "2026-11-14",
  end_date: "2026-11-14",
  venue: "Gymkhana Hall",
  format_family: "INDIVIDUAL",
  tournament_type: "open",
  tournament_matches: [],
};

const matches = [
  match("1", "1", "in_progress", "Ananya Rao", "Meera Iyer", "19-17", "Women’s Singles", "WS_01", 1),
  match("2", "1", "scheduled", "Nisha Sen", "Ritu Das", null, "Women’s Singles", "WS_02", 2),
  match("3", "2", "playing", "Arjun / Kabir", "Dev / Eshan", "21-18, 8-6", "Men’s Doubles", "MD_01", 1),
  match("4", "2", "scheduled", "Ira / Neel", "Maya / Om", null, "Mixed Doubles", "XD_01", 2),
  match("5", "3", "in_progress", "Sana Sheikh", "Tara Menon", "11-9", "Women’s Singles", "WS_03", 1),
];

function match(
  suffix: string,
  court: string,
  status: string,
  team1: string,
  team2: string,
  score: string | null,
  category: string,
  code: string,
  order: number,
) {
  return {
    id: `00000000-0000-4000-8009-${suffix.padStart(12, "0")}`,
    tournament_id: TOURNAMENT_ID,
    category,
    match_code: code,
    round: 2,
    round_name: "Quarter-final",
    match_number: order,
    team1_label: team1,
    team2_label: team2,
    player1_id: null,
    player2_id: null,
    player3_id: null,
    player4_id: null,
    court_number: court,
    status,
    score,
    sets_history: score ? score.split(", ") : [],
    scheduled_at: `2026-11-14T0${8 + order}:00:00.000Z`,
    started_at: status === "scheduled" ? null : "2026-11-14T08:00:00.000Z",
    ended_at: null,
    winner_side: null,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
    points_to_win: 21,
  };
}

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function installVenueApi(page: Page) {
  await page.routeWebSocket(/realtime/, socket => socket.close());
  await page.route("**/auth/v1/**", route => json(route, { user: null }));
  await page.route("**/rest/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const object = (request.headers().accept ?? "").includes("application/vnd.pgrst.object");
    if (table === "tournaments") return json(route, object ? tournament : [tournament]);
    if (table === "tournament_matches") return json(route, matches);
    return json(route, []);
  });
}

async function openVenue(page: Page) {
  await installVenueApi(page);
  await page.goto(`/tournaments/${TOURNAMENT_ID}/venue`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: tournament.name })).toBeVisible();
  const dismissTour = page.getByRole("button", { name: "Dismiss tour" });
  if (await dismissTour.isVisible()) await dismissTour.click();
  await expect(page.getByRole("heading", { name: "Court 1", exact: true })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.root).toBeLessThanOrEqual(1);
}

test("venue display is legible and reflows at 1080p and 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openVenue(page);

  await expect(page.getByText("LIVE ON COURT")).toHaveCount(3);
  await expect(page.getByText("Up Next on this court")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Toggle Fullscreen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the public tournament page" })).toHaveAttribute(
    "href",
    new RegExp(`/tournaments/${TOURNAMENT_ID}$`),
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "docs/qualification/wc09-venue-1920x1080.png", fullPage: true });

  await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  await expect(page.getByText("Ananya Rao")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("venue display supports 720p, court focus, disconnect and reconnect", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openVenue(page);

  await page.getByRole("button", { name: "Court 2" }).click();
  await expect(page.getByText("Arjun / Kabir")).toBeVisible();
  await expect(page.getByText("Ananya Rao")).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "docs/qualification/wc09-venue-1280x720.png", fullPage: true });

  await context.setOffline(true);
  const venueNetworkStatus = page.getByRole("status").filter({ hasText: "Network disconnected" });
  await expect(venueNetworkStatus).toBeVisible();
  await expect(page.getByText("Arjun / Kabir")).toBeVisible();
  await context.setOffline(false);
  await expect(venueNetworkStatus).toHaveCount(0);
  await expect(page.getByText("Arjun / Kabir")).toBeVisible();
});

test("fullscreen refusal is explicit and non-destructive", async ({ page }) => {
  await openVenue(page);
  await page.evaluate(() => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
    });
  });
  await page.getByRole("button", { name: "Toggle Fullscreen" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fullscreen was not allowed" })).toBeVisible();
  await expect(page.getByText("Ananya Rao")).toBeVisible();
});
