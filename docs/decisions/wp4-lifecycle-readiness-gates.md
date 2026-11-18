# WP4 Decision Record — Lifecycle-Specific Readiness Gates

**Status**: Approved (13 November 2026)  
**Work Package**: 4 (Execution Playbook §11)  
**Primary Touchpoints**:
- `docs/decisions/wp4-lifecycle-readiness-gates.md`
- `client/src/lib/tournamentReadiness.ts`
- `client/src/pages/TournamentSetupChecklist.tsx`
- `client/src/components/admin/TournamentSettingsTab.tsx`
- `supabase/migrations/20261113123000_add_lifecycle_readiness_gates.sql`
- `supabase/tests/lifecycle_readiness_assertions.sql`

---

## 1. Context & Problem Statement

Currently, the database trigger `tournaments_require_readiness_before_active` enforces that transitioning a tournament status to `'active'` requires:
1. Date and venue configured
2. At least one participant or team
3. Doubles/XD partners resolved
4. Tournament matches or ties generated
5. Scoring rules configured
6. Round 1 / playable matches scheduled with court and time

While this prevents an unprepared tournament from starting play, it bundles the entire tournament setup into a single monolithic gate. In reality, tournament organizers execute three distinct lifecycle operations over several weeks:
1. **Announce / Registration Stage**: Making the event known to players so they can view tournament details, eligibility, dates, and sign up. Forcing organizers to generate brackets or assign courts before announcing an event breaks user onboarding.
2. **Draw & Schedule Publication Stage**: Publishing seeded brackets, ties, and resolved participant pairs so players and spectators can view who they play.
3. **Starting Tournament Play (`active`)**: Opening live courts, umpire scoring, live scorecards, and match callouts.

---

## 2. Inventory of Statuses & Visibility Flags

### Table: `public.tournaments`
- `status`: `'draft' | 'active' | 'completed' | 'archived'`
- `show_participants`: `boolean` (controls visibility of entrants tab on public page)
- `show_brackets`: `boolean` (controls visibility of draws/fixtures tab on public page)
- `form_status`: `'open' | 'closing_soon' | 'closed' | 'disabled'`
- `require_app_registration`: `boolean`

---

## 3. The Three Protected Actions

Instead of creating fragmented, uncontrolled database statuses, the system defines **three protected lifecycle actions**:

### Action 1: `announce` (Publish Event Info & Registration)
- **Goal**: Make tournament details visible to club members and open registration.
- **Blockers (Must Pass)**:
  - `MISSING_DETAILS`: Tournament name is non-empty, `start_date` is set, and `venue` is specified.
- **Warnings (Non-blocking)**:
  - Registration URL or in-app registration not enabled.
  - Description or eligibility rules missing.

### Action 2: `publish_draw` (Publish Draw & Fixtures)
- **Goal**: Safely reveal bracket structure and participant lists (`show_brackets = true`, `show_participants = true`).
- **Blockers (Must Pass)**:
  - Must meet all `announce` blockers.
  - `EMPTY_ENTRANTS`: At least 1 entrant/team per category (minimum 2 entrants/teams total).
  - `UNRESOLVED_PAIRS`: All doubles/mixed entries must have partners resolved (`partner_id IS NOT NULL` or `display_name LIKE '%&%'`).
  - `NO_FIXTURES`: Brackets/fixtures generated (`tournament_matches` or `tournament_ties` count > 0).
  - `INVALID_SCORING`: All matches must have valid scoring rules (`points_to_win > 0`, `best_of_sets IN (1, 3, 5)`).
- **Warnings (Non-blocking)**:
  - Unscheduled matches (some rounds without time/court).
  - Officials coverage incomplete.

### Action 3: `start_play` (Start Live Play / Transition to `active`)
- **Goal**: Enable live scoring, umpire operations, and court callouts (`status = 'active'`).
- **Blockers (Must Pass)**:
  - Must meet all `publish_draw` blockers.
  - `NO_PLAYABLE_MATCHES`: At least one match has competitors assigned to both sides.
  - `UNSCHEDULED_PLAYABLE_MATCHES`: Currently playable / Round 1 matches must have an assigned court and scheduled time.
  - `HARD_SCHEDULE_CONFLICT`: Playable match cannot overlap an unavailable court blackout period or an active match on the same court.
- **Warnings (Non-blocking)**:
  - Unassigned match officials (club tournaments may run self-umpired matches).
  - Later round matches unscheduled.

---

## 4. Shared Typed Rule Vocabulary

To eliminate discrepancies between client UI and database triggers, both share standard blocker codes:

| Blocker Code | Description | Target Fix Tab |
| --- | --- | --- |
| `MISSING_DETAILS` | Tournament name, date, or venue missing | `setup` |
| `EMPTY_ENTRANTS` | No participants or teams entered | `participants` / `teams` |
| `UNRESOLVED_PAIRS` | Doubles/XD entrant missing partner | `participants` |
| `NO_FIXTURES` | Draw or ties not yet generated | `bracket` / `fixtures` |
| `INVALID_SCORING` | Match scoring rule missing or invalid | `rules` |
| `NO_PLAYABLE_MATCHES` | No match with both sides populated | `bracket` |
| `UNSCHEDULED_PLAYABLE_MATCHES` | Round 1 / playable match missing court/time | `schedule` |
| `HARD_SCHEDULE_CONFLICT` | Court in blackout period or in-progress match conflict | `schedule` |
| `DATA_ERROR` | Verification query failed (treated as unknown/blocking) | retry / `setup` |

---

## 5. Server-Authoritative Database Protection

1. **RPC `verify_tournament_readiness(p_tournament_id UUID, p_action TEXT)`**:
   Returns structured JSONB containing `allowed: boolean`, `action: text`, `blockers: jsonb_array`, `warnings: jsonb_array`.
2. **Direct REST Protection**:
   The trigger `tournaments_require_readiness_before_active` executes `verify_tournament_readiness(NEW.id, 'start_play')`. Direct updates from REST/supabase-js (`UPDATE tournaments SET status = 'active'`) fail with SQLSTATE `23514` if any `start_play` blocker is violated.
3. **Attributable Transition RPC `transition_tournament_lifecycle(p_tournament_id UUID, p_action TEXT)`**:
   Enforces authorization, evaluates the specified action gate, updates the appropriate tournament columns/flags, and writes an entry to `admin_logs`.

