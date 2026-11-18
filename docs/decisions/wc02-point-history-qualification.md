# WC-02 record — custom scoring and point-history coverage

State: `locally-qualified` (14 November 2026). No hosted database or deployment action was performed.

## Outcome

The match Points tab now states whether its timeline is complete, live, partial or predates a corrected result. It only calls a finished timeline complete when all of these are true:

- the stored log is frozen as final;
- its raw entry count agrees with the stored count;
- every scoring rally advances exactly one side by one point;
- games start at game 1 and remain sequential;
- each game's last recorded score agrees with the match score;
- the result has not subsequently been corrected.

This prevents a final-score snapshot or truncated log from being presented as a complete rally history. Corrected histories remain visible as historical evidence but carry an explicit warning and do not support final-result claims.

## Defects fixed

1. The chart interval was fixed at 11. It now uses `ceil(points_to_win / 2)`, matching the scoring engine: 8 for games to 15, 11 for games to 21 and 15 for games to 30.
2. A zero `golden_point` means an uncapped game in the existing readiness rules, but point detection treated every next rally as golden point. Golden-point logic now applies only when the configured value is positive.
3. The match page used `||` defaults, which replaced a legitimate zero golden-point value with 30. It now uses nullish defaults.
4. The UI previously warned only after correction and gave no indication when a log was truncated or complete. It now labels all available histories without inferring unrecorded rallies.

## Source changes

- `client/src/lib/pointLog.ts`: coverage classifier and corrected custom-rule logic.
- `client/src/components/match/MatchPointsTab.tsx`: rule-aware interval and explicit coverage messages.
- `client/src/pages/TournamentMatchPage.tsx`: preserve zero-valued golden-point configuration.
- `client/src/lib/pointLog.test.ts`: 15/21/30, uncapped and coverage tests.
- `client/src/components/match/sportsSiteUi.test.tsx`: component coverage messages and interval rendering.
- `tests/wc02-point-history.spec.ts`: anonymous, deterministic mobile browser fixtures for complete, partial and corrected histories.

## Verification

- Code Review Graph was queried before source inspection. It found direct coverage in `sportsSiteUi.test.tsx`, indirect coverage in `pointLog.test.ts`, and the runtime impact path through `TournamentMatchPage.tsx` and `App.tsx`.
- `npx vitest run client/src/lib/pointLog.test.ts client/src/components/match/sportsSiteUi.test.tsx`: 23 tests passed.
- `npx vitest run client/src/pages/TournamentMatchPage.test.ts`: 4 tests passed.
- `npm run check`: passed.
- `npm run build`: passed with the repository's existing Vite mixed-import warnings.
- `npx playwright test tests/wc02-point-history.spec.ts --project=chromium --workers=1`: 3 tests passed. Each ran at 375 × 812, asserted the relevant label and chart, checked for horizontal overflow and attached a full-page screenshot to the Playwright report.

## Limits

- Browser fixtures prove rendering and classification with deterministic REST responses. They do not prove that hosted migrations are deployed or that a real umpire device has uploaded a complete log.
- A log can be classified complete only with respect to the score data available to the client. Staging and controlled-tournament reconciliation remain release work.
- Point scores support scoring-run and comeback statements only. They do not establish shot type, unforced errors or rally duration unless separately recorded.
