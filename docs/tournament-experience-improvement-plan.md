# Tournament experience and operational reliability plan

Prepared: 12 November 2026. Status updated 13 November 2026; reliability foundation implemented locally, migrations verified in isolation, staging verification and deployment pending.

Sports-site benchmark (14 November 2026): [`docs/sports-site-benchmark-2026-11-14.md`](./sports-site-benchmark-2026-11-14.md) adds Cricbuzz, ESPNcricinfo and football-app patterns (score strip, day strip, grouped results, match-page tabs, point-progression chart, form chips, ranking movement), records what was implemented and prioritises the rest, including site-wide items.

Execution handoff: [`docs/tournament-experience-execution-plan.md`](./tournament-experience-execution-plan.md) converts the remaining roadmap into ordered, owner-ready work packages with setup steps, touchpoints, acceptance tests and release gates.

## Implementation progress — 13 November 2026

The first two reliability batches are implemented locally. No hosted database migration has been applied.

- Offline umpire snapshots are serialized, attributed to the signed-in umpire, coalesced per match and removed only after the exact operation is acknowledged. Sync uses the existing atomic `upsert_live_match_by_id` RPC rather than replacing the shared live-match registry.
- The scoring screen distinguishes a device-saved score, an in-progress server sync and a sync requiring retry. Offline persistence now follows the resulting match state, covering point additions, deductions and direct edits.
- Rest checks include all four player slots across MS, WS, MD, WD and XD. They use `ended_at` when available and label the 30-minute match-duration fallback as an estimate.
- The setup checklist now verifies all playable matches, participant/pair completeness, scoring rules, officials and load failures. A partial schedule no longer passes because one match has a court and time.
- Test infrastructure now supplies deterministic in-memory `localStorage` under Node 26.
- Final tournament scoring now has an additive revisioned RPC with row locking, expected revisions and operation IDs. Identical retries return an already-applied receipt before Elo or bracket progression can run again; conflicting completed results are rejected.
- Walkovers and BYEs use the dedicated walkover RPC rather than the played-score finalization path.
- Court scheduling detects overlapping actual/estimated intervals, shows warnings for pending edits and re-reads current server rows before saving. Conflicting saves from a stale screen are blocked client-side.
- Court reservations are also protected at the database boundary with a transaction-scoped advisory lock and overlap trigger. Team-tie rubbers sharing the parent tie's propagated slot are treated as one reservation.
- Starting tournament scoring now uses a checked RPC at the actual start action. It locks and re-reads the match, verifies the current official, rejects a changed schedule, occupied court, player already active in another match, or an actual finish less than 15 minutes earlier, and applies the start idempotently.
- A database trigger protects the transition to `active`, including direct REST updates. It rejects incomplete details, entrants/pairs, fixtures, scoring, playable sides and court/time assignments with an actionable blocker list.
- Verification: `npm run check` passed; `npx vitest run` passed 43 files and 402 tests; `npm run build` passed. Vitest still prints two non-failing jsdom navigation warnings and the build retains existing dynamic/static-import warnings. The complete WP1/WP2 additive migration set passes in a fresh isolated Supabase Postgres 17 harness, including exactly-once finalization, conflicting completion, readiness, court/start protection, correction audit/idempotency, bracket repair and explicit authorization rejection. Genuine two-session result and court races also pass. The repository's full historical migration replay remains unavailable because the checked-in chain does not create its foundational `public.players` table before `20260619100000_admin_history.sql` references it.

Remaining in phases 1–2: representative full-schema/staging migration verification, old-client/direct-RPC policy, replacement end-to-end/native recovery evidence, configurable rest policy and reasoned schedule-override audit records. Genuine concurrent-session tests and the user-facing audited score-conflict workflow now pass locally; see [`docs/wp0-wp2-audit-2026-11-13.md`](./wp0-wp2-audit-2026-11-13.md).

## 1. Scope and decisions

This combines the seven BWF-inspired proposals and the operational improvements from the following discussion. It extends existing functionality instead of assuming every item needs a new implementation.

- Include MS, WS, MD, WD and mixed doubles (XD) in filters, scoring presentation, scheduling, rest checks, statistics and test fixtures. Check conflicts by player identity across disciplines, not merely inside one category.
- Exclude the proposed registration-status workflow: do not add submitted/accepted/waitlisted/action-required/withdrawn states or redesign registration around those states. Existing registration behavior remains outside this plan. Existing registrations may be used in end-to-end tests and existing actionable queues.
- Retain duplicate identity resolution and missing-partner validation where they support onboarding and tournament readiness; neither requires a new registration workflow.
- Preserve the repository plan's constraints: English only, no location services, push-only notifications, tournament matches only, and JSON-serializable persisted query results.
- Keep club Elo. A separate season-points competition is an optional future decision, not part of the committed scope.
- Borrow interaction patterns from BWF; use club-owned data and identity. No BWF data integration or scoring-rule change is needed for this plan.
- Existing uncommitted changes are substantial. Implementation must preserve them and use bounded, reviewable changes rather than a repository-wide rewrite.

## 2. Evidence and limitations

Inspected source provides these starting points. Presence of a file does not establish that its behavior is complete or production-verified.

| Area | Current evidence | Implication |
| --- | --- | --- |
| Tournament navigation | `client/src/pages/TournamentDetail.tsx` redirects active/draft archived records into Pulse | Establish one stable tournament route and retain compatibility with existing links |
| Live experience | Live-score, schedule, bracket, team and court components already exist | Compose existing views behind shared filters and links |
| Head-to-head | `ProfileRankingTab.tsx` passes signed-in user and viewed player to `HeadToHeadWidget` | Generalize comparison without removing the existing shortcut |
| Rest checking | `lib/restConflicts.ts` checks four player slots using a default 45-minute start-to-start gap, skips completed/walkover matches and returns a Map | Separate true rest from estimates; keep Maps internal and serialize query-bound results |
| Score recovery | `lib/umpire/resumeRecovery.ts` recovers recorded scores; comments explicitly say point log and serve state are unavailable in fallback recovery | Label partial recovery honestly and require confirmation of missing serve state |
| Offline sync | `hooks/useOfflineUmpireSync.ts` reads a shared live-match object, merges queued snapshots and writes the object back | Investigate active call paths and concurrency before selecting a per-match transactional design |
| Readiness | `TournamentSetupChecklist.tsx` uses coarse checks, including whether any match has a court and scheduled time | Validate relevant matches individually and make rules specific to lifecycle stage |
| Quality tooling | Vitest and Playwright configs exist; Playwright targets Chromium and `tests/` | Extend meaningful journeys and native verification rather than inventing a separate test framework |
| Planning | `REMAINING_PLAN.md` says certain tests are missing although those files now exist | Reconcile evidence and status before assigning work |

The code-review-graph tools were unavailable in this session; targeted source inspection was used. No live database inspection, full UI audit, test run or build was performed for this planning task. Database fields and API contracts below are proposals to validate against the actual schema. BWF's direct website could not be retrieved; its official app listing supported the high-level inspiration: https://apps.apple.com/tr/app/badminton4u/id1573552810.

## 3. Delivery sequence

Effort ranges are rough engineering days for one developer, including focused tests and review. They are not delivery commitments; baseline findings can change them. Each phase should be split into small changes.

| Phase | Deliverable | Depends on | Estimate |
| --- | --- | --- | --- |
| 0 | Verified backlog, baseline, domain contracts | None | 1–2 days |
| 1 | Reliable scoring, sync and recovery | 0 | 4–7 days |
| 2 | Scheduling safeguards and readiness | 0; integrate with 1 | 4–6 days |
| 3 | Stable tournament home, Match Centre, shared scorecards, order of play | 0–2 | 5–8 days |
| 4 | Traceable corrections and actionable admin workspace | 1–2 | 3–5 days |
| 5 | Identity onboarding, comparisons and ranking stories | 0, 3; identity work before comparisons | 4–7 days |
| 6 | Following and targeted push alerts | 1, 3, 5 | 3–5 days |
| 7 | Final cross-platform qualification and staged rollout | All included phases | 3–5 days |

Accessibility, loading/error behavior and tests are acceptance criteria in every phase. Phase 7 verifies the integrated result; it is not the first quality check. Plan roughly 27–45 engineering days for the full scope, then revise after phase 0. First useful release: phases 0–2.

## 4. Phase 0 — Establish a verified baseline

### Work

1. Inventory the existing dirty worktree without resetting, staging or overwriting unrelated changes.
2. Reconcile `IMPROVEMENT_PLAN.md`, `REMAINING_PLAN.md` and `docs/admin-revamp-plan.md` into a single backlog. Preserve historical notes; replace conflicting completion claims with links to current evidence.
3. Track each item as proposed, implemented/unverified, verified locally, or verified in staging. Include acceptance criteria, affected files and verification date.
4. Run the existing type/reference checks, Vitest suite and build. Inspect Playwright tests before running them, ensuring they target isolated fixtures rather than production. Record pre-existing failures separately from new regressions.
5. Trace actual score-write, recovery, finalization, bracket-advance, Elo and notification paths. Discover whether legacy offline hooks are still used.
6. Agree typed domain contracts: tournament ID, match ID, discipline, player slots, pair identity, match status, score structure, scheduled/estimated/actual times, revision and publication visibility.
7. Create deterministic fixtures for singles, MD, WD, XD and team ties, including a player entering multiple disciplines.

### Acceptance

- Every proposed change maps to existing behavior or a clearly identified gap.
- Tests/build have a reproducible baseline, with no unsupported claims of a clean suite.
- No new registration states enter the backlog.
- Proposed schema work remains separate from evidence about the deployed schema.

## 5. Phase 1 — Scoring reliability and recovery

### User outcome

An umpire can distinguish a local save from a server-confirmed score, recover after interruption and resolve a conflicting update without silently losing points.

### Work

1. Define UI states: saved on device, syncing, confirmed by server, retry needed and conflicting update. Connectivity alone must not imply successful persistence.
2. Inspect current persistence guarantees. Durably record each accepted local scoring change before presenting it as saved; serialize queue writes and show storage failures.
3. Use stable operation IDs, per-match revisions and server-checked expected revisions for retryable writes. Validate how much can be added to existing APIs before creating new storage.
4. Make finalization idempotent: one accepted completion must produce at most one bracket advancement, Elo effect and notification event even if the client retries.
5. Avoid shared-object read/merge/write races for independent matches. Prefer an atomic per-match update compatible with existing readers; plan migration of legacy snapshots if needed.
6. Prevent overlapping queue flushes. Remove only acknowledged operations; preserve updates queued while a flush is in progress. Partition queues by user and match to prevent replay under a different account.
7. Reject stale updates instead of using last-write-wins for scoring. Show local and server versions; allow an authorized official to select a recovery action with a recorded reason.
8. Recover complete snapshots when available. If only tournament-row scores survive, label the recovery as partial and confirm server/receiver/court state before continuing; never invent point history.
9. Handle expired sessions, changed official permissions, malformed queue data and server-confirmed matches that still have stale local operations.

### Likely touchpoints

`hooks/useOfflineUmpireSync.ts`, `hooks/useOfflineSync.ts`, `store/umpireStore.ts`, `hooks/useUmpireState.ts`, `lib/umpire/resumeRecovery.ts`, `lib/umpire/umpireMutations.ts`, `services/umpireService.ts`, umpire screens and the existing result-submission database functions.

### Acceptance and tests

- Score offline, close/reopen the app, reconnect and confirm the intended score once.
- Two officials submitting from the same revision cannot silently overwrite one another.
- Repeated finalization does not duplicate ranking changes or bracket advancement.
- A queue update added during sync survives until acknowledged.
- Auth expiry, storage failure and malformed data produce a recoverable explanation, not false success.
- Test XD serve/receiver recovery as well as singles and doubles score recovery.
- Keep client retries and server transaction tests separate so mocked tests do not stand in for database guarantees.

## 6. Phase 2 — Scheduling safeguards and tournament readiness

### Scheduling work

1. Normalize all real participants from all four player slots. Check shared identities across MS, WS, MD, WD and XD, and across team ties where lineups are known.
2. Model scheduled start, estimated duration/end, actual start/end, court and configurable minimum rest separately. Do not describe the current 45-minute start-gap heuristic as a BWF requirement.
3. Compute rest from actual end when available. Otherwise use an explicitly labelled estimate. Include recently completed matches in rest calculations; handle walkovers without fabricating playing duration.
4. Detect player overlap, court overlap, unavailable court periods and insufficient rest. Distinguish definite conflicts from warnings based on estimates or unresolved participants.
5. Check all relevant intervals, including long matches overlapping multiple later matches; do not rely exclusively on adjacent start times.
6. Recheck immediately before saving or starting a match to handle stale screens and concurrent organizers. Use server enforcement for definite protected constraints, with consistent UI previews.
7. Show conflict cards with player, discipline, conflicting match, court/time and a direct fix action. Offer suggested alternatives; do not silently move published matches.
8. Allow authorized, reasoned overrides only for overridable warnings; record who overrode what. Define hard constraints separately.
9. Scope scheduling to the tournament initially. Include concurrent tournaments sharing courts/players only when the data and permissions support it; show that scope to organizers.

### Readiness work

1. Extend the existing setup checklist with typed checks and evidence links.
2. Make checks lifecycle-aware: publishing event information, publishing a draw and starting play have different requirements. Do not require a fully scheduled tournament merely to announce an event.
3. Validate required event details, participants/pairs, supported scoring rules, draw integrity, active-round court/time assignments and official coverage.
4. Report completeness counts such as 8/10 matches scheduled instead of a passing status because one match has a court.
5. Represent data-load failures as unknown/failed checks, not empty data or a green result.
6. Separate blocking errors from warnings and revalidate on the corresponding protected action. Share business rules between checklist and mutation enforcement.

### Acceptance and tests

- An MS participant also entered in XD triggers a conflict when the matches overlap; test WS-to-XD, MD-to-XD and WD-to-XD too.
- Conflicts detect both partners, regardless of which player slot stores them.
- An actual 10:40 finish followed by a 10:50 start uses 10 minutes of rest, irrespective of the earlier scheduled start.
- Unknown future opponents are marked unresolved and rechecked after bracket advancement.
- Partial scheduling, invalid scoring settings and failed fetches never produce misleading readiness.
- Fix links open the exact relevant match, participant or setting.

### Likely touchpoints

`lib/restConflicts.ts` and tests, `lib/umpire/schedule.ts`, `TournamentOrderOfPlayTab.tsx`, `TournamentSetupChecklist.tsx`, `LiveMatchSchedule.tsx`, scheduling pages and tournament services/mutations.

## 7. Phase 3 — Connected tournament experience

### A. Stable tournament home

- Choose one canonical tournament route after inspecting the route table, for example `/tournaments/:id`; this is a proposed route, not an assertion that it exists.
- Retain identity and URL throughout the event lifecycle. Preserve old `/events/:slug` and Pulse links with redirects that carry the tournament identifier, tab and relevant filters.
- Use Overview, Players, Draw, Schedule and Results tabs, with Live prominent while play is active. Handle team-specific views without forcing an individual bracket layout onto ties.
- Preserve deep links, browser back/forward and Capacitor navigation. Restrict draft visibility according to existing permissions.
- Reuse existing components rather than duplicating active and archived event implementations.

### B. Match Centre and detail

- Offer Live, Upcoming and Completed views, filtered by tournament, date, court and MS/WS/MD/WD/XD. Preserve filters in shareable URLs where appropriate.
- Give matches stable detail links; include event, discipline, round, participants/pairs, seed, court, score, status and next-round destination when known.
- Show last successful update and stale/offline indicators. A disconnected score must not appear confirmed live indefinitely.
- Paginate historical lists and scope realtime subscriptions to visible/relevant tournaments.

### C. Court-first order of play

- Show Playing now, Next and Following per court using the authoritative queue ordering.
- Separate scheduled time, estimated time and actual start. For unscheduled matches show an honest queue position rather than invented precision.
- Surface delayed matches, changed courts and conflicts from phase 2. Handle empty/unavailable courts explicitly.
- Support spectators, a player's own matches and an organizer view through one shared data model.

### D. Consistent competition presentation

- Create a shared scorecard model and presentation primitives for player/pair identity, seed, game score, winner and status.
- Explicitly represent walkover, retirement, cancellation and incomplete results according to existing supported statuses. Do not infer a status from a missing score alone.
- Use aligned scores, legible names, text status labels and appropriate mobile truncation/expansion.
- Adopt the primitives incrementally in Match Centre, schedule, live widgets, brackets and archive views.

### Acceptance

- A bookmarked tournament link works before, during and after completion.
- A shared match link opens the correct match without requiring a previous Pulse selection.
- Filters include XD everywhere the discipline is applicable.
- A corrected result is consistent across scorecard, bracket, schedule and profile after refresh/invalidation.
- Empty, loading, denied, failed and stale states remain distinguishable.
- Existing old links and native back behavior pass regression checks.

### Likely touchpoints

`App.tsx`, `pages/TournamentDetail.tsx`, `pages/Pulse.tsx`, `components/pulse/*`, `components/events/*`, `components/club/LiveCourtsDashboard.tsx`, `components/feed/MatchScorecardModal.tsx`, tournament query hooks and realtime provider.

## 8. Phase 4 — Corrections and actionable administration

### Traceable corrections

1. Extend existing audit facilities with actor, timestamp, entity, before/after values, reason and operation ID. Validate authorized access server-side.
2. Preview the impact of score/winner changes on downstream draws, scheduled matches and Elo before applying a correction.
3. Revalidate the preview against current revisions at confirmation. A preview is not a lock on future state.
4. Apply permitted corrections atomically. If a downstream match has started or completed, block the simple correction and require a controlled resolution path rather than silently rewriting competition history.
5. Treat undo as a new audited action, preserving original history. Prevent double application of rating recalculations and notifications.
6. Cover seed, court and schedule edits with appropriately smaller previews and audits.

### Admin workspace

- Build on the existing admin restructuring; surface actionable cards rather than another catalogue of features.
- Start with matches missing officials, scheduling conflicts, failed score syncs where server visibility exists, unresolved identities and disputed results.
- Show accurate counts, urgency and tournament filters; link directly to the resolving screen.
- Existing registration queues may remain visible, but introduce no new registration states or state transitions.
- Expose only tasks the current role can access; explain unavailable actions where useful.

### Acceptance

- A stale correction preview cannot overwrite a newer result.
- Every applied correction can be attributed and reconstructed.
- A correction cannot silently invalidate a downstream match already in play.
- An admin task disappears after resolution and refresh, without misleading stale counts.

## 9. Phase 5 — Onboarding, player comparisons and ranking stories

### A. Identity onboarding

- Offer a minimal profile setup and a way to request ownership of an existing player record.
- Verify ownership using existing supported identity/contact mechanisms; names alone are insufficient for automatic claiming or merging. Do not introduce an email provider.
- Use existing guest-resolution tools for ambiguous cases, with explicit merge previews.
- Preserve historical results, pair membership and references when resolving a guest. Record redirects/aliases where needed so saved links continue to work.
- Ask only for data needed for the next task; retain partially completed forms. Keep public player information separate from private contact details.

### B. Head-to-head comparisons

- Generalize the current widget to select any two players or two pairs; retain the existing me-versus-player shortcut.
- Make eligible public comparisons usable without signing in.
- Keep player-vs-player, pair-vs-pair and played-together statistics distinct. Normalize pair identity independent of partner order and keep discipline as a filter.
- Include dated tournament meetings, round, game scores and recent form with visible sample size.
- Define treatment of walkovers, retirements, incomplete results and voided matches; apply one consistent policy across aggregates and drill-down results.

### C. Ranking stories

- Build on current Elo displays with rank movement, snapshot date, recent contributing results and career best when historical evidence exists.
- Store or derive comparable snapshots consistently; mark unavailable history instead of inventing movement.
- Distinguish individual Elo from pair performance. Confirm existing category rating rules before adding an XD ranking; keep XD results filterable regardless.
- Explain tie handling, corrections and ranking eligibility in plain language.
- Defer a separate season-points table until explicitly selected; do not mix Elo and participation points into an unexplained total.

### Acceptance

- A guest merge preserves tournament history and cannot be claimed by another user based solely on name.
- Pair A+B equals B+A for comparison identity, but A+C is a different pair.
- XD is independently filterable and not silently mixed into all doubles statistics.
- Head-to-head totals reconcile with displayed eligible meetings.
- Ranking changes compare compatible dated snapshots; missing history is labelled.

### Likely touchpoints

`AuthContext.tsx`, `GuestPlayersPanel.tsx`, `ResolveGuestsModal.tsx`, player services, `HeadToHeadWidget.tsx`, `lib/headToHead.ts`, `DoublesPairProfile.tsx`, `ProfileRankingTab.tsx` and leaderboard/profile query hooks.

## 10. Phase 6 — Following and targeted push alerts

Status: completed and locally verified on 13 November 2026. See `docs/decisions/wp9-following-and-targeted-push-alerts.md`.

### Work

1. Reuse any existing follow/preferences mechanisms; add player and tournament subscriptions only where missing.
2. Add a Following view prioritizing relevant live/upcoming matches and results.
3. Offer per-event preferences for match call, schedule/court changes and result publication. Keep quiet hours and mute/unfollow accessible.
4. Generate alerts from committed authoritative events, not optimistic client writes. Deduplicate by event/version/recipient, including overlapping player and tournament follows.
5. Deep-link to the affected match. Expired or cancelled events should open an accurate current state.
6. Reuse existing push infrastructure and permission prompts. Permission denial must not block following in the app.
7. Distinguish queued, provider-accepted and failed delivery where observable; do not promise delivery based solely on successful enqueueing.
8. Protect private events, personal subscription choices and contact/device information.

### Acceptance

- Following a player and their tournament produces one alert for one matching event.
- Retried score finalization does not duplicate a result alert.
- Muted/unfollowed events stop future alerts; denied push permission leaves in-app following usable.
- Schedule changes point to the correct updated match, including XD.

## 11. Accessibility, errors and performance — requirements across phases

### Accessibility and court-side use

- Use large touch targets for scoring and key actions; propose a 44-by-44 CSS-pixel minimum for those controls and verify actual layouts.
- Verify keyboard navigation, visible focus, semantic labels, focus restoration after dialogs and screen-reader announcements for critical state changes.
- Do not announce every live score change aggressively; prioritize user-initiated scoring and important errors without flooding assistive technology.
- Meet appropriate contrast targets, support reduced motion and avoid colour-only status cues.
- Check long names, 200% zoom, narrow screens, light/dark themes and practical bright-light readability on a phone.

### Error and empty states

- Separate no results, loading, permission denied, service failure and stale cached data.
- Preserve filters and form input during recoverable failures; show a targeted retry.
- Display last successful refresh where freshness affects decisions.
- Distinguish network errors from validation failures; do not retry non-retryable mutations indefinitely.
- Keep error boundaries near major feature areas so one failed widget does not hide an entire tournament.

### Performance

- Capture a repeatable baseline for tournament opening, live score refresh, ranking/profile load and subscription count using a realistic fixture size.
- Agree budgets after baseline rather than inventing current performance claims.
- Lazy-load nonessential tabs, page long result lists and avoid subscribing every mounted widget to the full live dataset.
- Persist only serializable data; keep Maps/Sets internal or convert to arrays/records before cache persistence.

## 12. Database and service implementation principles

These are design requirements, not migrations to apply during planning.

- Inventory current tables, RPCs, permissions and deployed migration state before selecting schema changes. Reuse existing infrastructure where it satisfies the guarantees.
- Potential additions include match revisions/operation receipts, actual timing fields, audit metadata, follow preferences and ranking snapshots. Confirm each gap before adding anything.
- Keep score finalization, revision enforcement, correction effects and protected readiness constraints authoritative on the server.
- Define a role matrix covering spectator, member, assigned official, tournament organizer and site administrator. Test direct API access as well as UI visibility.
- Apply appropriate RLS/grants to exposed data; ensure public views do not leak drafts, contact details or private follow records. Regenerate types after verified schema changes.
- Read current Supabase documentation before implementation; use the Supabase skill workflow for local schema iteration, migration generation and verification.
- Use additive, backward-compatible changes first. Rehearse migrations in an isolated environment and preserve recovery paths for older app versions and queued offline operations.

## 13. Verification matrix and release gates

| Scenario | Required evidence |
| --- | --- |
| Existing entry → draw → court assignment → score → result → Elo | End-to-end fixture verifies one coherent result, using existing registration behavior |
| Offline scoring → close → reopen → reconnect | Native/manual evidence plus automated queue/recovery tests |
| Concurrent score writers | Server-level concurrency test rejects stale revision |
| MS/WS/MD/WD player also entered in XD | Conflict and rest-check tests covering every player slot |
| Match overruns its estimate | Actual-end rest calculation and visible schedule warning |
| Duplicate completion request | One completion, one advancement and one rating effect |
| Correct winner after next round begins | Controlled rejection/resolution; no silent history rewrite |
| Guest resolution | Historical references preserved; unauthorized claim rejected |
| Public tournament/match link | Works fresh, on refresh and across lifecycle, with draft permissions preserved |
| Ranking and H2H | Aggregates reconcile with eligible results and dated snapshots |
| Follow overlap and retry | Single notification event per recipient, correct deep link |
| Access denied / failed query / empty list | Three distinct accurate user states |
| Keyboard, screen reader, reduced motion and mobile layout | Focused automated checks plus documented manual inspection |

Before each release: run existing type/reference checks, relevant unit/integration tests, production build and affected browser journeys. Verify browser tests are discovered under the configured `tests/` path. Add mobile viewport coverage and verify Capacitor-specific behavior on Android; a browser viewport is not a native recovery test.

Gate deployment on required checks after reviewing the current release workflow. Use isolated test accounts and data. Record actual commands, outcomes and unresolved limitations rather than relying on old test-count claims.

Roll out scoring changes to a controlled test tournament first, then to a small club event. Monitor failed/retried syncs, revision conflicts, recovery failures, finalization latency and notification failures without logging unnecessary personal data. Keep compatible readers during migration. A UI feature toggle alone is not a rollback strategy for already-written data; document data and old-client compatibility explicitly.

## 14. Proposed implementation batches

1. Baseline evidence, reconciled backlog and discipline/identity fixtures.
2. Scoring persistence and server revision/idempotency guarantees.
3. Sync/recovery interface and failure-path tests.
4. Cross-discipline conflict checks including XD and actual-rest calculation.
5. Lifecycle-specific readiness checks with actionable fix links.
6. Canonical tournament routes and compatibility redirects.
7. Shared scorecards, Match Centre and court-first schedule.
8. Correction preview/audit flow and actionable admin cards.
9. Safe identity onboarding, arbitrary H2H and ranking snapshots.
10. Following/preferences and deduplicated push events.
11. Integrated browser/native/accessibility verification and staged rollout.

For every batch, record changed behavior, affected files, test evidence, migration implications and known limitations. This plan is complete as a strategy artifact. Reliability batches covering offline scoring, result revisions/idempotency, XD/rest checks, court reservations, checked start and readiness gates are implemented locally; remaining work is tracked in the execution handoff above.
