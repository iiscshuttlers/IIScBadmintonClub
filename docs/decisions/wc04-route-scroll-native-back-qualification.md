# WC-04: route, scroll and native-back continuity

Date: 14 November 2026 (Asia/Calcutta)  
State: locally verified; physical Android qualification remains open

## Behavior contract

- Tournament category, court, date, status, panel and tab context remain in the canonical URL.
- Opening a match and going Back returns to the exact tournament URL rather than rebuilding a default view.
- The tournament breadcrumb on a match page returns to the most recent valid route for that tournament, never another tournament or a match route.
- Scroll position is keyed by the complete route, including query and hash state, and is restored after asynchronous tournament content grows.
- Android Back continues to delegate to browser history after overlays, home-exit behavior and duplicate-event protection are considered.

## Implementation evidence

- `client/src/lib/routeContinuity.ts` validates tournament return routes and persists route-specific scroll positions in session storage.
- `client/src/components/layout/RoutePersistence.tsx` remembers the latest canonical context for each tournament, including filter changes.
- `client/src/components/layout/ScrollToTop.tsx` owns manual restoration and retries while data-driven content resizes.
- `client/src/pages/TournamentMatchPage.tsx` uses the validated tournament return route for its breadcrumb.
- `client/src/hooks/useNativeBackButton.ts` remains the single Android Back handler and uses browser history for match-to-tournament navigation.

No schema, hosted Supabase or native project mutation was required.

## Local acceptance evidence

| Check | Fixture / scope | Result |
| --- | --- | --- |
| `npx vitest run client/src/lib/routeContinuity.test.ts client/src/hooks/useNativeBackButton.test.tsx client/src/lib/tournamentRoutes.test.ts` | Route validation, filter/hash keys, scroll persistence, canonical URLs and Android history delegation | 54/54 passed |
| `npx playwright test tests/signed-in-journeys.spec.ts --grep "tournament match back preserves filters and scroll context" --project=chromium --workers=1` | Intercepted signed-in mobile journey at 375×812 with 12 delayed schedule entries | 1/1 passed |
| `npm run check` | TypeScript and undefined-reference gate | Passed |
| `npm run build` | Production bundle | Passed |

## Remaining qualification

- Run the same journey with the hardware Back button in an Android emulator and a supported physical device.
- Confirm restoration after WebView process death and cold start as part of WC-11.
- Rehearse rescheduling and live list growth against an approved staging project.

