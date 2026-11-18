# WC-01: Android recovery and scorer conflict

Date: 14 November 2026 (Asia/Calcutta)  
State: local Android package and database concurrency qualified; physical-device recovery remains open

## Evidence completed

- Android `testDebugUnitTest`, `lintDebug`, and `assembleDebug` completed successfully (`BUILD SUCCESSFUL`, 744 tasks). The build produced the debug package without changing a hosted environment.
- `single_scorer_assertions.sql` passed against an isolated Supabase Postgres 17 container. It covers first-scorer claim, second-official rejection, direct active-scorer transfer rejection, unauthorized-player rejection, anonymous rejection, and friendly-broadcast compatibility.
- `single_scorer_concurrency_verification.mjs` opened two independent database clients simultaneously. Exactly one authorized scorer acquired the live tournament match; the other received SQLSTATE `55000` with `scorer_locked`.
- The disposable container used local port 54329 and was separate from the existing local Supabase container.

## Remaining acceptance

No Android emulator or physical device was available. Process death, offline scoring, reopen/recovery, reconnect/finalize, hardware Back, and the native share sheet therefore remain physical-device acceptance items. A successful APK build does not prove those lifecycle behaviors.

