# WP5 decision record — canonical tournament and match routes

State: approved 13 November 2026; implementation `verified-locally` (see §7)
Prepared: 13 November 2026
Work package: 5 (execution playbook §12)

Discovery note: the code-review-graph MCP server failed to connect in this session, so the route map below was built with `grep`/direct reads of `client/src/App.tsx`, `pages/TournamentsHub.tsx`, `pages/TournamentDetail.tsx`, `pages/Pulse.tsx`, `components/pulse/LiveTab.tsx`, `lib/tournaments.ts`, `public/firebase-messaging-sw.js`, `lib/pushNotifications.ts`, the edge functions under `supabase/functions/` and tournament RLS migrations.

## 1. Current route map (evidence)

### Tournament surfaces

| URL today | Handler | Behaviour | Problem |
| --- | --- | --- | --- |
| `/tournaments` | `TournamentsHub` | List of non-draft, non-archived tournaments (client-side filter). | — |
| `/tournaments?id=X[&subtab=S&m_status&m_cat]` | `TournamentsHub` → embeds `LiveTab` | `LiveTab` loads all tournaments and selects X. | If X is not found it **silently selects the active (or first team / latest) tournament** — a bookmark can show the wrong event. |
| `/tournaments/:id` | inline route in `App.tsx` | `window.location.replace` → `/tournaments?id=…` | Full page reload; native history gets an extra entry. Used by push links from `call-to-court` and `notify-up-next`. |
| `/events/:slug` | `TournamentDetail` | Archive/results page. Resolves legacy JSON archive by slug, else DB tournament by `slug \|\| id`. | Legacy records with `active`/`draft` redirect to `/pulse?t=<status>#tournament`; Pulse reads neither `t` nor `#tournament`, so identity is lost. |
| `/pulse?id=X#live`, `/pulse?tournament_id=X` | `Pulse` → `LiveTab` | Same selector as the hub. | Switching Pulse tab clears `search`, dropping `id`. |
| `/tournament-setup/:id` | `TournamentSetupChecklist` (protected) | Admin checklist; links to `/pulse?id=X#live`. | Admin-only; unchanged by this WP. |
| `/tv/draw/:tournamentId?`, `/tv/next/:tournamentId`, `/predict/:tournamentId`, `/rate/:tournamentId` | TV / prediction / rating pages | Stand-alone displays. | Out of scope; keep as-is. |

Lifecycle split: `TournamentsHub.openTournament` sends `completed`/`archived` to `/events/:slug` and everything else to `/tournaments?id=`. **The URL of an event therefore changes when it completes.**

### Match surfaces

| URL today | Handler | Problem |
| --- | --- | --- |
| `/pulse?tab=matches&m_status=S&m_cat=C#match-card-M` (from `ActiveTournamentWidget`) | `LiveTab` scrolls to the card | Uses `tab` (LiveTab reads `subtab`) and carries no tournament id; only works if the right tournament happens to be auto-selected and the card is in the loaded page. |
| `/tv/:matchId`, `/tv/overlay/:matchId?`, `/broadcast/:matchId` | Scoreboard / overlay displays | Display surfaces, not a match detail page. |
| `/my-matches` | Push link from `notify-match`, `send-match-reminders` | Not match-specific. |

There is **no stable match detail route**.

### Push deep links

- `call-to-court`, `notify-up-next`: `link: /tournaments/<tournament_id>` plus `match_id` in data.
- `notify-match`, `send-match-reminders`: `/my-matches`.
- `dispatch-scheduled-notifications`: `/pulse` or `/pulse#announcements`.
- `lib/pushNotifications.ts` follows any same-origin relative `data.link`; the service worker maps `action`/`type` to fixed paths.

### Visibility

- RLS `tournaments_public_read`: `status <> 'draft'`. Admin read and creator (`tournaments_self_host_read`) policies also exist. A draft is therefore invisible to everyone else at the database layer.
- `TournamentsHub` additionally hides `archived` client-side (archived are reached via `/events/:slug`).
- Verified in `20260628000000_tournaments_supabase.sql`: `tm_public_read` and `tp_public_read` both require an existing parent tournament whose status is not `draft`. The later `20260816110000_relax_matches_rls.sql` replaces privileged admin/umpire policies only and leaves these public policies in place.

### Identifiers

- No `slug` column for tournaments exists in checked-in migrations; `getTournaments()` maps `slug: tr.slug || tr.id`. Effective DB identity is the UUID.
- Legacy archived tournaments from site data (`useArchivedTournaments`) have slugs and no DB UUID.

## 2. Decision

### 2.1 Canonical tournament URL

```
/tournaments/:tournamentId[/:tab][?cat=&court=&date=&status=]
```

- `:tournamentId` is the DB UUID. Rationale: the only stable identifier present in the schema; slugs are not stored and would change on rename.
- Legacy JSON-archive tournaments (no UUID) keep `/events/:slug` as their canonical URL. They are immutable historical records.
- `:tab` is from a closed set; unknown values fall back to the lifecycle default without an error.

| Tab | Individual events | Team events | Current component reused |
| --- | --- | --- | --- |
| `overview` | Info, notices, key dates, winners when complete | same | `TournamentDetailsTab` (info), archive hero from `TournamentDetail` |
| `players` | Entries by discipline | Teams and rosters | `TournamentDetailsTab` (participants), `LivePlayersSection`, `LiveTeamsSection` |
| `draw` | Brackets / groups | Ties and standings | LiveTab `brackets`, `ties`, `standings` |
| `schedule` | Order of play | same | LiveTab `schedule` |
| `results` | Completed matches | same | LiveTab `matches` (`status=completed`), archive results from `TournamentDetail` |
| `live` | Live and upcoming matches; shown and emphasised only while `status = active` | same | LiveTab `matches` (`status=upcoming`) |

Role-specific panels (`my-matches`, `umpire`, `referee`, `organizer`, `polls`) remain secondary sub-views inside the page, addressed as `?panel=<name>`, and are shown only to eligible users exactly as today.

Lifecycle default tab: `upcoming` → `overview`; `active` → `live`; `completed`/`archived` → `results`. The default is applied only when no tab is given; an explicit tab is always honoured so bookmarks keep working after completion (e.g. `/live` on a completed event shows the Results-style empty state with a link to Results, not a redirect loop).

Filters: `cat` ∈ `MS|WS|MD|WD|XD` (XD always present), `court`, `date` (ISO `YYYY-MM-DD`), `status` (`upcoming|completed`). Filters use `replaceState`; tab changes use `pushState` so Back walks tabs, matching current `useQueryState` behaviour.

### 2.2 Canonical match URL

```
/tournaments/:tournamentId/matches/:matchId
/matches/:matchId        → resolves tournament_id, then replaces with the canonical URL
```

The short form exists for push notifications and sharing where only a match ID is known. The detail page shows event, discipline, round, participants/pairs, seeds, court, status, score and next-round destination when known. WP5 delivers the route and a minimal detail view; WP6 replaces its internals with the shared scorecard primitives.

### 2.3 Compatibility redirects (client-side, `replace`, no full reload)

| Old | New |
| --- | --- |
| `/tournaments?id=X&subtab=S&m_status=Z&m_cat=C` | `/tournaments/X/<tab(S,Z)>?cat=C` — `details→overview`, `brackets/ties/standings→draw`, `schedule→schedule`, `matches+completed→results`, `matches+upcoming→live` (or `schedule` when not active), `my-matches/umpire/referee/organizer/polls→?panel=` |
| `/tournaments/:id` (current hard reload) | becomes the canonical route itself |
| `/events/:slug` where slug or id resolves to a DB tournament | `/tournaments/<id>` (lifecycle default tab) |
| `/events/:slug` for a legacy JSON archive record | unchanged (canonical for legacy) |
| `/pulse?id=X` / `/pulse?tournament_id=X` (any hash) | `/tournaments/X/live` |
| `/pulse?…#match-card-M` | `/matches/M` |
| `/pulse?t=…#tournament` (legacy archive redirect target) | removed; `TournamentDetail` sends legacy active/draft records to the hub instead |

`/pulse` without a tournament id stays Pulse (club-wide feed). Selecting a tournament inside Pulse navigates to the canonical page instead of re-selecting in place.

Redirects run only **after** the visibility check (§2.4) so a redirect never confirms that a hidden tournament exists.

### 2.4 Visibility and failure states

- The route loader fetches the single tournament by ID through the normal anon/authenticated client, so RLS is authoritative.
- No row → one "Tournament not found" state, identical for a non-existent ID and a draft the viewer cannot read. No fallback to another tournament.
- Fetch error → a distinct "Couldn't load this tournament" state with Retry; never treated as not-found and never silently substituted.
- Loading, empty (e.g. no matches yet), denied (role panel requested without the role) and failed states are distinct.

### 2.5 Navigation

- Use wouter `setLocation(path, { replace: true })` for redirects; drop `window.location.replace` for these routes so Capacitor history does not gain reload entries.
- Verify `useNativeBackButton` treats path-segment tab changes like the existing query-string `pushState`.
- Fresh load of every canonical URL must work on GitHub Pages (`BASE_URL` prefix) and in the Capacitor WebView.

## 3. Assumptions

- WP4 lifecycle states are not yet decided. This record uses the existing statuses (`draft`, `upcoming`, `active`, `completed`, `archived`, `deleted`). If WP4 introduces "announced"/"draw published" visibility, only the tab-default and visibility functions change; the URLs do not.
- Push link changes in edge functions (`call-to-court`, `notify-up-next` → match URL) are prepared in code but deploying edge functions is out of scope (push-only, no hosted deployment in this WP). Existing `/tournaments/:id` links keep working regardless.

## 4. Implementation slices

1. `lib/tournamentRoutes.ts`: pure URL builders and legacy-URL parser/mapper with unit tests (including XD filters and every subtab mapping).
2. Canonical tournament route and page shell reusing existing components; lock `LiveTab` to the routed ID (no fallback selection); distinct not-found / failed states.
3. Compatibility redirects for `/tournaments?id=`, `/events/:slug`, `/pulse?id=`, `#match-card-`.
4. Update in-app link producers (`TournamentsHub`, `HomePersonalDashboard`, `ActiveTournamentWidget`, `ScheduleCalendar`, `Pulse`, `WinnersWallSection`, `SendReminderSheet`, `TournamentSetupChecklist`) to the builders.
5. Match route (`/tournaments/:tid/matches/:mid`, `/matches/:mid`) with minimal detail view.
6. Tests: unit (builders/mappers), component (not-found vs failed, no fallback), Playwright for fresh-load and back/forward where fixtures allow.

## 5. Rollback

Purely client-side. Reverting the slice restores old routes; redirects are additive, so old links keep working throughout. No database objects change in this WP.

## 6. Route safety checks

- Draft visibility is enforced by parent-aware RLS on tournaments, participants and matches. The canonical match page loads its parent first, and the short `/matches/:id` resolver now performs a second RLS-protected parent lookup before placing the tournament ID in the URL.
- `useNativeBackButton` has an automated Android-adapter test proving that a canonical path tab with `canGoBack=true` calls browser history instead of exiting. A physical-device smoke test remains a release check, not an implementation blocker.

## 7. Implementation record (13 November 2026)

### Files

New:
- `client/src/lib/tournamentRoutes.ts` (+ `.test.ts`, 47 tests) — URL builders, tab/panel/discipline/status parsers, lifecycle default, complete route-filter parsing, legacy hub/Pulse mappers, LiveTab sub-tab bridge.
- `client/src/lib/matchRouteVisibility.ts` — defense-in-depth resolver for short match URLs; requires both the match and its parent tournament to be visible through RLS.
- `client/src/hooks/queries/useTournamentRoute.ts` — single-tournament loader returning `loading | not_found | error | ready`; no fallback selection.
- `client/src/pages/TournamentPage.tsx` — `/tournaments/:id/:tab?`; shared `RouteStatusCard` for loading / not-found / failed.
- `client/src/pages/TournamentMatchPage.tsx` — `/tournaments/:id/matches/:matchId` detail and `/matches/:matchId` resolver.
- `client/src/pages/TournamentPage.test.tsx`, `TournamentMatchPage.test.ts`, `hooks/useNativeBackButton.test.tsx` — canonical fresh-load/filter-history, hidden-parent short-link and Android history regressions.
- `client/src/components/tournament/TournamentWinnersPanel.tsx` — winners/podium/certificates extracted from `TournamentDetail` and reused on the Results tab.
- `client/src/components/routing/LegacyPulseRedirect.tsx` — Pulse `?id=` / `#match-card-` redirect, mounted **outside** `GuestGate` so signed-out visitors are redirected too.

Changed:
- `App.tsx` — canonical routes replace the `/tournaments/:id` hard reload; Pulse route wrapped in `LegacyPulseRedirect`.
- `components/pulse/LiveTab.tsx` — optional `route` prop: routed tournament is fixed (no switcher, no fallback, cross-tournament filter hidden), canonical tab bar (Overview, Players/Teams, Draw or Ties & Standings, Schedule, Results, Live only while active or explicitly requested) plus role panels, `cat` filter key, Players view, standings above ties for team draws, live scores only on Live. Pulse usage without `route` is unchanged.
- `pages/TournamentsHub.tsx` — `?id=` view replaced by a `replace` redirect; cards and "Officiate" use canonical links.
- `pages/TournamentDetail.tsx` — DB tournaments redirect to canonical; legacy active/draft go to the hub instead of `/pulse?t=…#tournament`; winners block uses the shared panel.
- `lib/tournaments.ts` — `winnersFromFinals` extracted (behaviour unchanged).
- Link producers: `Pulse.tsx`, `HomePersonalDashboard.tsx`, `ActiveTournamentWidget.tsx` (`/matches/:id`, because its day query spans tournaments), `ScheduleCalendar.tsx`, `WinnersWallSection.tsx`, `SendReminderSheet.tsx`, `TournamentSetupChecklist.tsx`.

No database objects, edge functions or service-worker code changed.

### Verification

- `npm run check` — no errors in WP5 files (concurrent WP3 work in `OrderOfPlayPanel.tsx` showed transient generated-type errors during the run).
- Focused WP5 suite — 4 files, 54 tests passed (47 route-helper assertions plus 7 route, visibility and native-back behavior tests).
- Full `npx vitest run` — 46 files, 411 tests passed; the two known jsdom navigation warnings remain.
- `npm run build` — passed; existing dynamic/static import and bundle-size warnings remain.
- `npm run check` reached four unrelated type errors in concurrent WP work (`TournamentManager.tsx` and `TournamentSetupChecklist.tsx`); no reported error is in a WP5 file. The production build and all tests pass.
- `npx vite build` — passed; existing dynamic/static import warnings remain.
- Browser (dev server, read-only against the configured Supabase project, signed out):
  - `/tournaments?id=<completed>&subtab=matches&m_status=completed&m_cat=XD` → `/tournaments/<id>/results?cat=XD`, XD filter active, Winners shown, Live not offered.
  - Tab clicks push history; Back/Forward walk Draw ⇄ Results correctly; the replaced legacy URL is not in history.
  - `/events/<uuid>` (completed and archived) → canonical; `/events/open-2025` (legacy JSON) unchanged; `/tournaments/open-2025` → `/events/open-2025`.
  - `/tournaments/<unknown uuid>` → "Tournament not found"; `/tournaments/<id>/bogus` → `/tournaments/<id>`.
  - `/pulse?id=<id>#live` → `/tournaments/<id>/live`; `/pulse?…#match-card-<mid>` → canonical match page; `/pulse#feed` unchanged.
  - `/matches/<mid>` → `/tournaments/<tid>/matches/<mid>` showing XD quarter-final, set scores, court, scheduled/actual times and a working "advances to" link; the same match under a different tournament ID → "Match not found".
  - 375 px viewport: no horizontal scroll; tabs wrap.

### Known limitations / follow-ups

- Physical Capacitor Android back-button smoke testing and a deployed GitHub Pages base-path fresh-load remain release checks. The underlying history and `BASE_URL` routing behavior are covered locally.
- End-to-end Playwright journeys remain in WP10; WP5 now has component-level fresh-load, replacement-history and filter-preservation coverage.
- `LiveScoreSection` on the Live tab is still club-wide; scoping it to the tournament is WP6 (Match Centre).
- Seeds and pair identities on the match page await WP6 shared scorecard primitives.
- Push payloads from `call-to-court` / `notify-up-next` keep `/tournaments/:id`, which now works natively; switching them to match URLs is a WP9 edge-function change.
- Overview still contains the older Info/Participants toggle from `TournamentDetailsTab`, which duplicates the Players tab.
