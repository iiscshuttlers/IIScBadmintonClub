# Site-Wide World-Class Plan — Flow, UI, UX, Color

Extend the tournament experience's world-class bar
([TOURNAMENTS_WORLDCLASS_PLAN.md](./TOURNAMENTS_WORLDCLASS_PLAN.md)) to the **whole app**.

**Grounded in the current build:**
- Nav pillars: **Home · Pulse · Tournaments · Legacy · Club** ([Navigation.tsx](../client/src/components/Navigation.tsx)).
- **9 redirect-only routes** in [App.tsx](../client/src/App.tsx) (`/hub`, `/marketplace`,
  `/exchange`, `/find-lost`, `/umpire`, `/gallery`, `/hall-of-fame`, …) — IA churn.
- **Dual profile/mode systems**: `PlayerProfile`, `PlayerPersonalPage`,
  `personal/PersonalProfilePage` + `AppModeContext` (club vs personal).
- Rich theming already exists: **224 CSS vars, 5 `data-accent` themes**
  (violet/rose/amber/blue/cyberpunk) in [index.css](../client/src/index.css), plus the
  `ThemeScope`/family mechanism from the tournament work.
- Hub links to `/auth`, but **no `/auth` route exists** — verify this flow (likely a modal).

**Principles:** one design system · one accent strategy · fewer, clearer paths · every flow
has an obvious next step · motion/craft consistent everywhere · a11y + perf are table stakes.
`tsc`=0 per phase, mobile-first (375px), reduced-motion respected, verify in browser pane.

---

## S0 — Concrete issues found in a deep scan (fix these first; mostly quick)

Real defects/frictions located in the code, highest-value first:

### S0.1 🐞 Dead `/auth` route — broken primary CTAs
[TournamentsHub.tsx](../client/src/pages/TournamentsHub.tsx) calls `navigate("/auth")` in
**3 places** (lines ~192, 258, 485 — sign-in gate, Host CTA, empty-state action), but there
is **no `/auth` route** in [App.tsx](../client/src/App.tsx). The real auth surface is
**`/join`** ([Join.tsx](../client/src/pages/Join.tsx): WelcomeView/SignInView/SignUpView/Otp).
→ **Fix:** replace `/auth` with `/join` (and audit app-wide:
`grep -rn 'navigate("/auth")\|href="/auth"' client/src`). A primary CTA that 404s is a silent
funnel leak. *(This is in code we just shipped — fix in this branch.)*

### S0.2 Pulse "Events" tab overlaps Tournaments
Pulse has tabs **live / feed / events / directory** ([Pulse.tsx](../client/src/pages/Pulse.tsx)),
and `EventsTab` overlaps the dedicated **/tournaments** hub. Three doors to tournaments
(Pulse→Live, Pulse→Events, /tournaments) blur the model.
→ **Plan:** make `/tournaments` canonical for discovery; Pulse "Events" either links into it
or is retired; Pulse keeps **live/feed/directory** (its "now" identity). Decide one.

### S0.3 Home is static, not personalized
[Home.tsx](../client/src/pages/Home.tsx) (503 lines) is hero + quick-links + about/mission —
no live scores, no "your next match", no "your tournaments". For a logged-in member the
landing page should be a **dashboard** (see S3.5), reusing `useLiveScoresFor`,
`useMyTournamentRoles`, `AvatarStack`, `AnimatedScoreNumber`, `FeaturedTournamentHero`
patterns we already built.

### S0.4 Monster files (maintainability → UX risk)
Several files are far past a safe size and concentrate risk + slow iteration:
| File | Lines |
|---|---|
| admin/TournamentManager.tsx | **4208** |
| about/CourtScheduleSection.tsx | 2593 |
| pages/PlayerPersonalPage.tsx | 2579 |
| umpire/UmpireEngine.tsx | 1405 |
| tournament/BracketVisual.tsx | 1402 |
| events/LiveScoreSection.tsx | 1370 |
| pages/Legacy.tsx | 1328 |
→ **Plan:** stage extractions (split tabs/sections into child components + hooks). Start with
`TournamentManager` (it's the biggest and most-edited). Not a rewrite — mechanical splits with
tests of behavior parity. Ties into S1 (shared primitives shrink these).

### S0.5 Redirect sprawl → canonical links (see S2.1)
9 redirect-only routes; make in-app links canonical, keep redirects as back-compat.

**Do S0.1 immediately** (it's a shipped bug), then fold S0.2–S0.4 into the phases below.

---

## S1 — Design-system foundation (do first; everything inherits it)

The tournament surfaces now have `StatusChip`, `SEMANTIC`, `ThemeScope`, `motion.ts`,
`EmptyState`, `AvatarStack`, `AnimatedScoreNumber`. **Promote these to app-wide primitives**
so every page speaks the same language.

### S1.1 Extract a shared UI kit
`client/src/components/ui/` (or confirm existing). Canonical, reused everywhere:
- `Button` (variants: primary=brand lime, secondary, ghost, danger) — kill one-off button
  classes. Audit: `grep -rn "bg-primary.*rounded.*font-black\|<button" client/src/pages | wc -l`.
- `Card`, `Chip`/`Badge` (wrap `StatusChip`), `EmptyState`, `Skeleton`, `AvatarStack`,
  `Modal`/`Sheet`, `Tabs`, `SectionHeader`.
- One `PageHeader` (title + subtitle + actions) so Home/Pulse/Legacy/Club/Profile share a
  rhythm instead of each rolling its own hero.

### S1.2 Typography & spacing scale
Define a 5-step type scale + 4-step spacing rhythm as utilities/tokens; replace the scattered
`text-xl/2xl/3xl font-black uppercase tracking-wider` with named roles
(`display`, `title`, `heading`, `body`, `caption`). Playfair for `display`/`title` only.

### S1.3 Token audit
224 vars is a lot — map which are used, collapse duplicates, document the semantic set
(brand, surface, text, border, live, pending, success, family). One source of truth table.

**Verify:** a sample of each page renders with the shared `Button`/`Card`/`PageHeader`; no
visual regressions; `tsc`=0.

---

## S2 — Information architecture & navigation

### S2.1 Resolve redirect sprawl
The 9 redirect routes are fine as **back-compat aliases** but shouldn't define the mental
model. Decide canonical homes, keep redirects for old links, and make **in-app** links point
only at canonical URLs:
| Legacy | Canonical |
|---|---|
| `/hub` | `/club` |
| `/marketplace`, `/exchange` | `/club?tab=exchange` |
| `/find-lost` | `/club?tab=exchange&sub=lost-found` |
| `/umpire` | `/club?tab=my_matches` (or a dedicated `/officiate` — see S3.4) |
| `/gallery`, `/hall-of-fame` | `/legacy#…` |
Audit internal usages: `grep -rn "href=\"/hub\|/marketplace\|/exchange\|/gallery\|/hall-of-fame\|/umpire\"" client/src`.

### S2.2 Clarify the 5 pillars (reduce overlap)
- **Pulse** = "what's happening now" (live + feed + announcements).
- **Tournaments** = "compete" (discover/register/organize/officiate — now the hub).
- Pulse's live-tournament view and the Tournaments detail currently overlap (we embedded
  `LiveTab` in both). Pick **Tournaments** as canonical for a tournament's detail; Pulse links
  *into* it rather than rendering its own copy long-term (keep both working now).
- Make the nav show **context badges** (e.g. a live dot on Pulse/Tournaments when something
  is live) so users know where the action is.

### S2.3 Unify the profile/mode duality
`PlayerProfile` vs `PlayerPersonalPage` vs `personal/PersonalProfilePage` + `AppMode` is the
biggest conceptual tax. Plan:
- Document what each is for; define **one** profile route with modes as *tabs/sections*,
  not separate pages/worlds.
- If "personal mode" is a distinct product, make the **switch explicit and reversible** in one
  place (a mode toggle in the header) instead of parallel route trees.
- This is a larger refactor — stage it: (a) map, (b) merge the two player-profile pages, (c)
  fold personal mode into a section.

**Verify:** every nav/CTA lands on a canonical URL; a live event shows a nav badge; profile
has one home.

---

## S3 — Key flows, redesigned (the "better way")

### S3.1 Onboarding / Join (first impression)
`Join` → auth → `ProfileSetup` → Home. Make it a **guided 3-step** with progress, not a form
dump: (1) who you are, (2) your level/preferences, (3) done → land on a *personalized* Home.
Verify the `/auth` target actually exists (S0); if it's a modal, ensure deep links and the
hub's `navigate("/auth")` resolve.

### S3.2 Auth
Single, polished auth surface (modal or page) with clear states (sign in / up / magic link /
OAuth), inline errors, and a "why sign in" line on gated CTAs. Remove dead `/auth` nav if it
404s; route to the real surface.

### S3.3 Record a match / submit score (core loop)
There's no single obvious "record a match" entry — it's spread across my-matches / umpire /
club tabs. **Give the core loop one prominent, always-available entry** (a "＋ Record match"
FAB or header action) with a fast, mobile-first flow: pick opponents → score → confirm. This
is the app's heartbeat; it should be 2 taps from anywhere.

### S3.4 Live scoring / officiating
Consolidate umpire entry points (`/umpire` redirect, club tab, tournament Umpire tab) into one
"Officiate" surface listing matches you can score, with the live scoring console one tap in.

### S3.5 Discovery (Home)
Make Home a **personalized dashboard**: your next match, live now (with scores), your
tournaments, recent results — not a static marketing page. Reuse `useLiveScoresFor`,
`useMyTournamentRoles`, `AvatarStack`, hero patterns.

### S3.6 Host a tournament
The wizard exists; ensure it has the same step/progress polish as S3.1 and a clear
"draft → publish" path with preview.

**Verify (per flow):** count the taps from Home to completion; each flow has progress,
inline validation, and a success state with a next action.

---

## S4 — Color system, site-wide

### S4.1 One strategy, applied everywhere
Promote the tournament rule to the whole app:
- **Brand = `--primary` (lime)** for primary actions only.
- **Semantic:** rose=live, amber=pending/attention, emerald=success/completed, red=destructive.
- **Context accents** via `data-accent` (the existing 5 themes) and `ThemeScope` (families) —
  used to *tint context*, never as random chrome.
- Audit hard-coded colors app-wide: `grep -rn "bg-\(emerald\|green\|blue\|rose\|amber\|violet\)-[0-9]" client/src/pages client/src/components | wc -l` → route through tokens/`StatusChip`/`Button`.

### S4.2 Light/dark parity
Every new token needs both themes (the tournament pass was dark-leaning). Verify contrast
(~4.5:1) across pages in both modes.

### S4.3 Make `data-accent` a user setting (delight)
Expose the 5 accent themes (incl. cyberpunk) in Settings as a personalization — a cheap,
high-delight feature the infra already supports.

**Verify:** screenshot 5 key pages in light+dark; one accent for actions; semantic colors
consistent; accent switcher works.

---

## S5 — Motion & interaction language (app-wide)

Promote `client/src/lib/motion.ts` to the global standard:
- Page transitions (fade/slide) via a shared route wrapper.
- `cardIn`/`stagger` on every list; skeleton→content cross-fade everywhere.
- The shared-element `layoutId` pattern for list→detail across the app (profiles, matches,
  tournaments), not just tournaments.
- One hover/tap language (`lift`, `active:scale`). All behind `prefers-reduced-motion`
  (global guard already added).

**Verify:** navigating between pages feels continuous; no hard pops; reduced-motion disables.

---

## S6 — Performance & craft (table stakes for "world class")

- **Code-split** heavy routes (already `lazy`; audit bundle, split TV/broadcast/admin).
- **Images:** lazy-load, responsive `srcset`, blur-up placeholders (gallery/legacy/avatars).
- **Skeletons** on every data surface; no layout shift (CLS).
- **A11y pass:** focus-visible everywhere, aria-labels on icon buttons, keyboard nav, skip-link,
  semantic landmarks. (Started in tournaments; extend app-wide.)
- **Offline/empty/error states** standardized via `EmptyState` + an `ErrorState`.
- **Perf budget:** measure with Lighthouse; target 90+ on mobile.

**Verify:** Lighthouse mobile ≥ 90 (perf/a11y/best-practices); tab-through works on 5 pages.

---

## Suggested roadmap
| Order | Phase | Effort | Why first |
|---|---|---|---|
| 1 | **S1 design-system foundation** | Large | everything else inherits it |
| 2 | **S4 color site-wide** | Medium | coherence; pairs with S1 |
| 3 | **S2 IA / nav** | Medium | fixes the mental model & redirect sprawl |
| 4 | **S3.3 + S3.4 core loop (record/officiate)** | Medium | the app's heartbeat |
| 5 | **S3.5 personalized Home** | Medium | first impression |
| 6 | **S3.1/S3.2 onboarding + auth** | Medium | acquisition funnel |
| 7 | **S5 motion app-wide** | Medium | premium feel after layout stable |
| 8 | **S6 perf + a11y** | Ongoing | table stakes, measure continuously |
| 9 | **S2.3 profile/mode unification** | Large | biggest refactor; stage carefully |

## Decisions / risks
- **S1 and S2.3 are the big, risky refactors** — stage them, screenshot before/after, keep
  back-compat redirects. Everything else is incremental.
- **No new backend** for S3.5/S4/S5; S3.3 may need a cleaner match-create surface but reuses
  existing match services.
- **Verify the `/auth` flow first (S0)** — a 404 on a primary CTA is a silent funnel leak.
- Do **S1 → S4 together** in one coherent visual pass so the app doesn't live in two styles
  mid-migration.
- Measure a11y/perf (S6) continuously, not at the end.
