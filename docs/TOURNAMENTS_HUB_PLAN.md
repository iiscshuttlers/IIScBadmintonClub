# Tournaments Hub — Technical Build Plan

Turn the Tournaments page (`/tournaments`, [client/src/pages/TournamentsHub.tsx](../client/src/pages/TournamentsHub.tsx))
from a passive browse directory into the **front door of the whole tournament flow**:
discover → open → register → organise → officiate — all in one place, while Pulse
keeps its own live view.

**Guiding principles**
- Reuse existing building blocks: `getTournaments()`, `LiveTab`, `RegisterModal`,
  `EventTypeBadge` / `RankedBadge`, `ThemeScope`, the host wizard, and the
  `tournament_registrations` / `tournament_officials` tables.
- No new backend unless noted. Keep `tsc --noEmit` at **0 errors** after every phase.
- Everything themed per event family (violet = individual, emerald = team) and
  mobile-first (test at 375px).

---

## Phase 1 — Merge hub ↔ Pulse tournament view ✅ (implemented)

**Goal:** clicking a tournament card opens the full tournament experience *on the
Tournaments page* instead of bouncing to `/pulse`. Pulse keeps working unchanged.

**How it was done** (in [TournamentsHub.tsx](../client/src/pages/TournamentsHub.tsx)):
1. Imported the Pulse view and the query-param hook:
   ```ts
   import { useQueryState } from "@/hooks/useQueryState";
   import { LiveTab } from "@/components/pulse/LiveTab";
   ```
2. Read the selection reactively:
   ```ts
   const [selectedId] = useQueryState("id", "");
   ```
3. Card navigation now stays on the page:
   ```ts
   // was: navigate(`/pulse?tab=live&id=${t.id}`)
   else navigate(`/tournaments?id=${t.id}`);   // completed → /events/:slug (archive) unchanged
   ```
4. Detail branch before the normal list render:
   ```tsx
   if (selectedId) {
     return (
       <div className="min-h-screen …">
         <button onClick={() => navigate("/tournaments")}>← All tournaments</button>
         <LiveTab />   {/* LiveTab reads ?id from the URL itself */}
       </div>
     );
   }
   ```

`LiveTab` already derives its tournament from `?id`
(`new URLSearchParams(window.location.search).get("id")`) and manages its own
`?subtab`, so it drops in with no changes.

**Follow-ups for this phase**
- [ ] Add a `/tournaments/:id` path alias in [App.tsx](../client/src/App.tsx) that
      redirects to `/tournaments?id=:id` (prettier URLs, shareable).
- [ ] **Deduplicate the embedded header (user ask #3).** When `LiveTab` renders inside
      the hub, its own banner repeats the tournament name *and* the selector shows
      "New Tournament (Team, active)" — the name + family/ranked badges appear twice.
      Add an optional `embedded?: boolean` prop to `LiveTab`: when true, **hide the big
      title + EventType/Ranked badges and keep only the switcher dropdown as a bare
      down-arrow** (no duplicated "New Tournament" label, no "Team · active" text — the
      hub's back button + the dropdown are enough). Keeps a single source of the name.
- [ ] Confirm deep links from elsewhere (notifications, officials panel) still point
      at `/pulse?tab=live&id=…`. **Keep `/pulse?tab=live&id=…` as a transparent alias**
      to `/tournaments?id=…` so existing bookmarks / push notifications don't break
      (assessment Risk 3); migrate internal links gradually, pick one canonical later.

---

## Phase 0 — Data layer (foundation for A–F)

`getTournaments()` ([client/src/lib/tournaments.ts](../client/src/lib/tournaments.ts))
is missing fields the richer UI needs.

### 0.1 Extend the select + mapping
Add `require_app_registration` and a participant count via a PostgREST aggregate embed:
```ts
// select
.select("*, tournament_matches(category, match_code, round_name, winner_side, team1_label, team2_label), tournament_participants(count)")
// mapping (inside data.map)
require_app_registration: tr.require_app_registration,
participant_count: tr.tournament_participants?.[0]?.count ?? 0,
```
Update the `LiveTournament`-ish return type (same file, ~line 90+) with:
```ts
require_app_registration?: boolean;
participant_count?: number;
```

### 0.2 New hook — `useMyTournamentRoles`
`client/src/hooks/useMyTournamentRoles.ts`:
```ts
export interface MyRole { registration?: "pending"|"approved"|"rejected"|"withdrawn"; roles: Set<string>; isCreator: boolean; }
export function useMyTournamentRoles(playerId?: string, tournaments?: any[]) {
  // 1 query to tournament_registrations (player_id = me) → {tournament_id, status}
  // 1 query to tournament_officials    (user_id  = me) → {tournament_id, role}
  // isCreator derived from tournaments[].created_by === me
  // returns Map<tournament_id, MyRole>
}
```
Read-only, so no RLS risk (both tables already allow `SELECT` to the owner/officials).

### 0.3 New hook — `useLiveScoresFor` (for Phase F)
`client/src/hooks/useLiveScoresFor.ts`: query `tournament_matches`
`.eq("status","in_progress").in("tournament_id", ids)` selecting
`tournament_id, score, court_number, team1_label, team2_label`; return latest per
tournament. **Prefer a React Query `refetchInterval: 25000` poll over open realtime
WebSockets on the public browse directory** (assessment Risk 2) — a browse list with
several live tournaments × courts would thrash renders and risk connection limits.
Reserve realtime for the single focused detail view, not the directory.

**Verify:** regenerate types if the aggregate embed changes inference
(`supabase gen types …`); `getTournaments()` returns the new fields; `tsc` = 0.

> **Risk 1 (aggregate count embed) — verify first.** Before wiring the card UI, run
> `supabase.from('tournaments').select('*, tournament_participants(count)')` against a
> real event. If PostgREST rejects the embed or RLS on `tournament_participants` hides
> rows from anon/auth, fall back to a lightweight counts query (or a small RPC) fetched
> alongside `useMyTournamentRoles` rather than blocking the main list. Don't ship the
> card's "N entered" until the count source is confirmed.

---

## Phase A — Richer tournament cards

Extract the card into `client/src/components/tournament/TournamentCard.tsx`:
```tsx
export function TournamentCard({ t, myRole, onOpen, onRegister }: {
  t: any; myRole?: MyRole; onOpen: () => void; onRegister?: () => void;
}) { … }
```
Render, wrapped in `<ThemeScope {...t}>`:
- Name + status chip (Live/Upcoming/Completed) — already have `STATUS_META`.
- `<EventTypeBadge compact>` + `<RankedBadge compact>`.
- **Date range** `fmtDate(startDate)–fmtDate(endDate)`, **venue** (MapPin), **category chips** (`t.categories?.slice(0,4)`), **participant count** ("12 entered").
- **Role ribbons** from `myRole`: "Registered · {status}", "Organizer", "Referee", "Umpire".
- Hover → `onOpen()`.

Guard every field (`t.venue && …`) so sparse events still look intentional.

**Verify:** cards show real data; a data-less event still renders cleanly; mobile single-column.

---

## Phase B — Register directly from the card

- In `TournamentCard`, when `t.status` ∈ {upcoming, active} **and**
  `t.require_app_registration` **and** signed in → show **Register** / **Manage entry**
  button → `onRegister()`.
- In `TournamentsHub`, hold `const [registerFor, setRegisterFor] = useState<any|null>(null)`
  and render:
  ```tsx
  {registerFor && (
    <RegisterModal open onClose={() => setRegisterFor(null)}
      tournament={{ id: registerFor.id, name: registerFor.name, categories: registerFor.categories,
                    tournament_type: registerFor.tournament_type, format_family: registerFor.format_family,
                    counts_for_elo: registerFor.counts_for_elo }}
      onRegistered={() => myRolesRefetch()} />
  )}
  ```
- Signed-out → button routes to `/auth`.

**Verify:** modal opens from a card, submits, role ribbon flips to "Registered"
(full happy-path needs a real `require_app_registration` event + admin).

---

## Phase C — "Host a tournament" CTA

In the hub header (next to search):
```tsx
<button onClick={() => navigate(isAuthed ? "/host-tournament/new" : "/auth")}>Host a tournament</button>
<button onClick={() => navigate("/host-tournament")}>My tournaments</button>
```
- Admins get the full wizard (ranked allowed); non-admins get self-hosted/unranked
  (already enforced by the ranked gate + `HostTournamentWizard`).
- Routes already exist: `/host-tournament` (list) and `/host-tournament/new` (wizard)
  in [App.tsx](../client/src/App.tsx).

**Verify:** correct routing per auth/role.

---

## Phase D — "My Tournaments" section

Above the browse list, render only if `useMyTournamentRoles` has entries. A compact
strip grouped by relationship, each card with one CTA:
- **Playing** (registration present) → `onOpen` (detail view) / open RegisterModal to manage.
- **Organizing** (isCreator or role ORGANIZER) → `/tournament-admin?id=${id}` (console).
- **Officiating** (role REFEREE/UMPIRE) → `/tournaments?id=${id}&subtab=referee` (or `umpire`).

```tsx
const mine = all.filter(t => myRoles.has(t.id));
// bucket into playing / organizing / officiating, dedupe (a user can be >1)
```

**Verify:** section hidden when the user has no roles; each CTA lands on the right surface.

---

## Phase E — Grouped sections, sort, empty states

- Replace the single flat list with three ordered groups: **🔴 Live now**, **Upcoming**,
  **Past** (each respecting the active search + type/ranked filters). The existing
  status pills become quick filters/jumps.
- **Sort** control per group: date (default) or name — small `<select>`.
- **Empty states:** no match for filters → friendly "try clearing filters"; zero
  tournaments at all → "No tournaments yet — host the first one" + the Phase C CTA.

**Verify:** groups render in order; sort reorders; both empty states reachable.

---

## Phase F — Live score peek (polish)

- On **live** cards, show a mini scoreline from `useLiveScoresFor`
  ("Aero Strikers 15 – 12 Smashers · Court 3"), auto-refreshing.
- Silent no-op when nothing is in progress.

**Verify:** live card shows a score that updates; no errors when idle.

---

## Phase G — Cricbuzz-style squad visual for team events (user ask #1)

**Goal:** before a tie's lineup is announced, show both teams' **full squads** side by
side (like Cricbuzz's "Squad" grid); once a lineup is submitted, the same block flips to
the announced **Playing lineup / Bench** split. Use this *everywhere a team tie is shown*
— the tie card, the tie detail modal, and the official console — not just one surface.

**Data (already present):** `tournament_team_members` (roster) embedded via
`players!tournament_team_members_player_id_fkey(*)`; `tie_lineups` tells us whether each
team has submitted and which players are in the lineup. The ambiguous-embed fix from
TeamTiesSection applies here too.

**New component** `client/src/components/events/TeamSquadView.tsx`:
```tsx
export function TeamSquadView({ tie, lineup }: { tie: Tie; lineup?: TieLineup }) {
  // two columns (team1 / team2), each ThemeScope'd to the team color.
  // state A — no lineup yet: render full roster as a plain "Squad" grid
  //           (avatar • name • role chip), header "Squad" + "Lineup pending".
  // state B — lineup submitted: split roster into "Playing" (in lineup, by rubber slot)
  //           and "Bench" (rest, dimmed), mirroring Cricbuzz Playing XI / Bench.
}
```
- Per team, independently (team1 can be announced while team2 is pending).
- Reuse `STATUS_META` / `LINEUP PENDING` badge wording already used in the modal.
- Mobile: stack the two squads vertically at <640px; avatars + names only.

**Wire-in:** render `<TeamSquadView>` in the tie detail modal (replaces the bare
"Both teams yet to submit lineup" empty block) and a compact variant on the tie card.

**Verify:** a tie with no lineups shows both full squads; after one team submits, that
column flips to Playing/Bench while the other stays "Squad / pending".

---

## Phase H — Pin the live / most-recent tournament (user ask #2)

**Goal:** the hub should *always* surface the single most relevant tournament at the top
— a **live** one if any is in progress, otherwise the **most recent** (latest by
start/updated date). A hero strip above everything, one tap into the detail view.

**How:** derive from the already-fetched list (no new query):
```ts
const featured = tournaments.find(t => t.status === "active")        // live first
  ?? [...tournaments].sort(byMostRecent)[0];                          // else newest
```
- Render a prominent `FeaturedTournamentHero` above the "My Tournaments" strip:
  name + `ThemeScope`, Live/updated chip, Phase F mini-scoreline when live, big
  "Open" CTA → `/tournaments?id=`.
- Hide only when the list is empty (then the Phase E "host the first one" empty state
  covers it).
- Sits above Phase D's "My Tournaments" and Phase E's grouped sections.

**Verify:** with a live event it pins that one (with a live score); with none live it
pins the newest completed/upcoming; empty list hides the hero.

---

## Cross-cutting checklist
- [ ] `ThemeScope` on every card/section (family from `getEventFamily(t)`).
- [ ] Mobile: single-column, wrapped filter rows, touch targets ≥ 40px; test 375px.
- [ ] Loading skeletons + error-retry + per-section empty states.
- [ ] Regenerate Supabase types after the `getTournaments` select change.
- [ ] `tsc --noEmit` = **0 errors** after each phase; smoke-test in the browser pane.

## Suggested order & effort
| Order | Phase | Effort | Notes |
|------|-------|--------|-------|
| 1 | **Phase 1 merge** | ✅ done | reuse LiveTab on `/tournaments?id=` |
| 2 | 0 + A | Medium | data + richer cards (visible foundation) |
| 3 | C | Small | host CTA — high value |
| 4 | B | Small | register from card (reuses RegisterModal) |
| 5 | D | Medium | my tournaments |
| 6 | E | Medium | grouping / sort / empty states |
| 7 | H | Small | pin live/most-recent tournament hero (reuses F scoreline) |
| 8 | F | Small–Med | live score peek (poll, not realtime, on the directory) |
| 9 | G | Medium | Cricbuzz-style squad → Playing/Bench for team ties (everywhere) |

**Phase 1 embedded-header dedup (user ask #3)** is a quick follow-up to do alongside
Phase A, not its own numbered step.

## Risks / open questions
- `participant_count` aggregate embed may need an RLS `SELECT` grant on
  `tournament_participants` for anon/auth — verify on a real event.
- Canonical tournament URL: keep **both** `/tournaments?id=` and `/pulse?tab=live&id=`
  for now; later pick one and redirect the other.
- Full register/officiating happy-paths need a real admin + a `require_app_registration`
  tournament (same E2E gap noted elsewhere).
- `LiveTab` embedded on Tournaments: consider an `embedded` prop to hide its internal
  tournament-selector dropdown so it doesn't duplicate the hub's own navigation.
