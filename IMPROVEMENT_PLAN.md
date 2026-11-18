# IISc Shuttlers — Full App Improvement Plan

A thorough, Antigravity-ready plan covering architecture, reliability, performance, and housekeeping. Each phase is self-contained and ordered by impact-to-effort ratio.

**Stack:** React 19 · Vite 7 · TypeScript · TailwindCSS 4 · Supabase · Capacitor 8 · TanStack Query v5 · Zustand · wouter · Framer Motion · Firebase (push) · Sentry

---

## Recommended Execution Order

| # | Work item | Est. effort | Status |
|---|---|---|---|
| 1 | **9A** — Delete 50+ debug scripts | 30 min | ✅ Completed |
| 2 | **9B** — `package.json` dep fixes + `@mediapipe` removal | 10 min | ✅ Completed |
| 3 | **9C/9D** — Migration file renames + `.gitignore` fix | 15 min | ✅ Completed |
| 4 | **Phase 3** — Migrate off `PlayerProfileType` → `PlayerRow` | 3–4 hrs | ✅ Completed |
| 5 | **Phase 4** — Fix 17 silent `catch {}` blocks | 1–2 hrs | ✅ Completed |
| 6 | **Phase 1A** — `TournamentManager.tsx` refactored + `tournamentService.ts` + query/mutation hooks | 1.5 days | ✅ Completed |
| 7 | **Phase 1B** — `TournamentParticipantsTab` modularization | 1 day | ✅ Completed |
| 8 | **Phase 1C** — `UmpireEngine` + `useUmpireState` split | 1 day | ✅ Completed |
| 9 | **Phase 1D** — `PlayerPersonalPage` extraction | 0.5 day | ✅ Completed |
| 10 | **Phase 2** — Data access layer sweep (domain services: admin, team, feed, hub, player, tournament, match) | 2 days | ✅ Completed |
| 11 | **Phase 5** — Delete dead experimental stubs (`ARReplayViewer`, `AcousticTensionAnalyzer`, `strokeClassifier`) | 1 hr | ✅ Completed |
| 12 | **Phase 6** — Unified matches fetch view migration (`player_matches_unified`) | 0.5 day | ✅ Completed |
| 13 | **Phase 7** — Reduce `:any` layer-by-layer across domain services | 1 day | ✅ Completed |
| 14 | **Phase 8** — Test suite expansion (293/293 passing) | Ongoing | ✅ Completed |

---

## Hard Constraints (honor in ALL phases)

- **No location services** — no `navigator.geolocation`, `@capacitor/geolocation`, or `ACCESS_*_LOCATION` permission anywhere. Keep `AndroidManifest.xml` location-clean.
- **English only** — no i18n, no multi-language strings.
- **Push-only notifications** — no email provider. All notifications go through existing Supabase edge functions + Firebase push infra.
- **Tournament matches only** — no friendly/casual match-logging features.
- **`localStorage` cache** — never return a `Set` or `Map` from a `queryFn` (the persisted React Query cache cannot deserialize them).

---

## Phase 1 — Break Up the God Components

**Why it's P0:** These files are too large to test, too slow to review, and are the source of most `any` casts and direct Supabase calls. Splitting them unlocks every other phase.

### 1A — `TournamentManager.tsx` (3,024 lines → ~350 lines)

**Step 1 — Extract `client/src/services/tournamentService.ts`**

Create this file following the pattern in `matchService.ts` (typed returns, throw on error, no toast/UI inside). Export these functions:

```ts
export async function fetchTournaments(opts?: { status?: string[] }): Promise<Tournament[]>
export async function fetchTournamentById(id: string): Promise<Tournament>
export async function createTournament(payload: TournamentInsert): Promise<Tournament>
export async function updateTournament(id: string, patch: Partial<Tournament>): Promise<void>
export async function deleteTournament(id: string): Promise<void>
export async function archiveTournament(id: string): Promise<void>
export async function fetchTournamentMatches(tournamentId: string): Promise<TournamentMatch[]>
export async function updateTournamentMatch(id: string, patch: Partial<TournamentMatch>): Promise<void>
export async function advanceTournamentWinner(matchId: string, winnerId: string): Promise<void>
export async function fetchTournamentParticipants(tournamentId: string): Promise<Participant[]>
export async function bulkUpsertParticipants(rows: ParticipantInsert[]): Promise<void>
export async function fetchTournamentRegistrations(tournamentId: string): Promise<Registration[]>
export async function approveTournamentRegistration(id: string): Promise<void>
export async function rejectTournamentRegistration(id: string): Promise<void>
export async function cloneTournamentFull(id: string): Promise<Tournament>
```

All types should live in `client/src/types/tournament.ts`. Move the CSV helpers (`downloadCSV`, `readCSVFile`) from lines 44–76 of `TournamentManager.tsx` to `client/src/utils/csvUtils.ts`.

**Step 2 — Create TanStack Query hooks in `client/src/hooks/queries/useTournamentQueries.ts`**

```ts
export function useTournamentList(opts?)
export function useTournamentDetail(id: string)
export function useTournamentMatches(tournamentId: string)
export function useTournamentParticipants(tournamentId: string)
export function useTournamentRegistrations(tournamentId: string)
```

Pattern: see `usePlayerProfileQuery.ts`. Each uses `useQuery`, consistent key (`['tournament', id, 'matches']`), `staleTime: 30_000`.

**Step 3 — Create mutation hooks in `client/src/hooks/mutations/useTournamentMutations.ts`**

```ts
export function useCreateTournament()   // invalidates ['tournaments']
export function useUpdateTournament()   // invalidates ['tournament', id]
export function useArchiveTournament()  // invalidates ['tournaments']
export function useAdvanceTournamentWinner()        // invalidates ['tournament', id, 'matches']
export function useApproveTournamentRegistration()  // invalidates ['tournament', id, 'registrations']
export function useBulkUpsertParticipants()         // invalidates ['tournament', id, 'participants']
```

Each uses `useMutation`. On error: `toast.error(err.message)`. No try/catch in components.

**Step 4 — Extract sub-components from the render body**

| New file | What to move from `TournamentManager.tsx` |
|---|---|
| `admin/TournamentHeader.tsx` | Title, lifecycle stepper, action buttons (publish, archive, clone) |
| `admin/TournamentMatchesTab.tsx` | Match list + score editor + walkover controls |
| `admin/TournamentSettingsTab.tsx` | Tournament edit form (name, date, format, rules, scoring config) |
| `admin/TournamentBracketTab.tsx` | `<BracketVisual>` wrapper + bracket regen controls |
| `admin/TournamentOrderOfPlayTab.tsx` | Wraps existing `<OrderOfPlayPanel>` |
| `admin/TournamentNotificationsTab.tsx` | `<SendReminderSheet>` + reminder history |

After extraction, `TournamentManager.tsx` becomes ~350 lines: imports + selected-tab state + tab router that renders the sub-components above. No `supabase.from()` anywhere.

---

### 1B — `TournamentParticipantsTab.tsx` (1,964 lines → ~250 lines)

This tab handles: add/remove participants, seeding, CSV import/export, bye assignment, guest resolution.

Extract:
- `client/src/hooks/mutations/useParticipantMutations.ts` → `useAddParticipant`, `useRemoveParticipant`, `useSeedParticipants`, `useBulkImportParticipants`
- `admin/ParticipantSeedingTable.tsx` → drag-drop seeding UI (use `@dnd-kit` already in deps)
- `admin/ParticipantImportModal.tsx` → CSV upload + parse preview modal (move CSV logic from `csvUtils.ts`)
- `admin/ParticipantBulkActions.tsx` → checkbox multi-select toolbar (select all, remove selected, export selected)

The remaining `TournamentParticipantsTab.tsx` renders those three components + the `<ResolveGuestsModal>` already extracted.

---

### 1C — `UmpireEngine.tsx` (1,454 lines) + `useUmpireState.tsx` (1,069 lines)

`useUmpireState.tsx` is **misnamed** — it contains JSX, which is illegal in a `.ts` hook file. This is the first fix:

1. Rename to `useUmpireState.ts` (drop the `.tsx` extension). Extract any JSX found inside to `components/umpire/UmpireStateDebugPanel.tsx` (only mounted in `import.meta.env.DEV` blocks).

2. Split `UmpireEngine.tsx` into three files:
   - `components/umpire/UmpireSetupScreen.tsx` — pre-match player/format selection (currently lines ~1–300)
   - `components/umpire/UmpireScoringScreen.tsx` — live scoring UI with court visual
   - `hooks/useUmpireKeyboard.ts` — the `useEffect` that binds keyboard shortcuts

3. `UmpireEngine.tsx` becomes the orchestrator (~150 lines): based on match phase, render `<UmpireSetupScreen>` or `<UmpireScoringScreen>`. Owns the offline-sync effect and crash-recovery logic only.

---

### 1D — `PlayerPersonalPage.tsx` (1,465 lines)

This page has 12 `useEffect`/`useState` hooks inline. Extract:

- `hooks/queries/usePersonalStats.ts` — consolidates the 4 data-fetch effects into one `useQuery` (server-side join or parallel fetches with `Promise.all`)
- `components/player-profile/PersonalMatchHistoryTab.tsx`
- `components/player-profile/PersonalTrainingLoadTab.tsx`
- `components/player-profile/PersonalInsightsTab.tsx`

The page file becomes a tab router with the `usePersonalStats` hook at the top.

---

## Phase 2 — Complete the Data Access Layer

**Goal:** Zero `supabase.from()` calls in component files. All DB access goes through `*Service.ts` + query/mutation hooks.

**Current state:** 77 component `.tsx` files still call Supabase directly. This makes them untestable, creates duplicate select-string literals scattered across files, and produces inconsistent error handling.

### 2A — Create remaining service files

| Service file | Tables/RPCs it wraps |
|---|---|
| `client/src/services/tournamentService.ts` | `tournaments`, `tournament_matches`, `tournament_participants`, `registrations` (done in Phase 1A) |
| `client/src/services/adminService.ts` | Player CRUD (`players`), ELO recalculation RPC, role changes, guest resolution, `admin_logs` reads |
| `client/src/services/teamService.ts` | `teams`, team rosters, team standings, lineup submission, `team_tournament_matches` |
| `client/src/services/feedService.ts` | Polls, announcements, rivalry cards, video highlights, `analytics_events` |
| `client/src/services/hubService.ts` | Court bookings (`court_queue_alerts`), marketplace listings, noticeboard items |

**Pattern for every service function:**

```ts
export async function doSomething(args: ArgsType): Promise<ReturnType> {
  const { data, error } = await supabase.from('table').select(...).eq(...);
  if (error) throw error;   // let TanStack Query / mutation catch it
  return data as ReturnType;
}
```

Rules:
- No `toast` calls inside service functions — error handling belongs in mutation hooks' `onError` callbacks.
- No `useState` or `useEffect` — these are plain async functions.
- Export types alongside functions in the same file or from `@/types`.

### 2B — Sweep admin components (priority order)

For each of the 77 component files that still call `supabase` directly:

1. Identify which table(s) they access.
2. Find or create the corresponding service function.
3. Replace the inline call with the service call.
4. If the call was in a component body (not inside a `useEffect`), wrap it in a `useQuery` or `useMutation` hook.

**Files by Supabase-call count (highest first):**

| File | Direct calls | Service to create/use |
|---|---|---|
| `admin/TournamentManager.tsx` | 35 | `tournamentService` (Phase 1A) |
| `admin/TeamTournamentManager.tsx` | ~20 | `teamService` |
| `admin/TournamentParticipantsTab.tsx` | ~18 | `tournamentService` (Phase 1B) |
| `admin/EloAuditPanel.tsx` | ~12 | `adminService` |
| `admin/PlayersManager.tsx` | ~10 | `adminService` |
| `admin/RoleManagerPanel.tsx` | ~8 | `adminService` |
| `admin/GuestPlayersPanel.tsx` | ~6 | `adminService` |
| `components/events/LiveScoreSection.tsx` | ~15 | `tournamentService` |
| `components/feed/*.tsx` (all) | ~20 total | `feedService` |
| `pages/ClubHubPage.tsx` | ~8 | `hubService` |

---

## Phase 3 — Eliminate the Dual Type System

**Goal:** `PlayerProfileType` deleted. All code uses `PlayerRow` directly.

**Background:** `PlayerProfileType` in `client/src/types/player.ts` (line 135+) is a camelCase alias for `PlayerRow`. Eight files still import it, and to satisfy the compiler they use 27 `as any` casts at the boundary where `PlayerRow` (snake_case) meets `PlayerProfileType` (camelCase).

### Steps

**Step 1** — Add a deprecation comment above `PlayerProfileType` in `client/src/types/player.ts`:

```ts
/** @deprecated Use PlayerRow directly. Will be deleted once all importers migrated. */
export interface PlayerProfileType { ... }
```

**Step 2** — Migrate each importer, one file at a time. For each:
- Replace `PlayerProfileType` with `PlayerRow` in props/return types.
- Rename camelCase field references to snake_case:
  - `fullName` → `full_name`
  - `avatar` → `avatar_url`
  - `joinedYear` → `joined_year`
  - `playingLevel` → `playing_level`
  - `dominantHand` → `dominant_hand`
  - `favoriteShot` → `favorite_shot`
  - `favoriteIdol` → `favorite_idol`
  - `favoriteFormat` → `favorite_format`
- Remove any mapping/transform function that converts `PlayerRow` to `PlayerProfileType`.

**Files to migrate (8 total):**

| File | Change |
|---|---|
| `components/player-profile/PlayerActionBar.tsx` | Props type: `PlayerProfileType` → `PlayerRow` + rename fields |
| `components/player-profile/PlayerHeroBanner.tsx` | Same |
| `hooks/queries/usePlayerProfileQuery.ts` | Return type change; remove camelCase mapping transform |
| `services/playerService.ts` | Return type; remove any mapping |
| 4 remaining files | Find with: `grep -rn 'PlayerProfileType' client/src` |

**Step 3** — After all 8 files are migrated, search for any remaining `as any` casts caused by mismatched types. Each one is now fixable by using the correct `PlayerRow` snake_case field name.

**Step 4** — Delete `PlayerProfileType` from `player.ts`.

**Step 5** — Run `tsc --noEmit` from `client/` and confirm zero errors.

**Expected outcome:** 27 fewer `as any` casts. `usePlayerProfileQuery` returns `PlayerRow` directly, no wrapper.

---

## Phase 4 — Fix Silent Error Swallowing

**Goal:** No `catch {}` anywhere. Every error either surfaces to Sentry or has an explicit "intentional" comment.

**Find all instances:**

```bash
grep -rn 'catch\s*{}\|catch\s*(\w\+)\s*{}' client/src
```

(17 matches expected)

### Decision tree for each empty catch

**Case A — Genuinely non-fatal background operation** (e.g., optional analytics ping, best-effort cache warm):

```ts
catch { /* intentional — best-effort only, failure is silent by design */ }
```

**Case B — User-facing flow, auth, or any DB call** (e.g., `AuthContext.tsx`, any hook that feeds UI state):

```ts
catch (err) {
  // dynamic import to avoid adding sentry to the critical bundle path
  import('@sentry/react').then(({ captureException }) => captureException(err));
}
```

Do **not** add `console.error` — the app already pipes errors to Sentry in production; a console call adds noise without durable value.

### Priority files

| File | Why it matters |
|---|---|
| `contexts/AuthContext.tsx` | Auth failures silently lost = user stuck with no explanation |
| `lib/supabase.ts` | DB-level errors never surface |
| Any hook whose return is used in the UI (returns `null`/`[]` on error) | User sees empty state with no indication of failure |
| `providers/RealtimeProvider.tsx` | Realtime subscription failures silently drop live score updates |

---

## Phase 5 — Remove Dead Experimental Stubs

**Goal:** No production bundle weight from unimplemented features. No misleading "coming soon" UI that ships to users.

### 5A — `ARReplayViewer.tsx`

File: `client/src/components/player/ARReplayViewer.tsx`

Status: 150 lines, hardcoded `dummyPath` array, no real AR backend, no AR SDK imported.

Action:
1. Check if any route renders it: `grep -rn 'ARReplayViewer' client/src`
2. Remove all imports and any route entry.
3. Delete the file.

### 5B — `AcousticTensionAnalyzer.tsx`

File: `client/src/components/player/AcousticTensionAnalyzer.tsx`

Same pattern — stub with no real audio analysis. Delete and remove all imports.

### 5C — `lib/ai/strokeClassifier.ts`

File: `client/src/lib/ai/strokeClassifier.ts`

Status: TF.js import is commented out. Falls back to a heuristic not called from anywhere meaningful.

Action:
1. Check callers: `grep -rn 'strokeClassifier' client/src`
2. If zero callers — delete the file.
3. If called from somewhere meaningful — gate it behind a dev-only dynamic import:

```ts
if (import.meta.env.DEV) {
  const { classify } = await import('@/lib/ai/strokeClassifier');
  // ...
}
```

### 5D — Remove `@mediapipe/tasks-vision` from `package.json`

1. Verify no imports: `grep -rn 'mediapipe' client/src`
2. If zero results: from the `client/` directory, run `npm uninstall @mediapipe/tasks-vision`
3. Commit `package.json` + `package-lock.json`.

This removes ~40 MB from the dev install with zero functionality loss.

---

## Phase 6 — Optimize the Dual-Query Match Fetch

**Goal:** Halve the data fetched by `fetchPlayerMatches` in `matchService.ts`.

**Problem** (`matchService.ts` lines 1–48): Two separate queries — one to `matches`, one to `tournament_matches` — each fetch up to 200 rows, then they're merged and sliced to 200 in JS. Worst case: 400 rows fetched to display 200.

**Solution: a PostgreSQL UNION view**

Create a new Supabase migration (file: `supabase/migrations/<timestamp>_create_player_matches_unified_view.sql`):

```sql
CREATE OR REPLACE VIEW public.player_matches_unified AS
SELECT
  id,
  player1_id, player2_id,
  team1_partner_id AS player3_id,
  team2_partner_id AS player4_id,
  status, score, created_at,
  ended_at, scheduled_at, date,
  TRUE  AS is_friendly,
  NULL::boolean AS counts_for_elo
FROM matches
WHERE status IN ('confirmed', 'pending')

UNION ALL

SELECT
  tm.id,
  tm.player1_id, tm.player2_id,
  tm.player3_id, tm.player4_id,
  tm.status, tm.score, tm.created_at,
  tm.ended_at, tm.scheduled_at,
  NULL AS date,
  FALSE AS is_friendly,
  t.counts_for_elo
FROM tournament_matches tm
JOIN tournaments t ON t.id = tm.tournament_id
WHERE tm.status IN ('completed', 'scheduled', 'in_progress', 'walkover')
  AND t.status <> 'deleted';
```

Add RLS on the view mirroring the underlying tables' policies.

Then update `fetchPlayerMatches` in `matchService.ts` to a single query:

```ts
export async function fetchPlayerMatches(playerId: string, limit = 200) {
  const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`;
  const { data, error } = await supabase
    .from('player_matches_unified')
    .select(`*, ...players joins...`)
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
```

**Note:** Add the view to `supabase-types-auto.ts` by running `supabase gen types typescript` after the migration.

---

## Phase 7 — Reduce `:any` Annotations

**Goal:** From 207 files using `any` down to under 30.

**Strategy: fix by layer, not by file.** Services are the foundation — fixing them propagates types up to every consumer automatically.

### Fix order

**Layer 1 — Services** (target: zero `any`)

Services have typed return values. `any` here defeats the entire type system. Fix `matchService.ts`, `playerService.ts`, `tournamentService.ts`, `adminService.ts`, `teamService.ts` first. These should be zero-`any` files.

**Layer 2 — Hooks** (target: zero `any`)

A typed hook return means all consumers get types for free. Fix `useTournamentQueries.ts`, `usePlayerProfileQuery.ts`, `useUmpireState.ts`, and any hook that calls a now-typed service function. Most `any` here will disappear automatically once Layer 1 is done.

**Layer 3 — Admin components** (target: minimal `any`)

Most `any` in admin components comes from untyped service returns. Layers 1–2 will eliminate the bulk of it. What remains will be isolated casting at known conversion boundaries.

### Common patterns and fixes

| Pattern | Fix |
|---|---|
| `(data: any)` in `.map()` after a typed query | Use the row type: `(row: Tournament)` |
| `catch (e: any)` | Change to `catch (e: unknown)` + `instanceof Error` guard |
| `as any` on a Supabase response | Add explicit return type: `.select().returns<MyType[]>()` or use `supabase-types-auto.ts` |
| `useState<any>()` | Give it the actual type: `useState<Tournament | null>(null)` |
| `const x: any = {}` as a partial builder | Use `Partial<MyType>` or a builder pattern |

---

## Phase 8 — Expand Test Coverage

**Goal:** Cover the critical path — auth, match lifecycle, tournament CRUD, ELO — with unit and integration tests.

**Existing infra:** Vitest + jsdom + @testing-library/react + MSW (all already configured). No new tooling needed.

### Priority test files to create

| Test file | What to cover |
|---|---|
| `contexts/AuthContext.test.tsx` | Sign-in, sign-out, role propagation (`master_admin`/`admin`/`player`), refresh token |
| `services/tournamentService.test.ts` | Mock Supabase; test each function returns correct shape and throws on `.error` |
| `hooks/mutations/useTournamentMutations.test.ts` | Cache invalidation on success, `toast.error` on failure |
| `hooks/queries/usePlayerProfileQuery.test.ts` | Data shape, `staleTime`, refetch on window focus |
| `services/matchService.test.ts` | Add dual-query merge logic test (existing file — extend it) |
| `components/admin/TournamentManager.test.tsx` | After Phase 1: render, tab switching, submit create form (use MSW to mock service) |
| `lib/umpire/scoringLogic.test.ts` | Already exists — add edge cases: deuce, third game, tie-break |

### Pattern for service tests

```ts
import { vi, expect, it, describe } from 'vitest';
import { supabase } from '@/lib/supabase';
import { fetchTournaments } from '@/services/tournamentService';

const mockT = { id: '1', name: 'Test', status: 'upcoming' };

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() }
}));

describe('fetchTournaments', () => {
  it('returns tournament array on success', async () => {
    (supabase.from as any).mockReturnValue({
      select: () => ({ data: [mockT], error: null })
    });
    const result = await fetchTournaments();
    expect(result).toEqual([mockT]);
  });

  it('throws on Supabase error', async () => {
    (supabase.from as any).mockReturnValue({
      select: () => ({ data: null, error: new Error('DB error') })
    });
    await expect(fetchTournaments()).rejects.toThrow('DB error');
  });
});
```

### Pattern for hook mutation tests

Wrap with `QueryClientProvider` + a fresh `QueryClient`. Call the mutation, verify `invalidateQueries` was called with the right key, and verify `toast.error` was called on rejection.

---

## Phase 9 — Housekeeping

### 9A — Delete debug/migration scripts from project root

All of these are untracked files (`git status` confirms) — safe to delete with no risk to the history. Commit once after bulk-deleting.

**Files to delete from project root:**
- `check_db.ts` through `check_db9.ts` (9 files)
- `fetch.mjs` through `fetch9.mjs` (9 files)
- All `check_*.ts` variants (~20 files: `check_schema.ts`, `check_matches.mjs`, `check_roles.ts`, etc.)
- `refactor*.cjs`, `extract*.cjs`, `compact.cjs`, `ast_refactor*.cjs`, `create_setup_flow.cjs`
- `patch.py` through `patch4.py`
- `fix.ts`, `fix_*.mjs`, `fix_*.ts`, `fix_byes.ts`, `fix_abhisek.mjs`
- `all_changes_today.patch`, `compare_diff.txt`, `dir_part.txt`, `engineTop.txt`, `engineBottom.txt`, `backup_bracket.pdf`, `admin_edit_func.txt`
- `db_types.ts`, `check.sql`, `check.ts` in root
- `final_doubles_restore.sql`, `find_corrupted_matches.sql` in root

**Files to delete from `client/`:**
- `client/check_status.cjs`, `client/check_varun.mjs`, `client/debug_*.mjs` (3 files)
- `client/scratch.cjs`, `client/scratch2.cjs`, `client/scratch3.cjs`, `client/scratch4.cjs`
- `client/debug_constraints.cjs`, `client/debug_duplicates.mjs`, `client/debug_raja.mjs`
- `client/get_raja.cjs`, `client/get_schema.mjs`, `client/inspect.mjs`
- `client/merge_raja.js`, `client/rename_raja.js`, `client/temp.js`, `client/test.js`
- `client/test_constraints*.js`, `client/test_sql.mjs`, `client/test_unique.mjs`
- `client/update_email.js`, `client/update_status.cjs`
- `client/diff_divs.txt`, `client/scratch/` directory
- `client/src/components/Navigation.tsx.bak` (backup file inside the component tree)

**Commit message:** `chore: delete one-off debug/migration scripts from root and client/`

---

### 9B — Fix `package.json` (trivial, ~10 min)

In `client/package.json`:

```json
// Move from "dependencies" to "devDependencies":
"@tanstack/react-query-devtools": "..."

// Remove entirely (no imports anywhere in client/src):
"@mediapipe/tasks-vision": "..."
```

Run `npm install` from `client/` after editing. Verify the app still builds: `npm run build`.

---

### 9C — Fix non-conforming migration files

In `supabase/migrations/`, these files lack the required `<timestamp>_<name>.sql` format:

- `fix_advance_tournament_winner.sql` — rename: `mv fix_advance_tournament_winner.sql <newest-timestamp+1>_fix_advance_tournament_winner.sql`
- `fix_policies.py` — Python files do not belong in the migrations directory. Inspect it: if it's a one-off that already ran, delete it. If it needs to run in future, convert to a proper `.sql` migration file.

---

### 9D — Add stale Claude Code artifacts to `.gitignore`

The `.claude/worktrees/` directory is a Claude Code artifact from past sessions, not project code. Add to `.gitignore` if not already there:

```
.claude/worktrees/
.claude/scheduled_tasks.lock
```

---

*All file paths are relative to `E:/Github/IIScBadmintonClub/`. TypeScript strict mode is on — all new code must pass `tsc --noEmit` with zero errors. Run TypeScript checks from the `client/` directory.*
