# Tournaments — World-Class Technical Plan

The jump from *polished* to *top-notch*. Grounded in the current build: `--primary` is
the lime brand ([index.css:138](../client/src/index.css)), `ThemeScope` re-tints
`--primary` per event family via `FAMILY_CSS_VARS`
([tournamentTheme.ts:91](../client/src/lib/tournamentTheme.ts)), `framer-motion@12` is
installed, and `useLiveScoresFor` already polls live scores.

**North star:** one brand accent, semantic-only secondary colors, a hero that's *alive*,
one restrained motion language, denser cards, and signature craft details.

**Rules for every phase:** `tsc --noEmit` = 0 · mobile-first (375px) · respects
`prefers-reduced-motion` · `:focus-visible` rings · touch targets ≥ 44px · verify in the
browser pane with screenshots (desktop + 375px).

---

## W1 — One color system with intent (foundation; do first)

**Problem (observed):** lime (nav/Host), emerald (Enter Hub/Open), rose (LIVE) and a violet
page gradient all compete on one screen. No single primary.

### W1.1 Collapse CTAs to the brand
- **Every primary CTA = `bg-primary`** (lime). Audit and convert hard-coded emerald/green
  buttons: `grep -rn "bg-emerald-\|bg-green-\|bg-lime-" client/src/components/tournament client/src/pages/TournamentsHub.tsx` →
  replace button backgrounds with `bg-primary text-primary-foreground`.
  - Hero "Enter Tournament Hub" (emerald) → `bg-primary`.
  - Card "Open" / "Register" already `bg-primary` — keep.

### W1.2 Lock the semantic palette
Single source of truth. Extend [tournamentTheme.ts](../client/src/lib/tournamentTheme.ts)
with a `SEMANTIC` map and route all usages through it / `StatusChip`:
| Token | Color | Means | Allowed on |
|---|---|---|---|
| brand | lime `--primary` | "do this" | primary CTAs only |
| live | rose | in-progress NOW | live pills, live score, LIVE badge |
| pending | amber | needs action / unscheduled | pending chips |
| success | emerald | completed/won **and** team family | completed chip, team theme |
| individual | violet | individual family | theme only |
| neutral | slate | default/disabled/archived | everything else |

Emerald/violet become **family-theme-only** (via `ThemeScope`), never chrome.

### W1.3 Family-colored page background (the background should *mean* something)
Make the hub + detail background pick up the featured/selected event's family:
- Add `FAMILY_CSS_VARS` entries for a soft bg glow var, e.g. `--family-glow`
  (violet `#7c3aed22` / emerald `#05966922`).
- In [TournamentsHub.tsx](../client/src/pages/TournamentsHub.tsx), wrap the page in
  `<ThemeScope family={getEventFamily(featuredTournament)}>` and replace the static violet
  gradient with a radial using `var(--family-glow)`. Team event → faint emerald; individual
  → faint violet. Detail view already themed by `LiveTab`'s own `ThemeScope`.

**Verify:** one accent (lime) for actions; red only on live; the hub background shifts
emerald vs violet by event type; screenshot both families.

---

## W2 — Promote, don't duplicate (information hierarchy)

**Problem (observed):** with one live tournament, the hero and the "LIVE NOW" card show the
same event twice.

### W2.1 Exclude the featured item from the list
In [TournamentsHub.tsx](../client/src/pages/TournamentsHub.tsx), filter the grouped list to
drop `featuredTournament?.id`:
```ts
const listSource = featuredTournament ? visible.filter(t => t.id !== featuredTournament.id) : visible;
```
Feed `listSource` into `filtered`/`grouped`. If that empties a group, hide the group header.

### W2.2 "Next up" hero when nothing is live
When no `active` tournament, the hero becomes a **countdown** to the soonest `upcoming`
(not just newest): show `startDate` delta ("Starts in 3 days"), a Register CTA if
`require_app_registration`, and no fake live styling.

**Verify:** featured event never appears twice; empty-of-live state shows a real countdown.

---

## W3 — A hero that's alive (signature moment #1)

Make [FeaturedTournamentHero.tsx](../client/src/components/tournament/FeaturedTournamentHero.tsx)
breathe when live:
- **Big live scoreline** from `useLiveScoresFor`: "ECE 15 – 12 CSA · Court 3", large mono,
  rose accent, updating on each 25s poll.
- **Number roll** on score change: wrap the digits in a small `<AnimatedNumber>` (framer
  `motion` + `AnimatePresence`, `key={score}`) so points tick, not snap. Guard with
  `prefers-reduced-motion` → instant.
- **Pulse** the rose live dot (`animate-ping` halo) — one, not many.
- **One** CTA ("Enter"). Drop the second competing action.
- Optional: tiny **court-status row** ("3 courts live · 2 upcoming").

**Verify:** score updates animate; reduced-motion shows instant; single CTA.

---

## W4 — One restrained motion language (signature moment #2)

Create `client/src/lib/motion.ts` with shared variants so motion is consistent, not
per-component guesswork:
```ts
export const cardIn = { initial:{opacity:0,y:12}, animate:{opacity:1,y:0}, transition:{duration:0.25} };
export const stagger = { animate:{ transition:{ staggerChildren:0.04 } } };
export const lift = "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xl";
```
### W4.1 Grid entrance
Wrap the card grid in a `motion.div` with `stagger`; each `TournamentCard` uses `cardIn`.
Skeleton → content **cross-fade** (AnimatePresence), no pop.

### W4.2 Shared-element card → detail transition (highest "wow")
Use framer `layoutId`:
- `TournamentCard` root: `layoutId={`tourn-${t.id}`}` on the name/accent header.
- Detail view header (the embedded `LiveTab` title, or a wrapper in the hub detail branch):
  same `layoutId`. On navigate `?id=`, the card's title/color **morphs** into the header.
- Keep it to the title + color block (cheap, reliable); don't morph whole cards.
- `prefers-reduced-motion` → disable `layout` (plain fade).

**Verify:** card lifts uniformly; grid staggers in; clicking a card morphs into detail;
reduced-motion falls back cleanly.

---

## W5 — Denser, richer cards (earn the space)

Current cards are sparse. Add real signal to
[TournamentCard.tsx](../client/src/components/tournament/TournamentCard.tsx):
- **Progress strip** for active: "Round 2 of 4 · 18/32 matches" — derive from the
  `tournament_matches` already embedded in `getTournaments()` (completed vs total), plus
  `round_name`. Thin bar in family color.
- **Live court count** on active cards ("3 courts live") from `useLiveScoresFor` / match
  statuses.
- **Winner chips** on completed cards (reuse the `winners` array already in `getTournaments`).
- **Stacked avatars** for participants/teams ("＋12") instead of a bare number — small query
  or reuse members already fetched; cap at 5 + overflow.
- Title-case status, add date range as the subtitle (fixes "New Tournament / open").

**Verify:** active card shows progress + live courts; completed shows winners; no card looks
empty; 375px stays single-column and legible.

---

## W6 — Craft details that signal quality

- **Empty states with personality:** replace bare icons with a small shuttlecock SVG + one
  warm line ("No tournaments yet — be the first to serve 🏸"). One reusable `EmptyState`.
- **Focus & a11y:** `focus-visible:ring-2 ring-primary` on every interactive element;
  `aria-label`s on icon-only buttons (the hero's unlabeled LIVE/team/ranked icons are
  currently ambiguous — add labels or text).
- **Tap feedback:** `active:scale-[0.98]` on cards/buttons for a physical feel on mobile.
- **Reduced-motion:** a global `@media (prefers-reduced-motion: reduce)` guard disabling
  transforms/animations.
- **Number & date formatting:** consistent `en-IN`, relative dates ("in 3 days", "2h ago")
  via one helper.
- **Scroll polish:** sticky filter bar on the hub; `scroll-mt` so deep-linked sections don't
  hide under it.

**Verify:** keyboard-tab through the hub shows clear focus; icons have labels; empty states
feel intentional; reduced-motion disables animation globally.

---

## Suggested order & effort
| Order | Phase | Effort | Why |
|---|---|---|---|
| 1 | **W1 color system** | Medium | foundation; everything inherits it |
| 2 | **W2 promote-not-duplicate** | Small | removes the obvious redundancy |
| 3 | **W5 richer cards** | Medium | most-seen surface; kills empty space |
| 4 | **W3 live hero** | Small–Med | signature moment, reuses live scores |
| 5 | **W4 motion language** | Medium | the "expensive" feel; do after layout is stable |
| 6 | **W6 craft details** | Small–Med | the final 10% that reads as world-class |

## Decisions / risks
- **No new backend** required: progress/winners/live-courts all derive from data
  `getTournaments()` + `useLiveScoresFor` already fetch. Stacked avatars may need one light
  query (batch) — fetch lazily, don't block the list.
- **Motion budget:** keep it to entrance + hover + one shared-element transition + number
  roll. More than that reads as busy, not premium. Everything behind `prefers-reduced-motion`.
- **Color migration is the risky part** (touches many files) — do W1 in one focused pass,
  screenshot before/after both families, keep `StatusChip` the single status source.
- Verify family background + shared-element transition on real devices; `layoutId` morphs can
  jitter if the two elements differ in size — keep the shared element to the title block.
