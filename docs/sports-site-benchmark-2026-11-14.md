# Sports-site benchmark: tournament and site-wide improvements

Prepared 14 November 2026. Extends [`tournament-experience-improvement-plan.md`](./tournament-experience-improvement-plan.md) (which already borrows from BWF) with patterns from Cricbuzz, ESPNcricinfo and football apps (FotMob, ESPN/BBC Sport, Flashscore).

**Evidence limits.** Cricbuzz and the BWF World Tour site refused automated fetches in this session, and search returned no first-party documentation of ESPNcricinfo or FotMob page layouts. The patterns below come from general product knowledge of these well-known apps, not from fresh page inspection. Spot-check each one against the live site before it shapes detailed design. The repository constraints still apply: English only, no location, push-only notifications, tournament matches only, club Elo, and no external data integration.

## 1. Patterns worth borrowing

| Pattern | Seen in | What it solves | Our equivalent / status |
| --- | --- | --- | --- |
| Persistent live-score strip above section tabs | Cricbuzz top bar, FotMob/ESPN score bar | Live scores are one tap away from every section, not only the Live tab | **Implemented** — `LiveScoreTicker` on all canonical tournament tabs except Live |
| Single scrollable section tab row | Cricbuzz / cricinfo match and series pages, FotMob | Up to 10 sections no longer wrap into 2–3 rows of pills on phones | **Implemented** — `LiveTab` tab row scrolls horizontally and keeps the active tab in view |
| Day strip (Yesterday / Today / Tomorrow / dates) | FotMob, Flashscore, BWF order of play | Changing day is the most common filter; a dropdown hides it | **Implemented** — `DayStrip` in `MatchCentre` replaces the Day select |
| Results grouped by event and round | BWF results ("MS – Final"), cricinfo series results | Scanning a finals day by discipline instead of one long list | **Implemented** for Results; Upcoming stays chronological on purpose |
| Current game/over highlighted | BWF live scores (current game), Cricbuzz current over | The live number reads first | **Implemented** — boxed current-game score on live `MatchScorecard` |
| Match page sub-tabs: Summary · Scorecard · Commentary/Timeline · H2H · Info | Cricbuzz, cricinfo, FotMob | One stable match URL that grows with the match lifecycle | Partial — `TournamentMatchPage` exists; extend the tabs (WP6) |
| Point progression "worm" / momentum chart | cricinfo worm and Manhattan, FotMob/Flashscore momentum | Shows the story of a game: runs, comebacks, game points | Proposed — needs a persisted point log (see §3, data gap) |
| Rally/point timeline with key moments | Cricbuzz ball-by-ball, FotMob event timeline | Interval, game point, match point, longest streak | Proposed — same point-log dependency |
| Pre-match H2H plus last-5 form (W/L chips) | FotMob, BWF H2H, cricinfo | Gives an upcoming match context | Partial — H2H widget and `PerformanceTrends` exist; add form chips to match and player pages |
| Ranking movement arrows (▲3 / ▼1) and "previous rank" | BWF world rankings | Makes ranking pages a story | Proposed — no rank-change field exists; snapshot Elo ranks weekly |
| Tournament stats leaders (most wins, longest match, biggest upset) | cricinfo series stats, FotMob top stats | Gives spectators something beyond scores | Proposed — derive from completed `tournament_matches` |
| Follow player/tournament → personalised "My feed" first | FotMob favourites, Cricbuzz notifications | Returning users see their matches first | Partial — subscriptions exist (WP9); surface followed items at the top of Home/Pulse |
| Records book (all-time) | cricinfo Statsguru/records | Long-term engagement and club history | Proposed — fits the Legacy section |
| Shareable result card image | FotMob/ESPN share cards | Results spread to WhatsApp groups | Partial — certificates and `shareMatch` exist; add a generated score-card image |
| Freshness/"updated N s ago" next to live scores | Cricbuzz auto-refresh, FotMob | Trust in live numbers | Already strong — `FreshnessBar` labels server confirmation and staleness |

## 2. Implemented in this change (14 November 2026)

Files: `client/src/lib/matchGrouping.ts` (+ tests), `components/match/LiveScoreTicker.tsx`, `components/match/MatchCentre.tsx`, `components/match/MatchPrimitives.tsx`, `components/pulse/LiveTab.tsx`.

- **Live score strip.** Compact chips (discipline, court, current-game score, games won) linked to the canonical match page. Renders nothing when no match is live. Reuses `useOpenMatchViews`, so it shares the existing cache and adds no extra query.
- **Scrollable tournament tab row.** One horizontally scrolling row with ≥44 px targets. The active tab is scrolled into view horizontally only (never moves the page), including after web fonts load.
- **Day strip** in Match Centre, labelled Today / Tomorrow / Yesterday where applicable, and still URL-backed (`date`).
- **Results grouped by event · round**, with match counts. Group order follows the existing most-recent-first sort.
- **Current game boxed** on live scorecards.

Verification: `npm run check` passed; `matchGrouping.test.ts` (5 tests) passed. In the dev preview at 375 px, the Results tab was scrolled into view, the page had no horizontal overflow, grouped results and the day strip rendered, and the reloaded page had no console errors. **Not verified:** the ticker and the live-game highlight with a real in-progress match, because no match was live in the data used.

## 3. Remaining recommendations, prioritised

Detailed, implementation-ready plan for every item below: [`sports-site-feature-plan.md`](./sports-site-feature-plan.md). Correction found while planning: per-point scores already reach `tournament_matches` during play, and the point log exists in `site_data.live_matches` until the match ends. The gap is that the log isn't **kept** after the match.

### P1 — tournament (fold into WP6 Match Centre)

1. **Match page tabs.** Summary (scorecard, status, court, next-round destination) · Points (timeline/worm when data exists) · H2H & form · Info (officials, times). Use stable sub-routes under `matchPath`.
2. **Form chips.** Last five tournament results as W/L chips on scorecards' expanded view, the match page and the player profile header. Reuse `PerformanceTrends` data.
3. **Tournament stats tab** (Results lifecycle): most wins, longest match (from `started_at`/`ended_at`), closest games (deuce games), biggest Elo upset. Compute client-side from completed matches first; move to a view if it gets slow.
4. **Court strip on Live**: a compact "Court 1 · Court 2 …" horizontal selector, replacing the court dropdown in the same way as the day strip.

### P1 — data gap blocking the richest patterns

5. **Persist the point log.** `lib/umpire/resumeRecovery.ts` states that point history and serve state are unavailable in fallback recovery. The worm chart, momentum and key-moment timeline all need an append-only per-match point log (server-side, revisioned, the same exactly-once rules as WP2). Decide this before designing the visualisations.

### P2 — site-wide

6. **Global live indicator.** A red "Live" dot on the Events/Pulse nav item and a site-wide ticker on Home while any tournament match is live (Cricbuzz pattern). Pulse already has a notification dot; use a distinct, text-labelled live state.
7. **Personalised home.** Followed players' and the signed-in player's next or live match first, then club-wide content (FotMob favourites).
8. **Ranking movement.** Weekly Elo rank snapshots and ▲/▼ movement plus "previous rank" on the leaderboard and profiles (BWF rankings).
9. **Records book** in Legacy: most titles, longest unbeaten run, highest Elo reached, longest match.
10. **Shareable result images.** Generate a score-card PNG from `MatchScorecard` data for WhatsApp sharing, extending `shareMatch`.
11. **Consistency pass.** Replace remaining pill-row filters and dropdowns used for frequent choices (time filter in legacy Pulse matches, category selects) with the same strip/segmented controls, and adopt `MatchScorecard` in the legacy Pulse `MatchCard` list. That list still uses its own discipline parsing, and its category select offers only Singles, Doubles and Mixed.

### Explicitly not borrowed

- Betting odds or win-probability models presented as fact. Club polls (`MatchPredictions`) remain opinion polls.
- Ads/sponsor slots, video highlights infrastructure, and multi-language support (English only).
- Location-based "near you" features (no location services).
