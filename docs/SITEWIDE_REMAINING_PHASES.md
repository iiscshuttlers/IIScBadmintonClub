# Site-Wide — Remaining Work, Phased Plan

The executable plan for everything still open after the tournament work shipped.
Companion to [SITEWIDE_WORLDCLASS_PLAN.md](./SITEWIDE_WORLDCLASS_PLAN.md) (the "what/why")
— this is the "how", in order, with file refs, effort, risk, and verification.

**Status going in:** the TOURNAMENTS_WORLDCLASS plan is 100% done. Site-wide: S0.1/0.2/0.3/0.5,
S2.1/2.2/2.3, S4.3, S5 (page transitions + shared-element), and part of S6 (avatar/grid
lazy-load, code-split) are done. These phases cover the rest.

**Standing rules:** `tsc --noEmit` = 0 after each phase · mobile-first (375px) ·
`prefers-reduced-motion` respected (global guard already in `index.css`) · verify in the
browser pane · commit per phase · keep back-compat redirects.

**Key infra already present (reuse, don't rebuild):**
- `LogMatchModal` is a **global, event-driven** modal (App.tsx renders it; triggered by
  `window.dispatchEvent(new CustomEvent("openLogMatchModal"))`). R1 just needs a prominent trigger.
- `PageHeader` (+ compact/backTo/icon variants), `StatusChip`, `EmptyState`, `ErrorState`,
  `AvatarStack`, `AnimatedScoreNumber`, `motion.ts`, `ThemeScope`, `SEMANTIC`, 5 `data-accent` themes.

---

## Phase R1 — Core loop: "Record a Match" entry (S3.3) — highest value, low risk

**Goal:** one prominent, always-available entry to log a match, from anywhere. The flow
(`LogMatchModal`) already exists and is global — this is about a consistent **trigger**.

**Steps**
1. Add a persistent **"＋ Record Match"** control:
   - Mobile: a FAB (reuse the existing fixed-bottom pattern, e.g. `BackToTop`/`Navigation`),
     above the bottom nav, hidden on `/tv`, `/broadcast`, and while a modal is open.
   - Desktop: a primary action in the top bar ([Navigation.tsx](../client/src/components/Navigation.tsx)).
2. On click: `window.dispatchEvent(new CustomEvent("openLogMatchModal"))` (signed-out → `/join`).
3. Make it brand-colored (`bg-primary`), `aria-label="Record a match"`, `active:scale`,
   `focus-visible` ring.
4. De-dupe any existing ad-hoc "Log Match" buttons to this one trigger.

**Effort:** S · **Risk:** Low (modal exists). **Verify:** from Home/Pulse/Club/profile, the
control opens the modal in ≤1 tap; hidden on TV/broadcast; signed-out routes to /join.

---

## Phase R2 — Consolidated "Officiate" surface (S3.4)

**Goal:** one place to find matches you can score. Today it's fragmented: `/umpire` →
redirect to `club?tab=my_matches` ([App.tsx:218](../client/src/App.tsx)), plus the tournament
Umpire tab and the umpire console.

**Steps**
1. Create `OfficiateTab` (or a `/officiate` route) listing matches the user can umpire
   (assigned official, admin, or open umpire) across tournaments — reuse `can_umpire_match()`
   / the umpire queries already in `UmpireTournamentTab`.
2. Each row → one tap into the live scoring console (`UmpireEngine` / `TieUmpireConsole`).
3. Point `/umpire` and the club "my_matches" umpire entry at this one surface; keep the
   tournament Umpire tab linking into it.

**Effort:** M · **Risk:** Med (touches umpire routing; don't change scoring logic).
**Verify:** an official sees their scorable matches in one list; console opens; old entry
points still resolve.

---

## Phase R3 — Onboarding, Auth & Host polish (S3.1, S3.2, S3.6)

**Goal:** guided, progress-driven flows for first impression + hosting.

**Steps**
1. **ProfileSetup → guided 3-step** ([ProfileSetup.tsx](../client/src/pages/ProfileSetup.tsx)):
   (1) identity, (2) level/preferences, (3) done → land on the personalized Home. Add a
   progress indicator; keep the existing fields, just stage them. Preserve edit-mode (no wizard
   when editing).
2. **Auth polish** ([Join.tsx](../client/src/pages/Join.tsx) + JoinViews): clear sign-in/up/OTP
   states, inline errors, a one-line "why sign in" on gated CTAs.
3. **Host wizard** ([HostTournamentWizard.tsx](../client/src/pages/HostTournamentWizard.tsx)):
   step/progress bar + a draft→preview→publish path.

**Effort:** M · **Risk:** Med (auth/onboarding are sensitive — don't change auth logic, only
presentation/sequencing). **Verify:** count taps to complete; each step validates inline; a
new account lands on a personalized Home.

---

## Phase R4 — Design-system completion (S1.1, S1.2, S1.3)

**Goal:** finish what the PageHeader rollout started.

**Steps**
1. **PageHeader card-variant** for the remaining centered/legal/account pages (Privacy, Terms,
   ChangePassword, DeleteAccount) — a `variant="card"` that fits inside a content card.
2. **Button/Card rollout** — replace one-off button/card classes on the busiest pages with the
   shared `ui/button` + `ui/card` (audit: `grep -rn "<button" client/src/pages | wc -l`).
3. **Type scale (S1.2)** — finish named roles (`display`/`title`/`heading`/`body`/`caption`) as
   utilities; `--font-display` already exists. Replace scattered `text-2xl/3xl font-black uppercase`.
4. **Token audit (S1.3)** — document the 224 CSS vars into one semantic table; collapse
   duplicates; write `docs/DESIGN_TOKENS.md`.

**Effort:** M–L · **Risk:** Low–Med (visual regressions — screenshot before/after).
**Verify:** sampled pages use shared primitives; no visual regressions; tokens documented.

---

## Phase R5 — Color system, app-wide (S4.1, S4.2)

**Goal:** the tournament color discipline everywhere.

**Steps**
1. Audit hard-coded colors app-wide:
   `grep -rn "bg-\(emerald\|green\|blue\|rose\|amber\|violet\)-[0-9]" client/src/pages client/src/components | wc -l`
   → route status colors through `StatusChip`/`SEMANTIC`, CTAs through `bg-primary`.
2. Enforce: rose = live only; emerald = success/team; amber = pending; brand = actions.
3. **Light/dark parity** — verify every surface in both modes (contrast ≥ 4.5:1); the
   tournament pass was dark-leaning.

**Effort:** M · **Risk:** Med (broad, visual). **Verify:** screenshot 6 key pages light+dark;
one accent for actions; semantic colors consistent.

---

## Phase R6 — Motion, app-wide completion (S5 remainder)

**Goal:** extend the shared-element + list motion language beyond tournaments.

**Steps**
1. Shared-element `layoutId` list→detail for **matches** (feed → scorecard) and **players**
   (directory → profile); PlayerProfile already has a `layoutId` seam to build on.
2. `cardIn`/`stagger` + skeleton→content cross-fade on the remaining lists (directory, feed,
   standings).
3. All behind `prefers-reduced-motion` (global guard already present).

**Effort:** M · **Risk:** Low–Med (`layoutId` size mismatch can jitter — keep shared element to
a title/avatar). **Verify:** navigating list→detail morphs; reduced-motion falls back.

---

## Phase R7 — Performance & a11y, deep (S6 remainder)

**Goal:** the measurable table-stakes.

**Steps**
1. **Lighthouse** mobile pass (perf/a11y/best-practices); target ≥ 90; fix top offenders.
2. **Images**: blur-up placeholders + responsive `srcset` on gallery/legacy/large images
   (avatar/grid lazy-load already done). Never lazy above-fold hero/logo (LCP).
3. **A11y sweep**: `aria-label` on all icon-only buttons, keyboard nav, visible focus, semantic
   landmarks, `alt` coverage. (skip-link + some aria already done.)
4. **CLS**: skeletons on every data surface so layout doesn't shift.

**Effort:** L (ongoing) · **Risk:** Low. **Verify:** Lighthouse ≥ 90 mobile; tab-through works
on 6 pages; no layout shift on load.

---

## Phase R8 — Finish S0.4 (CourtScheduleSection decomposition)

**Goal:** complete the file split (types/utils/data-hook already extracted; now the render).

**Steps**
1. Extract the **booking add/edit modal** → `CourtBookingModal.tsx` (props: form state + save/
   delete handlers). Biggest single block.
2. Extract the **history panel** and **timeline modal** → their own components.
3. Extract the **court cards** render into `CourtCard`/`CourtTimeline`.

**Effort:** M–L · **Risk:** Med (prop threading on a live booking tool; behavior-parity; the
admin booking flow is hard to fully exercise in a test session). **Verify:** render + a dry-run
of add/edit/delete booking; realtime still syncs.

---

## Suggested order & effort
| Order | Phase | Effort | Risk | Why |
|---|---|---|---|---|
| 1 | **R1 Record-Match entry** | S | Low | app heartbeat; infra exists |
| 2 | **R4 design-system completion** | M–L | Low–Med | consistency; unblocks R5 |
| 3 | **R5 color app-wide** | M | Med | pairs with R4 |
| 4 | **R2 Officiate surface** | M | Med | fixes a fragmented core flow |
| 5 | **R3 onboarding/auth/host** | M | Med | acquisition funnel |
| 6 | **R6 motion app-wide** | M | Low–Med | premium feel after layout stable |
| 7 | **R7 perf + a11y deep** | L | Low | measurable, ongoing |
| 8 | **R8 finish S0.4 split** | M–L | Med | maintainability, do last |

## Risk notes
- **R1 is the cheapest high-value win** — the modal is already global; it's a trigger + wiring.
- **R2, R3, R8 are the sensitive ones** — umpire routing, auth/onboarding, and a live booking
  tool. Change presentation/sequencing, never the underlying scoring/auth/persistence logic;
  screenshot before/after; keep behavior-parity.
- **Do R4 before R5** so color changes land on already-standardized components.
- **R7 needs a local Lighthouse run** you (or CI) execute — I can fix offenders but can't run it
  from here.
- Keep shipping on the existing PR branch (or a fresh branch per phase if you prefer smaller PRs).
