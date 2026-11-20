# WP6 record — Match Centre, court queue and shared scorecards

State: `verified-locally` (13 November 2026)
Work package: 6 (execution playbook §13). Builds on WP5 routes (`docs/decisions/wp5-canonical-routes.md`).

Discovery note: code-review-graph MCP was unavailable this session; exploration used `grep`/direct reads.

## Decisions

1. **One match-view model.** `client/src/lib/matchView.ts` turns a `tournament_matches` row into a `MatchView` (discipline, sides with TBD/BYE/seed/winner, state, text status, parsed games, court, scheduled/started/ended times, next-match code). Surfaces render `MatchView`, not raw rows.
2. **Status vocabulary = what the domain has.** `pending`/`scheduled` (→ "Not yet scheduled" when it has no court and no time), `in_progress` (Live), `completed`, `walkover`, `cancelled`. **There is no retirement status in the schema**, so none is shown; a retirement recorded only in score text is displayed verbatim as score text. Status is never inferred from a score; winners are marked only for completed/walkover.
3. **Court queue order = push-alert order.** `buildCourtQueues` uses the same comparison as `supabase/functions/_shared/courtQueue.ts` (live first, then `scheduled_at` nulls last, round, match number). A unit test asserts Next/Following equal the alert positions. Only organiser-assigned courts are queued; nothing is moved or auto-assigned. Matches without a time show "No time set — follows the queue" rather than an invented time.
4. **Times are separate.** Scheduled, actual start and actual finish are labelled individually; no estimated times are computed (WP3's duration policy can add estimates later).
5. **Realtime stays bounded.** Match Centre and the match page use query keys prefixed `["tournament_matches", …]`, which the existing `RealtimeProvider` channel already invalidates. **No new realtime channels.** A 60 s poll runs only while online.
6. **Freshness is explicit.** "Confirmed by server at HH:MM"; offline, refresh-failed and >2 min-stale-while-live states are worded differently and offer Refresh. A failed first load shows an error, never an empty list.
7. **Filters are shareable.** `cat` (MS/WS/MD/WD/XD), `court`, `date`, and `view` (live/upcoming/courts) are URL parameters. Finished matches are paged 30 at a time and the discipline/court filters are applied server-side so pages are not padded with other disciplines.
8. **Seeds** come from `tournament_participants.seed`, matched by player or partner ID within the same discipline. Seed loading failures never hide matches.

## Files

New:
- `client/src/lib/matchView.ts` (+ `matchView.test.ts`, 19 tests)
- `client/src/components/match/MatchPrimitives.tsx` — `MatchStatusBadge`, `SeedMark`, `MatchSideRow`, `MatchTimes`, `MatchScorecard`, `scoreSummary`
- `client/src/hooks/queries/useMatchViews.ts` — open (full) and finished (paged) match views
- `client/src/components/match/MatchCentre.tsx` — Live / Upcoming / Courts and Results

Changed:
- `client/src/components/pulse/LiveTab.tsx` — canonical Live tab renders the existing live-scoring strip plus Match Centre; Results renders Match Centre in results mode. Pulse (no `route`) is unchanged.
- `client/src/pages/TournamentMatchPage.tsx` — rebuilt on the shared model and primitives; adds seeds; realtime-backed key.

Not touched (WP3 in progress): `OrderOfPlayPanel.tsx`, `restConflicts.ts`, `courtConflicts.ts`, settings, migrations.

## Verification

- `npm run check` — passed.
- `npx vitest run` — 43 files, 411 tests passed.
- `npx vite build` — passed (existing warnings).
- Browser, dev server, signed out, read-only:
  - `/tournaments/<completed>/results?cat=XD` → 30 XD results with "Load more"; each card links to its match page; screen-reader label includes sides, discipline, round, status, game scores and court.
  - Court filter → `?cat=XD&court=C1`; every card on Court 1.
  - `/tournaments/<completed>/live` → Live/Upcoming/Courts tabs with distinct empty states; `view=courts` in the URL; Back returns to Live.
  - Match page: seeds [1]/[3], winner text, per-game aligned scores, court, scheduled vs actual times, server-confirmed time.
  - 375 px: no horizontal scroll; all Match Centre controls ≥ 44 × 44 px.

## Known limitations

- No active tournament exists in the data, so Live and Courts with real in-progress matches were verified only by unit tests.
- The point-by-point live strip (`LiveScoreSection`) is still club-wide and uses its own snapshot source; Match Centre shows server-confirmed `tournament_matches` scores.
- Shared primitives are adopted in Match Centre, court queue and the match page only. Schedule (`LiveMatchSchedule`), brackets, Pulse match cards, `UpNextPanel` and archive brackets still use their own rendering — next incremental adoption.
- Estimated start times are not shown (they depend on WP3's duration policy).
- Performance baselines and subscription-count measurement belong to WP10.

## Follow-up: schedule and bracket adoption (13 November 2026)

- `matchView.ts` gains `matchOutcome()` — status, written label, winner (completed/walkover only) and parsed games for a partial row, for surfaces that keep their own layout. 5 new tests.
- **Schedule** (`LiveMatchSchedule.tsx`): each card now uses `toMatchView` + `MatchStatusBadge` + `MatchSideRow` — written status instead of "● LIVE"/"✓ Done", seeds, winner text, per-game aligned scores (previously only for finished matches, as a joined string), court via `courtLabel`, and a 44 px "Details →" link to the match page. Live-first ordering uses `matchState`. Contacts, predictions and export are unchanged.
- **Brackets** (`BracketVisual.tsx`, also used by admin): grid, list and roadmap views use `matchOutcome`. Walkover winners are now marked (previously only `completed`), headers say Completed/Walkover/Cancelled instead of "Done", and scores in `21–13` / `21:13` form are parsed instead of becoming 0. Layout and sizing are unchanged.
- Verified in the browser on the completed test tournament: schedule shows 301 cards with seeds, winners, game scores and working detail links; draw headers read "Completed" without overflow in the 180 px boxes.
- Still not adopted: Pulse match cards, `UpNextPanel`, `TeamTiesSection`, archive brackets list (it uses `BracketVisual`, so the status rules apply there too).

## Rollback

Client-only. Removing the `route && activeSubTab === "matches"` block in `LiveTab.tsx` restores the previous list on canonical pages; no database changes.

## Follow-up 2: Pulse cards, Up Next and team rubbers (13 November 2026)

Files:
- `client/src/components/feed/MatchCard.tsx` (the card Pulse's `MatchSection`/match lists render). Tournament rows (`is_friendly === false` with `tournament_id` and `winner_side`) now use `matchOutcome`: a written `MatchStatusBadge` in the collapsed and expanded headers; winners and the "defeated" line only for completed/walkover (a stale `winner_side` on a live row is ignored); games via `parseGames` (so `21:13`/`21–13` work); scheduled, started and finished times shown separately through `MatchTimes` instead of `scheduled_at || created_at`; court via `courtLabel`; and a 44 px "Match details →" link to `matchPath`. Friendly (club) matches keep their `winner_id` display. For all cards, player names wrap (no `line-clamp-2`) and the like / scoreboard / share / notify / video / expand / collapse controls are at least 44 px.
- `client/src/components/pulse/MatchSection.tsx`: filter chips are 44 px with `aria-pressed`; the discipline filter tries `disciplineOf` first, then the old text rules; the header can be reached with the keyboard (`role="button"`, `aria-expanded`, Enter/Space).
- `client/src/components/pulse/LiveTab.tsx`: the Pulse list no longer puts a tournament match whose status is live under "Completed". It now goes under "Upcoming". The inline filter chips are 44 px with `aria-pressed`.
- `client/src/components/tournament/UpNextPanel.tsx`: rebuilt on `useOpenMatchViews` (key `["tournament_matches", id, "open-views"]`, shared with Match Centre, so no new realtime channel), `buildCourtQueues` (the push-alert order) and `MatchScorecard`. Each court shows Playing, then up to 3 Next. Live matches with no court are listed under "Order of play". Walkover and cancelled matches no longer show as queued; before, only `completed` was excluded.
- `client/src/components/events/TeamTiesSection.tsx`: a new `rubberView()` builds each rubber with `toMatchView`. Both the expanded tie and the rubber-breakdown popup use `MatchStatusBadge` and `MatchSideRow`, which gives a written status, wrapping lineup names, the winner only for completed/walkover, and per-game scores. Raw score text appears only when it can't be parsed into games. Each rubber in the expanded tie shows `MatchTimes` and a 44 px "Match details →" link. An unrevealed lineup stays hidden. The popup's close button and footer button are 44 px, and team names wrap.
- New tests: `feed/MatchCard.tournament.test.tsx` (5), `tournament/UpNextPanel.test.tsx` (2), `events/TeamTiesSection.rubber.test.tsx` (3).

Verification:
- `npm run check`: no errors in these files. The remaining tsc errors come from other in-progress work: `TournamentSetupChecklist.tsx` (WP3) and `TournamentManager.tsx` → `TournamentSettingsTab` `onNavigateTab` (WP3/WP7). `check-undefined-refs` passed.
- `npx vitest run`: 49 files, 427 tests passed (this count is before the two later test files; each was also run on its own and passed).
- `npx vite build`: passed (built in about 2 min; existing chunk-size warnings).
- Browser (dev server, signed out, completed tournament `62c5341c-…`, 375 px): `/live` shows the `MatchSection` "Live Matches (0)" with its empty state. All twelve filter chips measure 44 px, Enter and Space toggle the header, there is no horizontal scroll, and no console errors appear after a reload.

Remaining gaps:
- The Pulse `MatchCard` list can only be reached when signed in (the club Pulse is behind GuestGate, and "My matches" needs a session), so it was checked through component tests, not in the browser.
- `UpNextPanel` can't be reached for DB tournaments: `TournamentDetail` sends every UUID tournament to its canonical page before rendering the panel. It should either be mounted on the canonical Overview or retired in favour of Match Centre's Courts view.
- There are no team tournaments or rubbers in the data, so the rubber UI was checked only through `rubberView` unit tests.
- Pulse cards have no seeds yet (the feed query doesn't load `tournament_participants`).
- The live-scoring `MatchBroadcastCard` (club-wide point-by-point) is outside this model.

## Follow-up 3: one court, one key (20 November 2026)

- Organisers type the same court in different ways. IISM Trials 2026 has `"1"` (17 matches), `"C1"` (10) and `"Court"` (19). The court filter showed "Court 1", "Court 1", "Court", and choosing one hid the other half of that court's matches.
- `courtKey()` in `matchView.ts` (mirrored in `supabase/functions/_shared/courtQueue.ts`) turns `1`, `01`, `C1`, `c 1`, `Court 1`, `Court-1` into `"1"`. Placeholders (`Court`, `C`, `TBD`, `TBA`, `N/A`, `-`) count as no court, so such a match reads "Not yet scheduled" when it also has no time. Named courts pass through unchanged.
- `MatchView.court` is now that key, so filters, court queues, the venue scoreboard and Up Next all treat one court as one. Old `court=C1` links still work: the URL value goes through `courtKey()` too.
- This replaces decision 7's server-side court filter. A single `court_number = …` match can't cover every spelling, so `useFinishedMatchViews` no longer filters by court and `filterMatches()` does it on the client. Results already loads every finished match, so nothing is lost.
- Push alerts (`notify-up-next`) use the same key, so "you're up next" follows the merged queue. **This needs the edge function redeployed** to take effect. Alerts are deduplicated by (match, player, position), so a changed key can't send one twice.
