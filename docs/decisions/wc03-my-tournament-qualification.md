# WC-03: My tournament qualification

Date: 14 November 2026 (Asia/Calcutta)  
State: locally verified; staging and Android qualification remain open

## Behavior contract

- Signed-in players see one primary **My tournament** card on Home, not competing tournament-match lists.
- A live match wins priority; otherwise the earliest scheduled match is primary. Unscheduled entries follow scheduled entries.
- The primary action opens the canonical match route. Draw and schedule actions preserve the tournament, discipline and court context that is actually known.
- The card identifies the player's side and opponents, and keeps additional disciplines visible as direct match links.
- Missing schedule or court data is stated as **Time not assigned** or **Court not assigned**. The client does not invent a reporting time.
- Query failures remain visible and retryable rather than masquerading as an empty state.

## Implementation evidence

- `client/src/lib/homeRail.ts` selects the primary match and retains the remaining live/upcoming entries.
- `client/src/components/home/MyTournamentCard.tsx` owns the compact actionable presentation and canonical links.
- `client/src/components/home/HomeMatchRail.tsx` supplies tournament names, renders the card first and removes duplicate `my-live`/`my-next` secondary items.
- `client/src/components/home/HomePersonalDashboard.tsx` no longer renders the overlapping tournament-match strip on Home. The reusable strip remains available in the tournament hub.

No schema or hosted Supabase changes were required.

## Local acceptance evidence

| Check | Fixture / scope | Result |
| --- | --- | --- |
| `npx vitest run client/src/lib/homeRail.test.ts client/src/components/home/MyTournamentCard.test.tsx` | Priority, ordering, completed-only state, canonical links, unknown time/court, multiple disciplines | 9/9 passed |
| `npx playwright test tests/signed-in-journeys.spec.ts --grep "mobile home shows one actionable My tournament card" --project=chromium --workers=1` | Locally intercepted signed-in member at 375×812; no hosted requests or mutations | 1/1 passed |
| `npm run check` | TypeScript and project checks | Passed |
| `npm run build` | Production bundle | Passed |

## Remaining qualification

- Re-run the signed-in journey against an approved staging project with representative registrations and role policies.
- Verify Android WebView layout, tap targets and native back restoration as part of WC-04/WC-11.
- Confirm live rescheduling updates during a controlled tournament rehearsal.

