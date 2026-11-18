# Remaining Engineering and Product Decisions — Resolution Record

Date: 14 November 2026  
Scope: unresolved items left after WP0–WP10 implementation

## Decisions implemented locally

| WP | Decision | Result |
| --- | --- | --- |
| WP0 | Legacy offline score entries without an owner are unsafe to attribute. | They are marked `__unattributed__`, retained for diagnosis, and excluded from every signed-in user's sync. |
| WP2 | A tournament match has one active scorer. | The first authorized scorer claims the match; other scorers receive `scorer_locked`. Direct transfer while active is blocked. |
| WP5 | The outer tournament navigation is canonical. | The duplicate inner Info/Participants switch was removed; Players/Teams remain separate top-level tabs. |
| WP6 | The tournament Live strip is tournament-scoped; the Pulse fallback remains club-wide. | Broadcasts with a tournament ID are filtered directly; older broadcasts are matched through the tournament schedule. |
| WP6 | Seeds do not belong on generic Pulse cards without reliable tournament-entry context. | Seed rendering stays on tournament-aware match surfaces. Do not infer a seed from rating or rank. |
| WP7 | Administrative schedule, status, court, umpire and pre-start participant edits require a reason and operation ID. | First-party admin flows use `admin_update_tournament_match`; result fields continue through correction/undo RPCs. |
| WP7 | Ranked winner corrections require a true chronological Elo replay. | Do not use targeted delta reversal: it leaves later expected scores based on the old history. Winner-changing ranked corrections stay blocked until the replay migration is deployed and staging-diffed. Score-only corrections remain available. |
| WP7 | Team-tie winner changes must recompute tie totals and downstream slots in the same transaction. | They remain blocked by the simple correction RPC until a coordinated tie-correction RPC has isolated-database coverage. |
| WP8 | Historical free-text labels are evidence, not identity keys. | Preserve them by default. Future merge label changes must be exact whole-name replacements and reversible; never fuzzy-rewrite substrings. |
| WP8 | Rating history must be recorded, not approximated. | The synthetic ALL line was removed. Category lines use calculation logs; truncation is stated when a display cap applies. |
| WP8 | Future identity merges must be reversible without guessing. | Each moved reference is recorded by primary key, and reversal aborts on any changed or missing row. Pre-ledger merges remain non-reversible. |
| WP8 | A member cannot approve their own tournament registration. | Members may edit a pending registration or withdraw it; only an admin or tournament official may review it. |

## Decisions that deliberately remain blocked

These are not unresolved product choices. They are release controls that need an approved environment or real device:

1. Apply migrations and regenerate authoritative database types on staging.
2. Diff the corrected Elo replay against a staging copy before enabling ranked winner changes.
3. Exercise open-event and team-event readiness with realistic staging fixtures.
4. Verify deployed-base-path fresh loads and Android back/offline close-reopen-reconnect behavior.
5. Verify provider-accepted push delivery and canonical deep links on a real device.
6. Run the controlled tournament and small-club-event gates in the WP10 rollout record.

No hosted project, notification provider, or production rating data may be changed as part of local qualification.

