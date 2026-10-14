# Admin Page Revamp Plan

Tracking doc for the `/admin` (SiteAdmin) revamp. Goals: cleaner UI/UX, better
information architecture, mobile-friendly, faster load, and cut dead content.

Status legend: ⬜ todo · 🟡 in progress · ✅ done

---

## Phase 0 — Audit & decisions ✅

Current shell: `client/src/pages/SiteAdmin.tsx` (546 lines), 32 tabs across 6
groups, all panels eagerly imported. 12 admin files carry `@ts-nocheck`
(tsc does not type-check them — rely on `scripts/check-undefined-refs.mjs`).

### Approved cuts (delete)
- **Features Guide** (`AdminFeaturesGuide.tsx`) — hardcoded AI prose.
- **Architecture Graph** (`ArchitectureNeuralGraph.tsx`) — vanity force-graph;
  also drop the `react-force-graph-2d` dependency (sole consumer).
- **App Architecture** (`AppArchitectureMap.tsx`) — static hand-maintained tree.
- **Tooltip Registry** (`TooltipRegistryPanel.tsx`) — hardcoded static list,
  no live function.

### Approved merges
- 3 feature catalogs (Codebase Survey / All Features / Live Features) →
  one **Features** page; split the live ops (notification queue flush, DB
  health) out into **System › Live Ops**.
- 6 content editors (Landing, Banners, Polls, Holidays, Videos, Conveners) →
  one **Content** hub with sub-tabs (extends the pattern Noticeboard already uses).
- 3 review queues (Feedback, Reports/Moderation, Disputes) → one **Inbox**.

### Tournament de-dupe
`#tournament` tab, `/tournament-admin` page, and the amber header button all
mount the same `<TournamentManager>`. Keep `/tournament-admin` as the full
workspace; make the in-admin entry a single link; remove the redundant header button.

### Database Schema
Keep, but gate behind master-admin.

---

## Proposed new structure: 32 tabs → 6 sections

1. **Insights** — Statistics · ELO Audit · Analytics
2. **Inbox** — Feedback · Reports · Disputes (unified queues, status filters)
3. **People** — Players · Guests · Roles (master)
4. **Competition** — Tournaments · Matches · Umpire
5. **Content** — Landing · Banners · Noticeboard · Polls · Holidays · Videos · Conveners
6. **System** — Settings · Activity Log · Undo · Recycle Bin · Changelog · Live Ops · Database Schema (master) · Features catalog

---

## Phases

- ✅ **Phase 0** — Audit & decisions (this doc).
- ✅ **Phase 2** — Performance: every panel now lazy-loaded via `React.lazy` +
  a shared `<Suspense>` fallback in `SiteAdmin.tsx`. Verified by prod build:
  `SiteAdmin` shell chunk ~31.7 kB; `TournamentManager` (312 kB) and
  `EloAuditPanel` (~31 kB) now split into their own on-demand chunks.
  Still todo in later phases: drop `react-force-graph-2d` (after graph tab cut),
  extract nav/tab config out of the shell.
- ✅ **Phase 1** — Content restructure.
  - ✅ Deletions: removed `AdminFeaturesGuide`, `ArchitectureNeuralGraph`,
    `AppArchitectureMap`, `TooltipRegistryPanel` (files, tabs, TabId union,
    render branches, lazy consts, unused icons). Dropped `react-force-graph-2d`
    from `package.json` + `pnpm-lock.yaml`. Build: 6020→5143 modules, ~44s→~9s.
  - ✅ Merges:
    - Tournament de-dupe: in-admin tab is now a launcher to the canonical
      `/tournament-admin` workspace; redundant amber header button removed;
      `TournamentManager` no longer bundled in the admin shell.
    - Features: `FeaturesPanel` (sub-tabs Catalog/Survey) merges the two static
      catalogs; live-ops panel relabeled "Live Ops".
    - Content: `ContentHub` (sub-tabs Landing/Banners/Noticeboard/Polls/
      Holidays/Videos/Conveners) merges 7 editor tabs into 1.
    - Inbox: `InboxPanel` (sub-tabs Feedback/Reports/Disputes) merges 3 queues.
    - Database Schema gated behind master-admin (waffle filter + authState).
  - Result: **32 → 19 top-level tabs**; shell chunk 30.6 kB → 16.5 kB.
- ✅ **Phase 3** — Navigation/IA: persistent sidebar (desktop ≥lg) + slide-in
  drawer (mobile) + live section search, extracted into an `AdminNav` component.
  Groups renamed to Dashboard / People / Competition / Content / System /
  Developer. `#hash` deep-linking preserved, plus a `HASH_ALIASES` map that
  redirects old routes (config, noticeboard, feedback, disputes, all_features,
  the deleted dev panels, …) to their new home.
- ✅ **Phase 4** — Visual redesign: replaced the tall gradient header with a
  slim sticky top bar (section breadcrumb + compact undo/redo), moved to design
  tokens (`bg-background`/`bg-card`/`text-foreground`/`muted`/`border`/`primary`)
  for consistent light+dark theming, dropped the waffle launcher and the
  redundant header shortcut buttons.
- ⬜ **Phase 5** — Panel polish: shared `<AdminPanel>` wrapper on high-traffic panels.

## Risks / notes
- `@ts-nocheck` on shell + 12 panels → no tsc safety; verify with the
  undefined-ref gate + live preview.
- Admin is auth-gated; the browser pane cannot sign in, so final click-through
  verification is the maintainer's unless a dev auth path is provided.
- Cuts/dep removal are hard to reverse — done only with sign-off (granted).
