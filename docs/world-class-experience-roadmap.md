# World-class badminton experience roadmap

Prepared: 14 November 2026. Scope: IISc Shuttlers website and Android app.

## 1. Outcome and scope

Make the product dependable during a tournament, effortless for players to navigate, compelling for spectators, and actionable for organisers. Borrow interaction patterns from Cricbuzz, Badminton4U and Sofascore; use club-owned tournament data.

This document is a planning deliverable. It does not authorize implementation, deployment, hosted database changes or a release. It extends the existing tournament execution and sports-site feature plans rather than replacing their work.

Include all three distinctive additions: doubles intelligence, factual tournament stories and venue scoreboard mode.

### Existing decisions to preserve

- Cover MS, WS, MD, WD and XD wherever applicable; use all four participant positions for conflicts and comparisons.
- Tournament matches only for these new experiences. Preserve club Elo and existing registration workflows.
- English only, push notifications only, no location services, no BWF scraping or external-results integration.
- Keep conflict checks within one tournament unless a separate product decision expands scope.
- Reuse canonical tournament routes, shared match presentation, existing follows, scoring recovery and correction facilities.
- Distinguish device-saved, syncing, server-confirmed, stale and failed states.
- Protect private contacts, device tokens and following data. Public displays use public tournament/player fields only.

## 2. Evidence and current state

> **Status update — 14 November 2026 (evening).** The live, dated status of every capability is now kept in [`world-class-evidence-ledger.md`](./world-class-evidence-ledger.md); this section is the original starting snapshot. Since it was written, WC-00 to WC-07 and WC-09 have been completed **locally**, and WC-08 now has a local organiser review/publish flow and a public story section. Nothing in this roadmap is staging- or production-verified yet. What remains is mostly *external* qualification — an isolated staging project, a physical Android device, a physical venue screen and a hosting decision — see §19 and [`docs/tickets/`](./tickets/README.md).

Original snapshot: code-review-graph tools were not available in that session; targeted file inspection was the fallback. Findings describe local source, not the deployed product. All file paths below were rechecked and exist.

| Capability | Evidence reviewed | Planning treatment | Status now (see ledger) |
| --- | --- | --- | --- |
| Match Summary / Points / H2H / Info | `client/src/pages/TournamentMatchPage.tsx`, existing sports-site plan | Existing; qualify and improve rather than rebuild | Source-present, UI tests pass |
| Point progression and key moments | `client/src/components/match/MatchPointsTab.tsx`, `lib/pointLog.ts` | Existing; verify rules, completeness and correction handling | Locally verified (WC-02) |
| Personalised next/live match rail | `client/src/lib/homeRail.ts`, `components/home/MyTournamentCard.tsx` | Existing; extend into a player action card | Locally verified (WC-03) |
| Doubles-pair profile | `client/src/pages/DoublesPairProfile.tsx`, `lib/comparison.ts` | Existing; audit eligibility and extend comparison depth | Locally verified (WC-06) |
| Actionable admin cards | `client/src/components/admin/AdminActionCards.tsx` | Existing; reconcile action coverage before adding cards | Locally verified (WC-07) |
| Player/tournament/match follows and preferences | `client/src/services/subscriptionService.ts`, `followingAlerts.ts` | Existing; verify delivery, deduplication and deep links | Locally verified (WC-05); provider unqualified |
| Court selection, result sharing, stats, records, ranking movement | `docs/sports-site-feature-plan.md`, As built section | Documented locally implemented; qualification required | Mixed; see ledger |
| Offline recovery, revision checks, rest/court guards, correction audit | `docs/tournament-experience-execution-plan.md` | Documented locally implemented; verify full deployed path | Unit-verified; physical device open (WC-01) |
| Tournament story | `lib/tournamentStory.ts`, `components/tournament/TournamentStoryPanel.tsx` | Built in WC-08 | Locally verified; staging publish open |
| Venue display | `pages/VenueScoreboardPage.tsx`, `lib/venueDisplay.ts` | Built in WC-09 | Browser-verified; physical soak open |

The existing sports-site document includes an As built heading dated 14–15 November. Treat its verification statements as recorded reports, not independently reproduced evidence or proof of future work. Likewise, verify any claimed snapshot job or migration against the actual target environment before relying on it.

### Phase 0 evidence ledger

For each capability record: source location, current behavior, test evidence, browser evidence, Android evidence, migration state, deployed version, known gap and owner. Use distinct states: proposed, source-present, locally-verified, staging-verified, production-verified. Attach dated evidence rather than inferring one state from another.

## 3. Product journeys

| Person | Primary journey | Success condition |
| --- | --- | --- |
| Player | Open Home → next match → court/draw → changed schedule | Knows the next action and whether its information is current |
| Spectator | Open public tournament → live courts → match → player/pair | Understands scores and match context without unnecessary sign-in |
| Umpire | Start assigned match → score offline → reopen → reconnect → finish | No acknowledged point is lost; final result is applied once |
| Organiser | Open tournament attention list → inspect issue → resolve | Issue count and downstream state reflect the resolution |
| Venue operator | Open published tournament display → choose courts → fullscreen | Readable, current public scores with a clear offline state |

## 4. Delivery order and effort

Estimates are engineering effort for one engineer familiar with the repository, including focused tests and documentation. They are not delivery commitments. Phase 0 must re-estimate them after identifying completed work and release gaps. Do not add previous roadmap estimates again for work already built.

| Phase | Work package | Estimate | Dependency |
| --- | --- | --- | --- |
| 0 | Evidence ledger, UX inventory, performance baseline | 2–3 days | None |
| 1 | Tournament reliability and release qualification | 5–8 days | Phase 0; repair scope may expand |
| 2A | My tournament dashboard | 3–5 days | Reliable authoritative match/schedule data |
| 2B | Court-first viewing and navigation continuity | 3–5 days | Phase 0; schedule freshness contract |
| 2C | Push preference and delivery qualification | 3–5 days | Event identity and correction semantics |
| 3A | Match narrative and player/ranking polish | 3–5 days | Qualified point logs and eligibility policy |
| 3B | Doubles intelligence | 5–8 days | Canonical identities and comparison policy |
| 3C | Organiser attention coverage | 3–5 days | Phase 1; observable issue sources |
| 4A | Factual tournament stories | 4–6 days | Validated aggregates and correction handling |
| 4B | Venue scoreboard mode | 4–6 days | Phase 2B; public read permissions |
| 4C | Public sharing and discovery polish | 2–4 days | Stable routes and hosting feasibility |
| 5 | Integrated pilot, accessibility and release checks | 4–6 days | All features selected for the release |

Total provisional effort: 44–71 engineer-days, before contingency. Allow roughly 15–20% contingency after Phase 0; event availability and release approvals add calendar time. Ship smaller releases rather than waiting for the full roadmap. Independent UI packages can be scheduled separately, but scoring and correction changes should be serialized.

## 5. Phase 0 — reconcile and measure

1. Reconcile this document against the existing sports-site and tournament execution plans. Mark duplicate work as validation, enhancement or already complete.
2. Inventory public/signed-in/official/admin routes, shared components, notification events and deployment configuration.
3. Create a reusable isolated tournament fixture: all five disciplines, singles and doubles, guest identity, multiple courts, custom scoring rules, scheduled/live/completed/walkover/cancelled examples and a corrected result.
4. Add incomplete point history, missing schedule, unavailable court and unreliable historical timestamps to the fixture.
5. Measure Home, tournament, match, player/pair and admin journeys on representative data. Capture device, network, build, dataset and timing method.
6. Produce a gap list with owner, severity, expected evidence and release dependency.

Exit: an agreed baseline and a reconciled backlog. A source-present feature cannot silently become a new implementation task.

## 6. Phase 1 — prove tournament reliability

### Tasks

- Verify offline scoring through disconnect, app backgrounding, force-stop, reopen, reconnect and completion using a real Android device and isolated event.
- Test competing scorers, expired sessions, scorer takeover, stale result revisions and duplicate finalization retries.
- Confirm the same final result appears in the match page, bracket, schedule, profile and rating history after invalidation.
- Check actual-rest and occupied-court protections across all participant positions, including XD.
- Verify point-log persistence and recovery when log writes fail, arrive late, or disagree with a corrected final score.
- Show useful recovery actions; preserve unsent work. Never present optimistic progress as a server acknowledgement.
- Reconcile hosted/staging migration state separately from local SQL harness results.

### Acceptance

- Device restart restores the latest locally acknowledged scoring state in the qualified scenarios.
- Retried completion creates one authoritative result and one set of downstream effects.
- A stale writer cannot overwrite a newer score/result.
- A score correction either propagates consistently or enters an explicit controlled resolution path.
- Spectators see freshness and last successful confirmation; reconnect causes a full reconciliation.
- Native recovery, concurrency and permission evidence is attached to the release ledger.

Deliverable: a reliability qualification report with unresolved blockers and replayable scenarios. Extend current recovery and correction code rather than introducing a second scoring system.

## 7. Phase 2A — My tournament

Build on `HomePersonalDashboard` and `buildHomeRail`.

### Player card

- Prioritize own live match, then next scheduled match; show unscheduled matches honestly.
- Include tournament, discipline, partner, opponent, round, court and scheduled time when known.
- Distinguish scheduled start, estimated start, match call and reporting time. Show reporting time only when explicitly configured; do not invent an offset.
- Link directly to match, draw and court schedule. Show schedule-change context when a trustworthy previous value exists.
- Support players with multiple disciplines without hiding another upcoming match; keep the primary card concise and expose the full list.
- Keep official assignments distinct from player participation. Provide signed-out and no-upcoming-match states.

Acceptance: a player can reach their next match in one action from Home; no incorrect countdown for unscheduled matches; correction/rescheduling updates the card; long doubles names remain readable at 320 px and 200% zoom.

## 8. Phase 2B — court-first viewing

Extend `MatchCentre`, `OrderOfPlayPanel` and existing live-court views.

- Group each court into Playing now / Next scheduled / Later. Mark unassigned fixtures separately.
- Show authoritative status and last refresh; estimates must be labelled and must not imply an official court assignment.
- Preserve date, discipline, court, selected tab and list position across match navigation, refresh and native back.
- Render overlapping/conflicting assignments as a warning rather than choosing one silently.
- Use one shared scorecard and status vocabulary across Home, Pulse, schedule, match and venue display.

Acceptance: deep links reproduce filters; browser/native back restores context; finishing a match moves it out of Playing now without duplication; stale cached schedules remain visibly stale.

## 9. Phase 2C — useful push notifications

Reuse current subscription preferences and provider. Audit existing functionality before adding fields or handlers.

1. Create an event matrix for match call, assigned court/time change, start, final result and corrected result. Map each to existing supported preferences; add a distinct start preference only if needed.
2. Define event identity using entity, event type and authoritative revision. Deduplicate recipient/event delivery when player, tournament and match follows overlap.
3. Record retry outcome and provider acceptance separately from device receipt; do not claim an alert was read from a send response.
4. Test cold start, warm start, signed-out destination, deleted/hidden match and outdated app links.
5. Define muting and unsubscribe behavior, expired reminders after rescheduling, and suppression of stale queued events.
6. Document notification-disabled/device-offline behavior. In-app schedules remain the authority; push is not guaranteed delivery.

Acceptance: one logical alert for overlapping follows; preferences respected; a rescheduled match does not retain an obsolete reminder; each permitted alert opens the right canonical screen.

## 10. Phase 3A — match and player depth

Improve existing match tabs rather than recreating them.

- Audit game-point, match-point, interval, deuce and scoring-run logic against the configured scoring rules, including single-game-to-30 formats. Inspect hard-coded 11-point chart markers before generalizing.
- Label scoring runs as scoring runs, not physiological or tactical momentum measurements.
- Show point-history coverage: complete, partial, unavailable or invalidated by correction. Suppress unsupported derived claims.
- Offer a text/table alternative to charts and keyboard/touch-accessible exploration.
- Explain ranking snapshot date, comparison period and eligible contributing results. Show career best only when historical evidence supports it.
- Make all aggregate counts reconcile with a filtered match list and a visible sample size.

Acceptance: one complete match, one partial history, one custom-rule event and one corrected match produce accurate, intelligible displays. No invented point history or ranking backfill.

## 11. Phase 3B — doubles intelligence

Extend `DoublesPairProfile`, existing H2H components and shared comparison eligibility.

### Features

- Stable pair identity independent of member order; preserve both players' identities and public links.
- Pair overview: matches played, wins/losses, recent form, tournaments and titles where the data supports attribution.
- Pair-versus-pair comparison with dated meetings, event, round and game scores.
- Discipline and date-range filters; distinguish MD, WD and XD.
- Player partnership history with explicit match counts. Sort by an explained criterion such as matches played; avoid declaring a best partner from tiny samples.
- Explain whether walkovers/retirements count as wins and which score-based statistics exclude them.
- Keep individual-versus-individual, played-together and pair-versus-pair measures distinct.

### Data and acceptance

Use canonical player IDs, not team-label parsing. Reuse existing guest resolution; unresolved identities get an explicit limitation rather than speculative merges. Pair order reversal returns identical results. Changed sides and partner positions do not change attribution. Corrected/voided results refresh comparisons. Empty histories say no recorded meetings. Title counts agree with the published event results. No new pair rating system is part of this scope.

Deliver in slices: pair identity/policy → comparison service and tests → pair overview → pair comparison → partnership history and mobile polish.

## 12. Phase 3C — organiser command centre

Extend `AdminActionCards` and existing tournament admin routes.

| Issue | Required evidence | Action |
| --- | --- | --- |
| Missing official | Assignment and match readiness | Open officials assignment |
| Court/player conflict | Current schedule and participant slots | Open filtered Order of Play |
| Delayed scheduled match | Scheduled time and current authoritative state | Review schedule; never auto-move published fixtures |
| Unresolved identity | Existing claim/guest queue | Open controlled resolution preview |
| Disputed/corrected result | Existing dispute and audit records | Open review/correction flow |
| Score sync problem | Observable server/device report with timestamp | Show scope and recovery information |

Do not report zero sync failures merely because offline devices cannot contact the server. Define lateness thresholds explicitly and distinguish estimated delays from confirmed incidents.

Acceptance: role-scoped cards show accurate counts; denied/unknown/empty states differ; resolving an issue refreshes its card; no private information reaches public screens; downstream-started matches block unsafe simple correction.

## 13. Phase 4A — factual tournament stories

Start with deterministic templates over validated aggregates. Generative text is unnecessary for v1.

### Story types

- Tournament completed: champions and finalists by discipline.
- Day/session recap: completed matches and notable verified results, using configured event timezone and actual completion evidence.
- Seed upset: lower-seeded winner against a higher seed under a documented seed policy.
- Close game or comeback: only where rules and sufficiently complete point history establish the claim.
- Milestone: only when the records coverage supports statements such as a recorded title count; avoid unrestricted all-time claims.

### Workflow

1. Generate a draft from published, eligible tournament results.
2. Attach links to every supporting match and the source revision/coverage.
3. Let an authorised organiser review, edit and publish using existing content facilities where possible.
4. Distinguish editorial wording from computed facts. Recheck computed facts at publication.
5. Invalidate or flag stories when supporting results change. Never silently retain an incorrect champion claim.
6. Share a public story link and optional image using existing sharing utilities.

Acceptance: drafts stay private; missing data omits a claim; corrections trigger review; sample stories agree with result drill-downs. No smash, error, rally-length or tactical claims derived solely from scores.

Deliver in slices: fact definitions → tested aggregation/templates → review UI → public story → correction lifecycle.

## 14. Phase 4B — venue scoreboard mode

### Display

- Read-only route for a published tournament, with selectable courts and optional fullscreen.
- Two layouts initially: one-court large scoreboard and multi-court overview. Show upcoming assignments where authoritative.
- Large names and score numerals, discipline, round, court and match status; doubles partners remain legible.
- Clear last-confirmed time, stale/disconnected banner and automatic reconciliation after reconnect.
- Optional rotation pauses on operator interaction and respects reduced-motion preferences. Avoid automatic rotation in the first slice if it reduces readability.
- QR/link to the public tournament, generated from the public share base URL rather than a device-local origin.
- No scoring controls, contact details, private drafts or personal notifications. This is an explicitly selected display mode, not device-location tracking.

### Acceptance

- Verify on an actual venue screen at expected viewing distance; record screen size, resolution and readability outcome.
- Test 1080p, 720p and a browser fallback; handle fullscreen refusal and sleep/wake without hiding the score.
- Run a two-hour soak with repeated match transitions, connection loss and recovery; inspect memory/subscription growth.
- Cached scores never appear current after connectivity is lost; reconnect replaces stale state with a fresh authoritative read.
- Hidden/draft events remain inaccessible through the display route.

Deliver in slices: public read model → single-court layout → multi-court layout → reconnect/fullscreen behavior → venue rehearsal.

## 15. Phase 4C — public website and sharing

- Verify anonymous tournament, match, player and pair journeys under the current publication/access policy.
- Preserve legacy links, base paths and Android-to-public-site sharing.
- Audit document titles, descriptions, canonical URLs, social preview images and published content discovery.
- Check whether the present static hosting can return route-specific metadata to link crawlers. If not, propose prerendering or a hosting change with cost/maintenance implications before promising rich previews.
- Keep app-oriented actions in Android and public discovery/share landing pages on the website, using the same data and match components.

Acceptance: a fresh shared URL opens its intended content; permitted public pages work without prior selection; denied/private pages reveal no content through metadata; preview behavior is verified with the actual hosting setup.

## 16. Shared engineering requirements

### Data and services

Inventory existing schema/RPCs and deployed migrations before proposing new structures. Candidate additions are event receipts, story source revisions and missing preferences only where no suitable facility exists. Keep migrations additive and compatible with older Android clients and queued operations. Read the Supabase skill and current official documentation when implementing database work.

Reuse `MatchView`, shared eligibility, `tournamentRoutes`, existing query-key prefixes and public player projections. Persist plain JSON in query caches. Avoid one new realtime subscription per widget; measure subscription/query growth. Move aggregation server-side only when observed data volume justifies it.

### Quality targets

These are proposed release targets, not measured current performance:

| Measure | Target and method |
| --- | --- |
| Web page experience | Aim for LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at the 75th percentile; use lab proxies until sufficient real-user samples exist |
| Spectator score freshness | Aim for p95 ≤5 s from server acknowledgement to visible spectator update under the documented normal-network profile |
| Local scoring feedback | Aim for p95 ≤100 ms on the supported test phone; keep server confirmation separate |
| Data correctness | Zero result/aggregate discrepancies in the release fixture and pilot audit |
| Accessibility | WCAG 2.2 AA target for changed journeys; automated checks plus keyboard, screen-reader, zoom and contrast inspection |
| Recovery | All named offline/restart/concurrency scenarios pass; document recovery timing rather than inventing an SLA |

Use operation timestamps and privacy-conscious diagnostics. Record whether clocks are synchronized when measuring cross-device latency. Push provider acceptance is not a device-delivery latency measurement.

## 17. Verification and release

For each work package: focused type/reference checks, behavior tests, production build and affected browser journeys. Use `npm run check`, relevant Vitest suites and `npm run build`; run the broader required release gate at integration. Documentation-only planning does not require rerunning application tests.

Minimum integrated matrix:

- Public visitor, member, assigned official and organiser; direct endpoint permission checks for changed protected operations.
- All five disciplines; normal scoring and custom formats; walkover, retirement where supported, cancellation, partial data and corrected result.
- Two browser sessions plus Android; reconnect, app restart, expired login and stale cached content.
- 320/375 px mobile, desktop, light/dark, 200% zoom, keyboard, screen reader and reduced motion.
- Follow overlap, muted subscriptions, rescheduled reminders and cold-start push links.
- Pair order reversal, guest resolution and participant-side changes.
- Story invalidation and two-hour venue display rehearsal.

### Rollout

1. Local/isolation: deterministic fixtures and migration harness where applicable.
2. Staging: verify schema compatibility, permissions, realtime updates and notification delivery using test accounts/devices.
3. Rehearsal tournament: run start-to-finish with player, umpire, organiser and spectator roles.
4. Small club pilot: enable only qualified features; nominate an organiser and engineering responder.
5. Broad release: proceed only with recorded sign-off on unresolved limitations and a compatible rollback path.

Separate releases: reliability qualification; player/court/notification polish; comparisons/admin improvements; stories/venue displays. Feature flags can disable presentation but do not roll back written data. Document old-client behavior and migration recovery separately.

## 18. Risks and decisions

| Risk | Response |
| --- | --- |
| Existing features mistakenly rebuilt | Phase 0 reconciliation and source evidence |
| Scoring changes disturb live tournaments | Isolated fixtures, serialized scoring work and staged pilot |
| Historical timestamps or identities distort analytics | Coverage labels, canonical IDs and explicit eligibility |
| Point-log gap produces false comeback story | Completeness gate; omit unsupported claims |
| Sparse doubles history implies false superiority | Show sample sizes; avoid opaque chemistry scores |
| Notifications arrive late or twice | Revision-based event identity, expiry and deduplication |
| Offline devices are invisible to admin | Label observability limits instead of claiming healthy sync |
| Static hosting cannot generate previews | Feasibility check before architecture change |
| Large worktree causes accidental overwrites | Bounded changes, inspect current diffs, preserve unrelated work |

Decisions needed during implementation: pilot event/date and named owners; event reporting-time configuration; acceptable lateness threshold; public story publication permissions; venue screen inventory; hosting changes only if metadata requires them. Use existing product policies until these decisions are made; none block preparation of this plan.

## 19. First actionable backlog

1. WC-00: create the evidence ledger and reconcile completed roadmap items.
2. WC-01: qualify one Android offline/restart-to-finish journey and one two-scorer conflict.
3. WC-02: audit custom-rule point-chart markers, key moments and corrected-log behavior.
4. WC-03: design My tournament using existing Home rail and canonical match routes.
5. WC-04: qualify court-filter/back-navigation continuity on web and Android.
6. WC-05: document/test notification event identity, expiry and deep links.
7. WC-06: audit existing pair profile and implement canonical pair-comparison policy.
8. WC-07: reconcile admin issue sources and observability limits.
9. WC-08: specify/test factual story templates and review/invalidation flow.
10. WC-09: implement single-court venue display, then multi-court and soak qualification.
11. WC-10: verify public sharing metadata against actual hosting.
12. WC-11: run integrated rehearsal, update evidence ledger and prepare release decision.

Each ticket should record scope, dependencies, source touchpoints, data changes, acceptance scenarios, test evidence, deployment state and known limitations. Completion requires observable behavior and evidence, not merely merged source.

### Revised effort after reconciliation (14 November 2026)

The 44–71 engineer-day estimate in §4 assumed most features still had to be built. After the local implementation pass, the remaining work is qualification, not construction:

| Remaining work | Ticket | Estimate | Blocked on |
| --- | --- | --- | --- |
| Staging replay of the full migration chain, RLS/role matrix | WC-11a | 2–3 days | An approved isolated Supabase project/branch |
| Physical Android recovery, native back, push acceptance | WC-01 / WC-05 | 2–3 days | A connected device or emulator; non-production push tokens |
| Venue screen rehearsal and two-hour soak | WC-09 | 1 day + soak | Access to the venue screen |
| Public metadata: prerender/edge or host change | WC-10 | 1 day decision; 2–5 days if prerender | Product/hosting decision |
| Stories: staging publish, non-admin organiser permission (optional), walkover-final policy | WC-08 | 1–2 days | Staging; product decision on organiser role |
| Controlled tournament rehearsal and screen-reader matrix | WC-11 | 2–3 days | A nominated event and owners |

Revised total: roughly 9–17 engineer-days plus external lead time. Ticket files with acceptance criteria live in [`docs/tickets/`](./tickets/README.md).
