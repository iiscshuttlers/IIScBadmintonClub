# WC-06: canonical doubles comparison

Date: 14 November 2026 (Asia/Calcutta)  
State: local implementation complete; staging/public-data acceptance remains part of WC-11

## Contract

- Pair identity is the unique, case-normalised set of two canonical player IDs. Member order never changes identity; a duplicated member is not a pair.
- Pair-versus-pair, player-versus-player and played-together results remain separate.
- Counted, walkover and excluded results use one shared policy across the H2H and pair-profile surfaces.
- Discipline and inclusive date-range filters constrain the visible sample. Undated rows are excluded from a dated sample.
- Won/lost figures always show their counted sample; small samples receive an explicit warning.

## Evidence

- `client/src/lib/comparison.ts` owns canonical identity, eligibility, discipline, date filtering and reconciliation.
- `client/src/pages/HeadToHeadPage.tsx` exposes pair mode, discipline filters, all-time/12-month/3-year periods, meetings and the result policy.
- `client/src/pages/DoublesPairProfile.tsx` uses the shared eligibility policy and links into canonical pair comparison.
- Focused WC-06/WC-07 tests passed as part of the 26-test slice; the broader WC-06–WC-10 slice passed 54/54.

No pair rating or unsupported "best partner" claim was introduced. The legacy pair overview still uses recorded tournament matches only; cross-source partnership-history expansion is a later Phase 3B enhancement, not silently inferred here.
