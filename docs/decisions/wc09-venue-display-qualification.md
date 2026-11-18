# WC-09: venue scoreboard

Date: 14 November 2026 (Asia/Calcutta)  
State: desktop-browser display qualification complete; physical-screen and two-hour soak qualification remain open

## Implemented behavior

- Read-only tournament route with all-court and selected-court layouts.
- High-contrast court, discipline, round, participant and score presentation with an authoritative next match.
- Last server-confirmation time and explicit disconnected, refresh-failed and stale states. Cached data older than 75 seconds is not presented as current.
- Fullscreen control retains the scoreboard and reports refusal instead of failing silently.
- Public tournament link always uses the public web base rather than `capacitor://localhost` or another device origin.
- Hidden events continue to depend on the existing public RLS route contract; the display adds no write controls or private projections.
- The route uses a labelled venue-courts section rather than nesting a second `main` landmark inside the application layout.

## Evidence and limits

- `client/src/pages/VenueScoreboardPage.tsx` implements the display.
- `client/src/lib/venueDisplay.ts` contains the testable freshness and public-link contract.
- Existing queue tests verify playing/next ordering; venue helpers verify stale-state and public-origin behavior.
- `tests/wc09-venue-display.spec.ts` passes 3/3 in Chromium: 1920×1080 multi-court, 1280×720 selected-court, 200% zoom without horizontal overflow, offline/online replacement, cached-score continuity and explicit fullscreen refusal.
- Browser captures were inspected at [`wc09-venue-1920x1080.png`](../qualification/wc09-venue-1920x1080.png) and [`wc09-venue-1280x720.png`](../qualification/wc09-venue-1280x720.png). Scores, participant names, court labels, live labels and next-match information remain visible in the captured layouts.

Still required: physical 1080p/720p viewing-distance inspection, real fullscreen/browser variants, device sleep/wake, subscription/memory observation and a two-hour venue soak. Automated browser completion is not physical-venue acceptance.
