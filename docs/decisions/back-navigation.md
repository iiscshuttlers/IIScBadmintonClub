# Back navigation: one rule for every Back control

Date: 21 November 2026 (Asia/Calcutta)
State: implemented and verified locally (unit, one Playwright journey, browser preview). Not yet tried on Android hardware.

## The problem

Back controls behaved four different ways:

- the phone/browser Back key skipped in-page steps that never touched history (wizard steps, the opened officiate match, the umpire drill-down, sign-in steps);
- several arrows always went to a fixed page (`/tournaments`, `/admin`, `/host-tournament`) whatever you came from;
- others called `history.back()` behind a `history.length > 1` check, which is almost always true on the web because it counts other sites in the tab, so Back from a shared link could leave the site;
- labels such as "Back to H2H" or "Back to Profile" named a place the control didn't reliably go to.

## The rule

The on-screen Back control and the Android Back key do the same thing, in order:

1. Close an open overlay (Android key only; on-screen controls are never under one).
2. Undo an in-page step, if the screen has one.
3. Return to the previous in-app screen, if there is one.
4. Otherwise (opened from a link, a notification or a cold start) go to the screen's parent, replacing the current entry. With no parent registered, go home. On home, press twice to exit.

Labels say "Back". Where a fixed destination is useful, it is a separate link beside Back (the tournament name on a match, "All tournaments" on a tournament). Kiosk exits on TV/venue screens ("TV home", "Exit Venue") stay fixed and say where they go.

## Implementation

- `client/src/lib/navHistory.ts`: stamps every history entry with its in-app index (`__navIdx`), counting from the entry the app first loaded on in this tab. Index 0 means there is nothing of ours behind it. Installed in `main.tsx` before the router. Also holds the step-handler and parent-fallback registries the Android key uses.
- `client/src/hooks/useGoBack.ts` and `client/src/components/ui/BackButton.tsx`: the Back control. It is a link to the parent (so a new tab or a long-press opens somewhere sensible). A tap runs rule 2 (`onBeforeLeave`), then 3, then 4. `PageHeader`'s `backTo` uses it.
- `client/src/hooks/useHistoryStep.ts`: an in-page step that behaves like a screen. Moving forward pushes an entry, and `back()` pops it. When the step was restored with no entry behind it (a draft or a reload), `back()` replaces the step with its parent step instead. Used by the host wizard, the Officiate opened match, the umpire format → category → match drill-down, the ELO audit player view and the sign-in steps.
- `client/src/hooks/useNativeBackButton.ts`: the Android key, following the rule above.

Never decide Back with `window.history.length`; use `canGoBackInApp()`, `useGoBack` or `BackButton`.

## Evidence

- `npx vitest run`: 94 files, 787 tests passed, including `navHistory.test.ts`, `useHistoryStep.test.tsx`, `BackButton.test.tsx` and `useNativeBackButton.test.tsx`.
- `npx playwright test tests/signed-in-journeys.spec.ts --grep "match Back control"`: passed. Back from a match pops history to the filtered schedule; a match opened directly goes up, replacing the entry.
- Browser preview: tournament list → tournament → Schedule → match → next match, then Back walked each step in reverse. Wizard step 3 → 2 → 1 → `/host-tournament`. Sign-in welcome → sign in → OTP and back.
- `npm run check` and `npm run build` passed.

## Still open

- Android hardware/emulator run of the same journeys (WC-04's open item).
- "tournament match back preserves filters and scroll context" still fails at its scroll assertion (`savedListScroll` stays 0). It was already failing on `main` before this change.
