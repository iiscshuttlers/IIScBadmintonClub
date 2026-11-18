# WP9 Decision Record — Following and Targeted Push Alerts

**Status**: Approved (13 November 2026)  
**Work Package**: 9 (Execution Playbook §16)  
**Primary Touchpoints**:
- `docs/decisions/wp9-following-and-targeted-push-alerts.md`
- `supabase/migrations/20261113170000_add_tournament_subscriptions_and_alert_dedup.sql`
- `supabase/tests/following_targeted_alerts_assertions.sql`
- `client/src/services/subscriptionService.ts`
- `client/src/lib/followingAlerts.ts`
- `client/src/components/feed/MyMatchesTab.tsx`
- `client/src/pages/SubscriptionsPage.tsx`
- `client/src/components/tournament/FollowTournamentButton.tsx`
- `client/src/pages/TournamentPage.tsx`
- `supabase/functions/call-to-court/index.ts`
- `supabase/functions/notify-up-next/index.ts`

---

## 1. Context & Problem Statement

Currently:
1. Users can follow individual players via `players.following` or `user_player_subscriptions`, and track individual matches via `user_match_notifications`.
2. However, there is no mechanism to follow entire tournaments (`user_tournament_subscriptions`).
3. There are no granular notification preferences per subscription (e.g., opting in/out of match calls, schedule changes, or results, or temporarily muting without unfollowing).
4. When a user follows both a tournament and a player participating in that tournament, an event (such as a match result or court schedule update) could produce duplicate alerts.
5. In-app navigation links in some legacy push handlers still point to `/tournaments/:id` rather than the canonical match route (`/tournaments/:id/matches/:matchId`).
6. Users who deny browser/native push permissions lose access to their followed match activity unless a dedicated in-app Following view exists.

---

## 2. Inventory of Existing Follow & Notification Mechanisms

| Mechanism | Storage | Scope | Granular Prefs |
| --- | --- | --- | --- |
| `players.following` | Array `uuid[]` on `players` | Social following | None |
| `user_player_subscriptions` | Table `user_player_subscriptions` | Match start reminders for player | Only `notify_before_mins` |
| `user_match_notifications` | Table `user_match_notifications` | Match start reminders for specific match | Only `notify_before_mins` |
| Master toggles | Columns on `players` | Broad channel categories (`pref_notify_smash`, etc.) | Channel-level |
| Tournament Follow | **Missing** | Tournament-wide subscriptions | **Missing** |
| Granular event toggles | **Missing** | Match call, schedule change, result | **Missing** |
| Quiet hours | **Missing** | Nighttime silence window | **Missing** |
| Event deduplication | Partial / Ad-hoc | Prevents double push across overlapping follows | **Missing unified table** |

---

## 3. Database Architecture & Schema Decisions

### 3.1 Table `public.user_tournament_subscriptions`
Stores user subscriptions to whole tournaments with fine-grained event preferences:
```sql
CREATE TABLE public.user_tournament_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  notify_match_call BOOLEAN NOT NULL DEFAULT true,
  notify_schedule_change BOOLEAN NOT NULL DEFAULT true,
  notify_result BOOLEAN NOT NULL DEFAULT true,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);
```
- Row-Level Security: Users can only select, insert, update, or delete their own subscriptions (`auth.uid() = user_id`).

### 3.2 Granular Preferences on `public.user_player_subscriptions`
Enriches player subscriptions with matching event controls:
- `notify_match_call BOOLEAN DEFAULT true`
- `notify_schedule_change BOOLEAN DEFAULT true`
- `notify_result BOOLEAN DEFAULT true`
- `is_muted BOOLEAN DEFAULT false`

### 3.3 Quiet Hours Configuration on `public.players`
Allows users to specify local quiet hours to prevent nighttime push notifications:
- `quiet_hours_enabled BOOLEAN DEFAULT false`
- `quiet_hours_start TEXT DEFAULT '22:00'`
- `quiet_hours_end TEXT DEFAULT '07:00'`

### 3.4 Table `public.delivered_targeted_alerts`
Authoritative deduplication log ensuring that an event and revision version is delivered to a recipient at most once across overlapping player and tournament follows:
```sql
CREATE TABLE public.delivered_targeted_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'match_call' | 'schedule_change' | 'result'
  event_version BIGINT NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'in_app', -- 'in_app' | 'push'
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id, event_type, event_version, channel)
);
```

---

## 4. Alert Generation & Deduplication Logic

### Server-Authoritative RPC: `dispatch_authoritative_match_alert`
```
dispatch_authoritative_match_alert(p_match_id, p_event_type, p_title, p_body, p_version)
```
1. **Target Discovery**:
   - Collects candidate recipients from:
     - Direct match competitors (`player1_id`, `player2_id`, `player3_id`, `player4_id`)
     - Followed players in this match (`user_player_subscriptions` and `players.following`)
     - Followed tournament (`user_tournament_subscriptions`)
2. **Preference Filtering**:
   - Skips users where `is_muted = true` on the matching subscription.
   - Skips users whose event preference (`notify_match_call`, `notify_schedule_change`, or `notify_result`) is disabled.
   - Skips users currently inside active quiet hours (evaluated in local timezone).
3. **Set Deduplication**:
   - Collapses overlapping follows so each distinct `user_id` appears at most once per event invocation.
4. **Delivery Log Check**:
   - Skips any user already recorded in `delivered_targeted_alerts` for `(user_id, match_id, event_type, event_version, 'in_app')`.
5. **Committed Delivery**:
   - Inserts exactly one row into `public.notifications` per eligible user with canonical link:
     `/tournaments/:tournamentId/matches/:matchId`.
   - Records delivery in `delivered_targeted_alerts`.
   - Queues push notification in `public.scheduled_notifications` for background delivery.

---

## 5. Client Following Experience

1. **In-App Following Feed** ([client/src/components/feed/MyMatchesTab.tsx](file:///e:/Github/IIScBadmintonClub/client/src/components/feed/MyMatchesTab.tsx)):
   - Adds a **"Following"** tab alongside "Playing" and "Umpire Duty".
   - Displays all matches belonging to followed players or followed tournaments, ranked by Live $\rightarrow$ Upcoming $\rightarrow$ Completed.
   - Functions even if push notification permissions are denied.
2. **Subscription Center** ([client/src/pages/SubscriptionsPage.tsx](file:///e:/Github/IIScBadmintonClub/client/src/pages/SubscriptionsPage.tsx)):
   - Lists followed tournaments with instant Mute, Unfollow, and event preference toggles.
   - Lists followed players with event preference controls.
   - Configures Quiet Hours.
3. **One-Click Tournament Follow**:
   - Adds `<FollowTournamentButton />` to Tournament details header to allow spectators and players to follow the tournament with one tap.

---

## 6. Security and delivery contract

- `dispatch_authoritative_match_alert` is service-role only. Authenticated clients cannot supply arbitrary alert titles, bodies, types or versions.
- The match trigger is `SECURITY DEFINER` with a fixed `search_path`; direct trigger-function execution is revoked from client roles.
- Event types are restricted to `match_call`, `schedule_change` and `result`.
- Schedule changes use a dedicated monotonic `schedule_revision`, independent of `result_revision`, so repeated court/time edits remain distinct events.
- Push jobs use the real queue shape: `recipient_ids uuid[]`, `channels = ARRAY['push']`, `audience = 'custom'`, plus the canonical match link.
- Quiet hours suppress push queueing but preserve the durable in-app activity record.
- `call-to-court` retains its official-only authorization and cooldown, then delegates recipient discovery, dedupe, canonical links and push queueing to the authoritative dispatcher.
- Queue status distinguishes pending, provider-accepted (`sent`) and failed delivery; failures retain the dispatcher error text.

## 7. Verification (13 November 2026)

- `following_targeted_alerts_assertions.sql` passed in isolated Supabase PostgreSQL 17.
- Covered overlapping follows, granular preferences, mute, quiet-hours in-app preservation/push suppression, exact-version dedupe, repeated schedule revisions, canonical links, queue columns, subscription-owner RLS and direct authenticated dispatch rejection.
- Client subscription/following tests passed as part of the full Vitest run: 61 files, 511 tests.
- The integrated static gate prevents duplicate migration timestamps and regressions in dispatcher grants or queue columns.

## 8. Known limitations and rollout

- Real FCM/APNs/Web Push provider acceptance and dead-token behavior require staging tokens; local SQL verification stops at the queue contract.
- Hosted migrations and edge-function deployment were not performed in this worktree session.
- Monitor `scheduled_notifications.status/error` and retry counts during the controlled tournament; do not log notification body content unnecessarily.

## 9. Rollback

- Client: hide follow controls and Following views while leaving subscription rows intact.
- Edge function: revert `call-to-court` only together with a compatible delivery path; do not re-enable client execution of authoritative dispatch.
- Database: disable the alert triggers to stop generation. Keep dedupe/subscription tables for forward recovery; prefer a forward fix over dropping delivery history.

