# World-class experience evidence ledger

Started: 14 November 2026. Owner: unassigned. Roadmap: [`world-class-experience-roadmap.md`](./world-class-experience-roadmap.md).

## Production shell performance update — 14 November 2026

- Production-only build inspection found that `vite-plugin-manus-runtime` was injecting a development inspection runtime, a second React payload and its CSS directly into `index.html`.
- The Vite configuration now enables all Manus inspection/storage plugins only for the development server.
- A production rebuild reduced `dist/index.html` from 375.14 kB (107.60 kB gzip) to 8.30 kB (2.63 kB gzip), a 97.8% raw-size reduction.
- `scripts/check-production-index.mjs` now fails the production build if a Manus runtime marker returns or if `index.html` exceeds 40 KiB.
- Current verification: TypeScript/undefined-reference gate passed; 77 Vitest files and 622 tests passed; production build and the new index guard passed.
- Playwright discovered all 14 Chromium journeys, but the managed web-server phase stalled before the first test in three serial attempts. This run therefore does not replace the earlier browser evidence; rerun on a host where Playwright can complete its web-server handoff.

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
| Result sharing | Locally verified on 14 November 2026 | `ShareResultButton.tsx`, `matchViewShare.ts`, `matchViewShare.test.ts` (5/5 passed); absolute public base URL | Android share sheet; current hosted deep links return 404/generic crawler metadata |
| Actionable admin cards | Locally verified on 14 November 2026 | `adminActions.ts`, `useAdminActionItems.ts`, `AdminActionCards.tsx`; delay, conflict, observability and navigation tests pass | Role/RLS matrix against an isolated staging instance |
| Identity, H2H and pair comparisons | Locally verified on 14 November 2026 | `DoublesPairProfile.tsx`; `comparison.ts`; `comparison.test.ts` (9/9 passed) | Public-data staging acceptance and broader partnership-history product slice |
| Factual tournament stories | Locally verified on 14 November 2026 (evening) | `tournamentStory.ts` (11/11 tests incl. publication record, JSON round-trip and public withholding after a corrected final); `TournamentStoryPanel.tsx` (6/6 component tests: hidden when unpublished, separate organiser note, corrected-final withholding, unverifiable-results hiding, admin publish, empty-selection guard); `useTournamentStory.ts`. Published record stored under `site_data` key `tournament_story:<id>` (existing public-read/admin-write policy; no migration). Drafts are never written. Read-only dev-server check against real data: IISM Trials 2026 produced 4 items from 61 decided matches, 0 withheld on re-check, Results tab rendered with no console errors | Admin publish against staging (not run against production); browser check of the admin editor needs an admin sign-in; non-admin organisers cannot publish under current `site_data` policy; walkover finals produce no champion item |
| Venue scoreboard mode | Browser locally verified on 14 November 2026 | `VenueScoreboardPage.tsx`, `venueDisplay.ts`, `wc09-venue-display.spec.ts`; 3/3 at 1920×1080, 1280×720 and 200% zoom, including court focus, disconnect/reconnect and fullscreen refusal; inspected captures under `docs/qualification` | Physical viewing-distance/fullscreen/sleep check, subscription-memory observation and two-hour soak |
| Public page metadata and rich previews | Hosting limitation verified on 14 November 2026 | Live root returned 200; tournament/match deep paths returned 404 with generic root metadata | Approve prerender/edge or hosting change; rich previews are not qualified on current Pages hosting |

## Release and environment ledger

| Area | Current evidence | State / risk | Required next step |
| --- | --- | --- | --- |
| Current worktree automated gate | Full automated suite rerun on 14 November 2026: 77 test files/622 tests, check, build and diff hygiene passed; expanded 14/14 Chromium journeys passed serially | Locally verified source gate | Preserve serial browser configuration; proceed only to approved staging/rehearsal |
| SQL isolation | Dedicated Postgres 17 scorer-lock replay and simultaneous two-client race passed locally on 14 November 2026 | Single-scorer slice locally verified; not a full release-chain or hosted-staging replay | Replay the exact release migration set against an approved schema baseline |
| Staging | WP10 records no approved isolated Supabase branch/project | Blocked | Obtain dedicated staging or approved branch; never use production as staging |
| Android | `testDebugUnitTest`, `lintDebug` and `assembleDebug` passed on 14 November 2026; no device/emulator was connected | Package locally verified; blocked for native recovery evidence | Connect a supported device or emulator and execute the recovery matrix |
| Production database compatibility | WP10 records compatibility-ending migrations and emergency grants while an old client remained live | High release/security risk | Follow the client-first checklist; do not run blanket `supabase db push` |
| Public contact privacy | WP10 records emergency grants exposing selected contact columns until the compatible client ships | High privacy risk; reported current state must be rechecked read-only before action | Deploy compatible reviewed client, then reapply restrictions in the documented order |
| Push provider | Queue contract locally qualified; prior `sent` row is not delivery proof | Staging evidence missing | Deploy qualified dispatcher to staging and test with non-production tokens |
| Performance | WP10 reports deterministic local browser baselines | Useful regression baseline, not device/network SLA | Rerun on release commit; measure staging and Android separately |

## Reconciled backlog

| ID | Scope | Working owner | Treatment after reconciliation | Exit evidence |
| --- | --- | --- | --- | --- |
| WC-00 | Evidence ledger and roadmap reconciliation | Engineering | Complete for initial implementation pass; keep ledger current | Every release capability has a state, source, gap and role owner |
| WC-01 | Android recovery and scorer conflict | Engineering + release owner | Android package and isolated scorer-lock race qualified locally; physical recovery still open | Physical-device transcript; local server/concurrency evidence now passes |
| WC-02 | Custom rules and point history | Engineering | Complete locally; interval, uncapped-game and coverage defects fixed | 15/21/30 rules, partial log and corrected log pass unit, component and mobile browser checks |
| WC-03 | My tournament | Product + engineering | Complete locally; consolidated Home surfaces into one actionable card without schema changes | One-action next match, multi-discipline and unknown-time behavior pass focused and signed-in mobile checks; staging/Android remain in WC-11 |
| WC-04 | Court/back continuity | Engineering | Complete locally; route-specific URL/scroll restoration, court conflict alerts, unassigned section and context-aware match return implemented | Browser and unit checks pass; hardware Back/process-death evidence remains in WC-11 |
| WC-05 | Notification identity/expiry/deep links | Engineering + release owner | Complete locally; recipient deduplication, quiet hours, and canonical match deep links implemented | Stable event/revision/recipient queue identity, superseded/expired suppression and cold/warm canonical routing pass |
| WC-06 | Doubles intelligence | Product + engineering | Complete locally; canonical order-independent identity, shared eligibility, discipline and date samples | Pair/profile staging and public-data acceptance remain in WC-11 |
| WC-07 | Admin issue coverage | Tournament operations + engineering | Complete locally; delay threshold, resolving routes and denied/unknown/empty observability states | Server-wide offline-device health is explicitly not claimed |
| WC-08 | Tournament stories | Editorial owner + engineering | Complete locally; admin review/publish/withdraw editor and public Results-tab story with live fact re-checking | Staging publish, organiser-role permission decision and walkover-final policy remain open |
| WC-09 | Venue scoreboard | Venue operator + engineering | Browser-qualified at 1080p, 720p and 200% zoom with reconnect and fullscreen-refusal behavior | Physical display/sleep/fullscreen, subscription-memory and two-hour soak evidence remain open |
| WC-10 | Public metadata | Web/release owner | Actual hosting verified; share payloads pass but deep links return HTTP 404 with generic metadata | Hosting/prerender decision required before rich previews can be claimed |
| WC-11 | Integrated rehearsal | Release owner | Local source gate passed; venue browser matrix and isolated scorer concurrency added | Broad release held: full staging chain, physical Android, provider, screen reader, physical venue soak and controlled-event evidence remain open |

## Immediate execution order

1. Prepare an approved isolated Supabase staging environment and replay the full pending migration/assertion sequence; the local scorer-lock slice already passes.
2. Connect an Android device/emulator and run process-death, reconnect, native-back and real push-provider acceptance with non-production accounts/tokens.
3. Run the controlled tournament, screen-reader matrix and two-hour physical venue rehearsal recorded in WC-11.
4. Decide between prerender/edge rendering or a different host for HTTP-200 route-specific public metadata.
5. Do not deploy or mutate hosted Supabase from this ledger task.

## Evidence update template

For each entry append: date/time and timezone; commit/worktree identity; environment; exact command or manual steps; fixture/account role; result; artifact/log location; limitations; person responsible. Never record personal contact values or live push tokens.
