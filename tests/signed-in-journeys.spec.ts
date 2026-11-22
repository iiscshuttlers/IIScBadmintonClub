import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

/**
 * Signed-in UI journeys against deterministic, intercepted Supabase responses.
 * A fake session is placed in storage; every REST/auth/functions/realtime call
 * is answered locally, so nothing reaches (or mutates) the hosted project and
 * no real account is needed. Covers WP7 admin cards, WP8 claim + head-to-head,
 * and the contact-privacy client rules (no `select=*` on players).
 */

const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const MEMBER = "00000000-0000-4000-8000-0000000000b1";
const RIVAL = "00000000-0000-4000-8000-0000000000b2";
const GUEST = "00000000-0000-4000-8000-0000000000c1";
const TOURNAMENT = "00000000-0000-4000-8000-000000000101";

function supabaseHost(): string {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const line = readFileSync(f, "utf8").split(/\r?\n/).find((l) => l.startsWith("VITE_SUPABASE_URL="));
    if (line) return new URL(line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")).hostname;
  }
  return "placeholder.supabase.co";
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
function fakeSession(userId: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, email, role: "authenticated", aud: "authenticated", exp })}.sig`;
  return {
    access_token: token,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: { id: userId, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

const player = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  full_name: name,
  nickname: null,
  avatar_url: null,
  gender: "female",
  role: "player",
  is_guest: false,
  is_approved: true,
  deleted_at: null,
  elo_rating: 1200,
  singles_elo: 1200,
  doubles_elo: 1200,
  mixed_elo: 1200,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const PLAYERS = [
  player(ADMIN, "Club Admin", { role: "admin" }),
  player(MEMBER, "Asha Rao"),
  player(RIVAL, "Bina Iyer"),
  player(GUEST, "Asha (guest)", { is_guest: true }),
];

const H2H_MATCHES = [
  { id: "m1", tournament_id: TOURNAMENT, status: "completed", category: "WS", match_code: "WS_F_01", round_name: "Final",
    player1_id: MEMBER, player2_id: RIVAL, player3_id: null, player4_id: null, winner_side: 1, winner_id: MEMBER,
    score: "21-15, 21-18", sets_history: ["21-15", "21-18"], ended_at: "2026-10-01T10:00:00Z", scheduled_at: null,
    created_at: "2026-10-01T09:00:00Z", tournaments: { name: "Open 2026", status: "completed" } },
  { id: "m2", tournament_id: TOURNAMENT, status: "walkover", category: "WS", match_code: "WS_SF_01", round_name: "Semi-final",
    player1_id: RIVAL, player2_id: MEMBER, player3_id: null, player4_id: null, winner_side: 2, winner_id: MEMBER,
    score: null, sets_history: null, ended_at: "2026-09-01T10:00:00Z", scheduled_at: null,
    created_at: "2026-09-01T09:00:00Z", tournaments: { name: "Autumn 2026", status: "completed" } },
];

interface Seen { playerSelects: string[]; rpcs: Record<string, unknown>[]; rpcNames: string[] }

// Cross-origin responses must expose content-range or supabase-js cannot read counts.
const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" };

async function fulfill(route: Route, body: unknown, headers: Record<string, string> = {}) {
  await route.fulfill({ status: 200, contentType: "application/json", headers: { ...CORS, ...headers }, body: JSON.stringify(body) });
}
const count = (route: Route, n: number) =>
  route.fulfill({ status: 200, headers: { ...CORS, "content-range": `0-0/${n}` }, body: "" });

async function installApi(page: Page, me: string, overrides: Record<string, (url: URL) => unknown> = {}): Promise<Seen> {
  const seen: Seen = { playerSelects: [], rpcs: [], rpcNames: [] };
  // Surface app exceptions in the test output instead of a generic error card.
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message} | ${(e.stack ?? "").split("\n").slice(1, 4).join(" | ")}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // React logs boundary-caught errors as "%o" + Error object: read the object.
    void Promise.all(
      m.args().map((a) => a.evaluate((v: unknown) => (v instanceof Error ? `${v.message} @ ${(v.stack ?? "").split("\n")[1] ?? ""}` : String(v))).catch(() => "")),
    ).then((parts) => {
      const text = parts.join(" ").slice(0, 500);
      if (/Error|error/.test(text)) console.log(`[console.error] ${text}`);
    });
  });
  const host = supabaseHost();
  const meRow = PLAYERS.find((p) => p.id === me)!;
  const email = me === ADMIN ? "admin@fixture.test" : "member@fixture.test";

  await page.addInitScript(
    ([key, session]) => {
      localStorage.setItem(key as string, session as string);
      localStorage.setItem("onboarding_completed_v1", "1"); // skip the first-run tour
      // Keep boundary-caught errors readable from the test (see dumpAppErrors).
      const w = window as unknown as { __appErrors: string[] };
      w.__appErrors = [];
      const orig = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        const err = args.find((x) => x instanceof Error) as Error | undefined;
        if (err) w.__appErrors.push(`${err.message} @ ${(err.stack ?? "").split("\n").slice(1, 3).join(" ")}`);
        orig(...args);
      };
    },
    [`sb-${host.split(".")[0]}-auth-token`, JSON.stringify(fakeSession(me, email))],
  );
  await page.routeWebSocket(/realtime/, (ws) => ws.close());
  await page.route("**/functions/v1/**", (r) => fulfill(r, {}));
  await page.route("**/storage/v1/**", (r) => r.fulfill({ status: 404, body: "" }));
  await page.route("**/auth/v1/**", (r) => fulfill(r, fakeSession(me, email).user));
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.split("/rest/v1/")[1] ?? "";
    const wantsObject = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const isHead = req.method() === "HEAD" || (req.headers()["prefer"] ?? "").includes("count=exact");

    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      seen.rpcNames.push(fn);
      seen.rpcs.push({ fn, body: req.postDataJSON?.() ?? null });
      if (overrides[`rpc:${fn}`]) return fulfill(route, overrides[`rpc:${fn}`](url));
      if (fn === "get_my_player_private") return fulfill(route, [{ id: me, email, iisc_email: null, contact_number: null, sr_number: null }]);
      if (fn === "resolve_my_player_id") return fulfill(route, me);
      return fulfill(route, []);
    }

    const table = path.split("?")[0];
    if (overrides[table]) {
      const body = overrides[table](url);
      if (isHead && typeof body === "number") return count(route, body);
      // A numeric override represents count-only fixture data. If another
      // widget reads rows from the same table, return an honest empty list
      // instead of a number that violates the PostgREST row shape.
      if (typeof body === "number") return fulfill(route, wantsObject ? null : []);
      return fulfill(route, wantsObject && Array.isArray(body) ? body[0] ?? null : body);
    }
    if (table === "players") {
      seen.playerSelects.push(url.searchParams.get("select") ?? "");
      const idEq = url.searchParams.get("id")?.replace(/^eq\./, "");
      if (isHead) return count(route, 0);
      if (idEq) {
        const row = PLAYERS.find((p) => p.id === idEq) ?? null;
        return fulfill(route, wantsObject ? row : row ? [row] : []);
      }
      return fulfill(route, wantsObject ? meRow : PLAYERS);
    }
    if (isHead) return count(route, 0);
    return fulfill(route, wantsObject ? null : []);
  });
  return seen;
}

async function dumpAppErrors(page: Page) {
  const errs = await page.evaluate(() => (window as unknown as { __appErrors?: string[] }).__appErrors ?? []);
  for (const e of errs) console.log(`[app error] ${e}`);
}

function expectNoPrivatePlayerReads(seen: Seen) {
  for (const sel of seen.playerSelects) {
    expect(sel, `player select must not request private columns: ${sel}`).not.toMatch(/(^|,)\s*\*\s*(,|$)|\bemail\b|contact_number|sr_number/);
  }
}

test("member compares two players: reconciled totals, walkover kept separate", async ({ page }) => {
  const seen = await installApi(page, MEMBER, {
    tournament_matches: () => H2H_MATCHES,
  });
  await page.goto(`/h2h?a=${MEMBER}&b=${RIVAL}`);
  await expect(page.getByRole("heading", { name: "Head-to-head" })).toBeVisible();
  await expect(page.getByLabel("1 wins to 0")).toBeVisible();
  await expect(page.getByText(/walkovers 1–0 \(not counted\)/)).toBeVisible();
  await expect(page.getByText(/Walkover — Asha Rao advanced/)).toBeVisible();
  await page.getByRole("button", { name: "XD" }).click();
  await expect(page).toHaveURL(/cat=XD/);
  await expect(page.getByText(/No recorded meetings in XD/)).toBeVisible();
  expectNoPrivatePlayerReads(seen);
});

test("member asks to claim a guest record; nothing is linked by the request", async ({ page }) => {
  const seen = await installApi(page, MEMBER, {
    player_claim_requests: () => [],
    "rpc:request_player_claim": () => ({ request_id: 1, status: "pending", created: true }),
  });
  await page.goto(`/player/${GUEST}`);
  await expect(page.getByText(/is a guest record/)).toBeVisible().catch(async (e) => {
    await dumpAppErrors(page);
    throw e;
  });
  await page.getByRole("button", { name: "This is me — request link" }).click();
  const send = page.getByRole("button", { name: "Send request" });
  await expect(send).toBeDisabled();
  await page.getByLabel("How can an administrator verify this is you?").fill("I played the 3 Oct friendly; Bina can confirm.");
  await send.click();
  await expect.poll(() => seen.rpcNames.includes("request_player_claim")).toBe(true);
  expect(seen.rpcNames).not.toContain("merge_player_identity");
  expect(seen.rpcNames).not.toContain("decide_player_claim");
  expectNoPrivatePlayerReads(seen);
});

test("admin dashboard lists actionable items that link to their fix", async ({ page }) => {
  // A window around "today" in any timezone keeps the tournament active.
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const seen = await installApi(page, ADMIN, {
    tournaments: () => [{ id: TOURNAMENT, name: "Club Open", status: "active", start_date: day(-2), end_date: day(2) }],
    tournament_officials: () => [],
    tournament_matches: () => [],
  });
  await page.goto("/admin#overview");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  const officials = page.getByRole("button", { name: /Club Open: no umpire or referee assigned/ });
  await expect(officials).toBeVisible();
  // Friendly-match disputes were removed with the friendly matches table.
  await expect(page.getByRole("button", { name: /disputed results/ })).toHaveCount(0);
  await officials.click();
  await expect(page).toHaveURL(new RegExp(`/tournament-admin\\?id=${TOURNAMENT}&tab=officials`));
  expectNoPrivatePlayerReads(seen);
});

test("mobile home shows one actionable My tournament card", async ({ page }) => {
  const primaryMatch = "00000000-0000-4000-8000-000000000310";
  const otherMatch = "00000000-0000-4000-8000-000000000311";
  const partner = "00000000-0000-4000-8000-0000000000b3";

  await page.setViewportSize({ width: 375, height: 812 });
  const seen = await installApi(page, MEMBER, {
    tournaments: () => [{
      id: TOURNAMENT,
      name: "Spectrum Open",
      status: "active",
      start_date: "2026-11-14",
      end_date: "2026-11-16",
    }],
    tournament_matches: () => [
      {
        id: primaryMatch,
        tournament_id: TOURNAMENT,
        category: "XD",
        match_code: "XD_QF_01",
        round: "QF",
        round_name: "Quarter-final",
        match_number: 1,
        team1_label: "Asha Rao & Dev Kumar",
        team2_label: "Bina Iyer & Chitra Shah",
        player1_id: MEMBER,
        player2_id: RIVAL,
        player3_id: partner,
        player4_id: "00000000-0000-4000-8000-0000000000b4",
        court_number: "2",
        status: "scheduled",
        score: null,
        sets_history: null,
        scheduled_at: "2026-11-15T09:30:00Z",
        started_at: null,
        ended_at: null,
        winner_side: null,
        advances_to_match: null,
        rubber_label: null,
        tie_id: null,
        points_to_win: 21,
        tournaments: { name: "Spectrum Open" },
      },
      {
        id: otherMatch,
        tournament_id: TOURNAMENT,
        category: "WS",
        match_code: "WS_R1_01",
        round: "R1",
        round_name: "Round 1",
        match_number: 2,
        team1_label: "Asha Rao",
        team2_label: "Bina Iyer",
        player1_id: MEMBER,
        player2_id: RIVAL,
        player3_id: null,
        player4_id: null,
        court_number: null,
        status: "pending",
        score: null,
        sets_history: null,
        scheduled_at: null,
        started_at: null,
        ended_at: null,
        winner_side: null,
        advances_to_match: null,
        rubber_label: null,
        tie_id: null,
        points_to_win: 21,
        tournaments: { name: "Spectrum Open" },
      },
    ],
  });

  await page.goto("/");

  const card = page.getByRole("region", { name: "My tournament" });
  await expect(card.getByRole("heading", { name: "Your next match" })).toBeVisible();
  await expect(card.getByText("Spectrum Open").first()).toBeVisible();
  await expect(card.getByRole("link", { name: "Open match" })).toHaveAttribute(
    "href",
    `/tournaments/${TOURNAMENT}/matches/${primaryMatch}`,
  );
  await expect(card.getByRole("link", { name: /WS.*Round 1/i })).toHaveAttribute(
    "href",
    `/tournaments/${TOURNAMENT}/matches/${otherMatch}`,
  );
  await expect(card.getByText("Time not assigned")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your next match" })).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/report(?:ing)? time/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expectNoPrivatePlayerReads(seen);
});

test("tournament match back preserves filters and scroll context", async ({ page }) => {
  const filteredRoute = `/tournaments/${TOURNAMENT}/schedule?cat=XD&court=2&date=2026-11-15&status=upcoming`;
  const matches = Array.from({ length: 12 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(410 + index).padStart(12, "0")}`,
    tournament_id: TOURNAMENT,
    category: "XD",
    match_code: `XD_R1_${String(index + 1).padStart(2, "0")}`,
    round: 1,
    round_name: "Round 1",
    match_number: index + 1,
    team1_label: `Asha Rao & Partner ${index + 1}`,
    team2_label: `Bina Iyer & Rival ${index + 1}`,
    player1_id: MEMBER,
    player2_id: RIVAL,
    player3_id: null,
    player4_id: null,
    court_number: "2",
    status: "scheduled",
    score: null,
    sets_history: null,
    scheduled_at: `2026-11-15T${String(8 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}:00Z`,
    started_at: null,
    ended_at: null,
    winner_side: null,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
    points_to_win: 21,
  }));
  const seen = await installApi(page, MEMBER, {
    tournaments: () => [{
      id: TOURNAMENT,
      name: "Spectrum Open",
      status: "active",
      format_family: "INDIVIDUAL",
      categories: ["XD"],
      start_date: "2026-11-14",
      end_date: "2026-11-16",
      show_participants: true,
    }],
    tournament_matches: (url) => {
      const requestedId = url.searchParams.get("id")?.replace(/^eq\./, "");
      return requestedId ? matches.find((match) => match.id === requestedId) ?? null : matches;
    },
    tournament_participants: () => [],
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(filteredRoute);
  const firstMatch = matches[0].id;
  const matchLink = page.locator(`a[href="/tournaments/${TOURNAMENT}/matches/${firstMatch}"]`).first();
  await page.locator("summary").filter({ hasText: "Sunday, 15 November" }).click();
  await expect(matchLink).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, Math.min(700, document.documentElement.scrollHeight - innerHeight)));
  const listScroll = await page.evaluate(() => window.scrollY);
  expect(listScroll).toBeGreaterThan(100);

  await matchLink.click();
  await expect(page).toHaveURL(new RegExp(`/tournaments/${TOURNAMENT}/matches/${firstMatch}$`));
  const savedListScroll = await page.evaluate((route) =>
    Number(sessionStorage.getItem(`iiscshuttlers:scroll:${route}`)), filteredRoute);
  expect(savedListScroll).toBeGreaterThan(100);
  const tournamentBack = page.getByRole("link", { name: "Spectrum Open" }).first();
  await expect(tournamentBack).toHaveAttribute("href", filteredRoute).catch(async (error) => {
    await dumpAppErrors(page);
    throw error;
  });

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${filteredRoute.replace(/[?]/g, "\\?")}$`));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(Math.max(0, savedListScroll - 5));

  await page.locator("summary").filter({ hasText: "Sunday, 15 November" }).click();
  await matchLink.click();
  await tournamentBack.click();
  await expect(page).toHaveURL(new RegExp(`${filteredRoute.replace(/[?]/g, "\\?")}$`));
  expectNoPrivatePlayerReads(seen);
});

test("match Back control returns to the previous screen, or up when opened directly", async ({ page }) => {
  const filteredRoute = `/tournaments/${TOURNAMENT}/schedule?cat=XD&court=2&date=2026-11-15&status=upcoming`;
  const match = {
    id: "00000000-0000-4000-8000-000000000501",
    tournament_id: TOURNAMENT,
    category: "XD",
    match_code: "XD_R1_01",
    round: 1,
    round_name: "Round 1",
    match_number: 1,
    team1_label: "Asha Rao & Partner",
    team2_label: "Bina Iyer & Rival",
    player1_id: MEMBER,
    player2_id: RIVAL,
    player3_id: null,
    player4_id: null,
    court_number: "2",
    status: "scheduled",
    score: null,
    sets_history: null,
    scheduled_at: "2026-11-15T08:00:00Z",
    started_at: null,
    ended_at: null,
    winner_side: null,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
    points_to_win: 21,
  };
  await installApi(page, MEMBER, {
    tournaments: () => [{
      id: TOURNAMENT,
      name: "Spectrum Open",
      status: "active",
      format_family: "INDIVIDUAL",
      categories: ["XD"],
      start_date: "2026-11-14",
      end_date: "2026-11-16",
      show_participants: true,
    }],
    tournament_matches: (url) => (url.searchParams.get("id") ? match : [match]),
    tournament_participants: () => [],
  });
  const matchRoute = `/tournaments/${TOURNAMENT}/matches/${match.id}`;
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  const backControl = breadcrumb.getByRole("link", { name: "Back" });
  const atFilteredRoute = new RegExp(`${filteredRoute.replace(/[?]/g, "\\?")}$`);

  // From the filtered schedule into a match and Back again: history, not a push.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(filteredRoute);
  await page.locator("summary").filter({ hasText: "Sunday, 15 November" }).click();
  await page.locator(`a[href="${matchRoute}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${matchRoute}$`));
  const lengthOnMatch = await page.evaluate(() => history.length);
  await backControl.click();
  await expect(page).toHaveURL(atFilteredRoute);
  expect(await page.evaluate(() => history.length)).toBe(lengthOnMatch);
  await expect(breadcrumb.getByRole("link", { name: "All tournaments" })).toBeVisible();

  // Opened straight on the match (a shared link): Back goes up to the last
  // tournament view, replacing the entry instead of leaving the site.
  await page.goto(matchRoute);
  await expect(backControl).toHaveAttribute("href", filteredRoute);
  const lengthOnDirect = await page.evaluate(() => history.length);
  await backControl.click();
  await expect(page).toHaveURL(atFilteredRoute);
  expect(await page.evaluate(() => history.length)).toBe(lengthOnDirect);
});

// ── Gallery photo alerts (migration 20261121150000_gallery_album_alerts) ──

const GALLERY_PHOTOS = [
  { id: "g1", title: "Final", category: "Tournaments", subfolder: "Open Tournament August 2026",
    path: "gallery/Tournaments/Open Tournament August 2026/1.jpg", url: "https://res.cloudinary.com/demo/image/upload/v1/1.jpg" },
  { id: "g2", title: "Team", category: "Tournaments", subfolder: "BPL-2024",
    path: "gallery/Tournaments/BPL-2024/2.jpg", url: "https://res.cloudinary.com/demo/image/upload/v1/2.jpg" },
];

interface GalleryWrite { table: string; method: string; body: any; prefer: string }

/** Stateful fakes for the gallery alert reads and writes, layered over installApi. */
async function installGallery(page: Page) {
  const state = {
    muted: [] as string[],
    overrides: [] as { album: string; subscribed: boolean }[],
    enabled: true,
    writes: [] as GalleryWrite[],
  };
  const preflight = (route: Route) =>
    route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-methods": "*", "access-control-allow-headers": "*" } });
  const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
  const record = (table: string, route: Route) => {
    const req = route.request();
    const w = { table, method: req.method(), body: req.postDataJSON(), prefer: req.headers()["prefer"] ?? "" };
    state.writes.push(w);
    return w;
  };

  await page.route("**/res.cloudinary.com/**", (r) => r.fulfill({ status: 404, body: "" }));
  await page.route("**/rest/v1/site_data**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return preflight(route);
    if (req.method() === "POST") {
      const { body } = record("site_data", route);
      if (body?.key === "gallery_muted_albums") state.muted = body.value;
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    const key = new URL(req.url()).searchParams.get("key")?.replace(/^eq\./, "");
    const value = key === "gallery_images" ? GALLERY_PHOTOS : key === "gallery_muted_albums" ? state.muted : null;
    const rows = value == null ? [] : [{ value }];
    return fulfill(route, wantsObject(route) ? rows[0] ?? null : rows);
  });
  await page.route("**/rest/v1/gallery_album_subscriptions**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return preflight(route);
    if (req.method() === "POST") {
      const { body, prefer } = record("gallery_album_subscriptions", route);
      for (const r of Array.isArray(body) ? body : [body]) {
        const i = state.overrides.findIndex((o) => o.album === r.album);
        if (i >= 0 && prefer.includes("ignore-duplicates")) continue;
        if (i >= 0) state.overrides.splice(i, 1);
        state.overrides.push({ album: r.album, subscribed: r.subscribed });
      }
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    return fulfill(route, state.overrides);
  });
  await page.route("**/rest/v1/players**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return preflight(route);
    if (req.method() === "PATCH") {
      const { body } = record("players", route);
      if (typeof body?.pref_notify_gallery === "boolean") state.enabled = body.pref_notify_gallery;
      return route.fulfill({ status: 204, headers: CORS, body: "" });
    }
    if (new URL(req.url()).searchParams.get("select") === "pref_notify_gallery") {
      const row = { pref_notify_gallery: state.enabled };
      return fulfill(route, wantsObject(route) ? row : [row]);
    }
    return route.fallback();
  });
  return state;
}

test("member controls new-photo alerts per album and for the whole gallery", async ({ page }) => {
  await installApi(page, MEMBER);
  const gallery = await installGallery(page);
  // An opt-out made with the old browser-only bell.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("legacy-seeded")) return;
    sessionStorage.setItem("legacy-seeded", "1");
    localStorage.setItem("gallery_unsubscriptions", JSON.stringify(["BPL-2024"]));
  });

  await page.goto("/legacy?filter=Open%20Tournament%20August%202026#albums");

  // On by default, with no setup by the member.
  const openOn = page.getByRole("button", { name: "Turn off alerts for Open Tournament August 2026" });
  await expect(openOn).toBeVisible();
  await expect(openOn).toHaveAttribute("aria-pressed", "true");

  // The old opt-out moves to the server without overwriting newer choices, then leaves storage.
  await expect(page.getByRole("button", { name: "Turn on alerts for BPL 2024" })).toBeVisible();
  expect(gallery.writes.find((w) => w.table === "gallery_album_subscriptions")).toMatchObject({
    prefer: expect.stringContaining("ignore-duplicates"),
    body: [{ user_id: MEMBER, album: "BPL-2024", subscribed: false }],
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gallery_unsubscriptions"))).toBeNull();

  // Bundled albums never get uploads, so they have no bell; members can't mute for everyone.
  await expect(page.getByRole("button", { name: "Spectrum 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: /alerts for Spectrum 2026/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /for everyone/ })).toHaveCount(0);

  await openOn.click();
  await expect(page.getByRole("button", { name: "Turn on alerts for Open Tournament August 2026" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => gallery.overrides).toContainEqual({ album: "Open Tournament August 2026", subscribed: false });

  // Notification settings show the same choices and the gallery-wide switch.
  await page.goto("/settings");
  await page.getByRole("button", { name: /Notification Settings/ }).click();
  const dialog = page.getByRole("dialog");
  const master = dialog.getByRole("switch", { name: "New gallery photos" });
  await expect(master).toBeChecked();
  await expect(dialog.getByRole("switch", { name: "Alerts for Open Tournament August 2026" })).not.toBeChecked();
  const bpl = dialog.getByRole("switch", { name: "Alerts for BPL 2024" });
  await expect(bpl).not.toBeChecked();
  await bpl.click();
  await expect(bpl).toBeChecked();
  await expect.poll(() => gallery.overrides).toContainEqual({ album: "BPL-2024", subscribed: true });

  await master.click();
  await expect(master).not.toBeChecked();
  await expect.poll(() => gallery.enabled).toBe(false);
  await expect(dialog.getByRole("switch", { name: /^Alerts for/ })).toHaveCount(0);
});

test("admin mutes an album's photo alerts for everyone", async ({ page }) => {
  await installApi(page, ADMIN);
  const gallery = await installGallery(page);
  await page.goto("/legacy?filter=BPL-2024#albums");

  const mute = page.getByRole("button", { name: "Mute BPL 2024 for everyone" });
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await mute.click();
  await expect(page.getByRole("button", { name: "Alert everyone about BPL 2024" })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => gallery.muted).toEqual(["BPL-2024"]);
  expect(gallery.writes.find((w) => w.table === "site_data")?.body).toMatchObject({ key: "gallery_muted_albums", value: ["BPL-2024"] });
  // A muted album is off for members (the admin included) until they turn its bell back on.
  await expect(page.getByRole("button", { name: "Turn on alerts for BPL 2024" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn off alerts for Open Tournament August 2026" })).toBeVisible();
});
