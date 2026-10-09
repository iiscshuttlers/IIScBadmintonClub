# Technical Specification: Team Events (IISc Badminton Club) — v2

Status: draft for approval. Supersedes the first draft; changes are driven by a review against the real schema
(`client/src/lib/supabase-types-auto.ts`, `useUmpireState.tsx`, `supabase/migrations/*`).

Items marked **[verify]** are assumptions I could not confirm from the code and must be checked before the
relevant migration is written. Items marked **[decision]** need an owner decision (see section 12).

---

## 1. Objective

Add "Team Events" (leagues/pools, team knockouts, tie-based formats) to the app. A **tie** is Team A vs Team B and
is made of several **rubbers** (individual matches: MS, WS, MD, WD, XD). Every rubber participant is a real
registered `players` row, so ELO, win/loss records, H2H and match history reflect team-event play.

Non-goals (v1): live team auctions/drafts, per-rubber substitution mid-match, cross-tournament team identity
(teams are per-tournament), paid registration.

## 2. Design Principles

1. **All writes go through `SECURITY DEFINER` RPCs.** RLS is row-level and cannot express "captain may change only
   `lineup_locked_a`" or "captain may only touch their own side". Authenticated users get `SELECT` only on new
   tables; mutations are RPCs that validate the caller, state and rules inside one transaction.
2. **Validation lives in the database**, mirrored in the UI for UX only (roster membership, rubbers-per-player,
   doubles pairs, gender rules).
3. **Derived state is recomputed, never incremented.** Tie score/winner are recalculated from rubbers, so score
   corrections, walkovers and re-submissions stay consistent.
4. **Lineups are secret until both sides lock.** Stored in a private table and copied into `tournament_matches`
   only at reveal.
5. **Open events are untouched.** `format_family` defaults to `OPEN_EVENT`; every existing consumer of
   `tournament_matches` is audited so rubbers cannot leak into open-event brackets, schedules or stats.
6. **Single source of truth per fact** (e.g. captain is `tournament_teams.captain_id` only).

## 3. Permission Model (maps to what exists today)

The app has no "organizer" concept. Existing authority is `tournaments.created_by` and `players.role`
(`admin`, `master_admin`, `umpire`); `players.id = auth.uid()`.

Helper functions (`SECURITY DEFINER`, `STABLE`, `search_path = public`):

| Function | Returns true when |
|---|---|
| `is_tournament_manager(t_id)` | `tournaments.created_by = auth.uid()` OR caller role in (`admin`,`master_admin`) |
| `is_team_captain(team_id)` | `tournament_teams.captain_id = auth.uid()` |
| `is_team_staff(team_id)` | captain, OR active member with role `VICE_CAPTAIN` |
| `is_active_team_member(team_id)` | row in `tournament_team_members` with status `ACTIVE` |

"Open registration" from the first draft is dropped for teams: team creation is by the tournament manager, or by
any approved player when `tournaments.team_self_registration = true` (new flag, default `false`). **[decision]**

## 4. Schema

All migrations are additive and live in `supabase/migrations/2026MMDDHHMMSS_team_events_*.sql`, one concern per
file, so each can be reverted independently.

### 4.1 Changes to `tournaments`

| Column | Type | Notes |
|---|---|---|
| `format_family` | `text NOT NULL DEFAULT 'OPEN_EVENT'` | CHECK in (`OPEN_EVENT`,`TEAM`) |
| `tie_format_config` | `jsonb` | required iff `TEAM`; see 4.2; frozen once ties exist |
| `max_rubbers_per_player` | `int` | default 2, CHECK > 0 |
| `team_roster_min` / `team_roster_max` | `int` | defaults 4 / 10 |
| `team_self_registration` | `boolean NOT NULL DEFAULT false` | |
| `tie_points_win` / `tie_points_draw` | `int` | defaults 2 / 1 (league table points) |
| `counts_for_elo` | `boolean NOT NULL DEFAULT true` | **[decision]** whether team rubbers move ELO |

CHECK: `format_family = 'TEAM' OR tie_format_config IS NULL`.

### 4.2 `tie_format_config` shape

```json
{
  "rubbers": [
    {"order": 1, "label": "MS1", "category": "MS", "points": 1, "best_of_sets": 3, "points_to_win": 21},
    {"order": 2, "label": "MD1", "category": "MD", "points": 2, "best_of_sets": 3, "points_to_win": 21}
  ],
  "play_dead_rubbers": false,
  "draw_allowed": true
}
```

- `category` in (`MS`,`WS`,`MD`,`WD`,`XD`); drives slot count (singles 1, doubles 2) and gender rule.
- A SQL function `validate_tie_format(jsonb)` enforces: unique contiguous `order`, `points > 0`, valid category,
  at least 1 rubber, total points odd when `draw_allowed = false`. Used in a CHECK constraint.
- The rubber's `best_of_sets`/`points_to_win` are copied onto `tournament_matches.best_of_sets` / `points_to_win`
  (columns already exist) so the Umpire engine needs no new input.

### 4.3 Changes to `tournament_matches`

Existing NOT NULL columns that rubber rows must satisfy: `category`, `round`, `round_name`, `match_code`,
`match_number`, `status`. Existing player columns are `player1_id..player4_id` (nullable); **[verify]** the
convention is player1/player2 = side 1 and player3/player4 = side 2 (check `submit_tournament_match` and
`useUmpireHelpers`).

New columns:

- `tie_id uuid NULL REFERENCES tournament_ties(id) ON DELETE CASCADE`
- `rubber_order int NULL`, `rubber_label text NULL`
- `UNIQUE (tie_id, rubber_order)` (partial: `WHERE tie_id IS NOT NULL`)
- `CHECK ((tie_id IS NULL) = (rubber_order IS NULL))`
- index on `(tie_id)`

Rubber-row generation fills: `category` = rubber category, `round`/`round_name` from the tie, `match_number` =
tie-scoped sequence, `match_code` = `<tie_code>-R<order>`, `team1_label`/`team2_label` = team short names,
`status` = the existing "scheduled" value **[verify the allowed status values and whether a CHECK constraint
exists; a `skipped`/`cancelled` value for unplayed dead rubbers may be needed]**.

### 4.4 New tables

**`tournament_teams`**

| Column | Type |
|---|---|
| `id` | uuid PK default `gen_random_uuid()` |
| `tournament_id` | uuid NOT NULL FK → tournaments ON DELETE CASCADE |
| `name`, `short_name` | text NOT NULL (short_name ≤ 5 chars) |
| `logo_url` | text NULL |
| `captain_id` | uuid NOT NULL FK → players |
| `pool` | text NULL (e.g. `A`) |
| `seed` | int NULL |
| `status` | text NOT NULL default `ACTIVE` (`ACTIVE`,`WITHDRAWN`) |
| `created_at` | timestamptz default now() |

Constraints: `UNIQUE (tournament_id, lower(name))`, `UNIQUE (tournament_id, lower(short_name))`,
`UNIQUE (tournament_id, captain_id)`.

**`tournament_team_members`** (renamed from `rosters`; adds consent + tournament scoping)

| Column | Type |
|---|---|
| `id` | uuid PK |
| `team_id` | uuid NOT NULL FK → tournament_teams ON DELETE CASCADE |
| `tournament_id` | uuid NOT NULL (denormalised; set by RPC, guarded by trigger) |
| `player_id` | uuid NOT NULL FK → players |
| `role` | text NOT NULL default `PLAYER` (`VICE_CAPTAIN`,`PLAYER`) — captain is NOT a role here |
| `status` | text NOT NULL default `INVITED` (`INVITED`,`ACTIVE`,`DECLINED`,`REMOVED`) |
| `invited_by` | uuid FK → players |
| `created_at`, `responded_at` | timestamptz |

Constraints: `UNIQUE (team_id, player_id)`; partial
`UNIQUE (tournament_id, player_id) WHERE status IN ('INVITED','ACTIVE')` — a player is on at most one team per
tournament. Trigger ensures the captain always has an `ACTIVE` member row (inserted by `create_team`).

**`tournament_ties`**

| Column | Type |
|---|---|
| `id` | uuid PK |
| `tournament_id` | uuid NOT NULL FK |
| `tie_code` | text NOT NULL (unique per tournament, e.g. `A-03`, `SF-1`) |
| `team_a_id`, `team_b_id` | uuid FK → tournament_teams (CHECK `team_a_id <> team_b_id`; NULL allowed in knockouts until fed) |
| `stage` | text CHECK in (`POOL`,`KNOCKOUT`) |
| `round_name` | text (e.g. `Group A – R2`, `Semi-Final`) |
| `round_number` | int |
| `state` | text CHECK in (`SCHEDULED`,`AWAITING_LINEUPS`,`IN_PROGRESS`,`COMPLETED`,`CANCELLED`) |
| `scheduled_at` | timestamptz NULL |
| `lineup_deadline` | timestamptz NULL |
| `lineup_locked_a`, `lineup_locked_b` | boolean default false |
| `score_team_a`, `score_team_b` | int default 0 (derived) |
| `winner_team_id` | uuid NULL FK (derived or admin-set) |
| `result_type` | text default `NORMAL` (`NORMAL`,`WALKOVER`,`FORFEIT`,`ADMIN_DECISION`) |
| `needs_admin_decision` | boolean default false (knockout draw, see 7.4) |
| `advances_to_tie` | uuid NULL FK → tournament_ties |
| `advances_to_slot` | text NULL (`A`/`B`) |
| `loser_advances_to_tie`, `loser_advances_to_slot` | optional (3rd-place playoff) |
| `created_at`, `updated_at` | timestamptz |

`score_*`, `winner_team_id`, `state` and lock flags are written only by RPCs/triggers.

**`tie_lineups`** (private until reveal)

| Column | Type |
|---|---|
| `id` | uuid PK |
| `tie_id` | uuid FK → tournament_ties ON DELETE CASCADE |
| `side` | text CHECK in (`A`,`B`) |
| `rubber_order` | int |
| `player1_id`, `player2_id` | uuid FK → players (`player2_id` NULL for singles) |
| `submitted_by` | uuid FK → players |
| `updated_at` | timestamptz |

`UNIQUE (tie_id, side, rubber_order)`.

**`tournament_team_standings`** — a `security_invoker` view of raw aggregates per team per pool (played, won,
drawn, lost, tie points, rubbers for/against, games for/against, points for/against). Final ordering with
head-to-head tiebreaks is computed in a unit-tested TS util (7.5), not SQL.

### 4.5 Indexes

`tournament_teams(tournament_id)`, `tournament_team_members(team_id)`, `(player_id)`, `(tournament_id, status)`,
`tournament_ties(tournament_id, state)`, `(team_a_id)`, `(team_b_id)`, `tournament_matches(tie_id)`,
`tie_lineups(tie_id)`.

## 5. Row Level Security

RLS enabled on every new table.

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `tournament_teams` | public | none for `authenticated` (RPC only) |
| `tournament_team_members` | public for `status = 'ACTIVE'`; own row, staff of team and tournament manager can see `INVITED` | none (RPC only) |
| `tournament_ties` | public | none (RPC/trigger only) |
| `tie_lineups` | tournament manager always; team staff for **their own side only**; everyone else only when the tie's `lineup_locked_a AND lineup_locked_b` | none (RPC only) |

Writes are done by `SECURITY DEFINER` functions that check `auth.uid()` against the helpers in section 3.
`tournament_matches` keeps its existing policies; rubber rows are created and filled by RPCs, and results still go
through `submit_tournament_match`. Anyone who could previously umpire a match can umpire a rubber.

## 6. RPC Surface

All return the affected row(s) and raise descriptive exceptions the client maps to toasts.

| RPC | Caller | Behaviour |
|---|---|---|
| `create_team(t_id, name, short_name, logo_url, captain_id)` | manager, or any approved player if `team_self_registration` (captain = self) | Insert team + captain's `ACTIVE` member row |
| `invite_team_member(team_id, player_id)` | team staff | Insert `INVITED`; checks one-team-per-tournament, roster max, tournament status; sends notification |
| `respond_team_invite(member_id, accept bool)` | invited player | → `ACTIVE`/`DECLINED`; re-check uniqueness and roster max |
| `remove_team_member(member_id)` | staff, manager, or the player (leave) | → `REMOVED`; blocked if the player is in a locked lineup of a non-completed tie |
| `set_team_captain(team_id, player_id)` | manager | Player must be `ACTIVE`; old captain stays as member |
| `set_member_role(member_id, role)` | captain | `PLAYER`/`VICE_CAPTAIN` |
| `create_ties(t_id, ties jsonb)` | manager | Bulk-insert fixtures generated client-side (7.1); validates teams belong to the tournament; creates rubber rows (7.2) |
| `open_tie_lineups(tie_id)` | manager (or scheduler job) | `SCHEDULED → AWAITING_LINEUPS` |
| `save_tie_lineup(tie_id, side, assignments jsonb)` | team staff of `side` | Upsert draft into `tie_lineups`; full validation but does not lock |
| `lock_tie_lineup(tie_id, side)` | team staff of `side` | Re-validates, sets lock flag; if both locked, runs reveal (7.3) |
| `admin_replace_rubber_player(match_id, slot, player_id)` | manager | Allowed only before rubber `started_at`; audit-logged |
| `set_tie_result(tie_id, kind, winner_team_id, note)` | manager | Walkover/forfeit/knockout-draw decision; writes `result_type`, completes tie, triggers advancement |
| `update_tie_format(t_id, config jsonb)` | manager | Rejected once any tie exists |

### 6.1 Lineup validation (inside `save_tie_lineup` / `lock_tie_lineup`)

1. Caller is staff of that side; tie `state = AWAITING_LINEUPS`; that side not already locked.
2. Every rubber in `tie_format_config` has an assignment with the right slot count (1 or 2).
3. All players are `ACTIVE` members of that team; no duplicates within a rubber.
4. A player appears in at most `max_rubbers_per_player` rubbers (and optionally at most one per category).
5. Gender rule: MS/MD all male, WS/WD all female, XD one of each. **[verify `players.gender` exists and how
   `useUmpireHelpers.getGender` derives it]**; skip the rule if the event sets `ignore_gender_rules` **[decision]**.
6. Row-lock the tie (`SELECT … FOR UPDATE`) so two captains locking at the same moment cannot both skip the reveal.

## 7. Tie Lifecycle and Computation

### 7.1 Fixture generation

- Pure TypeScript in `client/src/lib/teamEvents/fixtures.ts` with vitest coverage: round-robin (circle method,
  odd team count → bye), pool split, knockout bracket with byes and seeding, advancement links.
- Output is posted to `create_ties`. The RPC validates; it does not generate.
- Pool → knockout: manager triggers "Generate knockout" after pools complete; seeding comes from final standings.

### 7.2 Rubber creation

`create_ties` (and `generate_tie_rubbers` internally) inserts one `tournament_matches` row per configured rubber
with null players and `tie_id`/`rubber_order` set, so the schedule and Umpire list can show them immediately.

### 7.3 Reveal

When both lock flags are true: copy `tie_lineups` into `tournament_matches` (side A → player1/2, side B →
player3/4, per the verified convention), set `state = IN_PROGRESS`, set `lineups_revealed_at`, notify both teams
and assigned umpires. Idempotent.

Deadline handling: a scheduled job (pg_cron or the existing edge-function pattern, **[verify what scheduler
`match-notifier` uses]**) at `lineup_deadline` notifies the manager of any unlocked side; auto-forfeit is NOT
automatic in v1, the manager uses `set_tie_result`.

### 7.4 Completion trigger

`AFTER UPDATE OF status, winner_side, winner_id ON tournament_matches WHEN tie_id IS NOT NULL` calls
`recompute_tie(tie_id)`:

1. `score_team_a = Σ points of rubbers with winner_side = 1`, `score_team_b` likewise for side 2. Double-walkover
   or no-winner rubbers score 0 for both.
2. Clinch: if `play_dead_rubbers = false` and one team's score > half the total points, remaining rubbers are
   marked skipped (status value per 4.3) and the tie completes.
3. Otherwise complete when all rubbers are terminal.
4. Equal score at completion: pool stage with `draw_allowed` → draw (`winner_team_id = NULL`); otherwise set
   `needs_admin_decision = true`, state stays `IN_PROGRESS`, manager resolves via `set_tie_result`.
5. If the tie was previously `COMPLETED` and a corrected rubber flips the outcome: recompute and re-run
   advancement; if the downstream tie already started, raise an error requiring manager intervention.
6. On `COMPLETED` in knockout stage, `advance_winner(tie_id)` writes the winner into `advances_to_tie` /
   `advances_to_slot` (and loser for the 3rd-place tie). It is idempotent.

### 7.5 Standings

`tournament_team_standings` view provides aggregates. `client/src/lib/teamEvents/standings.ts` orders teams:
tie points → head-to-head (among tied teams) → rubber difference → game difference → point difference → seed.
Fully unit tested including 3-way ties.

## 8. ELO, Stats and Existing Consumers

`submit_tournament_match` (revised ~16 times; latest definitions in `20260815*` and `20260816160000_double_walkover`
**[verify the most recent version before editing]**) currently updates ELO, category ELO and win/loss records, and
the comment at `useUmpireState.tsx:688` ("no ELO impact") is stale.

Tasks:

1. Decide `counts_for_elo` default **[decision]**; if rubbers must be excluded, add
   `IF tie.tournament.counts_for_elo = false THEN skip ELO` to the latest function version, copying the full
   function body into a new migration (never patch an old one).
2. Confirm rubber `category` maps cleanly to the category codes used by category ELO.
3. Audit every consumer of `tournament_matches` and decide whether it includes, excludes, or specially renders
   rubbers:

| Consumer | Default action |
|---|---|
| `useAllTournamentMatches`, `useTournamentMatchHistory`, `MyMatchesTab`, `MatchCard` | include rubbers (they are real matches), show "Team A vs Team B – MD1" context |
| `useLeaderboardStatsQuery`, `useIronmanMonthlyQuery`, `H2HSection`, `DoublesPairProfile` | include only if `counts_for_elo`; verify filters on `tournament_type` |
| `LiveBracketsSection`, `TournamentSection` | exclude rubbers (`tie_id IS NULL`); new tie bracket component for TEAM events |
| `LiveMatchSchedule`, `ScheduleCalendar`, `ActiveTournamentWidget` | include rubbers, group under tie |
| `supabase/functions/match-notifier` | handle null player ids before reveal, use team labels |
| Win/loss migrations (`20260912*`, `20260913*`, `20260914*`) | verify triggers tolerate rubbers and walkovers |

Umpire flow: `startMatch` requires `p1Id` on both sides and `buddyCheckPassed` (`useUmpireState.tsx:409-416`).
Rubbers are pre-filled and the umpire is assigned by the manager, so confirm the buddy check is bypassed for
tournament matches with an assigned umpire (it likely already is via `tournamentMatch`) **[verify]**.

## 9. Frontend

All new files must be included by `tsconfig` (see memory note that `tsc` silently skips some `client/src` files);
add a CI/typecheck check that the new directories are covered.

### 9.1 Data layer

- `client/src/hooks/queries/useTeamEventQueries.ts`: teams, members, ties, tie detail, standings, lineup (follows
  the existing `hooks/queries/*` React Query convention).
- `client/src/services/teamEventService.ts`: thin wrappers over the RPCs in section 6.
- Realtime subscription on `tournament_ties` and `tournament_matches` (filtered by `tie_id`) for the live tie view.
- Regenerate `supabase-types-auto.ts` after each migration set.

### 9.2 Host wizard (`HostTournamentWizard.tsx`)

- New "Event type" step: Open event / Team event.
- Team branch: tie format builder (rows: label, category, points, best-of, points-to-win; presets such as
  "Thomas-Cup style 3 singles + 2 doubles"), max rubbers per player, roster min/max, points for win/draw,
  draw allowed, play dead rubbers, `counts_for_elo`, self-registration.
- Final insert writes the new columns; client-side validation mirrors `validate_tie_format`.
- Gate the option behind an admin/feature flag until Phase 4 ships.

### 9.3 Team hub (`pages/TournamentTeamHub.tsx`)

Tabs: My Team (roster, invites sent/received, accept/decline), Fixtures (my ties and deadlines), Lineup entry
points. Player search reuses the existing players directory query, excludes players already on a team in this
tournament, and issues invites (not direct adds).

### 9.4 Lineup builder (`components/team/TieLineupBuilder.tsx`)

- Shows rubber slots from `tie_format_config`, roster pool with per-player rubber counters.
- Interaction: tap-to-assign as the primary path (the app ships as an Android Capacitor build), drag-and-drop as
  an enhancement; **[verify an existing dnd dependency in `client/package.json` before adding one]**.
- Autosaves drafts via `save_tie_lineup`; "Lock lineup" confirmation dialog warns it is irreversible.
- Shows only the caller's own side; opponent side shows "Waiting / Locked" status, never contents.
- Inline errors come from the same rules as 6.1.

### 9.5 Public tie view (`TournamentDetail.tsx` + new components)

- `components/team/TieCard.tsx`, `TieDetailModal.tsx` (rubbers with scores, players, umpire, live badge),
  `TeamStandingsTable.tsx`, `TieBracket.tsx`.
- For TEAM events the Brackets/Schedule/Participants tabs render teams instead of players; the Participants tab
  lists teams and rosters.

### 9.6 Umpire integration

- `UmpireTournamentTab.tsx` lists rubbers grouped by tie; selecting one opens `UmpireEngine` with the existing
  `tournamentMatch` prop. No scoring changes: it still calls `submit_tournament_match`, and the trigger in 7.4
  handles the tie.
- Match label shows "Tie code · Rubber label".

### 9.7 Notifications

Invite received, invite accepted, lineup window open, lineup deadline approaching, lineups revealed, rubber about
to start, tie completed. Reuse the existing `site_data` / push pattern used for `match_alert`.

## 10. Phased Delivery

Each phase is independently shippable, and `OPEN_EVENT` behaviour stays identical throughout.

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Discovery | Close all **[verify]** items; decide all **[decision]** items; consumer audit table filled in | Spec amended, no open verify items |
| 1. Schema & RPCs | Migrations 4.1–4.5, RLS, helper functions, team/member RPCs, `validate_tie_format`, `create_ties`, lineup RPCs, regen types | SQL tests pass (below); open-event regression queries unchanged |
| 2. Wizard & teams | Wizard branch, team hub, invites, roster rules, notifications for invites | A host can create a TEAM event; captains build teams with consent |
| 3. Fixtures & lineups | `fixtures.ts`, tie list, lineup builder, reveal, `admin_replace_rubber_player` | Two test captains complete lock → reveal; opponent cannot read the other side |
| 4. Scoring & completion | Umpire list for rubbers, `recompute_tie` trigger, advancement, `set_tie_result`, ELO decision wired in `submit_tournament_match` | Full tie played through to completion incl. clinch, walkover, correction |
| 5. Public views & standings | Tie view, standings, tie bracket, schedule/live integration, consumer audit fixes, realtime | Spectator can follow a team event end to end |
| 6. Hardening | Notifications for deadlines, edge cases, performance, docs, remove feature flag | Pilot event run by a real club event |

## 11. Testing Strategy

- **SQL tests (pgTAP or scripted psql in `supabase/tests/`)**: each RPC's permission matrix (captain of A cannot
  touch B, non-staff rejected, anonymous rejected), lineup validation rules, one-team-per-tournament constraint,
  `tie_lineups` visibility before/after reveal, `recompute_tie` for normal / clinch / draw / knockout-draw /
  walkover / double-walkover / correction-after-completion, advancement idempotency.
- **Vitest**: `fixtures.ts` (even/odd counts, byes, seeding), `standings.ts` (tiebreak chains, 3-way ties),
  lineup validator, tie-format builder validation.
- **Regression**: SQL snapshot of leaderboard, H2H and ELO outputs for existing tournaments before/after the
  `submit_tournament_match` migration — must be identical for `OPEN_EVENT`.
- **E2E (manual script + browser preview)**: create event → 2 teams → lineups → play rubbers → tie completes →
  winner advances.

## 12. Rollout, Rollback, Risks

- **Rollout**: migrations first (no UI impact), then UI behind a feature flag visible to admins, then a pilot, then
  general availability.
- **Rollback**: each migration has a documented down script; because new columns on existing tables are nullable
  or defaulted, the app keeps working with them unused. Never drop `tie_id` data without exporting results.
- **Risks**:
  - Editing `submit_tournament_match` again (high churn function) → mitigate with the regression snapshot.
  - Consumers leaking rubbers into open-event views → mitigated by the audit table in section 8.
  - Gender/roster rules too strict for a casual club → make them per-event settings.
  - Players with no linked account cannot be rostered (teams require registered players by design); document the
    workaround of the manager pre-registering guests.

### Decisions Made (October 7)

1. **ELO:** Team rubbers DO move ELO and category ELO by default (`counts_for_elo = true`). This means players in a team event still risk their personal and category ELO, which keeps the matches competitive. This will be added as a toggle in the Host Wizard and Admin Settings.
2. **Registration:** Only the **tournament manager** can create a team and initiate the roster (`team_self_registration = false`). This prevents users from creating unauthorized "spam" teams. The manager creates the team shell, assigns a captain, and the captain can then invite the rest of the roster.
3. **Gender Rules:** Configurable per event (via an `ignore_gender_rules` boolean flag in `tournaments`). This allows the club to host strict tournaments (where MS must be male) OR casual tournaments where anyone can play any rubber. This will also be added as a toggle in the Host Wizard and Admin Settings.
4. **Draws:** Drawn ties are allowed and can be resolved by set difference, point difference, or an extra tie-breaker rubber depending on the tie format configuration. These tie-breaker resolution options will be explicitly added to the **setup wizard and admin settings inside the tournament**.
5. **Dead Rubbers:** Dead rubbers get played by default (so players still get match experience), meaning `play_dead_rubbers = true`.
6. **Deadlines:** Lineup deadlines do NOT auto-forfeit. The system simply awaits manager action to manually submit the lineup or forfeit the team.
