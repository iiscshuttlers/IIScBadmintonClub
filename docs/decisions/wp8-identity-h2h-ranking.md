# WP8 record — Identity onboarding, H2H and ranking stories

State: `verified-locally` (13 November 2026). The identity migration is **not deployed**.
Work package: 8 (execution playbook §15). Builds on WP6's shared match model.

Discovery note: code-review-graph MCP was unavailable; exploration used `grep`/direct reads plus read-only, signed-out queries against the hosted project.

## ⚠ Finding that needs a decision: player contact details are public

Signed out (anon key), `select email, contact_number … from players` returned an email for every row checked (300/300) and a phone number for 238/300. Values were only counted, not displayed or stored. This is identity task 5 ("separate public player data from private contact details"), but fixing it is cross-cutting, so it is **not** changed here:

- Postgres column privileges would make every `select("*")` on `players` fail: 8 direct reads plus about 24 embedded `players(*)` selects.
- Login links accounts by email (`AuthContext` → `players … eq("email", …)`), team invites look up by email, and contact features (`LiveMatchSchedule`) read phone numbers.

Proposed fix, as its own work item:
1. Move `email`, `iisc_email`, `contact_number` and `sr_number` into `player_private` (1:1, RLS: self, site admins, and officials of a tournament the player is entered in).
2. Expose contacts only through a `SECURITY DEFINER` RPC that applies the existing "contacts enabled / opponent / official" rules.
3. Switch account linking to `auth.uid()`.
4. Replace `select("*")` on `players` with explicit public column lists.
5. Revoke anon/member SELECT on the private columns.

New WP8 code reads only public player columns (`id, full_name, gender`).

## Identity

- **Claims are requests, never actions.** A signed-in member with their own profile can ask to own a guest record with written evidence (`request_player_claim`). Nothing moves until a site administrator approves (`decide_player_claim`). A matching name is never accepted as evidence, and members cannot claim other members' records, approve their own request or act anonymously. Guest profiles show "This is me — request link" with the request's status.
- **Merges are previewed and reasoned.** `preview_player_merge` lists every row that will move. It finds them through all foreign keys to `players` plus known player columns that have no foreign key, such as tournament match slots and Elo logs. It blocks merges that would corrupt history: the guest and the member in the same match (a self-match) or both entered in the same event. `merge_player_identity` is admin-only, needs a reason, is idempotent by operation ID, re-checks everything under row locks and moves every reference before deleting the guest. Rows whose foreign key would cascade-delete (badges, entries) are moved first, so they survive.
- **Saved links survive.** `player_aliases` maps old → surviving ID, kept one hop deep across repeated merges. The public can read only that mapping, and the table is append-only. `/player/:oldId` redirects; an unknown ID now shows "Player not found" instead of an endless loading screen.
- **Legacy paths retired.** `claim_guest_player` moved only friendly matches, so tournament history could be lost by cascade; `merge_guest_player` references columns that don't exist. Both lose client execute. The admin Guests panel and Resolve Guests modal now open the merge preview. The modal no longer auto-merges on open or offers one-click "Auto-Link All"; strong candidates are only pre-selected.
- Minimal profile setup already exists (`ProfileSetup.tsx`) and was not changed.

## H2H

- `lib/comparison.ts` is the one model for players and pairs:
  - **Pair identity:** `pairKey` treats A+B as equal to B+A, while A+C is a different pair.
  - **Separate statistics:** player-vs-player, pair-vs-pair and played-together are kept apart.
  - **Discipline:** taken from the category or match code for tournament matches, and from participant genders for friendlies. XD can always be filtered on its own.
- **One result policy:**
  - Counted: confirmed friendlies and completed tournament matches with a winner.
  - Walkovers: listed and counted separately, never as wins or losses.
  - Not counted (listed with the reason): pending, scheduled, in-progress, disputed, cancelled, or no winner recorded.
  - Retirements: there is no retirement status, so a retirement counts as the result that was recorded.

  `meetings = wins + losses + walkovers + not counted` always holds.
- New `/h2h` page, members-only like `/compare`:
  - compares any two players or any two pairs, with discipline filter, summary, sample-size note, form (last 5 meetings) and played-together;
  - each meeting shows date, event, round and score, and links to its match page;
  - all state lives in the URL (`?a=&b=&mode=pairs&cat=XD`).
- **Old count bugs fixed:**
  - `ComparePlayers` read only the latest 200 matches, counted pending/scheduled rows as results, and scored a winnerless row as a loss for player 1.
  - `DoublesPairProfile` counted unfinished matches as losses.
  - `lib/headToHead` (TV next-up) matched pairs on *any* shared player.
- Links to `/h2h` added from the profile H2H widget, the compare page and the pair page.

## Ranking

- **Category rules confirmed** from `submit_tournament_match` and `calculate_overall_elo`:
  - singles categories (MS/WS/"Singles") update `singles_elo`;
  - doubles (MD/WD/"Doubles") update `doubles_elo`;
  - everything else, including XD and "Mixed", updates `mixed_elo`;
  - overall is the average weighted by matches played.

  `lib/ratingStory.ts` mirrors this. The profile chart filter used `"Singles"`/`"Doubles"` only, so tournament MS/WS logs were missing from it and XD showed doubles history. That filter now uses the same buckets.
- **Reproducible history source:** the existing dated, per-match `elo_calculation_logs`. No new snapshot table was added.
- **Profile "Rating history" panel** per rating: current rating, movement over 30 days, recent contributing changes and best recorded rating. Each is shown only when logs exist, with "recorded since" dates. "No recorded rating changes" is shown otherwise, and a current rating that differs from the last logged change is flagged (usually an admin recalculation).
- **Plain-language "How ratings work":** individual Elo vs a pair record, separate XD rating, eligibility, no ties in badminton, and how corrections are treated (WP7 blocks ranked winner changes until a recalculation). The pair page explains that a pair has a record, not a rating.

## Files

Database: `supabase/migrations/20261113160000_add_player_identity_claims_and_merge.sql`; tests `supabase/tests/identity_bootstrap.sql`, `supabase/tests/identity_assertions.sql`.

Client (new):
- libraries: `lib/comparison.ts` (+ test), `lib/ratingStory.ts` (+ test)
- services: `services/comparisonService.ts`, `services/identityService.ts`
- pages: `pages/HeadToHeadPage.tsx` (+ test)
- components: `components/player-profile/RatingStory.tsx`, `components/player-profile/ClaimRecordCard.tsx`, `components/admin/PlayerMergeDialog.tsx` (+ test), `components/admin/ClaimRequestsSection.tsx`

Client (changed): `App.tsx` (`/h2h`), `pages/PlayerProfile.tsx`, `pages/ComparePlayers.tsx`, `pages/DoublesPairProfile.tsx`, `lib/headToHead.ts` (+ test), `components/player-profile/HeadToHeadWidget.tsx`, `components/player-profile/tabs/ProfileRankingTab.tsx`, `hooks/useProfileAnalytics.ts`, `components/admin/GuestPlayersPanel.tsx`, `components/admin/ResolveGuestsModal.tsx`.

## Verification

- **Isolated `test_wp8` database** (local Supabase Postgres 17): `identity_bootstrap.sql` → migration → `identity_assertions.sql` passed. It covers:
  - name-only merge and preview by a member are refused;
  - claims need evidence and do not move history;
  - self-approval, member-record claims and anonymous claims are refused;
  - preview finds FK, non-FK and cascade-FK references and flags self-match conflicts;
  - conflicting and reasonless merges are refused;
  - approval preserves friendly, tournament, entry, badge and Elo history;
  - aliases are written, approval retries are idempotent and the merge is logged;
  - aliases are append-only, anon can read the mapping but not the reason, and internal helpers aren't exposed.
- **Browser, signed out, against hosted data (read-only):** a real XD pair-vs-pair query with one pair entered in reversed partner order gives 1–0 (sample 1). Swapping partners between the pairs gives 0 meetings, MD gives 0, and round, event and score are present; totals reconcile. `/h2h` itself is members-only, so its UI is covered by component tests.
- **Automated checks:** unit/component tests (comparison 7, ratingStory 14, headToHead 3, HeadToHeadPage 2, PlayerMergeDialog 3), the full `vitest` run, `vite build`, the undefined-reference gate, and `npm run check` (only the two pre-existing WP3 errors).

## Known limitations

- **Contact-data exposure:** see the finding above. It is unresolved.
- **Merge reversal:** a merge can't be undone from the app; the alias row and audit log record exactly what moved.
- **Guest names inside labels:** free-text team labels (e.g. `team1_label`) keep the guest's name text.
- **No requester notification:** nobody is notified when a claim is decided; they see the status on the guest's profile.
- **ComparePlayers history cap:** it still reads the first player's latest 1000 matches, and its Elo-trend chart is unchanged. `/h2h` reads the full pairwise history, capped at 1000 rows per table and labelled when reached.
- **Profile chart "ALL" line:** still the existing approximation. The new Rating history panel uses recorded changes only.
- **Players' own recent form:** H2H "form" is the last five meetings between the two sides, not each player's overall recent form.

## Rollback

- **Client:** remove the `/h2h` route, the `RatingStory` panel and the `ClaimRecordCard`/merge dialog wiring.
- **Database:** revoke execute on the new RPCs. Keep `player_aliases`, which is needed for links to merged records. Re-granting the legacy RPCs is not recommended.
