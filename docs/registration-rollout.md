# In-app tournament registration: rollout

Plan: `C:\Users\JANMEJAY\.claude\plans\happy-gliding-book.md` (approved 23 Nov 2026).
**Shipped 23 Nov 2026 (~21:00 IST)** in PR #30: all six migrations applied to production, the
dispatcher deployed, the backup-inbox secret set, the site deployed, and an Android release
uploaded. Registration is still **off** for every tournament (`require_app_registration`)
until an organiser turns it on (checklist steps 10–12). See "Ship log" at the end.

## Rollout checklist (do these in order)

Before each migration: check `supabase_migrations.schema_migrations` for the version (other sessions
apply local-only migrations), rehearse with `node supabase/tests/registration_rehearse.mjs …`, then
apply with `npx --yes supabase@3.3.0 db query --remote --yes -f <file>` wrapped in BEGIN/COMMIT and
`migration repair --status applied <version> --remote --yes`. After each, check
`has_function_privilege('anon', …)` (prod has drifted before) or run
`npx --yes supabase@3.3.0 db advisors --remote --type security --level warn`.

1. **Apply Migration A** `20261123150000_registration_schema.sql` (additive; nothing changes yet).
2. **Deploy the dispatcher** `dispatch-scheduled-notifications` (it now selects `attempts`,
   `delivered_channels`, `group_key`, so A must be live first). Download the live copy first and diff
   it with main (`functions download … --use-api`). Optionally first fix the pre-existing supabase-js
   version mismatch `deno check` reports (dispatcher 2.39.3 vs `_shared/notifications.ts` 2.10.0).
3. **Apply Migration B** `20261123150100_registration_player_rpcs.sql`.
4. **Apply Migration C** `20261123150200_registration_organiser_rpcs.sql`.
5. **Part B:** `20261123150300_court_key_normalise.sql` (includes the `'1'` → `'C1'` data fix; 17
   completed rows, no alerts) and `20261123150400_tournament_role_checks.sql`.
6. **Cron last:** `20261123150500_registration_cron.sql`.
7. **Deploy the client** (merge → Pages; Play release per the usual flow if wanted).
8. **Regenerate types** (`supabase gen types`), then fold `PARTICIPANT_REGISTRATION_COLUMNS` into
   `PARTICIPANT_PUBLIC_COLUMNS`, drop the untyped RPC casts in `registrationEntries.ts`, select
   `registration_opens_at`/`format_family` in the Feed query, and set `source = 'form'` on imports.
9. **Set the secret** `REGISTRATION_BACKUP_EMAIL` (club inbox) and optionally `PUBLIC_SITE_URL`:
   `npx --yes supabase@3.3.0 secrets set REGISTRATION_BACKUP_EMAIL=<club inbox>`. Never store it in
   the database (`club_settings` is public).
10. **Power Automate:** a flow on the club inbox for subjects starting `[Registration]` that parses the
    `Field: value` lines (Time (IST), Tournament, Category, Action, Player, Partner, Previous partner,
    Guest partner phone, By) into an Excel table row.
11. **Turn the flag on for one tournament** (`require_app_registration = true`, status upcoming), set
    the timeline in the organiser's Registration view, then on a phone: sign out → open the
    tournament → "Sign in to register" → sign in → you land back on **My entry**; enter a pair; check
    the partner gets the in-app notice, a **push** and an **email** (also with email turned off in
    their settings); check the backup email reaches the club inbox and Power Automate adds the row.
12. Turn on `auto_reminders_enabled` only once that works (24 h reminder + 8 PM summary).

**SMTP daily limit:** the SMTP host is a secret, so the limit couldn't be read. Gmail allows about
500 recipients a day (Workspace ~2,000; Microsoft 365 ~10,000). Registration sends one email per
notice plus one backup copy per entry change; a 100-player tournament stays well under 500 on a busy
day. If the limit is hit: sends fail, registration rows retry at 5 min / 30 min and then show as
failed in the admin Delivery panel; in-app and push still go out. Move to a Workspace/M365 sender or
spread reminders (turn off automatic reminders) for big events.

**Status:** steps 1–9 done on 23 Nov 2026 (see the ship log). Steps 10–12 belong to the user.
The poster, the daily CSV digest, `source = 'form'` on imports and the guest-claim rehearsal
were built on 23 Nov evening (see "Leftovers").

---

## Build log

### Phase 0: Preflight — Gate 0 PASSED (23 Nov 2026, ~15:30 IST)

**Modified before this run** (`git status --short`, 104 entries, from other sessions; not touched
except where a phase had to edit on top of them): saved verbatim in the session scratchpad
`git-status-before.txt`. Highlights: many `client/src/components/**` files (admin, tournament,
events, layout/ScrollToTop), `client/src/App.tsx`, `.codex/config.toml`, `.mcp.json`;
`client/src/components/tournament/AvatarStack.tsx` deleted.

**Baseline**
- `npm run check` → exit 0 (tsc clean; 0 undefined refs; no raw colours; grids OK).
- `npx vitest run` → **133 files, 1213 tests, all passed**.

**Facts re-confirmed (read-only prod queries, `supabase db query --remote --read-only`)**
- Newest applied migration `20261123090000`. This run uses `20261123150000` (A schema),
  `20261123150100` (B player RPCs), `20261123150200` (C organiser RPCs), `20261123150300`
  (Part B courts), `20261123150400` (Part B role checks), `20261123150500` (cron, applied last).
- `tournament_participants` columns exactly as the plan says (incl. `email`); only PK index;
  policies `tp_admin_all`, `tp_host_manage`, `tp_official_read`, `tp_public_read`.
- `scheduled_notifications`: checks `event_type ∈ {match_call, schedule_change, result,
  gallery_photos}`, `status ∈ {pending, sent, cancelled, failed}`; pending `group_key` unique index.
  Policy `scheduled_notifications_manage` (admin / creator / official).
- `tournament_registrations`: UNIQUE (tournament_id, player_id); self insert `player_id = auth.uid()`.
- `tournaments`: 3 rows (2 archived, 1 deleted); none open. One archived tournament already has
  `require_app_registration = true` (harmless: archived = Hidden).
- `court_number`: C1 112, NULL 97, C3 97, C2 20, `Court` 19, `1` 17.
- pg_cron: dispatcher `*/2`, match reminders `*/5`, invoked via `net.http_post` with the anon JWT.
- **`resolve_my_player_id()` already exists** (SECURITY DEFINER, mirrors `resolveMyPlayerId`: auth uid
  first, else e-mail / IISc e-mail match, non-guest first). Phase 3 reuses it instead of a new helper.
- `is_tournament_official(t, role default null)` already includes admins and the creator.
- `record_tournament_walkover` checks `can_umpire_match` (umpires/admins), so a host who is not
  an umpire can't call it; see Phase 4 decision.
- `is_tournament_manager` uses `auth.uid()` only; `reveal_tie_lineup` / `reveal_decider_rubber`
  have inline `players.role` lookups (Phase 11).
- **SMTP daily limit:** not readable (the SMTP host is an edge-function secret). Gmail personal
  accounts allow ~500 recipients/day, Google Workspace ~2,000, Microsoft 365 ~10,000. See rollout.

**Rehearsal command** (write-capable, always rolled back):
`npx --yes supabase@3.3.0 db query --remote --yes -f <script>` where the script starts with
`SET lock_timeout = '3s'; SET statement_timeout = '60s'; BEGIN;` and ends with `ROLLBACK;`.

**Decisions**
- The npx cache had lost the Supabase CLI binary mid-run (`npx --no-install supabase` failed with
  "missing packages"); used `npx --yes supabase@3.3.0` (same version as before).
- Rehearsals are built by `supabase/tests/registration_rehearse.mjs`, which concatenates the new
  migrations in order plus the chosen assertion files into one BEGIN…ROLLBACK script.

### Phase 1: Shared rules as pure code — Gate 1 PASSED (23 Nov, ~15:35 IST)

Files: `client/src/lib/registration/{window,partners,attention,limits}.ts` + tests,
`client/src/lib/registration/registrationWindowCases.json` (20 cases, also pasted into the SQL
assertions by the rehearsal script), `supabase/functions/_shared/registrationMessages.ts` +
`test/lib/registrationMessages.test.ts`.

- `npx vitest run client/src/lib/registration test/lib/registrationMessages.test.ts` → 5 files, 77 tests passed.
- `npm run check` → clean.

Decisions
- `genderCheck(cat, a, b)` treats `b === undefined` as "no partner yet" (only the entrant is checked);
  a known mismatch wins over an unknown.
- A partner on the waitlist counts as taken (`waitlisted` outcome), per "Taken" in the plan.
- When B changes partner (free C or joining a solo C), the old partner is "left behind" and stays
  entered alone (gets/keeps a solo row), matching "Leave pair".
- IST format is `Fri 27 Nov, 6 PM` (minutes shown only when not :00).
- CSV cells starting with `= + - @` are prefixed with `'` (formula-injection guard).
- User asked mid-run (live message) to **pause when usage reaches 60%**; checked at each gate
  (at Gate 1: 5-hour 36%, weekly 43%).

### Phase 2: Migration A (schema) — Gate 2 PASSED (23 Nov, ~15:55 IST)

`supabase/migrations/20261123150000_registration_schema.sql` (additive), rehearsal runner
`supabase/tests/registration_rehearse.mjs`, fixtures `supabase/tests/registration_test_helpers.sql`,
assertions `supabase/tests/registration_schema_assertions.sql`.

- `node supabase/tests/registration_rehearse.mjs A supabase/tests/tournament_visibility_assertions.sql supabase/tests/registration_test_helpers.sql supabase/tests/registration_schema_assertions.sql`
  → visibility suite passed in the same transaction; `registration_schema_assertions: 47 checks passed`; rolled back.
- `PARTICIPANT_PUBLIC_COLUMNS` gained `registered_by, source, looking_for_partner, updated_at`;
  guard test added to `client/src/lib/playerColumns.test.ts` (no `email`, new columns present) → passes.

Decisions
- New tables are read-only for clients (INSERT/UPDATE/DELETE revoked from anon + authenticated);
  every write goes through SECURITY DEFINER RPCs. Private tables also revoke SELECT from anon.
- "Organisers" in policies = `is_tournament_official(t, 'ORGANIZER')` (admins + creator + ORGANIZER
  officials; umpires/referees excluded). Player checks use `(SELECT resolve_my_player_id())` (initplan).
- Extra columns not in the plan: `tournament_partner_requests.stale_reason`,
  `tournament_backup_outbox.next_attempt_at`, `tournament_withdrawal_requests.player_ids/status
  waiting_opponent`; index `idx_scheduled_notifications_retry_due` for the claim query.
- **Rollout order matters:** the client constant selects the new participant columns, so Migration A
  must be live before the client deploys (already the plan's order).

### Phase 3: Migration B (player RPCs + triggers) — Gate 3 PASSED (23 Nov, ~16:25 IST)

`supabase/migrations/20261123150100_registration_player_rpcs.sql`,
`supabase/tests/registration_rpc_assertions.sql`.

- `node supabase/tests/registration_rehearse.mjs B supabase/tests/tournament_visibility_assertions.sql supabase/tests/registration_test_helpers.sql supabase/tests/registration_schema_assertions.sql supabase/tests/registration_rpc_assertions.sql`
  → visibility suite passed; `registration_rpc_assertions: 214 checks passed` (cumulative with the
  47 schema checks); rolled back.
- Covered: the 20 shared window cases in SQL; anon refused; flag-off / TEAM / draft / not-open /
  locked / deadline refused; every B-picks-C outcome (free, join alone, taken with name, already
  together, self, waitlisted partner); column swap; leave and withdraw notices; waitlist moves only on
  a delete while open and below the cap (a pair split may exceed the cap by one; leave never moves it;
  locked never moves it); requests: accept (swap + left-behind told), decline, stale (sender got a
  partner; receiver's pair changed), expired after the sender withdrew; gender (MD/WD/XD, unknown
  allowed, `ignore_gender_rules`); events limit for both members; guest partner = guest player with
  phone only in `tournament_entry_contacts`, no notices to guests; summary rows for both members,
  waitlist shown, `withdrawn` when nothing left; players can't write `tournament_registrations`
  while the flag is on (still can with it off); notices have the registration shape and keep the
  email channel for a player with `pref_receive_email = false`; no participant `email` written; no
  phones in events; draw insert on a flag-off tournament has no trigger effect, on a flag-on one
  locks only that category and expires its pending requests; late withdrawal notifies host +
  organiser (not umpires) with the organiser link; grants (internal fns not executable by anon or
  authenticated; player RPCs authenticated-only); every definer fn pins `search_path`.

Fix attempts (tests only, not weakened): boolean text form (`true` not `t`); schema assertions now
clean up their fixture rows; two expectations corrected to the documented rule (the entered-alone
player keeps `player_id` when someone joins; a split can exceed the cap so one withdrawal doesn't
promote). Code fix: `tournament_waitlist.created_at` defaults to `clock_timestamp()` so join order
is exact inside one transaction.

Decisions
- Reused the existing `resolve_my_player_id()` (e-mail-linked logins verified).
- Joining an entered-alone player keeps them as `player_id`; when a member changes partner, the
  caller becomes `player_id` (plan's swap rule).
- Leave = both stay entered alone (a new solo row for the leaver). Change of partner away from X =
  X gets a solo row. Splits may exceed `max_entries` by one; the organiser sees it.
- A gender **mismatch** is refused for players (organiser RPCs only warn); unknown is allowed.
- Withdrawing expires the player's pending requests in that category (so "sender withdrew" shows
  as `expired`, not `stale`).
- `enqueue_registration_notice` skips guests, deleted players and the acting player (except
  `partner_request_stale`, which tells both, and waitlist moves). Host notices link to
  `?panel=organizer&view=registration`, player notices to `?panel=my-entry&cat=…`.
- Summary partner text: `MD: Name; XD (waitlist): Name` (`no partner` when alone).
- Draw-lock and summary triggers swallow their own errors with a WARNING so they can never block a
  draw or an entry.

### Phase 4: Migration C (organiser RPCs, conflicts, reminders) — Gate 4 PASSED (23 Nov, ~16:45 IST)

`supabase/migrations/20261123150200_registration_organiser_rpcs.sql`,
`supabase/tests/registration_organiser_assertions.sql`.

- Full replay A→C in one rolled-back transaction:
  `node supabase/tests/registration_rehearse.mjs C supabase/tests/tournament_visibility_assertions.sql supabase/tests/registration_test_helpers.sql supabase/tests/registration_schema_assertions.sql supabase/tests/registration_rpc_assertions.sql supabase/tests/registration_organiser_assertions.sql`
  → visibility suite passed; **351 registration checks passed** (cumulative).
- Covered: non-organisers (member, UMPIRE official, plain player) refused by every organiser RPC,
  anon has no EXECUTE; host, ORGANIZER official and admin allowed; lock / reopen (needs a new future
  deadline after the deadline, refused once drawn), Lock all / Reopen all, timeline fields;
  `entries_visibility` set / null (= same as tournament) / bad value refused; organiser add + edit
  after the lock with notices (added / changed / removed); taken players are warnings;
  one `duplicate_found` per host per **new** conflict, none on an unrelated update (seed) or a
  growing conflict, resolved when rows go, a new one when recreated; reminders: audience
  recomputed, ids only narrow, 12 h cooldown, guests skipped as "not on the app" with a WhatsApp
  payload, no-email count, organiser note, shared-player / shared-pair texts, cap, locked category
  refused, note > 200 refused; automatic 24 h reminder (off unless `auto_reminders_enabled`; no
  partner + open requests; once per deadline even after the cooldown); evening summary per host,
  one per day, skipped when nothing changed; late withdrawal: walkover sets `winner_side` with
  `W/O` and no sets, "no opponent yet" waits, dismiss, remove before the draw, refused after;
  locked categories don't move the waitlist until the organiser taps Move up; viewer waitlist
  counts (anon, public only).

Fix attempts: one real bug fixed (the automatic reminder skipped players with no partner);
test-only corrections: cap test needed a player outside the cooldown, a "latest notice" check was
order-dependent inside one transaction, the shared-player check now allows several conflicts,
helper name typo.

Decisions
- Late-withdrawal walkover writes the same fields as `record_tournament_walkover` inside
  `resolve_withdrawal_request` (that function only admits umpires/admins via `can_umpire_match`,
  so a host who isn't an umpire couldn't call it), then calls `advance_tournament_winner`.
- `registration_waitlist_counts` is the one new function executable by `anon` (signed-out viewers
  see waitlist counts; it returns counts only and hides draft/deleted tournaments).
- Reminder cap: at most 200 recipients per call; the rest are reported as `capped`.
- Automatic reminders run hourly and send at most once per player per category per deadline.

### Phase 5: Services and hooks — Gate 5 PASSED (23 Nov, ~16:55 IST)

Files: `client/src/types/registration.ts`, `client/src/services/tournament/registrationEntries.ts`
(+ `.test.ts`, 13 tests), `client/src/hooks/useRegistration.ts`; `useMyTournamentRoles` takes the
resolved player id (3rd argument) for registrations; LiveTab and TournamentsHub pass `profile.id`.

- `npm run check` → clean. `npx vitest run` → **139 files, 1305 tests, all passed** (baseline 1213).
- Service tests (mocked Supabase): every read returns empty with **no** Supabase call when the flag
  is off (or TEAM, or no player id); RPC payloads (save, withdraw, lock, organiser save with nulls,
  reminders with empty ids/blank note → null); errors surfaced and `registration_*` codes turned
  into readable text; the entries select never includes `email`.

Decisions
- **Plan adapted:** the new participant columns were NOT added to `PARTICIPANT_PUBLIC_COLUMNS`:
  the generated Supabase types don't know them yet, so typed queries fail `tsc`. A separate
  `PARTICIPANT_REGISTRATION_COLUMNS` (guard-tested, no `email`) is used by the registration
  service; fold it in after `supabase gen types`. Side benefit: old screens don't depend on
  Migration A being live.
- RPC names are called through an untyped wrapper until types are regenerated.
- Explicit column lists everywhere (the contact-privacy guard rejects `select("*")`).
- Hooks are disabled with the flag off; queryFns return plain arrays/objects (persisted cache).

### Order change
Phase 11 (Part B, independent of Part A per the plan) is built next, before Phase 6, so a complete
track lands before the 60 % usage pause the user asked for.

### Phase 11: Part B, open tournament-day bugs — Gate 11 PASSED (23 Nov, ~17:20 IST)

1. **Courts.** `findCourtConflicts` / `suggestAlternativeSlots` (`client/src/lib/courtConflicts.ts`) and
   `bulkSchedulePatch` compare with `courtKey()`; placeholders ("Court", "TBD") are no court.
   `parseBulkSchedule` stores numbered courts as `C<n>` (new `bulkCourt()`); "Court 3", "3", "c03"
   → `C3`. Migration `20261123150300_court_key_normalise.sql`: SQL `court_key(text)` (mirror of
   `courtKey`, names lower-cased), used by `start_tournament_match_checked` (expected court,
   blackout periods, court-in-use, advisory lock) and the overlap trigger
   `assert_tournament_court_available` (also uses it; placeholders skip the check); data fix
   `'1'` → `'C1'` (17 completed IISM Trials 2026 rows, so no schedule alert fires).
2. **Role checks.** Migration `20261123150400_tournament_role_checks.sql`: `is_tournament_manager`
   = `is_admin_or_master()` or the creator (auth uid or e-mail-linked player via
   `is_my_player_id`); `reveal_tie_lineup` / `reveal_decider_rubber` use `is_admin_or_umpire()`
   instead of inline `players.role` lookups; bodies otherwise identical; anon EXECUTE revoked
   on both reveal functions (only `umpireService.ts` calls them, signed in).

- `npx vitest run client/src/lib/courtConflicts.test.ts client/src/components/admin/tournamentMatchesLogic.test.ts client/src/lib/matchView` → 4 files, 83 tests passed
  (new: "1"/"C1"/"Court 1" overlap, different courts and placeholders never collide, blackout typed
  "Court 2" hits a match stored "2", no same-court suggestion under another spelling, bulk stores
  `C<n>`, retyping the same court is not a change).
- `node supabase/tests/registration_rehearse.mjs partb --only=partb supabase/tests/tournament_visibility_assertions.sql supabase/tests/registration_test_helpers.sql supabase/tests/court_key_role_checks_assertions.sql`
  → RLS suite passed; `court_key_role_checks_assertions: 33 checks passed`; rolled back.
- **Not run:** `supabase/tests/court_start_assertions.sql` is a psql script (`\set`) for the local
  fixture harness, so the CLI can't run it.

Decisions
- Existing parser tests changed on purpose: bulk lines now store `C3` (plan: "stores C<n>"), not `3`.
- `is_tournament_manager` keeps its meaning (admins + creator); ORGANIZER officials are still not
  "managers" (unchanged behaviour). Umpire checks became `is_admin_or_umpire()` (adds e-mail-linked
  umpires/admins; otherwise the same set).
- Noticed, not changed: `lib/matchReadiness` / courtBoard write the bare key ("1") when putting a
  match on court, so new "1" values can appear again; harmless now that every comparison uses
  `courtKey` / `court_key`.

### Cron migration + full replay (23 Nov, ~17:30 IST)
`supabase/migrations/20261123150500_registration_cron.sql` (hourly `7 * * * *` deadline reminders,
`30 14 * * *` = 8 PM IST summary) + `supabase/tests/registration_cron_assertions.sql`.
`node supabase/tests/registration_rehearse.mjs all <visibility> <helpers> <schema> <rpc> <organiser> <court/roles> <cron>`
→ every suite passed in one rolled-back transaction (all six migrations in order).
User raised the usage pause to **75 %** (live message).

### Phase 6: Player UI, "My entry" — Gate 6 PASSED (23 Nov, ~17:55 IST)

Files: `client/src/components/registration/{MyEntryPanel,PartnerPicker}.tsx`, `registrationText.ts`,
`MyEntryPanel.test.tsx` (11 tests); `lib/tournamentRoutes.ts` (`"my-entry"` panel, `parseCategory`,
`myEntryPath`); `lib/returnUrl.ts` (`rememberReturnUrl`, `takeReturnUrl` — in-app paths only);
`App.tsx` `/login-callback` and `useProfileSetup` (first setup) honour and clear the return address;
`LiveTab.tsx`: "My entry" pill beside My matches (signed in, flag on, not TEAM), Register button opens
My entry when the flag is on, "Sign in to register" stores My entry as the return address;
`autoAnnouncements.registrationState()` follows `registrationWindow()` with the flag on and the Feed
post's Register opens My entry. New RPC `my_waitlist_positions` added to Migration B (players only
see their own waitlist rows) — B re-rehearsed: 216 checks passed.

- `npx vitest run client/src/components/registration client/src/lib/returnUrl.test.ts client/src/lib/tournamentRoutes.test.ts client/src/lib/autoAnnouncements` → all passed
  (signed out → sign in + return address; no entry; taken → Ask; entered-alone → Join; received
  request Switch/Stay; stale request explained; leave/withdraw; waitlist position; locked → Can't play?;
  flag off → nothing; gender prompt; return-url round trip and off-site refusal; `?cat=` parsing).
- `npm run check` → clean.
- Playwright mocked-Supabase journey (`tests/signed-in-journeys.spec.ts`, "member enters a category
  from My entry on a phone", centre-court = light and floodlight = dark, 375 px) → 2 passed via a
  temporary `playwright.registration.tmp.config.ts` (port 5199, workers 1, 120 s timeout; first try
  timed out on a cold vite server). Cards fit 375 px; the Enter tap sends `save_my_tournament_entries`
  with `[{category:"MS"}]`; no private player columns read. Screenshots:
  `test-results/my-entry-375-{centre-court,floodlight}.png`.

Decisions
- The "My entry" pill test is covered by `isRegistrationFlagOn` + the journey (LiveTab itself has no
  unit harness); the pill isn't shown for TEAM tournaments.
- Feed post uses tournament-level dates only (it doesn't load per-category settings). The Feed query
  doesn't select `registration_opens_at` yet (types not regenerated), so until then the Feed treats
  a flag-on tournament with no opening date as open.
- Picker loads members (id, name, gender; no guests) only when it opens.

### Phase 7: Viewer UI, Players tab — Gate 7 PASSED (23 Nov, ~18:10 IST)

Files: `client/src/lib/registration/visibility.ts` (+ test, 7), `LivePlayersSection.tsx` (new optional
`tournament` prop; `player_id`/`partner_id` on its row type; `useAuth` for the viewer's own entry),
`LivePlayersSection.visibility.test.tsx` (8), LiveTab passes the tournament.

- Component tests: as_entered (with status line "Open · 2 entered · 2 on the waitlist"), null inherits
  `show_participants` on and off, after_close before/after the lock, after_draw and hidden private,
  own entry always shown with "Your entry", Looking-for-a-partner mark, flag off = today's behaviour.
- Playwright harness: "viewer sees a category's entries, status line and waitlist count" at 375 px
  (`/tournaments/<id>/players?cat=MD`) → passed; screenshot `test-results/players-tab-375.png`.
- `npx tsc --noEmit` clean.

Decisions
- With the flag on, seed badges stay hidden until the category's draw exists (app entries get seeds
  in sign-up order, which aren't real seeds).
- Entry counts per category are shown only when that category's list is visible.
- Flag-on tournaments always load the (already public) participant rows and filter on screen; the
  "not published" message for the whole tab now applies only with the flag off.

### Phase 8: Organiser UI, "Registration" view — Gate 8 PASSED (23 Nov, ~18:40 IST)

Files: `client/src/components/registration/{RegistrationView,RegistrationReminderSheet}.tsx` + test (8),
`client/src/lib/registration/drawWarnings.ts` + test (4). Mounted in `TournamentManager` → Players
(entries) tab (flag on; the legacy approve panel stays below for old pending sign-ups) and in
`HostSetupSections` → "Registration" (host **and ORGANIZER officials**: `OrganizerDashboard` now
offers Set-up when the flag is on and passes `organiser`; Entries and Scoring rules stay host-only;
`?view=registration` from a notice opens Set-up with the section expanded).
`TournamentParticipantsTab.generateBracket`: Make-draw warnings (shared partners, partner-less
doubles, seeds in sign-up order) and per-category match count (`countTournamentMatches(id, cat)`).
`TournamentSettingsTab`: form URL stays editable with the flag on (labelled "Fallback form").

- Component tests: backup status + category counts; lock/unlock; filters + organiser add after the
  lock; duplicates banner; reminder sheet (recipients, guest "Copy WhatsApp message", channel line
  "In-app, push and email", preview with organiser note, payload, result "Reminded 1 · skipped 1 ·
  1 not on the app"); sheet off for a locked category; late withdrawal walkover after the draw /
  remove before / "waiting for opponent"; summary text.
- Playwright harness "host opens the Registration view from a notice link" at 375 px (paper, light)
  and 1280 px (smash, dark) → 2 passed; screenshots `test-results/registration-view-*.png`.
- `npm run check` → clean.

Decisions / not built
- **Poster (A4 + QR) not built:** it needs the `qrcode` package (lockfile change + install). Share
  and "Closing soon" texts are built (navigator.share, clipboard fallback). Left for a follow-up.
- The reminder sheet previews recipients from `registration_attention`; the 12 h cooldown is applied
  by the server and shown in the result ("skipped N"), not predicted per row beforehand.
- Withdrawal requests list and backup status live here (Phase 9/10 UI parts done early).

### Phase 9: Edge functions (local only) — Gate 9 PASSED with a gap (23 Nov, ~19:00 IST)

Files: `supabase/functions/_shared/dispatchRules.ts` (+ `test/lib/dispatchRules.test.ts`, 9 tests),
`_shared/notifications.ts` (`getNotificationTargets(…, opts)`; default = today's behaviour),
`dispatch-scheduled-notifications/index.ts`.

Dispatcher changes: stuck `sending` rows (> 10 min) go back to `pending` with `attempts + 1`; a
**claim step for every row** (`UPDATE … SET status='sending' WHERE id IN (…) AND status='pending'
RETURNING`, so overlapping runs never double-send; due = `coalesce(next_attempt_at, scheduled_at) <= now`);
rule `registration` (in-app type `tournament_registration`, push optional and gated by
`pref_receive_push` + `pref_notify_whistle`, **email ignores both email prefs**; title/body from
`buildRegistrationNotice(payload)`, email subject/text from `registrationEmail()` with an absolute
link); `delivered_channels` recorded per channel and a retry sends only the missing ones;
registration failures retry at 5 min / 30 min then fail on the 3rd attempt; a requeue that hits the
pending `group_key` index cancels the older row; non-registration rows: claim step only, then
today's flow (fail at once). Backup drain: up to 20 unsent `tournament_backup_outbox` rows per run
to `REGISTRATION_BACKUP_EMAIL` (`[Registration] <tournament> — <name> — <entered|changed|left|withdrawn>`,
`Field: value` lines, guest phone included only here), retry with the same backoff, give up after 3.

- `npx vitest run test/lib` → 10 files, 117 tests passed (wording, CSV, target selection:
  registration ignores email prefs / other kinds unchanged, retry decisions, channels to resend,
  stuck detection, collision detection, due filter, backup backoff).
- `npx esbuild <file>` syntax check on the dispatcher, notifications.ts, dispatchRules.ts → ok.
- **Not verified: `deno check`** — Deno is not installed on this machine. Run
  `deno check supabase/functions/dispatch-scheduled-notifications/index.ts` before deploying.
- **Not built: the daily CSV digest email** (one CSV per day while open). The per-event backup
  emails carry the same data; the organiser view also has a CSV export.

Decisions
- Claim time is stored in `sent_at` while `sending` (overwritten on success, cleared on requeue).
- Absolute email links use env `PUBLIC_SITE_URL`, default `https://iiscshuttlers.github.io/IIScBadmintonClub`.
- Rollout order matters: the dispatcher selects `attempts`, `delivered_channels`, `group_key`,
  so deploy it only **after** Migration A is applied.

### Phase 10: Fallback import, guest claim, late withdrawals — Gate 10 PASSED (partly) (23 Nov, ~19:10 IST)

- `client/src/lib/registration/importDedupe.ts` (+ test, 2): skip anyone already entered in the
  category (same player, e-mail in any case, or phone by its last 10 digits). Wired into
  `ParticipantImportModal.runBulkImport` when the flag is on; the toast says how many were skipped.
- Late withdrawals: list + Remove / Give walkover / Dismiss built in Phase 8, wired to
  `resolve_withdrawal_request`; walkover sets `winner_side` with `W/O` and no sets, and the
  no-opponent-yet case waits — both verified in the Gate 4 rehearsal.
- **Not done:** imported rows keep `source = 'organiser'` (the participant service is typed against
  the old generated types; set `source = 'form'` after `supabase gen types`).
- **Not verified:** guest-claim re-check. When a claim approval rewrites `player_id`/`partner_id`
  on participant rows, the conflict trigger (Migration C) records any shared player and queues one
  `duplicate_found` for the host; no rehearsal of the claim RPC itself was run.

### Phase 12: Final verification — Gate 12 PASSED (23 Nov, ~19:30 IST)

- `npm run check` → exit 0. `npx vitest run` → **146 files, 1364 tests, all passed** (baseline 133 / 1213;
  no new failures). One release-gate test (`test/qualification/wp10ReleaseGate.test.ts`) was updated on
  purpose: it allowed `pushOptional: true` for gallery alerts only; it now allows exactly gallery
  alerts and registration notices (the plan's rule) and still fails on any other.
- Full rehearsal, all six migrations in order with every suite, one rolled-back transaction:
  `node supabase/tests/registration_rehearse.mjs all supabase/tests/tournament_visibility_assertions.sql supabase/tests/registration_test_helpers.sql supabase/tests/registration_schema_assertions.sql supabase/tests/registration_rpc_assertions.sql supabase/tests/registration_organiser_assertions.sql supabase/tests/court_key_role_checks_assertions.sql supabase/tests/registration_cron_assertions.sql`
  → passed (**386** registration/Part B checks + the visibility suite + cron). `has_function_privilege`
  checks are part of the suites (internal functions closed to anon and authenticated; player and
  organiser RPCs authenticated-only; waitlist counts anon by design; reveal functions closed to anon).
- `deno check` (Deno 2.9.8, installed mid-run by the user; run with `--no-config` from a scratch dir):
  the dispatcher's only error is the **pre-existing** supabase-js 2.39.3 vs 2.10.0 client-type mismatch
  on the `getNotificationTargets(supabase, …)` call; `send-match-reminders` and `match-notifier` (not
  touched) fail the same way. The first run inside the repo made Deno add `"workspaces": ["."]` to
  `package.json`; that change was reverted (`package.json` is as before).
- Memories updated: `in-app-registration-direction`, `tournament-day-open-bugs`,
  `supabase-cli-on-this-machine`, MEMORY.md index.
- Temporary Playwright config removed. Nothing committed, pushed, applied or deployed.

### Leftovers built (23 Nov, ~20:00 IST)

- **`source = 'form'`:** `bulkImportParticipants` takes an optional `source`; `ParticipantImportModal`
  passes `"form"` only when the flag is on, so flag-off imports insert exactly as before (unit test).
- **Guest-claim rehearsal** (`supabase/tests/registration_guest_claim_assertions.sql`, 11 checks, own
  fixtures). It **found a real bug**: approving a claim on a registration tournament failed with
  `tournament_registrations_unique`. The summary trigger wrote the real player's row when
  `merge_player_identity` moved the participant row, and then the merge's own
  `tournament_registrations` update collided. Fix (Migration B, `reg_sync_registration_summary`):
  a guest left with no entries has their summary row deleted instead of being marked withdrawn. A claim
  where both are already entered in the same category stays refused (`merge_blocked: history_conflict`),
  so nobody ends up in two rows.
- **`court_start_assertions.sql`** is now self-contained (own players, tournament and matches, no psql
  `\set`) and also checks a bare `"2"` clashes with `"C2"`. Run:
  `node supabase/tests/registration_rehearse.mjs partb supabase/tests/court_start_assertions.sql`.
- **`deno check`:** `_shared/notifications.ts` types its client structurally (`{ from(table) }`), so the
  supabase-js 2.39.3 vs 2.10.0 clash is gone. The dispatcher, lineup-deadline-reminders, notify-up-next,
  push-live-score, send-announcement and send-match-reminders type-check clean. match-notifier and
  notify-social still have their own pre-existing type errors (not deployed in this work).
- **Daily CSV digest:**
  - a new table `tournament_backup_digests` (service role only);
  - `queue_registration_backup_digest()`, run by cron `registration-backup-digest` at `35 14 * * *`
    (20:05 IST), queues one row per IST day when anything was backed up in the last 24 h;
  - the dispatcher's `drainBackupDigest` emails a CSV attachment (`BACKUP_CSV_HEADER` columns, oldest
    first, formula-safe) to the club inbox, with the same 5 min / 30 min / give-up retries.
  Pure builders `digestCsv` / `digestSubject` / `digestBody` are unit-tested.
- **QR poster:**
  - `qrcode@1.5.4` was added;
  - a "Poster (A4)" button in the organiser's Registration view opens a printable page (club name,
    tournament, open categories with closing times, QR for the My entry link);
  - if pop-ups are blocked, the page downloads instead;
  - share links and the poster now use the public https site (`publicLink`), so they also work when
    copied from the Android app.

### Ship log (23 Nov 2026)

1. **Gate:**
   - `npm run check` clean;
   - vitest 148 files / 1375 tests;
   - full rehearsal (all six migrations, every suite, plus guest-claim and court-start) passed, rolled
     back;
   - Playwright 21 / 22: `wp10-performance` also fails on `main` at f9ad3528 (not this work), and the
     flaky scroll journey was skipped;
   - the gallery e2e mock was updated for batched `site_data` reads (`key=in.(…)`).
2. **PR #30** (`feat/registration-and-admin-revamp`, 4 commits) included all uncommitted work in the
   checkout except local tool config.
3. **Migrations applied** in this order, each in BEGIN/COMMIT with `lock_timeout 3s`, then
   `migration repair`: 20261123150000 (A), then dispatcher deploy, then 150100 (B), 150200 (C), 150300
   (court key; 17 rows `'1'` → `'C1'`), 150400 (role checks), 150500 (cron: 3 jobs active).
   - New tables: RLS on, no client writes.
   - Anon can execute only `registration_waitlist_counts`.
   - The security advisors' only new entries are the intended client RPCs.
4. **Dispatcher deployed** (`dispatch-scheduled-notifications`). The live copy matched the previous
   `main`, and after the deploy it returns 200 every 2 min with the backup and digest drains active.
5. **Secret set:** `REGISTRATION_BACKUP_EMAIL` (the club inbox; function secret only).
6. **Types regenerated.** The registration columns are folded into `PARTICIPANT_PUBLIC_COLUMNS`, the
   Feed reads `format_family` and `registration_opens_at`, and the import `source` cast is gone. The
   registration service keeps an untyped table helper because participants embed `players` twice,
   which the generated types report as ambiguous.
7. **Merged** to `main`; the GitHub Pages deploy succeeded and the live site loads.
8. **Android release:** v4.36 (build 436) uploaded to the production track and rolled out; tag `v4.36-build436` pushed.
