# WP7 record — Controlled corrections and actionable administration

State: `verified-locally` (13 November 2026). Database changes are **not deployed** to the hosted project.
Work package: 7 (execution playbook §14). Builds on WP1/WP2 (revisions, `apply_tournament_match_correction`) and WP6 (shared match model).

Discovery note: code-review-graph MCP was unavailable; exploration used `grep`/direct reads.

Dependency note: the playbook orders WP7 after WP4. WP3/WP4 were in progress in the same checkout; this package does not modify their files. The migration is timestamped after WP3's and reads the WP3 `schedule_override_*` columns, so WP3's migration must be applied first.

## User-visible outcome

- Organisers get a **Correct** action on completed matches (Tournament Manager → Fixtures). It shows the current server result, takes corrected game scores, and before anything is saved shows a **read-only preview**: old → new score, winner change, Elo effect, every later match fed by this result (and whether it has started), and the revision the server will check. Applying needs a reason.
- If anyone changes the result between preview and apply, nothing is saved and the dialog says so and reloads the new state.
- The latest correction can be **undone** with a reason; the undo is a new audited action and never edits the original record.
- Each match shows its **history**: corrections, undos, direct edits, court/time changes and overrides, with who/when/before/after/reason.
- The admin dashboard opens with **Needs attention** cards — running tournaments with no umpire/referee, schedule conflicts (same detectors and policy as the Order of Play, overridden conflicts excluded), disputed friendly results, guest identities to resolve, and score updates on *this device* not yet confirmed by the server. Each card opens the screen that resolves it and disappears after resolution and refetch. A failed check is shown as "may be incomplete", never as "nothing to do".

## Decisions

1. **Authoritative audit table.** `tournament_audit_events` is append-only (UPDATE/DELETE/TRUNCATE rejected by trigger), not writable by clients (no INSERT/UPDATE/DELETE grant; RLS read limited to `is_tournament_official`). `admin_logs` stays as the readable activity feed but is client-insertable, so it is not treated as evidence.
2. **One correction core.** `_change_tournament_match_result` (not client-executable) holds the WP2 guards unchanged — auth, reason, operation-ID idempotency, expected revision, ranked/team winner-change block, downstream-started block under the row lock — and records the audit event. `apply_tournament_match_correction` keeps its signature, receipts and error codes; WP2 assertions pass unchanged.
3. **Preview is advisory; the transaction is authoritative.** `preview_tournament_match_correction` is STABLE and read-only. Apply re-reads revision and downstream state inside the transaction, so a stale preview cannot commit (`40001`).
4. **Undo = new action.** `undo_tournament_match_correction(event_id, expected_revision, reason, operation_id)` restores the event's `before` values through the same core, only while that correction is still the current result (`correction_superseded` otherwise). Retries are idempotent; a second different undo is refused.
5. **Direct edits can no longer silently rewrite history.** Admin screens still write `tournament_matches` directly (Edit, Reset, status select, Undo Match). A row trigger now:
   - rejects rewriting a decided result while a downstream match has started (`downstream_match_started`);
   - bumps `result_revision` on any direct result rewrite of a decided match, so earlier previews and umpire submissions cannot overwrite it;
   - records `result_direct_edit`, `schedule_edit`, `schedule_override` (with the WP3 reason) and `seed_edit` (on `tournament_participants`) with actor and before/after.
   Normal scoring is unaffected: rows that become decided inside the current transaction (e.g. `submit_tournament_match_v2`'s multi-statement completion) are exempt via a transaction-local flag, and live point updates (not decided) are ignored.
6. **Elo.** Winner changes in Elo-counting tournaments and team rubbers remain blocked (as in WP2) and the preview says why; score-only corrections are allowed. Atomic Elo reversal is not implemented (see limitations).
7. **Failed syncs are device-local.** Unconfirmed umpire snapshots live in each device's storage, so the card counts only this device's queue and says so.

## Files

Database:
- `supabase/migrations/20261113150000_add_correction_preview_undo_and_edit_audit.sql`
- `supabase/tests/correction_preview_undo_assertions.sql`, `supabase/tests/wp7_harness_setup.sql`

Client (new): `lib/correctionPreview.ts` (+ test), `services/correctionService.ts`, `components/admin/MatchCorrectionDialog.tsx` (+ test), `lib/adminActions.ts` (+ test), `hooks/queries/useAdminActionItems.ts`, `components/admin/AdminActionCards.tsx` (+ test).

Client (changed): `components/admin/TournamentMatchesTab.tsx` (Correct button + dialog), `pages/SiteAdmin.tsx` (cards on the dashboard).

Not touched: WP3/WP4 files (`OrderOfPlayPanel`, `restConflicts`, `courtConflicts` — imported read-only — settings, their migrations), `tournamentService.ts` (existing `applyTournamentMatchCorrection` reused).

## Verification

Isolated database `test_wp7` in the local Supabase Postgres 17 container (`test_wp3` untouched). Chain: `auth_setup`, `result_revision_bootstrap`, WP1/WP2 migrations, WP3 `20261113113500`, `wp7_harness_setup`, WP7 migration, then:
- `result_revision_assertions.sql` — passed
- `score_correction_assertions.sql` — passed (WP2 contract unchanged)
- `schedule_override_assertions.sql` — passed; overrides recorded as `schedule_override` with reason, plain edits as `schedule_edit`
- `correction_preview_undo_assertions.sql` — passed: preview read-only and accurate; blockers; direct reset blocked while downstream started; direct edit bumps revision and is audited; stale preview rejected; correction → undo restores, separate events, original intact; undo retry idempotent; double undo refused; audit append-only; schedule/seed audited; no client write/execute on internals; non-official preview/undo refused.

WP4's `20261113123000` cannot run in this bootstrap (it reads `tournaments.name`, absent from the shared harness) — a WP4 harness gap, independent of WP7.

Client: `npm run check` (no new errors; two pre-existing WP3 errors in `NoticeBoard.tsx`, `TournamentSetupChecklist.tsx`), unit/component tests (17 + 8 new), full `vitest`, `vite build`, undefined-reference gate. Admin screens require an admin sign-in, so the dialog and cards are exercised by component tests with mocked RPCs; all new modules load in the dev server.

## Known limitations

- **Not deployed**; the hosted project lacks the new RPCs/table, so the dialog and history will error there until the migration (after WP3's) is applied.
- Ranked/team **winner changes still need a coordinated Elo/tie recalculation** path; WP7 blocks and explains rather than performing it.
- Direct admin edits (Edit/Reset/status select) are audited and guarded but **carry no reason**; moving them onto reasoned RPCs is follow-up work.
- Undo covers corrections only (not direct edits or schedule changes).
- Disputes/guests counts are club-wide and admin-only; organiser-scoped (non-admin) dashboards are not provided.
- Browser verification of the signed-in admin flow was not possible in this session.

## Rollback

Client: remove the Correct button/dialog and the `AdminActionCards` block. Database: drop triggers `tournament_matches_guard_direct_edit`, `tournament_matches_audit_direct_edit`, `tournament_participants_audit_seed`; re-apply `20261113104500` to restore the original `apply_tournament_match_correction` body. Keep `tournament_audit_events` (history).
