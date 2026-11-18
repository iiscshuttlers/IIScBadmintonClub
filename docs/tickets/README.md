# World-class roadmap — open tickets

Generated 14 November 2026 from [`world-class-experience-roadmap.md`](../world-class-experience-roadmap.md) and the [evidence ledger](../world-class-evidence-ledger.md). Each ticket below is still open; locally completed work is not repeated here. "Done" means dated evidence in the ledger, not merged source.

Status key: **Blocked** = waiting on an external prerequisite · **Ready** = can start now · **Decision** = needs a product/owner choice first.

| ID | Title | Status | Owner (role) | Estimate |
| --- | --- | --- | --- | --- |
| WC-11a | Staging migration replay and role matrix | Blocked: staging project | Engineering + release owner | 2–3 d |
| WC-01 | Physical Android scoring recovery | Blocked: device | Engineering | 1–2 d |
| WC-05b | Push provider acceptance on device | Blocked: staging + device | Engineering + release owner | 1 d |
| WC-09b | Venue screen rehearsal and two-hour soak | Blocked: venue screen | Venue operator + engineering | 1 d + soak |
| WC-10 | Route-specific public metadata | Decision: hosting | Web/release owner | 1 d decision; 2–5 d build |
| WC-08b | Story permissions and walkover policy | Decision + staging | Editorial owner + engineering | 1–2 d |
| WC-11 | Controlled tournament rehearsal | Blocked: all of the above | Release owner | 2–3 d |

---

## WC-11a — Staging migration replay and role matrix

- **Scope:** Replay the full pending migration chain (through `20261115130000_notification_identity_expiry.sql`) and all `supabase/tests` assertions against an approved isolated Supabase project or branch. Then exercise public visitor, member, assigned official, organiser and admin against every changed protected operation.
- **Prerequisite:** A dedicated staging project or branch. Never use production as staging, and never run a blanket `supabase db push`.
- **Acceptance:** Every migration applies cleanly from the recorded baseline. Assertions pass. Denied operations return permission errors rather than empty successes. The contact-privacy restriction order from `decisions/player-contact-privacy.md` is rehearsed.
- **Evidence:** Command log, schema baseline identifier, role/operation matrix with results.

## WC-01 — Physical Android scoring recovery

- **Scope:** On a supported phone or emulator, start a match, score offline, then background the app, force-stop it, reopen, reconnect and finish. Repeat with two scorers to check takeover and conflict handling. Check that hardware Back restores tab, filter and list context.
- **Acceptance:** No acknowledged point is lost. Exactly one final result is written. A stale writer is rejected. Back returns to the prior context.
- **Evidence:** Device model/OS, build number, transcript or screen recording, server rows before and after.

## WC-05b — Push provider acceptance on device

- **Scope:** Deploy the qualified dispatcher to staging and use non-production tokens. Cover the match call, court/time change, final result and corrected result events. Overlapping follows must produce one alert. Test cold and warm start into canonical routes, plus a dead token.
- **Acceptance:** One logical alert per event. A rescheduled match sends no obsolete reminder. Each alert opens the right screen. Provider acceptance and device receipt are recorded separately.
- **Never** record live push tokens in evidence.

## WC-09b — Venue screen rehearsal and two-hour soak

- **Scope:** Run `/tournaments/:id/venue` on the actual hall screen at viewing distance, in both single-court and multi-court layouts. Test fullscreen refusal, sleep/wake, and a two-hour soak with match transitions and network loss/recovery.
- **Acceptance:** Names and scores can be read from the back row. A stale banner appears within the configured threshold. Reconnect replaces stale state. Memory and subscription counts stay flat across the soak.
- **Evidence:** Screen size/resolution, photos, browser memory snapshots at 0/60/120 minutes.

## WC-10 — Route-specific public metadata

- **Finding:** Deep tournament/match URLs on current GitHub Pages hosting return HTTP 404 with generic root metadata, so crawlers cannot produce rich previews.
- **Decision needed:** Choose one:
  - (a) build-time prerender of public tournament/match pages
  - (b) edge function or host with rewrites (e.g. Netlify/Cloudflare)
  - (c) accept generic previews.
- **Acceptance (if a or b):** A freshly shared URL returns 200 with route-specific title, description and image. Private/draft pages reveal nothing through metadata. Legacy links and the base path still work.

## WC-08b — Story permissions and walkover policy

- **Built locally:** An admin review/publish/withdraw editor and a public story section on the Results tab. Items are re-checked against live results, and corrected facts are withheld automatically. Stored in `site_data` (`tournament_story:<id>`).
- **Open:**
  1. Publish and withdraw on staging with an admin account.
  2. Decide whether non-admin organisers may publish. The current `site_data` policy is admin-only; allowing organisers needs an RPC or a dedicated table.
  3. Decide whether a walkover final produces a champion item. Walkovers are currently excluded.
  4. Optional day-summary story type, using the event timezone and actual completion times.
- **Acceptance:** Drafts never reach the public read. A corrected final hides the old champion within one refresh. Every item links to its supporting match.

## WC-11 — Controlled tournament rehearsal

- **Scope:** Run a full rehearsal event with player, umpire, organiser and spectator roles. Include a screen-reader pass (TalkBack and one desktop reader), 320 px, 200% zoom, reduced motion, and rerun the performance baseline on the release commit.
- **Acceptance:** Every ledger row involved reaches "Staging verified". Unresolved limitations have recorded sign-off before any broad release.
