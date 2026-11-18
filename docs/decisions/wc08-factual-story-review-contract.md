# WC-08: factual story templates and review lifecycle

Date: 14 November 2026 (Asia/Calcutta)  
State: deterministic domain slice complete locally; organiser UI, persistence and public story publication remain open

## Contract

- Stories are generated only from completed matches with a recorded winner.
- Champion claims require a final, a winner and a runner-up. Seed-upset claims use recorded seeds.
- A "thriller" requires a three-game result with a deciding-game margin of two points or less. A normal wide deciding game is not labelled a thriller.
- Every item records supporting match IDs and a deterministic source fingerprint.
- New drafts are private. Publication requires explicit review. Changed or removed supporting facts clear publication and return the story to `needs_review`.
- No smash, error, rally-length, comeback or tactical claim is inferred from final scores.

## Evidence and limits

- `client/src/lib/tournamentStory.ts` implements templates and the private/reviewed/published/needs-review state transitions.
- `client/src/lib/tournamentStory.test.ts` covers champions, seed upsets, tight and non-tight deciders, correction invalidation and publication gating.
- The focused WC-06–WC-10 slice passed 54/54.

There is intentionally no hosted write, published story route or organiser editor in this ticket. Those Phase 4A presentation/persistence slices require a publication-permission decision and staging schema review.
