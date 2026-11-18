# WP10 Record — Integrated Qualification and Rollout

State: `locally-qualified; external-rollout-gates-open` (13 November 2026).
Work package: 10 (execution playbook §17). Integrates and qualifies Work Packages 0 through 9.

---

## 1. Executive Summary & Qualification Matrix

WP0 through WP9 are locally qualified under automated and isolated-database tests. WP10's implementation gate passes locally; staging, physical Android recovery, performance measurement, a controlled tournament and a small club event remain external release gates. The 13 November release-blocker run did not mutate the hosted environment.

| Package | Scope | Automated Evidence | Database / Isolation Verification | Status |
| --- | --- | --- | --- | --- |
| **WP 0** | Baseline & Backlog Reconciliation | `npm run check`, production offline integration, Playwright scoring journey | Documented in `docs/wp0-wp2-audit-2026-11-13.md` | Locally qualified |
| **WP 1** | Full-schema migration & concurrency | `concurrency_verification.mjs`; legacy client RPCs revoked | Tested in Docker Postgres 17 `result_revision_assertions.sql` | Locally qualified; staging pending |
| **WP 2** | Score-conflict resolution | `ScoreConflictModal.test.tsx`, `offlineQueue.test.ts` | Server vs local side-by-side reconciliation verified | Locally qualified |
| **WP 3** | Configurable rest policy & overrides | `restConflicts.test.ts`, `courtConflicts.test.ts` | Tested in Docker Postgres 17 `schedule_override_assertions.sql` | Locally qualified |
| **WP 4** | Lifecycle readiness gates | `tournamentReadiness.test.ts`, `tournamentService.test.ts` | Docker Postgres 17 assertions include two-entrant minimum, privacy and hard conflicts | Locally qualified |
| **WP 5** | Canonical tournament & match routes | `tournamentRoutes.test.ts`, `TournamentPage.test.tsx` | URL normalization, state preservation, deep-link routing | Locally qualified; native back pending |
| **WP 6** | Match Centre & shared scorecards | `matchView.test.ts`, `UpNextPanel.test.tsx` | Authoritative queue order, XD compatibility, tie-breaking | Locally qualified |
| **WP 7** | Corrections & actionable administration | `correctionPreview.test.ts`, `MatchCorrectionDialog.test.tsx`, `AdminActionCards.test.tsx` | Legacy direct-edit callers removed; reasoned correction and dedicated advancement paths used | Locally qualified; ranked/team winner recalculation intentionally blocked |
| **WP 8** | Identity onboarding, H2H & rankings | `comparison.test.ts`, `ratingStory.test.ts`, `HeadToHeadPage.test.tsx`, `playerColumns.test.ts` | Contact privacy migration and real-role assertions passed after timestamp correction | Locally qualified |
| **WP 9** | Following & targeted push alerts | `followingAlerts.test.ts`, `subscriptionService.test.ts` | Queue contract, forged-call rejection, dedupe, quiet hours and schedule revisions passed in Docker Postgres 17 | Locally qualified; provider delivery pending staging |
| **WP 10** | Integrated qualification & rollout | check, 511 Vitest tests, build and 2 Playwright journeys pass | Static release gate plus WP4/WP8/WP9 isolated database replay | Local gate passed; external rollout pending |

---

## 2. Automated Qualification Evidence

1. **Static Analysis & Type Integrity (`npm run check`)**:
   - `tsc --noEmit && node scripts/check-undefined-refs.mjs`
   - **Result**: Exit code 0. Zero compiler errors, 0 new undefined references in `@ts-nocheck` files.
   - Guard verified: `playerColumns.test.ts` statically checks all client code to guarantee no queries request `select("*")` or leak private contact columns.

2. **Production Bundle Verification (`npm run build`)**:
   - `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
   - **Result**: Built successfully in 1m 26s. Existing mixed static/dynamic import warnings remain non-fatal.

3. **Domain, Engine & Unit Test Suites (Vitest)**:
   - **Result**: 61 files and 511 tests passed.
   - Two known non-failing jsdom navigation warnings remain.

4. **Browser journeys (Playwright / Chromium)**:
   - Rapid rally input does not drop taps and supports score correction.
   - Both score controls are keyboard reachable and operable.
   - **Result**: 2 tests passed in 7.9 seconds after installing Playwright's pinned Chromium.

5. **Database Verification via Isolated Supabase PostgreSQL 17**:
   - `lifecycle_readiness_assertions.sql`, `contact_privacy_assertions.sql` and `following_targeted_alerts_assertions.sql` passed.
   - Authenticated access to both legacy result RPCs is false; service-role recovery access is true.
   - The disposable container was removed after verification.

---

## 3. Manual, Accessibility & Native Qualification Status

- Keyboard operation of the two primary score controls is browser-verified; focus rings and accessible names are present.
- Reduced-motion behavior is configured with `<MotionConfig reducedMotion="user">`.
- Offline queue and conflict recovery are covered at the production hook boundary.
- Physical Android process-death/reopen/reconnect, full screen-reader review, 200% zoom, bright-light readability and measured touch targets still require manual evidence.

### 3.1 Android build verification (13 November 2026)

- The production web bundle was copied into the Capacitor Android project and all 13 native plugins synced successfully.
- `assembleDebug`, `testDebugUnitTest` and `lintDebug` completed successfully.
- Android Lint initially found seven release errors. API-specific edge-to-edge style attributes were moved into API-qualified resources, and the Quick Settings tile now uses the required `PendingIntent` path on Android 14 and newer. The repeat report contains **0 errors and 66 warnings**.
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` (72,023,758 bytes; SHA-256 `61C07AD6E4C165874D13320F85486435C4814058995EE65D23CD05F63DD3A5F3`).
- ADB starts successfully, but no device or emulator was connected. Install, process-death, offline close/reopen/reconnect and native back-button evidence therefore remain open.

### 3.2 Performance baseline (14 November 2026)

`npm run benchmark:wp10` now runs a repeatable Chromium benchmark using deterministic REST fixtures: 48 tournaments, 256 players and a 127-match primary tournament across MS, WS, MD, WD and XD. The benchmark warms lazy chunks before measuring and does not contact or mutate production.

| Surface | Baseline | Provisional local budget |
| --- | ---: | ---: |
| Tournament opening | 782.5 ms median; 1,115.6 ms p95 (3 samples) | p95 ≤ 1,500 ms |
| Match Centre filtering | 26.7 ms | ≤ 100 ms |
| Live-score UI confirmation | 33.6 ms median; 44.4 ms p95 (20 samples) | p95 ≤ 75 ms |
| Public rankings loading | 809.5 ms | ≤ 1,500 ms |
| Realtime connections | 1 steady; 2 peak during navigation | ≤ 1 steady; ≤ 2 transition peak |

These are local regression budgets, not production-network or physical-device SLAs. They must be revisited after staging and Android measurements.

---

## 4. Staged Rollout & Deployment Sequence

Use a controlled client-first cutover. The final privacy and legacy-RPC hardening migrations intentionally end compatibility with older clients that request private player columns or use unrevisioned result writes.

### Phase 1: Deploy Client Code (Pre-Migration)
1. Deploy the new Vite client build.
2. The client is engineered to be fully tolerant of the un-migrated database:
   - Reads only public player columns.
   - Treats missing RPCs (e.g. contact lookup or subscription tables) as safe degradation ("no contacts / no active follows").
   - Service worker update automatically purges old query caches using `buster: "player-contact-privacy-1"`.

### Phase 2: Apply Additive Database Migrations
Apply migrations in chronological order:
1. `20261112053310_add_tournament_result_revisions.sql` (Result revision locking)
2. `20261113031227_enforce_court_reservations_and_checked_start.sql` (Court scheduling)
3. `20261113104500_add_tournament_score_correction.sql` (Score correction locking)
4. `20261113113500_add_rest_duration_policies_and_overrides.sql` (Rest duration rules)
5. `20261113123000_add_lifecycle_readiness_gates.sql` (Readiness gates)
6. `20261113150000_add_correction_preview_undo_and_edit_audit.sql` (Audit logging)
7. `20261113160000_add_player_identity_claims_and_merge.sql` (Identity claims & merge)
8. `20261113170000_add_tournament_subscriptions_and_alert_dedup.sql` (Tournament following & deduplication)
9. `20261113180000_restrict_player_contact_columns.sql` (Contact privacy; deliberately after WP9 player columns)
10. `20261113190000_harden_legacy_tournament_result_rpcs.sql` (Old-client write-path revocation)
11. `20261114090000_restrict_participant_email_and_claim_contact.sql` (Entry emails and lost-and-found claimant contacts; same client-first rule as step 9)

**Re-apply step 9's restriction after the client ships.** On 14 November production access was restored with a re-grant (see §5.2), so the database currently allows the old `select("*")`. After the new client is live and old cached builds have updated, run:

```sql
REVOKE SELECT ON public.players FROM anon, authenticated;
-- then re-run the GRANT block from 20261113180000 (column-level SELECT on every non-private column)
```

or re-run `20261113180000_restrict_player_contact_columns.sql` itself (it is idempotent).

### Phase 3: Compatibility Gate
1. Require the revisioned client version before applying `20261113190000`; older clients will be unable to finalize or directly edit results by design.
2. Regenerate Supabase types from the staging schema and rerun the complete matrix.

## 5. External release gates still open

- Apply the ordered migrations to an approved schema-only staging clone and retain the transcript.
- Run physical Android offline close/reopen/reconnect and native back-button checks.
- Measure performance with a realistic tournament fixture before setting budgets.
- Run a controlled test tournament, then one small club event, while monitoring revision conflicts, recovery failures, finalization latency and notification failures.
- Verify push provider acceptance/failure behavior with real tokens in staging.

### 5.1 Release-blocker execution status (13 November 2026)

1. **Staging rehearsal — blocked by environment approval.** The Supabase account has one active project named `IIScBadmintonClub` and no development branches. Creation of the isolated `wp10-staging-2026-11-13` branch was declined; no existing inactive project was repurposed.
2. **Deployment — intentionally held.** The only client deployment workflow publishes GitHub Pages from `main`, while the qualified changes are an uncommitted worktree on `feat/tournament-day-suite`. The documented client-first sequence cannot be satisfied by dispatching the current remote build. Production was not changed.
3. **Hosted state verified read-only.** The active project already records migrations through `20261113180000_restrict_player_contact_columns`. `20261113190000_harden_legacy_tournament_result_rpcs` remains pending. `call-to-court`, `notify-up-next` and `dispatch-scheduled-notifications` are active with JWT verification enabled.
4. **Next safe action.** Approve an isolated Supabase branch (or provide a dedicated staging project), connect an Android device or start an emulator, and prepare a reviewed commit for the production-only GitHub Pages workflow. Only after staging passes should the client be deployed and the final RPC-hardening migration applied.
5. **Performance qualification — locally complete.** The deterministic browser benchmark passes in 7.8 seconds and records the baseline and provisional budgets in §3.2.
6. **Controlled tournament — automated rehearsal complete; hosted observation blocked.** Eight focused suites covering bracket generation, lifecycle gates, court/rest conflicts, offline scoring, corrections, routes and targeted alerts pass: 130 tests. The real isolated-account tournament and small club event still require the staging branch and human participants.
7. **Push provider — readiness audited; real-token staging run blocked.** Production currently has three registered tokens belonging to three users, all refreshed within 30 days. One queue row is recorded as `sent`, but the deployed dispatcher could mark `sent` without checking FCM responses, so that row is not accepted as provider-delivery evidence. The local dispatcher now fails rows when Firebase credentials/tokens are unavailable, checks every FCM HTTP response, removes dead tokens and marks a row `sent` only after all FCM requests are accepted. The qualification test passes, but this function has not been deployed pending staging.

### 5.2 Production incident — 14 November 2026

- **What happened.** `20261113180000_restrict_player_contact_columns` (and the WP7/WP8 migrations) were applied to the hosted project while production still served the 19 October client from `main`. That client reads `players` with `select("*")` (including sign-in profile loading in `AuthContext`), which the restricted schema rejects (`42501`), so profile and player reads failed for everyone.
- **Mitigation (approved, executed 14 Nov).** `GRANT SELECT ON public.players TO anon, authenticated;` via `supabase db query --remote` on the linked `IIScBadmintonClub` project. Verified with signed-out requests: `select=*` and `select=…,email` on `players` return 200 again. Consequence: player contact details are publicly readable again until the re-apply step in §4.
- **Hosted state after mitigation.** WP7/WP8/privacy functions exist (anonymous calls return `42501`, not "not found"); `player_aliases` is readable; `players` has table-wide SELECT again.
- **Lesson.** Migrations that end old-client compatibility must not be applied before the client deploy (§4 Phase 1). Use the release checklist in §7.

### 5.3 Signed-out data audit — 14 November 2026

Counts only; no values were displayed or stored.

| Table | Signed-out result | Action |
| --- | --- | --- |
| `players` (email/phone) | readable again after the §5.2 re-grant | re-apply restriction after client deploy |
| `tournament_participants.email` | readable; 11 of 285 rows filled | `20261114090000` + client switched to public columns |
| `find_lost_posts.claim_contact` | readable; 1 row filled | `20261114090000`; visible only to author, claimant, admins |
| `tournament_registrations` | 0 rows (policy: own row, admins, officials) | none |
| `admin_logs`, `user_push_tokens`, `notifications`, team invite tokens | 0 rows | none |

Not audited: what signed-in members can read (needs a member account on staging).

Separate defect noticed: `find_lost_posts` UPDATE is allowed only for the author or admins, so a non-author claiming an item likely fails silently. Not changed.

---

## 6. Rollback & Contingency Plan

1. **Client Rollback**:
   - Before migrations 9–10, the client can be rolled back normally. After them, roll back only to a build that uses public player columns and revisioned result RPCs; an older client is intentionally incompatible.
2. **Database Rollback**:
   - If contact restrictions must be reverted: execute `GRANT SELECT ON public.players TO anon, authenticated;`.
   - Re-granting legacy result RPCs would restore old-client writes but reopen the lost-update/idempotency gap. Treat that as an emergency-only, explicitly approved rollback.
   - Additive tables (`user_tournament_subscriptions`, `delivered_targeted_alerts`, `player_aliases`) do not impact legacy query paths.

## 7. Release checklist (client-first)

Run in order; do not skip ahead.

1. **Freeze.** All work for the release is committed and merged to `main` through reviewed PRs (one per work package). `npm run check`, `npx vitest run`, `npm run build`, `npx playwright test` (including `tests/signed-in-journeys.spec.ts`) pass on the merge commit.
2. **Staging (when approved).** Apply all migrations in §4 order to a schema-only staging copy; run the SQL assertion suites under `supabase/tests/`; regenerate Supabase types and re-run step 1.
3. **Ship the client.** Deploy `main` (GitHub Pages workflow). Confirm the live bundle version, then wait until old cached builds have updated (service worker; at least one release cycle).
4. **Verify the client on the current DB.** Signed out and signed in: home, a tournament page, a player profile, the schedule. No `select=*` requests to `players`, `tournament_participants` or `find_lost_posts` in the network log.
5. **Apply compatibility-ending migrations**, one at a time, verifying after each:
   - re-apply `20261113180000_restrict_player_contact_columns.sql` (contacts were re-granted on 14 Nov);
   - `20261113190000_harden_legacy_tournament_result_rpcs.sql`;
   - `20261114090000_restrict_participant_email_and_claim_contact.sql`.
   If a preflight check stops a migration, fix the named policy/function and re-run.
6. **Post-deploy checks.** Repeat step 4; run the signed-out audit (counts only) and confirm private columns now return `42501`; watch `scheduled_notifications` failures and revision-conflict logs for a day.
7. **Rollback.** Client: redeploy the previous `main` build only before step 5. Database: `GRANT SELECT ON public.<table> TO anon, authenticated;` restores old-client reads (re-exposes the columns).
