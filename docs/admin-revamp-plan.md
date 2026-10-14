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
- 🟡 **Phase 5** — Panel polish.
  - ✅ Added shared chrome `client/src/components/admin/AdminPanel.tsx`:
    `AdminPanel` (icon + title + description + actions header), `AdminLoading`
    (standard spinner), `AdminEmptyState` (standard empty state).
  - ✅ Adopted in the highest-traffic review panels: AnalyticsPanel,
    ModerationPanel, AdminFeedbackPanel (all tokenized away from hardcoded
    slate backgrounds in the process).
  - ⬜ Follow-up candidates (larger/complex, lower marginal gain): PlayersManager,
    MatchesManager, AdminSettings, AdminStatsOverview (already has a custom
    skeleton + export header — leave unless we want full uniformity).

## Phase 6 — Hardening (reliability · perf · a11y · polish) ✅

Follow-up round after the core revamp.

- **Reliability** — added `AdminErrorBoundary` (`client/src/components/admin/AdminErrorBoundary.tsx`)
  wrapping the panel switch in `SiteAdmin`, keyed by the active tab so a crash
  in one panel shows a recoverable "Retry" card instead of blanking the shell;
  navigating to another section clears it. (The app already has a global
  `OfflineBanner` with Lie-Fi detection + route-level `ErrorBoundary`s, so no
  duplicate offline UX added.)
- **Accessibility** — mobile drawer now closes on `Escape`, carries
  `role="dialog"` + `aria-modal` + `aria-label`; fixed a low-contrast status
  chip in `ModerationPanel` (slate-400 → muted / amber-600 / emerald-600 with
  dark variants).
- **Performance** — `LogMatchModal` (mounted for every signed-in user but
  invisible until opened; already `return null` when closed) is now
  `React.lazy` + `Suspense`, gated on open. Eager entry chunk
  **793 → 750 kB** (gzip 234 → 222); modal split into its own 27 kB chunk.
  Profiling note: heavy libs (xlsx 493 kB, jspdf 386 kB, recharts 360 kB,
  html2canvas 201 kB) are already correctly code-split into on-demand chunks;
  the remaining weight is first-party code in the entry chunk.
- **Panel polish (Phase 5 finish)** — `PlayersManager`, `MatchesManager`,
  `AdminSettings` now use the shared `AdminLoading` / `AdminEmptyState` for
  consistent loading + empty states (no duplicate title header, since the shell
  top bar already shows the section name).

## Phase 7 — Delivery audit ✅

Built the push/cron delivery-audit panel (was deferred in Phase 6).

- Migration `supabase/migrations/20261014120000_admin_delivery_audit.sql` adds
  two admin-only `SECURITY DEFINER` read RPCs: `admin_cron_health()` (per
  pg_cron job: schedule, active flag, last run status/timing, 24h run/failure
  tally — "did the job fire") and `admin_notification_delivery(days_back)`
  (status breakdown of the `scheduled_notifications` queue — "did messages
  send"). Both guard on `is_admin_or_master()` and degrade to empty if the
  `cron` schema is absent (local dev).
- `client/src/components/admin/DeliveryAuditPanel.tsx` renders both via
  react-query plus a recent-failures list, in the shared `AdminPanel` chrome,
  with an "apply the migration" empty state. New "Delivery Audit" tab in the
  Developer group.
- Needs `npx supabase db push` to activate; the panel shows a clear hint until
  then.

## Risks / notes
- `@ts-nocheck` on shell + 12 panels → no tsc safety; verify with the
  undefined-ref gate + live preview.
- Admin is auth-gated; the browser pane cannot sign in, so final click-through
  verification is the maintainer's unless a dev auth path is provided.
- Cuts/dep removal are hard to reverse — done only with sign-off (granted).
