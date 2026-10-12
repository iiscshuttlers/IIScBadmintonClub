# Tournaments — Flow / UX / UI / Color Polish Plan

A focused pass to make the tournament experience (hub → detail → tie modal) feel
coherent, calm, and obvious. Builds on [TOURNAMENTS_HUB_PLAN.md](./TOURNAMENTS_HUB_PLAN.md)
(features) — this plan is about **polish**, not new features.

**Guiding principles**
- **Plain language over jargon** — the user is a player/captain/organizer, not a dev.
- **No dead ends** — every empty/pending state offers the next action.
- **Define once, reuse everywhere** — status chips, colors, families via `ThemeScope`.
- **Calm hierarchy** — fewer sizes, fewer bold-everything labels, one accent per surface.
- `tsc --noEmit` = 0 after each phase; mobile-first (test 375px); no behavior regressions.

---

## Phase P1 — Plain labels + actionable empty states (highest leverage, low risk)

### P1.1 Replace internal jargon
Surface-facing strings that leak dev vocabulary:

| Current | Replace with | Where |
|---|---|---|
| `CRICBUZZ SQUAD & LINEUP VIEW` | `Squads` | [TeamSquadView.tsx](../client/src/components/events/TeamSquadView.tsx) header |
| `Court Match #{playing_order}` | `Match {playing_order}` | [TieVisualLineupModal.tsx](../client/src/components/events/TieVisualLineupModal.tsx) |
| `Rubber #{rubber_order}` / `rubber_label` | `Match {n}` (keep "rubber" only in organizer/admin tooling) | modal + list row |
| `Extra Decider Rubber` | `Decider` | modal |
| `Pairings reveal on match start` | keep — it's clear | — |

Keep "rubber"/"tie" terminology **only** in admin/organizer consoles where it's the
domain term; hide it from the spectator/player-facing modal.

### P1.2 Every empty/pending state gets a next step
Audit each "nothing here" block and attach a role-aware CTA:

- **Tie modal, no rubbers** (`rubbers.length === 0`, modal line ~321): instead of a
  bare "No rubbers configured", branch on viewer role:
  - captain of a team in this tie → **"Submit your lineup"** (opens the builder)
  - admin / assigned official → **"Enter on behalf"** (existing override path)
  - everyone else → **"Lineups not announced yet — get notified"** (reminder opt-in)
- **"Both teams yet to submit their lineup"** banner: same treatment — make the banner's
  right side a button, not just a `LINEUP PENDING` chip.
- **Hub, no tournaments / no filter matches** (already handled in Phase E) — verify the
  "Host the first one" CTA is present.
- **Live Matches (0)** section in `LiveTab`: show "No live matches right now — next up at
  {time}" instead of an empty list.

**Verify:** open a tie as each role (where testable) and confirm a real action appears;
no screen shows a wall with nothing tappable.

---

## Phase P2 — One status system + color meaning (coherence)

### P2.1 Extract a single `StatusChip`
`client/src/components/tournament/StatusChip.tsx`:
```tsx
type TState = "live" | "scheduled" | "upcoming" | "completed" | "archived" | "pending";
export function StatusChip({ state, compact }: { state: TState; compact?: boolean }) { … }
```
One source of truth for icon + label + classes. Replace the ad-hoc copies in:
- [TournamentCard.tsx](../client/src/components/tournament/TournamentCard.tsx) `STATUS_META`
- [FeaturedTournamentHero.tsx](../client/src/components/tournament/FeaturedTournamentHero.tsx)
- [TieVisualLineupModal.tsx](../client/src/components/events/TieVisualLineupModal.tsx) (per-rubber + header)
- [TeamSquadView.tsx](../client/src/components/events/TeamSquadView.tsx) (Lineup Announced/Locked/Pending)
- [TeamTiesSection.tsx](../client/src/components/events/TeamTiesSection.tsx) status filters

### P2.2 Color meaning — make it reliable
| Color | Reserved for | Rule |
|---|---|---|
| **Rose/red** | **LIVE / in-progress only** | Nothing non-live may use rose. Referee tab stays rose only because it surfaces live oversight. |
| **Emerald** | Team family + "completed/success" | Family color via `ThemeScope family="team"`. |
| **Violet** | Individual family | Family color via `ThemeScope family="individual"`. |
| **Amber** | Pending / needs-attention | Lineup pending, unscheduled. |
| **Slate** | Neutral / archived / disabled | — |

- Make the **whole detail view** inherit the family: wrap the embedded `LiveTab` detail
  in `ThemeScope family={getEventFamily(t)}` so chips/CTAs/accents read emerald for a
  team event end-to-end (today it's mixed).
- Audit rose usages: `grep -rn "rose-" client/src/components/tournament client/src/components/events`
  and demote any non-live use to amber/primary.

### P2.3 Contrast fixes
- Bench / "Secret Lineup" text: dim via a muted **color token** (`text-slate-500`), not
  `opacity-70` on a translucent bg (currently borderline unreadable in `TeamSquadView`).
- Verify every chip meets ~4.5:1 on its background in dark mode.

**Verify:** a team event is emerald throughout; rose appears only on live things;
dim text is legible at 375px.

---

## Phase P3 — Tie modal flow + a real List view

### P3.1 Order by "what matters now"
In the rubbers map ([TieVisualLineupModal.tsx](../client/src/components/events/TieVisualLineupModal.tsx)),
sort before render: **live → scheduled/upcoming → completed**, and auto-collapse
completed rubbers (click to expand). Mirrors the "Live first" sort already used in ties.

### P3.2 Make Court Cards vs List meaningfully different + sticky
- The compact List row is in place (dense one-liner). Ensure it's visually distinct:
  List = table-like rows with a subtle header (`Match · Side A · Score · Side B · Status`);
  Court Cards = the rich court graphic.
- **Persist the choice**: `localStorage["tieViewMode"]` so it survives reopen.
- Move `TeamSquadView` so it's **collapsible** and below the live rubber (it's a reference,
  not the headline once matches start).

### P3.3 Squad view refinements
- Header → `Squads` (P1), with a one-line explainer only before reveal.
- Show captain (C) and, if present, a small count "Playing 4 · Bench 2" summary.

**Verify:** reopening the modal remembers the view; live rubber is first; completed
collapse; List and Cards are clearly different shapes.

---

## Phase P4 — Hub visual polish

### P4.1 Calm the hero
[FeaturedTournamentHero.tsx](../client/src/components/tournament/FeaturedTournamentHero.tsx):
reduce to one accent (drop either the glow blob or the gradient), smaller height, so it
frames the list rather than competing with it. Keep the live scoreline — that's the hook.

### P4.2 Tighten the type scale
Across hub + cards, collapse to **3 sizes**: hero title / card title / meta. Reduce the
number of `font-black uppercase tracking-wider` micro-labels — keep it for section
headers only, use normal-weight for data.

### P4.3 Skeletons, not spinners
Replace the loading spinner with card-shaped skeletons (same grid) so layout doesn't jump.
Reuse for the "My Tournaments" tray and groups.

### P4.4 Name-collision fallback
When two visible tournaments share a name, cards/switcher show a secondary line
(date range · venue) so they're never indistinguishable. (Also fixes the "New Tournament ×3"
confusion in test data.)

**Verify:** hero reads as a frame not a billboard; type feels calmer; no layout jump on
load; duplicate-named events are distinguishable.

---

## Suggested order & effort
| Order | Phase | Effort | Why first |
|---|---|---|---|
| 1 | P1 labels + empty states | Small–Med | Touches every screen; removes dead-ends & jargon |
| 2 | P2 status chip + color | Medium | Coherence; one definition reused everywhere |
| 3 | P3 modal flow + list | Medium | The most-used detailed surface |
| 4 | P4 hub polish | Small–Med | Final visual calm |

## Cross-cutting checklist
- [ ] `tsc --noEmit` = 0 after each phase.
- [ ] Mobile 375px: single column, wrapped rows, touch targets ≥ 40px.
- [ ] No jargon on spectator/player surfaces; domain terms only in admin tooling.
- [ ] Every empty/pending state has a role-aware CTA.
- [ ] Rose = live only; family color applied end-to-end via `ThemeScope`.
- [ ] Skeleton loaders; no layout shift.
- [ ] Verify in the browser pane (screenshots) after each phase.
