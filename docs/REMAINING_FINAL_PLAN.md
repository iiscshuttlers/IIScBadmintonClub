# Remaining Work — Final Technical Plan

Consolidated, accurate list of everything still open after R1–R8 landed, with a concrete
technical plan per item. Supersedes the open items in
[SITEWIDE_REMAINING_PHASES.md](./SITEWIDE_REMAINING_PHASES.md).

**Done already (do not redo):** W1–W6 (tournaments, 100%); S0.1/0.2/0.3/0.5; S2.1/2.2/2.3;
S4.3; S5 page transitions; S6 avatar/grid lazy-load + code-split; R1 (Record-Match FAB +
desktop); R2 (Officiate surface); R3.1 (ProfileSetup 3-step) + R3.3 (host wizard); R4 PageHeader
card-variant on legal/account pages + `DESIGN_TOKENS.md`; R8 (CourtScheduleSection 2593→1101,
6 components extracted).

**Standing rules:** `tsc`=0 per step · mobile 375px · `prefers-reduced-motion` honored ·
verify in browser pane (fresh tab to avoid stale HMR) · commit per step · behavior-parity on
refactors · keep back-compat redirects.

---

## P0 — Cleanup & correctness (small, do first)

### P0.1 Commit in-flight work
~19 files are uncommitted (R1–R4/R8). Group into logical commits (record-match, officiate,
onboarding/host, design-system, court-schedule split) and push to the PR.

### P0.2 OfficiatePage access gate
[OfficiatePage.tsx:16](../client/src/pages/OfficiatePage.tsx) computes `hasAccess` but never
uses it — signed-in non-officials reach the list. Either render an "officials only" state when
`session && !hasAccess`, or delete the dead variable if the tab's own filtering is the intended
gate. **Decide + apply.**

### P0.3 Manual click-through of the booking flow
R8 extracted the booking/add/edit/delete/history/timeline into components; `tsc`=0 and it
renders, but the **admin booking mutation paths** can't be exercised in a test session. Do a
real admin dry-run: add → edit → delete a booking, confirm realtime still syncs.

**Effort:** S · **Risk:** Low.

---

## P1 — Auth polish (S3.2 / R3.2)

Only the dead `/auth` link was fixed; the surface itself is unpolished.

**Steps** ([Join.tsx](../client/src/pages/Join.tsx), [auth/JoinViews.tsx](../client/src/components/auth/JoinViews.tsx)):
1. Clear state machine UI: sign-in / sign-up / magic-link / OTP, with labelled transitions.
2. **Inline field errors** (email/password/OTP) instead of only toasts; disabled submit until valid.
3. A one-line **"why sign in"** on gated CTAs (pass a `reason` into the gate → Join).
4. Honor `return_url` after auth (already set by GuestGate/FAB/ProtectedRoute) — verify the
   post-login redirect consumes it.

**Effort:** M · **Risk:** Med (sensitive — presentation only, never touch auth logic).
**Verify:** each state reachable; invalid input shows inline error; post-login returns to origin.

---

## P2 — Design-system completion (S1.1, S1.2)

### P2.1 Button/Card rollout
**30 pages** still use raw `<button>`/ad-hoc cards. Migrate incrementally to `ui/button` +
`ui/card` (variants: primary=brand, secondary, ghost, danger).
- Order by traffic: Pulse, Club, player profiles, settings, host, directory.
- Per page: replace button classes with `<Button variant=…>`, card wrappers with `<Card>`.
- Audit progress: `grep -rln "<button" client/src/pages | wc -l` (drive toward near-0 on
  content pages; keep raw buttons only where a custom control is justified).

### P2.2 Type-scale named roles (S1.2)
`--font-display` + `.text-display` exist; finish the scale: add `.text-title/.text-heading/
.text-body/.text-caption` utilities and replace scattered `text-2xl/3xl font-black uppercase
tracking-wider` with roles. Playfair/Outfit for display/title only.

**Effort:** L (mechanical, stage it) · **Risk:** Low–Med (visual — screenshot before/after).
**Verify:** sampled pages use shared primitives + type roles; no visual regressions.

---

## P3 — Color system, app-wide (S4.1, S4.2)

**934** hard-coded `bg-{color}-{n}` occurrences across pages/components.

**Steps**
1. Triage the 934 into: **status** (→ `StatusChip`/`SEMANTIC`), **brand/action** (→ `bg-primary`),
   **family** (→ `ThemeScope`), and **legit palette** (team brand, illustrations — leave).
2. Enforce the rule set: rose=live, amber=pending, emerald=success/team, violet=individual,
   brand=actions. Reuse the tournament audit's outcome.
3. Do it **per directory** (events/, tournament/, players-directory/, pages/) to keep diffs
   reviewable; not one mega-commit.
4. **Light/dark parity** sweep — verify contrast (≥4.5:1) in both themes on 6 key pages.

**Effort:** L · **Risk:** Med (broad, visual). **Do after P2** so colors land on standardized
components. **Verify:** screenshot 6 pages light+dark; one accent for actions; semantics consistent.

---

## P4 — Motion, app-wide (S5 remainder)

`layoutId` exists in 4 files (tournament + player pages). Extend the language:

**Steps**
1. Shared-element `layoutId` list→detail for **feed → match scorecard** and **directory →
   player profile** (PlayerProfile already has a seam).
2. `cardIn` + `stagger` + skeleton→content cross-fade on remaining lists (directory, feed,
   standings, history).
3. Keep shared element to a title/avatar (size-stable) to avoid jitter; all behind
   reduced-motion.

**Effort:** M · **Risk:** Low–Med. **Verify:** list→detail morphs on feed + directory;
reduced-motion falls back; no layout jump.

---

## P5 — Performance & a11y, deep (S6 remainder)

**Steps**
1. **Lighthouse** mobile run (you/CI execute; I fix offenders) — target ≥90 perf/a11y/
   best-practices.
2. **Images**: blur-up placeholders + responsive `srcset` on gallery/legacy/large images
   (lazy-load already done). Never lazy above-fold hero/logo.
3. **A11y sweep**: `aria-label` on every icon-only button (grep `<button` with only an icon
   child), keyboard nav, visible focus, semantic landmarks, full `alt` coverage.
4. **CLS**: skeletons on every data surface (reuse `TournamentCardSkeleton`/`PageSkeleton`
   patterns) so nothing shifts on load.

**Effort:** L (ongoing) · **Risk:** Low. **Verify:** Lighthouse ≥90; tab-through works on 6
pages; no CLS on load.

---

## P6 — PageHeader: finish remaining pages

A few content pages still roll their own header and are clean fits now that variants exist:
- `MyStatsPage` (its "Detailed Analytics" is mid-page — add a real top PageHeader),
- `TournamentTeamHub`, `TournamentSetupChecklist`, `ProfileSetup` (header could use the compact
  variant), plus any others from `grep -rLn PageHeader client/src/pages/*.tsx` that have a hero.

**Effort:** S–M · **Risk:** Low. **Verify:** converted pages render; no nav-offset issues.

---

## Suggested order & effort
| Order | Item | Effort | Risk | Notes |
|---|---|---|---|---|
| 1 | **P0 cleanup** (commit, hasAccess, booking dry-run) | S | Low | unblock + correctness |
| 2 | **P2 design-system** (Button/Card + type roles) | L | Low–Med | foundation for P3 |
| 3 | **P3 color app-wide** | L | Med | after P2 |
| 4 | **P1 auth polish** | M | Med | funnel; presentation only |
| 5 | **P4 motion app-wide** | M | Low–Med | after layout stable |
| 6 | **P6 PageHeader finish** | S–M | Low | quick consistency wins |
| 7 | **P5 perf + a11y deep** | L | Low | measurable; needs Lighthouse run |

## Risk notes
- **P2 and P3 are large and mechanical** — stage per-directory, screenshot before/after, keep
  commits small and reviewable. Don't attempt in one pass.
- **P1 (auth) and the booking paths (P0.3)** are the sensitive logic — change presentation only.
- **P5 needs a local/CI Lighthouse run**; I can implement fixes but not measure from here.
- Everything is additive on the open PR branch unless you want a fresh branch per phase.
