# WC-11: integrated rehearsal and release decision

Date: 14 November 2026 (Asia/Calcutta)  
Decision: **hold broad release**

## Locally qualified

- WC-01–WC-10 source contracts have focused automated coverage, with known external portions recorded separately.
- `npm run check` passed with zero TypeScript or undefined-reference failures.
- Full Vitest passed: 77 files, 622 tests, zero failures.
- Production build and `git diff --check` passed; diff output contained line-ending notices only.
- The expanded Chromium matrix passed serially: 14/14 journeys, including signed-in admin/member flows, scoring, WC-02 coverage states, three WC-09 venue scenarios and performance capture. An initial earlier 11-worker run caused the three lazy-loaded WC-02 fixtures to time out; all passed alone and in the complete serial run, so the release command should use the stable serial configuration.
- Existing deterministic browser and database harnesses cover important scoring, recovery, route, privacy and notification paths without mutating production.
- Android unit tests, lint and debug assembly pass locally. The isolated Postgres 17 scorer-lock assertions and simultaneous two-client scorer race pass.
- WC-09 adds 3/3 Chromium checks at 1920×1080, 1280×720 and 200% zoom, plus disconnect/reconnect and fullscreen-refusal behavior; both display captures were visually inspected.

The latest local performance capture recorded tournament opening p95 3,410.7 ms, tournament-search interaction 594.2 ms (the test's historical field name says `matchCentreFilterMs`), live-score confirmation p95 180.2 ms, ranking load 2,019.9 ms and two fixture websocket connections. These are Vite/Playwright regression observations from a heavily exercised local qualification run, not production or device SLAs; no performance budgets were enforced by the test.

## Release blockers

- No approved isolated Supabase staging replay for the newest migrations and notification queue changes.
- No physical Android process-death/reconnect/native-back evidence.
- No real provider-token push acceptance run.
- No organiser/player/official/spectator rehearsal tournament or small club pilot.
- No physical 1080p/720p viewing-distance/sleep/fullscreen check, subscription-memory observation or two-hour venue soak.
- Current GitHub Pages deep links return HTTP 404 and generic metadata; WC-10 documents the verified limitation.
- Manual screen-reader and complete WCAG 2.2 AA inspection remain open; automated Chromium reflow at 200% zoom passes.

Local green gates permit continued staging preparation, not production release. No hosted database, edge function, deployment workflow or production data was changed by WC-06–WC-11 work.
