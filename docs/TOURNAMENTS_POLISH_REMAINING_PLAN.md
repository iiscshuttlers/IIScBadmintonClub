# Tournaments Polish — Remaining Work Plan

The deep follow-ups left after the first polish pass
([TOURNAMENTS_UX_POLISH_PLAN.md](./TOURNAMENTS_UX_POLISH_PLAN.md)). Ordered by value.
`tsc --noEmit` = 0 after each; mobile-first (375px); verify in the browser pane.

---

## R1 — Role-aware empty-state CTAs + REAL reminder wiring (highest value)

Today the tie modal's empty states only show a **placeholder** "Get Notified" button that
fires `toast.success(...)` and nothing else
([TieVisualLineupModal.tsx:377](../client/src/components/events/TieVisualLineupModal.tsx:377),
and the banner reminders at lines 302 & 327). Goal: the right **action** for the right
**viewer**, backed by real persistence.

### R1.1 Get role context into the modal
The modal only has `useAuth()` (`session, isUmpire, isAdmin`) — it can't tell a captain
from a spectator. [TeamTiesSection.tsx](../client/src/components/events/TeamTiesSection.tsx)
**already computes** everything we need, so pass it down instead of re-querying:
- `userTeamData?.isCaptain` + `userTeamData.team.id` (line 62) → is the viewer a captain of
  `team_a_id` / `team_b_id` in this tie?
- `isUserOfficial` (line 216 = admin || umpire || assigned official || creator).
- `openOverrideLineup(tie, side)` (line 219) — the existing "enter on behalf" entry point.
- the lineup builder trigger ([TeamLineupBuilder](../client/src/components/admin/TeamLineupBuilder.tsx), opened at line 955).

**Add props** to `TieVisualLineupModal`:
```ts
interface Props {
  // …existing…
  viewerIsCaptainOf?: 'A' | 'B' | null;   // which side the viewer captains (if any)
  viewerIsOfficial?: boolean;
  onSubmitLineup?: (side: 'A' | 'B') => void;   // opens the builder in TeamTiesSection
  onEnterOnBehalf?: (side: 'A' | 'B') => void;  // calls openOverrideLineup
}
```
Wire these from `TeamTiesSection` where the modal is rendered (it already has the handlers).

### R1.2 The role-aware CTA block
Replace the single notify button (empty-rubbers block ~366, and the two banner reminders)
with a priority-ordered CTA:
```tsx
{viewerIsCaptainOf && (
  <button onClick={() => onSubmitLineup?.(viewerIsCaptainOf)}>Submit your lineup</button>
)}
{!viewerIsCaptainOf && viewerIsOfficial && (
  <>
    <button onClick={() => onEnterOnBehalf?.('A')}>Enter {tie.team_a?.short_name}</button>
    <button onClick={() => onEnterOnBehalf?.('B')}>Enter {tie.team_b?.short_name}</button>
  </>
)}
{/* always available */}
<WatchTieButton tieId={tie.id} />   // real reminder — see R1.3
```
Apply the same in the "{team} yet to submit" banner so its right side is an action, not a
static `LINEUP PENDING` chip. (Keep the chip too, as status.)

### R1.3 Real "notify on reveal" — tie-level (NEW backend)
`match_reminders` is keyed by **match_id**, which doesn't exist until rubbers are created —
so tie-level reveal alerts need their own subscription.

**New table** `tie_lineup_watchers`:
```sql
-- supabase/migrations/<ts>_tie_lineup_watchers.sql
create table public.tie_lineup_watchers (
  id uuid primary key default gen_random_uuid(),
  tie_id uuid not null references tournament_ties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (tie_id, user_id)
);
alter table public.tie_lineup_watchers enable row level security;
create policy "watch self insert" on public.tie_lineup_watchers
  for insert with check (user_id = auth.uid());
create policy "watch self read"   on public.tie_lineup_watchers
  for select using (user_id = auth.uid());
create policy "watch self delete" on public.tie_lineup_watchers
  for delete using (user_id = auth.uid());
```
**Fan-out on reveal:** add a trigger (or extend the lineup-lock / reveal RPC) so that when a
tie's rubbers get `revealed_at` (or both `lineup_locked_a` & `_b` flip true), it enqueues
rows into `scheduled_notifications` for every watcher — reusing the existing
`dispatch-scheduled-notifications` edge function + cron (no new dispatcher). Clear watchers
after fan-out.

**Client:** small `WatchTieButton` that toggles a `tie_lineup_watchers` row (optimistic,
invalidate on change like `useUserMatchAlerts`). Replaces the three placeholder toasts.

**Verify:** captain sees "Submit your lineup"; official sees "Enter {team}"; spectator sees
a working watch toggle that persists across reload; revealing a lineup enqueues a
notification to watchers.

---

## R2 — Rose = LIVE-only audit

**Rule:** rose/red may ONLY signal *in-progress / happening now* (live pills, live score
peek, LIVE badge, the Referee tab's live oversight). It must NOT be decorative.

**Not status — leave alone:** rose used as a **team brand palette** option
([TeamLogo.tsx](../client/src/components/events/TeamLogo.tsx),
[TeamDetailModal.tsx](../client/src/components/events/TeamDetailModal.tsx)) is a color choice,
not a status — keep.

**Audit these (count = rose- occurrences), demote non-live to amber/primary/slate:**
| File | n | Likely verdict |
|---|---|---|
| OrganizerDashboard.tsx | 15 | check — alerts/metrics may misuse rose |
| TeamDetailModal.tsx | 11 | mostly brand palette — keep |
| LiveTeamsSection.tsx | 8 | should be live-only — verify |
| TeamStandingsTable.tsx | 6 | demote (standings ≠ live) |
| RefereeDashboard.tsx | 5 | live oversight — keep |
| TeamTiesSection.tsx | 5 | live rows keep, others demote |
| TournamentCard / Hero / StatusChip | 3/3/3 | live pill only — keep |
| LiveMatchSchedule / TeamLogo | 3/3 | live keep / brand keep |
| Bracket, OrderOfPlay, Register, TournamentStandings, TieVisualLineup | 1 each | inspect |

Process: `grep -n "rose-" <file>` → for each, is it on a live indicator? keep : demote.

**Verify:** nothing non-live is red; red reliably reads "now."

---

## R3 — Hero calm + type scale (visual)

### R3.1 Calm the hero ([FeaturedTournamentHero.tsx](../client/src/components/tournament/FeaturedTournamentHero.tsx))
- One accent: drop **either** the blur-glow blob **or** the gradient, not both.
- Cap height (remove `sm:p-8`, reduce to `p-5`), so it frames the list, not dominates.
- Keep the live scoreline (the hook) + single CTA.

### R3.2 Type scale → 3 sizes
Across hub + cards, collapse to: **hero title** (`text-2xl/3xl Playfair`), **card title**
(`text-lg`), **meta** (`text-xs`). Reserve `font-black uppercase tracking-wider` for
**section headers only**; make data rows normal weight.

**Verify (browser pane):** screenshot hub at desktop + 375px; hero reads as a frame; fewer
competing bold labels.

---

## R4 — Squad "Playing · Bench" summary (small)

In [TeamSquadView.tsx](../client/src/components/events/TeamSquadView.tsx) team header, when
revealed, add a one-line summary: `Playing {playingMembers.length} · Bench {benchMembers.length}`.
Captain "C" badge already exists.

**Verify:** after reveal, each team header shows the split counts.

---

## R5 — Skeletons for the rest of the hub (small)

Main grid has skeletons; the **"My Tournaments" tray** and the **grouped sections** still
pop in. Extract `TournamentCardSkeleton` (the shape already inline at
[TournamentsHub.tsx:430](../client/src/pages/TournamentsHub.tsx:430)) and reuse in those
blocks during `loading`.

**Verify:** no layout jump anywhere on first load.

---

## Suggested order & effort
| Order | Item | Effort | Notes |
|---|---|---|---|
| 1 | R1.1–R1.2 role CTAs (client only) | Small–Med | immediate value, no backend |
| 2 | R1.3 real reminder (table + trigger + button) | Medium | new migration + reuse dispatcher |
| 3 | R2 rose audit | Small–Med | mechanical, per-file |
| 4 | R4 squad summary | XS | one line |
| 5 | R5 skeletons | Small | extract + reuse |
| 6 | R3 hero/type | Small–Med | needs visual iteration |

## Notes / decisions
- **R1.3 needs a DB migration + a reveal trigger** — flag for `supabase db push` and confirm
  the fan-out reuses `scheduled_notifications` + the existing cron (no second dispatcher).
- Do R1.1–R1.2 **first and independently** (pure client) so captains/officials get real
  actions even before the watcher backend lands; the watch button can ship as a follow-up.
- Keep team **brand** rose (logos) out of the R2 audit — it's palette, not status.
