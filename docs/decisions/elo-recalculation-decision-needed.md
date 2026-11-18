# Elo recalculation vs live scoring

State: `in-progress` (14 November 2026). Fix: `supabase/migrations/20261115120000_ranked_only_elo_replay.sql` (written in a parallel session with owner confirmation). Test: `supabase/tests/elo_replay_setup.sql` → `elo_live_helpers.sql` → that migration → `elo_replay_check.sql`.

## What was found (hosted project, read-only)

- **Live scoring** (`submit_tournament_match`) changes Elo only for tournaments with `counts_for_elo = true`. **Friendly matches never change Elo** (`confirm_friendly_match` sets `elo_change_* = 0`).
- **The replay** (`recalculate_tournament_elo`, called by `recalculate_all_elo`, the admin "Recalculate ELO" buttons and tournament-match undo in the Matches manager) replayed *every* completed tournament match, ignoring `counts_for_elo`.
- **Production data:** all 188 rated tournament matches (506 log rows, 148 players) belonged to tournaments with `counts_for_elo = false`, and no completed match was in a ranked tournament. The ranked event (Open Tournament August 2026) had been stored unranked, so current live results were not moving ratings, while any replay counted unranked events such as IISM Trials 2026.
- **Ordering:** corrections overwrote `scored_at`, which the replay orders by. Fixed in `20261115110000_correction_and_merge_followups.sql`.

## The fix in progress (20261115120000)

1. Marks Open Tournament August 2026 as ranked (owner confirmed).
2. Replays only ranked tournaments plus team-tie rubbers, the same gate as live scoring.
3. Does **not** recalculate by itself. An administrator runs "Recalculate ELO" afterwards; that resets everyone to 1200 and replays ranked matches only. **Ratings will change**: anything earned in unranked events (for example IISM Trials) disappears. Announce this before running it.

Verified locally: with the live (old) replay, an unranked match produced Elo logs (bug reproduced); with 20261115120000 it produces none, ranked singles and doubles land in the right buckets, and non-admins are refused.

## Remaining differences (minor)

- **Category codes:** the replay buckets categories by substring (`%MS%`, `%MD%`…), while live scoring uses an explicit code list that also includes BS/GS/BD/GD. Production only has MS, MD, XD, WS and WD, so this has no effect today; align it if those codes are ever used.
- **Ranked winner corrections (WP7):** still blocked. Once the replay is applied and ratings have been recalculated, a ranked winner correction can safely run `recalculate_all_elo` in the same transaction. That is a small change to `_change_tournament_match_result`, pending the club's agreement that one correction may shift later ratings.

## Before running "Recalculate ELO" on production

1. Apply 20261115120000 (it is compatible with the current client).
2. Snapshot current ratings (`players` Elo columns) so the change can be explained or reverted.
3. Run the recalculation as an admin, then compare old and new ratings for the 148 affected players.
