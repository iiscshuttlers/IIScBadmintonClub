# Player contact privacy

State: `verified-locally` (13 November 2026). **Not deployed.** Follows the finding in `docs/decisions/wp8-identity-h2h-ranking.md`.

## Problem

`players` had table-wide SELECT for `anon` and `authenticated`. Signed out, the hosted project returned an email for every row checked (300/300) and a phone number for 238/300. Values were only counted, not displayed or stored.

## Decision

Keep one `players` table and restrict reading with column privileges:

- **Private columns:** `email`, `iisc_email`, `contact_number` and `sr_number` are no longer granted to client roles. Every other column is granted explicitly.
- **Writes unchanged:** INSERT/UPDATE privileges are unchanged, so profile editing works. The participant import's "fill phone only if empty" moved to `admin_fill_player_contact`, because an update that filters on a column needs read access to it.
- **Private data through checked RPCs only:** each is `SECURITY DEFINER`, sets its `search_path`, checks `auth.uid()` itself and is revoked from `PUBLIC`/`anon`.

| RPC | Who | Returns |
| --- | --- | --- |
| `get_my_player_private()` | signed-in user | own email/phone/SR, including an account linked by verified email |
| `resolve_my_player_id()` | signed-in user | the player row that belongs to this account (replaces the client's `players?email=eq.…` lookup) |
| `admin_get_player_private(ids)` / `admin_search_players_by_email(q)` | site admins | private fields / email search |
| `find_player_by_email(email)` | signed-in user | public identity for an **exact** address only (team invites); no contact data |
| `player_email_in_use(email)` | signed-in user | whether another player already uses this address (profile setup) |
| `get_tournament_contacts(tid, ids)` | role-based | phone numbers: admins and the tournament's officials/organiser get everyone in that event; when the organiser has enabled contacts, other players get only people they share a match with, plus officials |
| `admin_fill_player_contact(id, phone)` | site admins | sets a phone number only if empty |

Known caller-rights policies reading `players.email` (venue presence insert, plus match/tournament/umpire management policies on `matches`, `tournament_matches`, and `umpire_assignments`) were rewritten to use `SECURITY DEFINER` helpers: `is_my_player_id()`, `is_admin_or_master()`, and `is_admin_or_umpire()`.

**Fail-safe:** the migration first scans the live database for caller-rights policies, functions or security-invoker views that read the private columns. If it finds any it **stops**, naming them, instead of breaking them. A test confirmed that an unknown policy aborts the migration with access unchanged.

## Client changes

- **No more full-row reads of `players`:**
  - `lib/playerColumns.ts` defines `PLAYER_PUBLIC_COLUMNS`, a typed literal list of 70 columns.
  - Every `select("*")` on `players` and every `players(*)` embed was replaced: `AuthContext`, profile setup, profile page, player directory/H2H, team/umpire/subscription services, team rosters.
  - Explicit `email`/`contact_number` selects were removed from public screens: team member lists, the player preview modal, captain lookups and player search, which no longer matches on email.
- **Own and admin data:**
  - `AuthContext` merges the user's own private fields from `get_my_player_private`, so own-profile screens keep working.
  - Admin loaders merge admin-only fields via `withAdminPrivate`: player manager, guest resolution, team setup, seeding/import directory, candidates.
  - `useAdminPlayers` serves admin screens and is excluded from cache persistence.
- **Contacts:** `LiveMatchSchedule` gets contacts and officials through `get_tournament_contacts`.
- **Cache:** the persisted query cache gets a `buster`, so caches written earlier (which may hold other players' emails) are discarded. Queries with `meta.persist === false` are never written to storage.
- **Regression guard:** `lib/playerColumns.test.ts` scans the client source and fails on any player query that requests `*`, a private column, or filters on one.

The two obsolete direct-contact readers in `services/tournamentService.ts` were removed after WP3 landed. The regression guard has no private-column allow-list. The import function calls `admin_fill_player_contact`.

## Verification

- **Isolated `test_privacy` database** (local Supabase Postgres 17): `contact_privacy_bootstrap.sql` → migration → `contact_privacy_assertions.sql` passed, run as the real `anon`/`authenticated` roles. It covers:
  - anon can read public columns but not private ones, `*`, or filters on email; anon can't call the RPCs;
  - a member can't read others' private columns, can read their own via RPC and can still update their own profile;
  - admin lookups are refused to members; exact-only email lookup works and partial input returns nothing;
  - venue presence: own row allowed, someone else's refused;
  - contacts: none while disabled; once enabled, own opponent plus officials but not other entrants;
  - officials see everyone in the event but nobody outside it; admins can look up and search;
  - an email-linked account resolves to its record;
  - import fill is admin-only and never overwrites.
- **Preflight check:** an unknown caller-rights policy that reads email makes the migration abort with its name, leaving access unchanged.
- **Browser, signed out, against the hosted (un-migrated) project:** the schedule renders (301 cards); the public column list returns 70 columns with no private fields; contact RPCs that don't exist yet degrade to "no contacts".
- **Automated checks:** `npm run check` (only the two pre-existing WP3 errors), full `vitest`, `vite build` and the undefined-reference gate.

## Deployment order

1. **Deploy the client first.** It works against the current database: it reads only public columns, and the missing RPCs degrade to "no contacts / no admin emails".
2. **Then apply `20261113180000_restrict_player_contact_columns.sql`** (after the WP3/WP7/WP8/WP9 migrations). If its preflight stops, rewrite the named policies or functions to use a `SECURITY DEFINER` helper and re-run it.
3. **Old cached app versions** that still request `select("*")` will get errors on player queries until they update. The service-worker update path handles this; ship the client a release ahead of the migration.
4. **New `players` columns** added later must be granted explicitly: `GRANT SELECT (col) ON players TO anon, authenticated`.

## Known limitations

- `tournament_registrations` has its own `email`/`phone` columns; their read policy wasn't audited here.
- Members can no longer see teammates' emails in team screens. That is intentional; phone contact goes through the tournament contacts feature.
- **Rollback:** `GRANT SELECT ON public.players TO anon, authenticated;` restores the old behaviour. The RPCs are harmless to leave in place.
