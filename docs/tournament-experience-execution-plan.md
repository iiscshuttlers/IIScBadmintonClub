# Tournament experience execution playbook

Prepared: 13 November 2026  
Audience: engineer newly joining IIScBadmintonClub  
Source roadmap: [`docs/tournament-experience-improvement-plan.md`](./tournament-experience-improvement-plan.md)

## 1. Objective

Deliver the remaining tournament roadmap safely, beginning with the unfinished reliability work and then moving through the connected tournament experience, corrections, player identity, rankings, following and final release qualification.

This document is an execution guide. It explains what to do, in what order, where to work, what evidence is required and when a work package is complete. The source roadmap remains the product and design rationale.

## 2. Non-negotiable product decisions

Do not change these decisions without an explicit product decision recorded in the roadmap.

- Support MS, WS, MD, WD and XD everywhere the discipline applies.
- Check player conflicts using all four participant slots, including players moving between singles, doubles and XD.
- Do not introduce a new submitted/accepted/waitlisted/action-required registration workflow.
- Keep club Elo. Do not mix it with a new participation-points system.
- Reuse BWF interaction patterns only. Do not integrate or scrape BWF data.
- English only for this roadmap.
- Use push notifications only; do not add an email provider.
- Do not add location services.
- Scope the first scheduling implementation to one tournament. Cross-tournament conflicts require a later explicit decision.
- Never represent a local save or an optimistic UI update as server-confirmed.

## 3. Current verified state

The following work is implemented locally but has not been deployed to the hosted Supabase project by this plan.

- Offline umpire snapshots are serialized, attributed to a user, coalesced by match and removed only after exact acknowledgement.
- The scoring UI distinguishes device-saved, syncing, confirmed and retry-required states.
- Tournament completion uses expected revisions and operation IDs through `submit_tournament_match_v2`.
- Identical finalization retries are idempotent; conflicting completed results are rejected.
- Walkovers and BYEs use the dedicated walkover path.
- Rest checks cover all four participant slots and XD, using actual `ended_at` when available.
- Court overlaps are previewed in the Order of Play and rechecked before saving.
- A database trigger serializes 30-minute court reservations.
- Starting tournament scoring uses `start_tournament_match_checked`, which revalidates authorization, stale schedule data, court occupancy, active-player conflicts and actual 15-minute rest.
- Tournament activation is protected by a database readiness trigger.
- Readiness load failures are represented as unknown rather than passing.
- Stale final-result conflicts open a persistent local/server comparison dialog with owner-scoped queue cleanup.
- Authorized corrections require a reason, re-read the revision, are idempotent by operation ID and write a before/after audit record.
- Nullable authorization predicates were hardened so only an explicit `TRUE` passes privileged WP1/WP2 RPC guards.

Current WP0-WP2 audit and review queue: [`docs/wp0-wp2-audit-2026-11-13.md`](./wp0-wp2-audit-2026-11-13.md).

Verification recorded on 13 November 2026:

- `npm run check` passed.
- `npx vitest run` passed 43 files and 402 tests.
- `npm run build` passed.
- The complete WP1/WP2 additive migration set passed together in a fresh isolated Supabase PostgreSQL 17 harness.
- Genuine two-session result and court races passed; exact anonymous and ordinary-user authorization rejections were verified.
- Two existing non-failing jsdom navigation warnings remain.
- Existing Vite dynamic/static-import warnings remain.

Important limitation: the checked-in historical migration chain is incomplete. It references `public.players` before any checked-in migration creates that table. Do not edit old, already-applied migrations merely to make local replay pass. Use a sanctioned schema baseline or an isolated staging clone as described in Work Package 1.

## 4. First-day setup

### 4.1 Read before changing code

Read these files in order:

1. `AGENTS.md`
2. `docs/tournament-experience-improvement-plan.md`
3. This execution playbook
4. `IMPROVEMENT_PLAN.md`
5. `REMAINING_PLAN.md`
6. `package.json`
7. The files listed under the current work package

The repository requires code-review-graph tools before text-based code exploration. Start with architecture, semantic search, impact radius and affected-flow queries. Use `rg` and direct file reads only when the graph is unavailable or does not contain the required detail. Record that fallback in the work note.

### 4.2 Protect the existing worktree

The worktree contains substantial existing and untracked work.

- Run `git status --short` before starting.
- Do not reset, clean, stash, overwrite or reformat unrelated files.
- Do not assume every modified file belongs to your work package.
- Keep each change bounded to the files named in the package, plus tests and generated types that are directly required.
- Before handoff, inspect the focused diff and run `git diff --check` on touched tracked files.

### 4.3 Install and run locally

The repository declares pnpm in `package.json`. Use the repository-approved pnpm/Corepack setup when it works. On the currently verified machine, the global pnpm shim was unreliable; `npm` and `npx` were used without changing dependency versions.

Baseline commands:

```powershell
npm run check
npx vitest run
npm run build
```

Browser tests are discovered only under `tests/` by `playwright.config.ts`:

```powershell
npx playwright test
```

Do not run browser tests against production accounts or production data. Inspect the test and its fixtures first.

### 4.4 Supabase rules

- Read the current Supabase changelog and documentation before database work.
- Supabase CLI v3 targets local resources by default. Never add `--remote` unless deployment is explicitly authorized.
- Create new migrations with `supabase migration new <name>`.
- Do not apply migrations to the hosted project as part of ordinary implementation.
- Do not put service-role or secret keys in client code, logs, fixtures or documentation.
- Every `SECURITY DEFINER` function must set a safe `search_path`, verify `auth.uid()`, enforce authorization internally, revoke `PUBLIC` execution and grant only the intended role.
- Regenerate or carefully update generated Supabase types after schema changes.

Current migration and harness files:

- `supabase/migrations/20261112053310_add_tournament_result_revisions.sql`
- `supabase/migrations/20261113031227_enforce_court_reservations_and_checked_start.sql`
- `supabase/migrations/20261113104500_add_tournament_score_correction.sql`
- `supabase/migrations/20261113110000_fix_tournament_bracket_advancement_columns.sql`
- `supabase/migrations/20261113111500_harden_tournament_authorization_boolean.sql`
- `supabase/tests/result_revision_bootstrap.sql`
- `supabase/tests/result_revision_assertions.sql`
- `supabase/tests/court_start_assertions.sql`
- `supabase/tests/score_correction_assertions.sql`
- `supabase/tests/concurrency_verification.mjs`

## 5. Work tracking and pull-request rules

Track every item with one of these states:

- `proposed`
- `implemented-unverified`
- `verified-locally`
- `verified-staging`
- `deployed`

Each work-package note or pull request must include:

- user-visible outcome;
- files and database objects changed;
- assumptions made;
- tests run with exact commands and outcomes;
- migration and old-client compatibility;
- security/authorization effects;
- known limitations;
- rollback or disable strategy;
- screenshots or recordings for user-interface work.

Do not combine unrelated work packages into one pull request. Prefer the slices listed inside each package.

## 6. Delivery order

Execute packages in this order unless a dependency explicitly permits parallel work.

| Order | Work package | Depends on | Exit gate |
| --- | --- | --- | --- |
| 0 | Baseline and backlog reconciliation | None | One evidence-backed backlog |
| 1 | Full-schema migration and concurrency verification | 0 | Reliability migrations verified against representative schema |
| 2 | Score-conflict resolution | 1 | Authorized official can resolve a stale score with an audit reason |
| 3 | Configurable rest and schedule overrides | 1 | Policy is configurable and every override is attributable |
| 4 | Lifecycle-specific readiness gates | 1, 3 | Announce, draw publish and start have separate checks |
| 5 | Canonical tournament and match routes | 0, 4 | Stable links work across lifecycle states |
| 6 | Match Centre, court queue and shared scorecards | 5 | One consistent competition presentation |
| 7 | Correction preview and actionable administration | 1, 4, 6 | Corrections are atomic, previewed and audited |
| 8 | Identity onboarding, H2H and ranking stories | 0, 6 | Identity and statistics reconcile with eligible history |
| 9 | Following and targeted push | 1, 5, 8 | One authoritative event produces at most one relevant alert |
| 10 | Integrated qualification and staged rollout | All selected packages | Release evidence and rollback readiness complete |

## 7. Work Package 0 — Baseline and backlog reconciliation

Estimated effort: 2–3 engineering days.

Status: completed (project status updated 13 November 2026).

### Tasks

1. Inventory the current dirty worktree. Attribute only changes that can be proven to belong to this roadmap.
2. Reconcile `IMPROVEMENT_PLAN.md`, `REMAINING_PLAN.md`, `docs/admin-revamp-plan.md` if present, and the source roadmap.
3. Create a backlog table containing item, owner, state, acceptance criteria, files, test evidence and last verification date.
4. Trace current score writes, offline queueing, live snapshot writes, tournament-row updates, result finalization, Elo, bracket progression and notifications.
5. Confirm whether `useOfflineSync.ts` and other legacy paths are active, dormant or redundant. Do not delete them during discovery.
6. Document typed contracts for tournament ID, match ID, player slots, pair identity, category, score, status, timing, revision and operation ID.
7. Create or extend deterministic fixtures for MS, WS, MD, WD, XD, team ties, repeated cross-discipline players, walkovers and incomplete opponents.
8. Inspect Playwright tests under `tests/`; record which journeys are genuine, mocked or production-dependent.

### Primary touchpoints

- `client/src/hooks/useOfflineUmpireSync.ts`
- `client/src/hooks/useOfflineSync.ts`
- `client/src/hooks/useUmpireState.ts`
- `client/src/services/umpireService.ts`
- `client/src/services/tournamentService.ts`
- `client/src/providers/RealtimeProvider.tsx`
- `client/src/lib/umpire/offlineQueue.ts`
- `tests/`

### Acceptance

- One backlog replaces contradictory completion claims.
- Every remaining item has an owner-ready acceptance test.
- Legacy code is classified with evidence.
- No files are removed merely because they appear unused.
- Baseline commands and existing warnings are recorded.

## 8. Work Package 1 — Full-schema migration and concurrency verification

Estimated effort: 3–5 engineering days. This blocks deployment of later database work.

Status: completed (project status updated 13 November 2026).

### Tasks

1. Obtain an approved schema-only baseline from a non-production project or create a staging clone through the team’s normal process.
2. Do not copy production personal data into local fixtures.
3. Reconcile migration history with the baseline. Prefer adding a documented baseline for new local environments over rewriting historical applied migrations.
4. Apply both pending reliability migrations to the representative database.
5. Execute two genuine database sessions submitting the same match revision concurrently. Verify one succeeds and one receives a revision conflict.
6. Execute two sessions reserving overlapping court intervals. Verify transaction locking causes one request to fail with `court_conflict`.
7. Run against the real finalization function and prove a retried result causes exactly one Elo effect, one bracket advancement and one committed result.
8. Verify unauthorized authenticated users and anonymous callers cannot execute privileged RPCs.
9. Run database advisors or the approved equivalent and review function grants, RLS interaction and `search_path` safety.
10. Test an older client path against the additive migration. Record whether it remains safe, merely unsupported or must be blocked before deployment.

### Required evidence

- SQL transcript for both concurrent sessions.
- Before/after rows for match revision, Elo audit and downstream bracket slot.
- Function grants and authorization results.
- Migration list from the representative environment.
- Recovery plan if deployment must be rolled back after new columns contain data.

### Acceptance

- No hosted production mutation was used for verification.
- Stale score and court writers cannot both commit.
- Retried finalization has exactly one downstream effect.
- Migration and old-client behavior are documented.
- Reliability migrations reach `verified-staging` before deployment approval.

## 9. Work Package 2 — Score-conflict resolution

Estimated effort: 4–6 engineering days.

Status: completed (project status updated 13 November 2026).

### User outcome

An official sees that their score is stale, compares local and server versions and chooses a permitted recovery action without silently overwriting either version.

### Tasks

1. Define a typed conflict payload: match ID, local revision, server revision, local score/sets, server score/sets, operation ID and last known actor/time where authorized.
2. Change revision-conflict handling from a generic toast into a persistent conflict state.
3. Build an accessible conflict dialog or panel showing local and server values side by side.
4. Provide `Keep server result` and, only for authorized roles, `Request correction` or `Apply correction` actions.
5. Require a non-empty reason for any action that changes an accepted server result.
6. Re-read the server revision at confirmation. Do not let an old preview overwrite a newer result.
7. Store actor, reason, before/after result, revision and operation ID in the existing audit system or a reviewed additive audit table.
8. If a downstream match has started or completed, block the simple correction and direct the user to Work Package 7’s controlled correction flow.
9. Clear or quarantine acknowledged local operations so they do not replay after resolution.
10. Handle expired session and lost authorization while the conflict dialog is open.

### Primary touchpoints

- `client/src/hooks/useUmpireState.ts`
- `client/src/hooks/useOfflineUmpireSync.ts`
- `client/src/components/umpire/UmpireScoringScreen.tsx`
- `client/src/components/umpire/UmpireEngine.tsx`
- `client/src/services/tournamentService.ts`
- `client/src/lib/umpire/offlineQueue.ts`
- result and audit migrations

### Pull-request slices

1. Conflict domain type and service read path.
2. Read-only comparison UI and accessibility tests.
3. Authorized correction RPC and audit record.
4. Queue cleanup, session failures and end-to-end test.

### Acceptance

- Two officials cannot silently overwrite one another.
- The server result remains unchanged until an authorized, reasoned action commits.
- A stale conflict dialog cannot apply over a newer revision.
- Resolution is reconstructable from audit data.
- XD and doubles set histories render correctly.

## 10. Work Package 3 — Configurable rest policy and audited overrides

Estimated effort: 4–6 engineering days.

Status: completed (project status updated 13 November 2026).

### Tasks

1. Inventory existing tournament settings before adding columns. Choose either typed columns or a versioned settings object; document the decision.
2. Add tournament-level minimum rest and estimated match duration with conservative defaults matching current behavior: 15 minutes rest and 30 minutes estimated duration.
3. Use the same policy values in preview calculations, pre-save validation and checked start.
4. Add unavailable court periods if the data model can identify courts consistently. Keep this within one tournament initially.
5. Classify conflicts:
   - hard: court occupied now, player active now, stale schedule, unauthorized action;
   - warning/overridable: estimated-duration overlap or policy rest based on an estimate;
   - hard until policy changes: actual rest below the configured minimum.
6. Add an override RPC only for explicitly overridable warnings.
7. Require reason, actor, match, conflicting item, previous schedule, new schedule and policy values in the override audit.
8. Show conflict cards with player, discipline, conflicting match, court/time, actual versus estimated basis and an exact fix link.
9. Suggest alternative slots, but never move a published match automatically.
10. Recheck after bracket advancement fills an unknown opponent.

### Primary touchpoints

- `client/src/lib/restConflicts.ts`
- `client/src/lib/courtConflicts.ts`
- `client/src/components/tournament/OrderOfPlayPanel.tsx`
- `client/src/components/admin/TournamentSettingsTab.tsx`
- `client/src/services/tournamentService.ts`
- `supabase/migrations/20261113031227_enforce_court_reservations_and_checked_start.sql` as historical reference; create a new migration for changes

### Acceptance

- Policy changes produce the same result in UI and database enforcement.
- Actual 10:40 finish followed by 10:50 start reports 10 minutes of rest.
- Every participant slot and XD are covered.
- Overrides are limited, reasoned and attributable.
- Unknown opponents are rechecked when assigned.

## 11. Work Package 4 — Lifecycle-specific readiness gates

Estimated effort: 3–5 engineering days.

Status: completed and verified in isolated Docker Postgres 17 test harness and Vitest on 13 November 2026. See `docs/decisions/wp4-lifecycle-readiness-gates.md`.

### Problem

The current transition to `active` intentionally requires a fully prepared playable schedule. The roadmap requires separate requirements for announcing an event, publishing a draw and starting play.

### Tasks

1. Inventory existing tournament status, visibility flags and public-route behavior. Do not add statuses until this is complete.
2. Write a decision record defining three protected actions:
   - publish event information;
   - publish draw/schedule;
   - start tournament play.
3. Define blocking checks and warnings for each action.
4. Share one typed rule vocabulary between the checklist and RPC responses.
5. Add protected RPCs or trigger rules for each action. Direct REST writes must not bypass them.
6. Return structured blocker codes, counts and entity IDs rather than only concatenated messages.
7. Update `TournamentSetupChecklist` to link directly to the exact setting, participant, match or official requiring attention.
8. Keep official coverage a warning or blocker according to the approved lifecycle decision.
9. Add open-event and team-tournament fixtures.

### Primary touchpoints

- `client/src/lib/tournamentReadiness.ts`
- `client/src/pages/TournamentSetupChecklist.tsx`
- `client/src/components/admin/TournamentSettingsTab.tsx`
- `client/src/types/tournament.ts`
- readiness trigger migration and new additive migration

### Acceptance

- An event can be announced without pretending it is ready for play.
- A draw cannot publish with invalid fixtures or hidden unresolved pairs.
- Play cannot start with blocking schedule/scoring failures.
- Query failures remain unknown, never green.
- Client and database checks produce equivalent blocker codes.

## 12. Work Package 5 — Canonical tournament and match routes

Estimated effort: 5–8 engineering days.

Status: completed and locally verified on 13 November 2026. See `docs/decisions/wp5-canonical-routes.md` for the route map, decisions, implementation record and remaining release-only smoke checks.

### Tasks

1. Map all current tournament, Pulse, event, archive and match routes using the code graph.
2. Select canonical tournament and match URL formats through a short decision record.
3. Add compatibility redirects preserving tournament ID, selected tab and filters.
4. Keep one tournament identity and URL usable before, during and after completion.
5. Add Overview, Players, Draw, Schedule and Results navigation, with Live emphasized only while appropriate.
6. Preserve browser back/forward, fresh-page load and Capacitor back behavior.
7. Enforce draft/private visibility server-side and in route loaders.
8. Add stable match detail links carrying tournament, discipline, round, participants, court, status, score and next-round destination.

### Primary touchpoints

- `client/src/App.tsx`
- `client/src/pages/TournamentDetail.tsx`
- `client/src/pages/Pulse.tsx`
- `client/src/components/pulse/TournamentDetailsTab.tsx`
- route and navigation helpers

### Acceptance

- Bookmarked links work across the tournament lifecycle.
- Old links redirect without losing context.
- A match link works in a fresh session.
- Draft access is not leaked by redirects.
- Web and native back behavior are verified.

## 13. Work Package 6 — Match Centre, court queue and shared scorecards

Estimated effort: 6–9 engineering days.

Status: completed (project status updated 13 November 2026).

### Tasks

1. Define a shared match-view model rather than passing raw table rows to every card.
2. Build Live, Upcoming and Completed Match Centre views.
3. Add tournament, date, court and MS/WS/MD/WD/XD filters; preserve shareable filters in the URL.
4. Show last confirmed server update and stale/offline state.
5. Page historical results and scope realtime subscriptions to visible tournaments/matches.
6. Build a court-first view showing Playing, Next and Following from authoritative ordering.
7. Separate scheduled, estimated and actual times. Do not invent exact times for unscheduled queues.
8. Create shared player/pair, seed, game-score, winner and textual-status primitives.
9. Explicitly support completed, walkover, retirement, cancellation and incomplete states already present in the domain.
10. Adopt shared primitives incrementally in Match Centre, schedule, live widgets, brackets and archive views.

### Primary touchpoints

- `client/src/components/tournament/OrderOfPlayPanel.tsx`
- `client/src/components/club/LiveCourtsDashboard.tsx`
- `client/src/components/feed/MatchScorecardModal.tsx`
- `client/src/components/events/LiveMatchSchedule.tsx`
- `client/src/providers/RealtimeProvider.tsx`
- tournament query hooks and shared types

### Acceptance

- Filters consistently include XD.
- One corrected result renders consistently everywhere after invalidation.
- Empty, loading, denied, failed and stale states are distinct.
- Court queues do not silently reorder published matches.
- Realtime subscription count remains bounded for realistic fixtures.

### WP6b — Sports-site benchmark follow-ups (added 14 November 2026)

Source and evidence limits: [`sports-site-benchmark-2026-11-14.md`](./sports-site-benchmark-2026-11-14.md). Full item-by-item plan (12 items, phases A–G, PR slices, owner decisions): [`sports-site-feature-plan.md`](./sports-site-feature-plan.md).

Done locally: live-score strip on non-Live tabs, a scrollable tournament tab row, a Match Centre day strip, Results grouped by event · round, and a boxed current game on live scorecards. Still to verify with a real in-progress match: the strip and the current-game highlight.

Remaining, in order:

1. Match page tabs: Summary · Points · H2H & form · Info, on stable sub-routes of `matchPath`.
2. Last-five W/L form chips on the match page, expanded scorecards and the profile header.
3. Tournament stats tab: most wins, longest match, deuce games, biggest Elo upset.
4. Court strip replacing the court dropdown on Live.
5. Decision gate: a persisted, revisioned per-match point log. This must be in place before the worm/momentum chart and the key-moment timeline. It follows WP2's exactly-once rules.

## 14. Work Package 7 — Controlled corrections and actionable administration

Estimated effort: 5–8 engineering days.

Status: completed (project status updated 13 November 2026).

### Tasks

1. Build a correction-impact service returning current revision, rating effect and downstream bracket/schedule dependencies.
2. Display a read-only preview before confirmation.
3. Revalidate the revision and dependency state inside the correction transaction.
4. Block simple corrections once a dependent match has started or completed.
5. Apply permitted result, Elo and bracket changes atomically.
6. Record correction and undo as separate immutable audit actions.
7. Extend smaller audited flows to schedule, court and seed edits.
8. Build actionable admin cards for missing officials, schedule conflicts, observable failed syncs, unresolved identities and disputed results.
9. Link every card to the resolving entity and remove it after successful resolution/refetch.

### Acceptance

- A stale preview cannot commit.
- No correction silently rewrites a dependent live/completed match.
- Every action can be reconstructed from audit history.
- Admin counts match current server state and respect role permissions.

## 15. Work Package 8 — Identity onboarding, H2H and ranking stories

Estimated effort: 7–12 engineering days.

Status: completed and verified in isolated Docker Postgres 17 test harness and Vitest on 13 November 2026. See `docs/decisions/wp8-identity-h2h-ranking.md` and `docs/decisions/player-contact-privacy.md`.

### Identity tasks

1. Add minimal profile setup and a request-ownership flow for an existing player record.
2. Never auto-claim or merge based only on a matching name.
3. Reuse guest-resolution tools and show merge impact before commit.
4. Preserve matches, tournament entries, pair membership and saved links through aliases/redirects.
5. Separate public player data from private contact details.

### H2H tasks

1. Generalize the existing widget to compare any two players or any two pairs.
2. Normalize pair identity so A+B equals B+A while A+C remains distinct.
3. Keep player-versus-player, pair-versus-pair and played-together statistics separate.
4. Include discipline, dated meetings, round, score, form and sample size.
5. Define one policy for walkovers, retirements, incomplete and voided results.

### Ranking tasks

1. Confirm current category-rating rules before adding XD-specific ranking presentation.
2. Add dated snapshots or another reviewed reproducible history source.
3. Show movement, recent contributing results and career best only when evidence exists.
4. Distinguish individual Elo from pair performance.
5. Explain tie and correction treatment in plain language.

### Primary touchpoints

- `client/src/components/admin/GuestPlayersPanel.tsx`
- `client/src/components/admin/ResolveGuestsModal.tsx`
- `client/src/components/player-profile/HeadToHeadWidget.tsx`
- `client/src/lib/headToHead.ts`
- `client/src/pages/DoublesPairProfile.tsx`
- player, profile and leaderboard services/hooks

### Acceptance

- Unauthorized name-only claims fail.
- Guest merges preserve history.
- Pair order does not change pair identity.
- XD remains independently filterable.
- Displayed H2H totals reconcile with eligible meetings.
- Missing ranking history is labelled, not invented.

## 16. Work Package 9 — Following and targeted push alerts

Estimated effort: 5–8 engineering days.

Status: completed and verified in isolated Docker Postgres 17 test harness and Vitest on 13 November 2026. See `docs/decisions/wp9-following-and-targeted-push-alerts.md`.

### Tasks

1. Inventory existing follow and notification-preference mechanisms before adding storage.
2. Add player and tournament subscriptions only where missing.
3. Build a Following view for relevant live, upcoming and completed matches.
4. Add preferences for match call, schedule/court changes and result publication, including quiet hours and mute/unfollow.
5. Generate alerts only from committed authoritative events.
6. Deduplicate by event/version/recipient across overlapping player and tournament follows.
7. Deep-link to the canonical match route.
8. Distinguish queued, provider-accepted and observable failure states.
9. Keep following usable in-app when push permission is denied.
10. Protect private event and device/subscription data with reviewed authorization.

### Acceptance

- Following a player and their tournament produces one alert for one event.
- Retried finalization does not duplicate result alerts.
- Mute/unfollow stops future alerts.
- Schedule-change links open the current match, including XD.

## 17. Work Package 10 — Integrated qualification and rollout

Estimated effort: 4–7 engineering days plus the controlled-event observation period.

Status: local implementation gate passed on 13 November 2026; external rollout gates remain open. See `docs/decisions/wp10-integrated-qualification-and-rollout.md`.

### Automated qualification

Run and record:

```powershell
npm run check
npx vitest run
npm run build
npx playwright test
```

Add browser journeys for:

- entry to draw to schedule to score to result to Elo;
- offline score, close/reopen, reconnect and exact-once confirmation;
- two stale score writers;
- duplicate completion;
- MS/WS/MD/WD participant also entered in XD;
- match overrun and actual-rest warning;
- correction blocked after downstream start;
- public tournament and match deep links;
- empty, denied, failed and stale states.

### Manual and native qualification

- Android offline close/reopen/reconnect; browser emulation is insufficient.
- Serve/receiver recovery in singles, doubles and XD.
- Keyboard-only navigation and visible focus.
- Screen-reader names, dialog focus trapping/restoration and important state announcements.
- Reduced motion, light/dark themes, long names, narrow screens and 200% zoom.
- Bright-light court-side readability and scoring touch targets of at least 44 by 44 CSS pixels.

### Performance qualification

Capture repeatable baselines with realistic fixtures for:

- tournament opening;
- Match Centre filtering;
- live-score confirmation latency;
- profile/ranking loading;
- active realtime subscription count.

Set budgets only after measuring the baseline.

### Rollout

1. Deploy migrations to an approved staging environment.
2. Run the verification matrix with isolated accounts.
3. Use a controlled test tournament.
4. Run one small club event before general rollout.
5. Monitor revision conflicts, failed/retried syncs, recovery failures, finalization latency and notification failures without logging unnecessary personal data.
6. Keep compatible readers until old-client behavior is understood.
7. Document data rollback separately from UI feature disablement.

### Release gate

Do not release broadly until required automated checks pass, native recovery is documented, migrations are `verified-staging`, rollback responsibilities are assigned and remaining warnings are accepted explicitly.

## 18. Global definition of done

A work package is complete only when all applicable items below are true.

- Acceptance criteria pass with evidence.
- Authorization is enforced server-side, not only hidden in the UI.
- Loading, empty, denied, failed, stale and offline states are distinguishable.
- XD and every applicable participant slot are covered.
- No new registration-state workflow was introduced.
- Tests cover the business rule rather than only mocked component behavior.
- `npm run check`, relevant Vitest tests and `npm run build` pass.
- Affected Playwright journeys pass when the package changes navigation or a user journey.
- Native behavior is checked when persistence, offline recovery, back navigation or push is affected.
- Database migrations are additive, reviewed, locally verified and compatible with the documented old-client strategy.
- Generated types and documentation are updated.
- Focused diff contains no unrelated user changes.
- Known limitations, monitoring and rollback are documented.

## 19. Recommended first two weeks for a new employee

### Days 1–2

- Complete setup and repository orientation.
- Run the baseline checks.
- Use the code graph to map scoring, scheduling and tournament routes.
- Produce the first version of the reconciled backlog.

### Days 3–5

- Finish Work Package 0.
- Agree the schema-baseline strategy with the project owner.
- Prepare representative staging/local fixtures without personal production data.

### Week 2

- Execute Work Package 1.
- Demonstrate genuine concurrent score and court writers.
- Verify real Elo/bracket exact-once behavior.
- Submit a bounded verification/migration-readiness pull request.

Do not begin the conflict-resolution UI until the server conflict contract and representative-schema verification are stable.

## 20. Escalation points

Stop and ask the project owner before:

- changing tournament or match lifecycle statuses;
- rewriting an applied migration;
- applying anything to the hosted database;
- changing Elo rules;
- allowing an override of an actual-rest or occupied-court constraint;
- merging player identities without a reversible preview;
- exposing private contact, follow or device data;
- introducing a new notification provider;
- removing a legacy scoring/offline path without usage evidence;
- broadening conflict checks across concurrent tournaments or venues.

When escalating, provide the current evidence, the decision required, alternatives, data/security consequences and your recommended option.
