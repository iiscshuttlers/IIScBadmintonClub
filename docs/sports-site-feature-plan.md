# Sports-site feature plan: match page, stats, rankings and site-wide polish

Prepared 14 November 2026. Turns the recommendations in [`sports-site-benchmark-2026-11-14.md`](./sports-site-benchmark-2026-11-14.md) into an ordered, implementation-ready plan. Its delivery and quality rules follow [`tournament-experience-execution-plan.md`](./tournament-experience-execution-plan.md): small reviewable PRs, preserve the dirty worktree, and use `npm run check`, Vitest and `npm run build` as the gate. `tsc` skips `@ts-nocheck` files, so check those in the browser.

**Hard constraints (apply to every item):** English only; no location services; push-only notifications; tournament matches only, no friendly-match features; query results persisted by React Query must be plain JSON (no `Set`/`Map`); never `select("*")` on `players` (use `PLAYER_PUBLIC_COLUMNS`); build links with `lib/tournamentRoutes`.

## 0. Summary

| # | Item | Depends on | Estimate (dev-days) | Phase |
| --- | --- | --- | --- | --- |
| 1 | Court strip in Match Centre | — | 0.5 | A |
| 2 | "Live" marker in main navigation + Home strip | — | 1.5–2 | A |
| 3 | Last-5 form chips | — | 1.5–2 | A |
| 4 | Share score image from tournament match views | — | 1.5–2 | A |
| 5 | Match page tabs (Summary · H2H & form · Info; Points later) | 3, 4 helpful | 3–4 | B |
| 6 | Persisted point log (decision + storage + sync) | WP2 rules | 4–6 | C |
| 7 | Points tab: worm chart, game progression, key moments | 5, 6 | 3–4 | C |
| 8 | Tournament stats tab | — | 3–4 | D |
| 9 | All-time records book in Legacy | 8 (shared lib) | 3–4 | D |
| 10 | Ranking movement arrows (▲/▼, previous rank) | — | 3–4 | E |
| 11 | Personalised Home: own + followed matches first | 2, 3 | 3–4 | F |
| 12 | Pulse match list consistency | 3, 4, 5 | 4–6 | G |

About 33–46 developer-days in total. The phases are ordered so each one ships something visible on its own. A is quick wins. C is the only phase that changes how scoring writes data, so it runs alone and gets the strictest review.

## 1. Verified current state (14 November 2026)

Facts the plan relies on, checked in source this session:

- **Live scores are already per point.** During play, `hooks/useUmpireState.ts` (≈line 400) writes `score`, `sets_history` and `status: "in_progress"` to `tournament_matches`. `providers/RealtimeProvider.tsx` invalidates every `["tournament_matches", …]` query (with 0–3 s jitter) on any change. Match Centre, the new `LiveScoreTicker` and the match page (`["tournament_matches", id, "match-route", matchId]`) therefore all refresh live.
- **The point log exists only while a match is live.** `BwfMatchState.pointLog: PointLogEntry[]` (`types/umpire.ts`) records game, scoring side, both scores, serving side, a timestamp and the serve snapshot. It is broadcast inside `site_data.live_matches` via `upsert_live_match_by_id`, and `MatchService.removeLiveMatch` deletes it when the match ends. `match_rally_stats` stores rallies only for sensor-instrumented matches. **No general point history survives a finished match.**
- **`useLiveMatches`** reads `site_data.live_matches`. Its `hasLiveMatches` also counts friendlies and matches still in `setup`, and every caller opens its own realtime channel named `feed_live_matches`.
- **Sharing:** `lib/shareMatch.ts` → `lib/matchShareCard.ts::renderMatchShareCard` already renders a PNG (with the native Capacitor share and `navigator.share` file paths). It takes the legacy `match` row shape, not `MatchView`.
- **Follows:** `services/subscriptionService.ts` provides player, tournament and match subscriptions plus `fetchFollowingMatches(userId, playerIds)`. Tables: `user_player_subscriptions` and `user_tournament_subscriptions` (migration `20261113170000`).
- **Elo history:** there is no rank-snapshot table. `hooks/queries/useLeaderboardStatsQuery.ts` derives `eloHistory`/`lastEloChange` client-side from per-match `elo_change_p1..p4`. `elo_calculation_logs` exists (admin audit).
- **Home:** `components/home/HomePersonalDashboard.tsx` already uses `usePlayerMatches`, `useMyTournamentRoles` and `useLiveScoresFor`. `useLiveScoresFor` keeps only one live match per tournament.
- **Legacy:** `pages/Legacy.tsx` uses `useHashTab` with `champions`, `albums`, `photos` and `videos`.
- **Routes:** `TOURNAMENT_TABS = overview, players, draw, schedule, results, live`. Match page: `/tournaments/:id/matches/:matchId` (`pages/TournamentMatchPage.tsx`, 186 lines, one card).
- **Pulse:** `components/pulse/LiveTab.tsx` in non-route mode still renders the legacy `feed/MatchCard` list from `useFeedMatches`. It has its own discipline parsing, a Singles/Doubles/Mixed select and a time select. That file was changed on disk by another edit during this session, so re-read it before starting item 12.
- **Data-quality warning:** in the August 2026 open tournament, finals scheduled on 23 Aug show "Finished Mon 24 Aug 11:41", so some `ended_at` values were bulk-set when matches were closed after the event. Any duration statistic must defend against this (see item 8).

## 2. Shared foundations (build once, used by several items)

| Foundation | Location | Used by |
| --- | --- | --- |
| `fetchRecentForm(playerIds, n)`: a single batched query for the last *n* completed or walkover tournament matches per player, returning plain arrays | `services/formService.ts` + `hooks/queries/useRecentForm.ts`, key `["tournament_matches","form",sortedIds,n]` (realtime-invalidated) | 3, 5, 11, 12 |
| `FormChips` primitive | `components/match/MatchPrimitives.tsx` | 3, 5, 11, 12 |
| `matchViewToShareInput(view, tournament)` adapter | `lib/matchShareCard.ts` | 4, 5, 12 |
| Pure `lib/matchStats.ts` (per-match facts: margin, deuce games, total points, duration-if-trustworthy) | new | 8, 9 |
| `ChipStrip` (horizontal scroll, 44 px chips, `aria-pressed`) extracted from `DayStrip` | `components/match/ChipStrip.tsx` | 1, 8, 12 |
| `useAnyTournamentLive()` (tournament-only, shared query) | `hooks/queries/useAnyTournamentLive.ts` | 2, 11 |

## 3. Items in detail

### 1. Court strip (Phase A, 0.5 d)

**Goal.** Make court selection one tap, as with days, and show which courts are live.

- Extract `ChipStrip` from `DayStrip` in `components/match/MatchCentre.tsx`. Replace the Court `<select>` with chips "All courts · Court 1 ● · Court 2 …". The ● dot plus visually hidden "live" text marks courts with a live match.
- Keep the `court` URL parameter, sorting with `localeCompare(…, {numeric:true})` and `courtLabel`.
- Hide the strip when there is at most one court.

**Acceptance.** URL round-trips; keyboard and screen-reader users hear "Court 2, live, pressed"; no horizontal page overflow at 320 px.
**Tests.** Unit-test the live-court derivation; verify in the browser preview at 375 px.

### 2. "Live" marker in main navigation + Home strip (Phase A, 1.5–2 d)

**Goal.** As on Cricbuzz, users anywhere in the app can see that a tournament match is live and reach it in one tap.

**Data.** Add `useAnyTournamentLive()`:

```ts
// key ["tournament_matches","any-live"] → realtime invalidation already covers it
supabase.from("tournament_matches")
  .select("id, tournament_id")
  .in("status", ["in_progress"])   // align with LIVE_STATUSES used in the DB
  .limit(20)
```

It returns `{ count, tournamentIds: string[] }` (plain arrays). It respects tournament visibility through existing RLS. Use 30 s `staleTime` and no polling, since realtime drives it. Don't use `useLiveMatches` for this: it counts friendlies and `setup` states, which would break the tournament-only constraint.

**UI.**
- In `components/Navigation.tsx`, the desktop `NavLink` and the bottom bar both get a text pill "LIVE" (red, with a pulsing dot only under `motion-safe`) on the **Events** item. Its accessible name is "Events, 2 matches live". This must stay distinct from the Pulse announcements dot (line ≈176).
- Tapping it with one live tournament goes to `tournamentPath(id, "live")`; with several, to `/tournaments` with live tournaments first.
- On Home, render `LiveScoreTicker` above `HomePersonalDashboard` for each live tournament. Generalise the ticker to accept `tournamentIds: string[]` and group chips by tournament name when there are several.

**Clean-up in the same PR.** Give `useLiveMatches` one shared channel (via `RealtimeProvider` or a module-level singleton) so several mounted callers don't each subscribe to `feed_live_matches`.

**Acceptance.** The marker appears within about 3 s of a match starting and disappears within about 3 s of it finishing (realtime). It doesn't appear for friendlies or `setup` states. It's visible on the native bottom bar.
**Tests.** Hook unit test with a mocked Supabase client; a Playwright check that the nav shows "LIVE" when a fixture match is `in_progress`.

### 3. Last-5 form chips (Phase A, 1.5–2 d)

**Goal.** Give each match context, as FotMob and BWF do: each player's last five tournament results.

**Data.** `fetchRecentForm(playerIds, 5)` makes one query on `tournament_matches` where `status in (completed, walkover)` and any of `player1_id..player4_id` is in `playerIds`. It orders by `coalesce(ended_at, scheduled_at, created_at)` descending, limits to `25 × playerIds.length` (cap 200), and computes per player client-side. The result per player is `{ matchId, tournamentId, result: "W"|"L", walkover: boolean, opponentLabel, date }[]`.

- **Rules:** exclude cancelled matches. Walkovers count but are shown as "W/O" or "L/O" with a lighter style. BYEs are excluded. Doubles use each player's own record (pair-specific form can be a later option).
- **Optional DB path** (only if query cost shows up in profiling): an SQL function `recent_form(p_player_ids uuid[], p_n int)` using a lateral join, `SECURITY INVOKER` so RLS applies.

**UI.** `FormChips` shows five 20 px chips, newest on the **left**, with the letter **and** colour (never colour alone). The tooltip/`title` gives "Won vs X, MS QF, 22 Aug" and links to that match. The screen-reader summary reads "Won 3 of last 5". The empty state is "No completed matches yet".

**Placement.** The match page H2H & form tab (item 5), the player profile header (`components/player-profile`), and the expanded legacy cards (item 12).

**Acceptance.** Correct for players in several disciplines. A corrected result updates the chips after invalidation. One network request per screen, not one per player.
**Tests.** Pure function tests for W/L/walkover/BYE/cancelled handling and ordering ties.

### 4. Shareable score image from tournament views (Phase A, 1.5–2 d)

**Goal.** One-tap WhatsApp-ready result card from the match page and Results, building on the existing renderer.

- Add `matchViewToShareInput(view, { tournamentName })` in `lib/matchShareCard.ts`, mapping sides, seeds, games, winner, discipline, round and court.
- Card content: tournament name, "Men's Singles · Final", both sides (with seeds), game scores with the winner bolded, "Winner" label, date, and the club mark. The link is the absolute canonical `matchPath`.
- Build the absolute URL with `import.meta.env.BASE_URL` plus the origin. This is the same class of bug fixed in commit `4118b30` (base path dropped on GitHub Pages), so add a unit test for it.
- Add a "Share result" button on the match page Summary and an icon button on `MatchScorecard` (completed state only, kept outside the `<Link>` so it isn't a nested interactive element).
- Later in the same item (optional): a **Champions card** on the Results tab (all discipline winners) reusing the same renderer.

**Acceptance.** The PNG renders for singles, doubles, walkover and team rubbers. The native share sheet shows on Android. Falls back to download if the browser can't share files.
**Tests.** Adapter and URL-builder unit tests (canvas isn't available in jsdom). Manual check on Android.

### 5. Match page tabs (Phase B, 3–4 d)

**Goal.** One stable match URL that grows with the match, as on Cricbuzz, cricinfo and FotMob.

**Routing.**
- Extend to `/tournaments/:id/matches/:matchId/:mtab?` with `mtab ∈ summary | points | h2h | info` (default `summary`).
- Add `matchPath(tId, mId, tab?)` and `parseMatchTab()` to `lib/tournamentRoutes.ts` and update `TournamentMatchPage.test.ts`.
- In `App.tsx` the match route already precedes `/tournaments/:id/:tab?`. Keep that order.
- Existing links stay valid (no tab means Summary). Native back steps through tabs only if tabs push history. Use `replace` for tab switches so Back leaves the match, consistent with WP5's filter handling.

**Tabs.**
- **Summary.** The existing status card, plus a game-by-game table (Game 1/2/3 rows, winner bold), the `FreshnessBar` while live, next-round destination (exists), "Share result" (item 4), and the follow/reminder button (`MatchReminderModal` exists).
- **Points.** Shown only when a persisted point log exists (item 7). There is no empty tab for older matches.
- **H2H & form.** `FormChips` for every player (item 3). For singles, show the H2H record using the logic behind `HeadToHeadWidget` (`components/player-profile/HeadToHeadWidget.tsx`), refactored to accept two player IDs without a signed-in user, with a link to `/compare/:p1/:p2`. For doubles, show pair H2H through the `/doubles/:p1/:p2` data with a link, and "first meeting" when there's no history. Tournament matches only.
- **Info.** Event, round, match code, court, scheduled/started/finished (`MatchTimes`), feeds-from and advances-to links (from `advances_to_match`), tournament link. Umpire, service judge and referee names are shown (approved, §5 decision 3), with no contact details.

**UI.** Reuse the scrollable tab row pattern from `LiveTab` (extract `ScrollTabs` to `components/ui`). `aria-current="page"`, 44 px targets.

**Acceptance.** Deep links to each tab work cold (no prior Pulse state). Unknown `mtab` falls back to Summary. Loading, not-found and error states are unchanged.
**Tests.** Route parsing tests; `TournamentMatchPage` render tests per tab; Playwright deep-link test.

### 6. Persisted point log (Phase C, 4–6 d), option B approved

**Problem.** The worm chart, momentum, key moments, "biggest comeback" records and accurate per-game durations all need the point sequence after a match ends, and today it is deleted when the match finishes.

**Options.**

| Option | How | Pros | Cons |
| --- | --- | --- | --- |
| A. Append-only rows (`tournament_match_points`, one row per rally) | Insert per point; undo inserts a void row | Granular and queryable in SQL | Offline queue must preserve order; undo semantics are complex; ~100 writes per match |
| **B. Per-match revisioned snapshot (recommended)** | `tournament_match_point_logs(match_id PK, revision, points jsonb, updated_at, recorded_by)`; the umpire writes the whole compacted log with each existing per-point sync; frozen at finalisation | Undo is natural (the snapshot replaces the old one); reuses WP2's revision and operation-ID model; one row per match | The JSON grows to about 4 KB per write (compacted), which is acceptable |
| C. Copy the log only at finalisation | Store it in the finalise RPC | Fewest writes | No live worm; lost if the device dies before finalising |

**Recommended design (B).**
- Compact entry format: `[game, side(1|2|0=let/fault), t1, t2, server(1|2), tsOffsetSec]`, with `startedAt` in a header field. Only the scoring fields are copied from `PointLogEntry`; the `prev` serve snapshot is not stored.
- Write through RPC `save_match_point_log(p_match_id, p_expected_revision, p_operation_id, p_points jsonb)` with `SECURITY DEFINER`. It locks the match, checks that the caller is the current scorer (reuse the checks from `20261114100000_enforce_single_active_tournament_scorer.sql`), rejects stale revisions, returns an idempotent receipt for repeated operation IDs, and rejects writes after the match is finalised.
- Finalisation (the existing revisioned finalise RPC) stamps `final = true`. Corrections (WP7) don't edit the log; they mark it `superseded_by_correction` so charts can show "the score was corrected after play".
- RLS: public `SELECT` mirrors `tournament_matches` visibility (published tournaments only, draft-visible to officials). No client `INSERT`/`UPDATE`.
- Client: in `useUmpireState`, alongside the existing `tournament_matches` update, queue the log write through the existing offline queue (`useOfflineUmpireSync`) with the same per-user, per-match partitioning and acknowledgement-before-removal rules.
- **Recovery bonus:** `lib/umpire/resumeRecovery.ts` can then restore the full point log and serve state from the server, removing today's "partial recovery" limitation. Add this as a follow-up task.
- Retention and size: fine at club scale (≈4 KB × matches). No cleanup job is needed.

**Acceptance.** Offline scoring followed by reconnect produces exactly one consistent log. Undo removes the point server-side. Two devices can't interleave logs (the single-scorer rule). Finished matches keep their logs. Old matches simply have no log.
**Tests.** SQL harness tests (stale revision, duplicate operation, write after finalise, unauthorised caller) in the isolated Postgres 17 harness used for WP1/WP2; client queue tests; one Playwright scoring run that checks the stored log.

### 7. Points tab: worm, progression and key moments (Phase C, 3–4 d)

**Depends on 6.**
- **Worm chart:** one line per side showing cumulative points within each game (x = rally number, y = points), with game boundaries marked, an interval marker at 11 and a deuce region shaded past 20–20. Use inline SVG (no new chart dependency unless one already exists; check `package.json` for `recharts` before adding anything). Read the repo's `dataviz` skill guidance for palette and contrast; each side's line is identified by both colour and dash style.
- **Game progression table:** score after every 5 rallies, longest scoring run per side, and game duration when timestamps are trustworthy.
- **Key moments** (pure `lib/pointMoments.ts`): game points and match points (saved or converted), longest run (≥4), comeback (trailed by ≥5 then won the game), and reaching deuce or golden point (respecting the `goldenPoint` setting).
- **Live behaviour:** while a match is live, the tab reads the snapshot row (realtime-invalidated), and the chart animates only under `prefers-reduced-motion: no-preference`.
- **Accessibility:** charts get a text summary and a "View as table" toggle.

**Tests.** `pointMoments` fixtures for normal, deuce, golden point, walkover-after-start and retirement-like abandonment.

### 8. Tournament stats tab (Phase D, 3–4 d)

**Routing.** Add `stats` to `TOURNAMENT_TABS` and to the `LiveTab` tab row (and `canonicalForLiveSubTab`/`liveSubTabFor`). Show it once at least one match has completed, and update it live from completed matches only, headed "So far · N of M matches completed" until the tournament ends (§5 decision 6). Respect the discipline filter (`cat`).

**Data.** Fetch all finished matches for the tournament (the Results query without the page limit, capped at 1,000) and compute everything in pure `lib/tournamentStats.ts`:

- **Totals:** matches completed, walkovers, games played, total points, deuce games (a game reaching 20–20, or a final score above 21), three-game matches.
- **Match records:** closest match (smallest total point difference), most one-sided match, longest game (most points), longest match by points, and longest match by time **only when trustworthy**: `started_at` and `ended_at` both present, a duration between 10 and 120 minutes, and ending on the same local day. If fewer than 50% of matches have trustworthy durations, hide time-based stats and show "Match timing wasn't recorded for most matches".
- **Player leaders:** most wins, best game-win % (minimum 3 matches), most points won. Doubles are attributed to pairs.
- **Biggest upset:** only for ranked tournaments (`counts_for_elo`) where Elo deltas exist. Verify which columns hold tournament Elo deltas before building this; if they're unavailable, omit it rather than estimate.

**UI.** Stat tiles (the large number with a label), plus "leader" lists linking to the match and player. Load the `dataviz` skill before building tiles or charts.

**Acceptance.** All numbers reproduce from a fixture set. Walkovers are excluded from point and game stats but counted in totals. Teams/ties get a per-team variant (wins by team) or the tab is hidden for TEAM format in the first release.
**Tests.** `tournamentStats.test.ts` with fixtures covering MS/WS/MD/WD/XD, walkovers, untrustworthy timestamps, and the hidden-time rule.

### 9. All-time records book in Legacy (Phase D, 3–4 d)

**Goal.** A Statsguru-style club history, as on cricinfo.

**Data.** Use an SQL function `club_records()` (`SECURITY INVOKER`, published tournaments only) that returns plain JSON. Alternatively, a nightly materialized view refreshed by the existing cron infrastructure (see the `send-match-reminders` cron) if the function is slow. Start with the function and measure first.

**Records (v1):**
- Most titles (from final winners; reuse the `WinnersWallSection` source), most finals, most tournament match wins.
- Longest tournament winning streak (ordered by `ended_at` then `scheduled_at`).
- Highest Elo reached. This needs Elo history: use the item 10 snapshots once they exist, or `elo_calculation_logs` if it holds post-match ratings (verify). Otherwise defer it.
- Longest game (points) and closest final.
- **v2** (after item 6): biggest comeback and longest rally run.

**UI.** A new `records` hash tab in `pages/Legacy.tsx` next to `champions`, with category filters (Overall/MS/WS/MD/WD/XD) and a "Ranked only" toggle (default off: all published, completed tournaments, §5 decision 4), each record linking to the match or player. Every record states its coverage, e.g. "Since July 2026: match timing recorded".

**Acceptance.** Records exclude cancelled and draft-tournament matches, and ties for a record are all listed.
**Tests.** Function tests in the SQL harness, and render tests for empty and coverage states.

### 10. Ranking movement arrows (Phase E, 3–4 d)

**Goal.** BWF-style "▲3 / ▼1 / NEW" next to each rank, plus "previous rank".

**Decision:** compute movement from **stored snapshots**, not on the fly from Elo deltas. Admin adjustments, rollbacks (`rollback_elo_on_match_delete`) and eligibility changes make back-calculation unreliable.

- **Table** `ranking_snapshots(snapshot_date date, list text /* overall|singles|doubles */, player_id uuid, rank int, rating numeric, PRIMARY KEY (snapshot_date, list, player_id))`, with public read.
- **Job:** a weekly scheduled edge function (Monday 00:05 IST) using the existing cron setup. It computes ranks with **the same eligibility rule the leaderboard uses** (read `components/players-directory/LeaderboardSection.tsx`/`LeaderboardTable.tsx` and move that rule into a shared SQL function so the UI and the job can't drift). It's idempotent per date.
- **No backfill** (§5 decision 2). The first snapshot is written at launch; movement shows from the second snapshot onwards, with "Movement from <date>" until then.
- **UI:** the leaderboard gets a movement column (▲ green, ▼ red, "–", "NEW" with text, not just colour). Profile ranking tab: "Rank 7 (▲2 since last week) · peak 4". Optionally a sparkline of weekly rank on the profile (reuse the `eloHistory` sparkline style).

**Acceptance.** Movement is relative to the latest snapshot at least 6 days old. A player returning after inactivity shows "RE" (re-entry) rather than a huge jump. Snapshots never change after being written.
**Tests.** Rank-function SQL tests (ties share a rank, then skip) and UI movement-label tests.

### 11. Personalised Home (Phase F, 3–4 d)

**Goal.** As FotMob's favourites do, returning users see what they care about first.

**Data.** Build on `HomePersonalDashboard`. Combine:
- my matches (`usePlayerMatches`);
- followed players' and tournaments' matches (`subscriptionService.fetchPlayerSubscriptions`, `fetchTournamentSubscriptions`, `fetchFollowingMatches`);
- live state (realtime-invalidated `["tournament_matches", …]` queries).

**Order (one rail, max 6 cards, "See all" leads to `/my-matches`):**
1. My live match
2. My next match (with court and queue position)
3. Followed players' live matches
4. Followed tournaments' live matches
5. Followed players' next matches
6. Recent results (last 48 h) for me and followed players, with `FormChips`

**States.**
- **Signed out:** the club-wide live strip (item 2) and the featured tournament (`ActiveTournamentWidget`). No personal rail.
- **Signed in with no follows:** a "Follow players to see their matches here" call to action linking to the players directory, plus one-tap follow suggestions (recent opponents and current tournament seeds).

Notifications stay push-only through the existing subscription preferences. No email.

**Acceptance.** Deduplicates matches present in several sources (e.g. I'm playing a followed player). Ordering is stable. A failed source shows partial data with a notice, not an empty rail.
**Tests.** Pure `lib/homeRail.ts` ordering and dedupe tests; render tests for the three user states.

### 12. Pulse match list consistency (Phase G, 4–6 d)

**Goal.** One match presentation across the app. Pulse currently duplicates filtering and discipline parsing and offers a Singles/Doubles/Mixed select that can't express MS vs WS.

**Approach.**
1. **Inventory** the legacy `feed/MatchCard` features in Pulse: kudos, share, prediction poll (`MatchPredictionCard`), "match of the day", upset badge, expand/collapse, hash deep-link highlight (`#match-card-…`), and "Load more". Confirm whether `useFeedMatches` still returns any non-tournament rows. Because of the tournament-only constraint, drop them from this surface (approved, §5 decision 5) and note the count in the PR.
2. **Extend `MatchScorecard`** with an optional `footer` slot (kudos, share, prediction) rendered **outside** the link, and an optional `badges` slot (Match of the day, Upset +NNN).
3. **Swap the Pulse "Matches" sub-tab** (non-route mode) to `MatchCentre` with a `renderFooter` prop, so the discipline strip, day strip, court strip, freshness bar and grouping are shared. Remove the duplicated category select, time select and `matchCat` parsing.
4. **"My Matches"** uses the same `MatchScorecard` plus `FormChips`, keeping `MyCertificatesCard` and the reminder bell.
5. **Hash deep links:** map `#match-card-<id>` to the canonical `matchPath` (redirect), keeping old shared links working.
6. **Remove dead code** once nothing imports it (check `MatchSection` and the legacy filter helpers with `rg`; `refactor_tool` dead-code mode if the code-review-graph server is back up).

**Acceptance.** Feature parity checklist signed off. No regression in kudos or poll counts. The XD and WS/WD filters work in Pulse. Bundle size doesn't grow.
**Tests.** Existing Pulse tests updated, plus a Playwright Pulse journey (filter → open match → back).

## 4. Phasing and PR slices

| Phase | PRs (each independently shippable) |
| --- | --- |
| A — quick wins | A1 `ChipStrip` + court strip · A2 `useAnyTournamentLive` + nav marker + shared live channel · A3 Home live strip (multi-tournament ticker) · A4 form service + `FormChips` + profile header · A5 share adapter + buttons |
| B — match page | B1 routes + tab scaffold + Summary · B2 H2H & form tab (HeadToHead refactor) · B3 Info tab |
| C — point data | C1 migration + RPC + SQL harness tests · C2 client sync through the offline queue · C3 Points tab (worm, moments) · C4 resume recovery from the server log |
| D — stats | D1 `matchStats`/`tournamentStats` libs + tests · D2 Stats tab · D3 `club_records()` + Legacy Records tab |
| E — rankings | E1 shared eligibility SQL + snapshots table + weekly job (first snapshot at launch) · E2 leaderboard/profile UI |
| F — home | F1 `homeRail` lib · F2 rail UI + empty/signed-out states |
| G — Pulse | G1 `MatchScorecard` slots · G2 Pulse Matches → `MatchCentre` · G3 My Matches · G4 dead-code removal |

A and B can run in parallel (different files). C must not overlap any other scoring work. D, E and F are independent of each other.

## 5. Owner decisions (settled 14 November 2026)

1. **Point log storage: option B approved.** One revisioned record per match (`tournament_match_point_logs`), updated as points are scored through `save_match_point_log`. Items 6 and 7 and the comeback records are unblocked.
2. **Ranking backfill: none. Start from the first snapshot** (owner delegated the call). Estimated history would be wrong in exactly the cases that matter (rollbacks, admin Elo adjustments, eligibility changes), and an arrow that's wrong does more harm than no arrow. The first weekly snapshot is taken at launch. Arrows appear from the second snapshot a week later. Until then, the movement column shows "–" and a "Movement from <date>" note. The backfill PR is dropped from Phase E.
3. **Officials on the Info tab: yes.** Umpire, service judge and referee names are shown publicly, using only public player columns (`PLAYER_PUBLIC_COLUMNS`) or the officials' display names. Contact details are never shown.
4. **Records scope: all published, completed tournaments by default, with a "Ranked only" filter** (owner delegated the call). Titles, finals and match records are club history whether or not a tournament counted for Elo. Elo-based records (highest Elo reached, biggest upset) come only from ranked matches anyway and say so in their coverage line. Friendly and cancelled matches are always excluded.
5. **Pulse rows: drop non-tournament rows** (owner delegated the call). This follows the tournament-only constraint. G2 first measures how many such rows `useFeedMatches` still returns and notes it in the PR. Nothing is deleted from the database; the rows are only no longer shown on this surface.
6. **Stats during live play: update live** (owner delegated the call). Stats are computed only from **completed** matches, so an in-progress score never appears as a record. The tab header reads "So far · N of M matches completed" until the tournament ends, then "Final". Records are refreshed by the existing realtime invalidation of `["tournament_matches", …]`.

## 6. Release gates (per PR)

- `npm run check`, related Vitest suites and `npm run build` pass. Visual changes are verified in the browser preview at 375 px and desktop, in light and dark, with no console errors.
- No new `select("*")` on `players`; persisted query results are JSON-serialisable.
- Accessibility: text labels alongside colour, 44 px targets, `aria-current`/`aria-pressed`, motion behind `motion-safe`.
- Migrations are additive, tested in the isolated harness, and not applied to hosted Supabase without explicit approval.
- Each PR updates the benchmark doc's status table and this plan's item status.

## 7. As built (14–15 November 2026)

All twelve items are implemented. Differences from the plan above, and why:

| Item | Plan said | Built | Why |
| --- | --- | --- | --- |
| 2 | Shared channel for `useLiveMatches` | Not changed | It has a single caller (`LiveTab`), so there is nothing to share. |
| 4 | Absolute URL from `import.meta.env.BASE_URL` + origin | `getBaseShareUrl()` + `matchPath` | On Android the app's origin is the device itself; shares must use the public site. A test pins the GitHub Pages base path. |
| 5 | Service judge on Info | Umpire (`umpired_by`, else `scored_by`) and tournament referees | No service-judge field exists. Referees are readable by signed-in users only (RLS), so visitors don't see that row. |
| 6 | New `save_match_point_log` RPC + offline queue changes | The existing `upsert_live_match_by_id` also stores the compacted log | That RPC already authorises the single active scorer and carries the full log on every point, so a lost write heals on the next point and no umpire-client change was needed. A failing log write can never break live scoring. Finish freezes the log; later score corrections flag it. |
| 6 | Resume recovery as a follow-up | Done | `restorePointLog` restores the log and serving side only when it agrees with the match row. |
| 8 | Biggest Elo upset | Seed upsets | Tournament matches don't store Elo changes. |
| 8 | — | Forfeits entered as 0–21 count as wins and as "Walkovers & forfeits", but not in score records or upsets | The August 2026 data has several such matches. |
| 8 | Deuce = 20–20 | Both sides reach `points_to_win − 1` | Most August matches were single games to 30, where 29–29 is the only deuce. `points_to_win` is now part of `MatchView`. |
| 9 | `club_records()` SQL function | Computed in the app (`lib/clubRecords.ts`) from paged decided matches | Simpler to test; club-scale data. Revisit if it gets slow. |
| 8, 9, 5 | Names from team labels | Names looked up by player id (`usePlayerNames`) | Team label order doesn't always match `player1/player3`, which credited titles to the wrong person. |
| 10 | "Movement from <date>" note before the first comparison | Arrows simply appear once a 6-day-old snapshot exists | Nothing to compare in week one. The first snapshot was taken 14 Nov 2026. |
| 11 | Follow suggestions on Home | A "Find players" link to the directory | Suggestions need a ranking of candidates; left out of v1. |
| 12 | Pulse Matches → `MatchCentre` | Pulse keeps its data flow (likes, polls, match of the day, load more, `#match-card-…` links) but renders every match with `MatchScorecard` via `PulseMatchItem`; discipline and time filters are shared chips; friendlies no longer appear | Same presentation without losing Pulse's social features. `MatchCard` and `MatchSection` stay because other pages use them. |

**Verification.** Typecheck, the full Vitest suite and `npm run build` pass. SQL: `supabase/tests/point_log_assertions.sql` and `ranking_snapshot_assertions.sql` pass in an isolated Supabase Postgres 17 container (`result_revision_bootstrap.sql` + `sports_plan_harness_setup.sql` + the scorer-lock migration + both new migrations). Browser (375 px, light and dark): Results court strip and share icons, Stats tab, match page Summary / H2H / Info, Legacy Records. Signed-in and live-only surfaces (Pulse, profile form chips and rank line, Home rail, LIVE marker, Points tab) are covered by component tests in `components/match/sportsSiteUi.test.tsx`, because the browser session wasn't signed in and no match was live.
