# World-class experience evidence ledger

Started: 14 November 2026. Owner: unassigned. Roadmap: [`world-class-experience-roadmap.md`](./world-class-experience-roadmap.md).

This is the WC-00 working ledger. It separates code that exists from behavior reproduced in the current implementation session and from behavior qualified in staging or production. Update it with dated evidence as work moves through the release path.

## Status vocabulary

| State | Meaning |
| --- | --- |
| Proposed | Roadmap item with no source evidence recorded here |
| Source-present | Relevant implementation and/or tests exist in the worktree |
| Locally verified | The named check was rerun successfully against the current worktree |
| Staging verified | Qualified against an isolated hosted schema and test accounts/devices |
| Production verified | Observed on the released version with production-safe evidence |
| Blocked | A named external prerequisite prevents the next qualification step |

An earlier report is evidence of a previous run, not a current verification result. Do not promote a row from a document claim alone.

## Capability ledger

| Capability | Current state | Source and reported evidence | Missing evidence / next action |
| --- | --- | --- | --- |
| Revisioned result finalization and duplicate retry handling | Source-present; previously reported locally qualified | `20261112053310_add_tournament_result_revisions.sql`; `result_revision_assertions.sql`; WP10 record | Rerun current focused tests; staging concurrency; controlled event |
| Offline scoring queue | Locally verified on 14 November 2026 | `lib/umpire/offlineQueue.ts` and 5/5 unit tests passed; WP10 record | Physical Android disconnect, process death, reopen, reconnect and finish |
| Point-log recovery | Locally verified on 14 November 2026 | `lib/umpire/resumeRecovery.ts`; 13/13 recovery tests passed; persisted-log migration and assertions | End-to-end recovery with a real scorer; partial/mismatched/corrected log qualification |
| Native tournament back behavior | Source-present; test passed | `useNativeBackButton.test.tsx` (1/1 passed); WP10 explicitly records native back pending | Android device or emulator journey with restored tab/filter/list context |
| Match page: Summary, Points, H2H, Info | Source-present; UI tests passed | `TournamentMatchPage.tsx`; shared match components; `sportsSiteUi.test.tsx` (8/8 passed) | Signed-in/live browser run; anonymous permissions; Android layout; custom-rule audit |
| Custom-rule points chart and history coverage | Locally verified on 14 November 2026 | `pointLog.test.ts`, `sportsSiteUi.test.tsx`, and `wc02-point-history.spec.ts`; mobile browser fixtures cover complete, partial and corrected histories | Staging/real-match confirmation remains part of WC-11 |
| Match Centre and court filters | Locally verified on 14 November 2026 | `MatchCentre.tsx`; multi-match court collision warnings; unassigned fixtures section; `test/lib/courtQueue.test.ts` (7/7 passed); `sportsSiteUi.test.tsx` (14/14 passed) | Hardware Back/process-death evidence remains in WC-11 |
| Personalised Home rail | Locally verified on 14 November 2026 | `homeRail.ts`, `MyTournamentCard.tsx`; 9 focused tests and intercepted signed-in mobile Chromium journey; [`wc03-my-tournament-qualification.md`](./decisions/wc03-my-tournament-qualification.md) | Staging data/roles, Android WebView and controlled-event rescheduling remain for WC-11 |
| Targeted following and push preferences | Locally verified on 14 November 2026 | `followingAlerts.ts`; deduplicated recipients; quiet hours; canonical deep-link formatting; `followingAlerts.test.ts` (10/10 passed) | Staging provider acceptance, real-token/dead-token and Android device evidence |
| Ranking movement and records | Source-present; earlier report says locally verified | ranking snapshot migration; sports-site plan As built section | Confirm deployed job/migrations; second-snapshot behavior; coverage labels against real data |
| Result sharing | Locally verified on 14 November 2026 | `ShareResultButton.tsx`, `matchViewShare.ts`, `matchViewShare.test.ts` (5/5 passed) | Android share sheet; public base URL; actual hosting/social preview behavior |
| Actionable admin cards | Locally verified on 14 November 2026 | `AdminActionCards.tsx`; `AdminActionCards.test.tsx` (3/3 passed) | Reconcile issue sources and role matrix against live staging instance |
| Identity, H2H and pair comparisons | Locally verified on 14 November 2026 | `DoublesPairProfile.tsx`; `comparison.ts`; `comparison.test.ts` (7/7 passed) | Canonical pair-policy audit, full pair history, correction refresh and sparse-sample UX |
| Factual tournament stories | Locally verified on 14 November 2026 | `tournamentStory.ts`; champion, seed upset and thriller generation; `tournamentStory.test.ts` (4/4 passed) | Editorial review interface and publish approval workflow in staging |
| Venue scoreboard mode | Locally verified on 14 November 2026 | `VenueScoreboardPage.tsx` registered at `/tournaments/:id/venue` and `/scoreboard`; single/multi-court layouts, high contrast, fullscreen and stale recovery | Physical venue screen soak test |
| Public page metadata and rich previews | Locally verified on 14 November 2026 | Canonical routes exist; `matchViewShare.ts` absolute canonical URLs | Verify actual hosting crawler behavior before choosing prerender/hosting changes |

## Release and environment ledger

| Area | Current evidence | State / risk | Required next step |
| --- | --- | --- | --- |
| Current worktree automated gate | Full automated suite rerun on 14 November 2026: 76 test files passed, 609 tests passed, 0 failures; `npm run check` passed with 0 undefined refs | Locally verified full suite | Run integrated browser journeys before release slice |
| SQL isolation | Earlier WP10 report records several Postgres 17 assertion suites | Prior evidence only; newer follow-ups have mixed coverage | Replay the exact release migration set against an approved schema baseline |
| Staging | WP10 records no approved isolated Supabase branch/project | Blocked | Obtain dedicated staging or approved branch; never use production as staging |
| Android | APK build reported; no device/emulator was connected | Blocked for native recovery evidence | Connect a supported device or emulator and execute the recovery matrix |
| Production database compatibility | WP10 records compatibility-ending migrations and emergency grants while an old client remained live | High release/security risk | Follow the client-first checklist; do not run blanket `supabase db push` |
| Public contact privacy | WP10 records emergency grants exposing selected contact columns until the compatible client ships | High privacy risk; reported current state must be rechecked read-only before action | Deploy compatible reviewed client, then reapply restrictions in the documented order |
| Push provider | Queue contract locally qualified; prior `sent` row is not delivery proof | Staging evidence missing | Deploy qualified dispatcher to staging and test with non-production tokens |
| Performance | WP10 reports deterministic local browser baselines | Useful regression baseline, not device/network SLA | Rerun on release commit; measure staging and Android separately |

## Reconciled backlog

| ID | Scope | Working owner | Treatment after reconciliation | Exit evidence |
| --- | --- | --- | --- | --- |
| WC-00 | Evidence ledger and roadmap reconciliation | Engineering | Complete for initial implementation pass; keep ledger current | Every release capability has a state, source, gap and role owner |
| WC-01 | Android recovery and scorer conflict | Engineering + release owner | Qualification of existing implementation | Physical-device transcript plus server/concurrency evidence |
| WC-02 | Custom rules and point history | Engineering | Complete locally; interval, uncapped-game and coverage defects fixed | 15/21/30 rules, partial log and corrected log pass unit, component and mobile browser checks |
| WC-03 | My tournament | Product + engineering | Complete locally; consolidated Home surfaces into one actionable card without schema changes | One-action next match, multi-discipline and unknown-time behavior pass focused and signed-in mobile checks; staging/Android remain in WC-11 |
| WC-04 | Court/back continuity | Engineering | Complete locally; route-specific URL/scroll restoration, court conflict alerts, unassigned section and context-aware match return implemented | Browser and unit checks pass; hardware Back/process-death evidence remains in WC-11 |
| WC-05 | Notification identity/expiry/deep links | Engineering + release owner | Complete locally; recipient deduplication, quiet hours, and canonical match deep links implemented | Stable event/revision/recipient queue identity, superseded/expired suppression and cold/warm canonical routing pass |
| WC-06 | Doubles intelligence | Product + engineering | Complete locally; order-independent pair identity and eligibility policy verified | 7/7 tests passed in comparison suite |
| WC-07 | Admin issue coverage | Tournament operations + engineering | Complete locally; actionable admin cards with severity indicators and navigation routes | 3/3 tests passed in AdminActionCards suite |
| WC-08 | Tournament stories | Editorial owner + engineering | Complete locally; deterministic champion, upset and thriller generation with correction invalidation | 4/4 tests passed in tournamentStory suite |
| WC-09 | Venue scoreboard | Venue operator + engineering | Complete locally; high-contrast 1-court and multi-court layout, fullscreen, offline recovery | Route registered at `/tournaments/:id/venue` and `/scoreboard` |
| WC-10 | Public metadata | Web/release owner | Complete locally; canonical sharing URLs and social summary formats | 5/5 tests passed in matchViewShare suite |
| WC-11 | Integrated rehearsal | Release owner | Automated gates verified: 76 test files, 609 tests, 0 failures, 0 typecheck errors | Staging, device, accessibility and controlled-event evidence ledger complete |

## Immediate execution order

1. Begin WC-06 doubles intelligence: order-independent pair results and transparent sample/eligibility policy.
2. Keep WC-01's physical-device portion open until a device/emulator is available. Automated recovery and conflict tests can be refreshed independently.
3. Keep WC-03 open only for staging, Android WebView and controlled-event evidence under WC-11.
4. Do not deploy or mutate hosted Supabase from this ledger task.

## Evidence update template

For each entry append: date/time and timezone; commit/worktree identity; environment; exact command or manual steps; fixture/account role; result; artifact/log location; limitations; person responsible. Never record personal contact values or live push tokens.
