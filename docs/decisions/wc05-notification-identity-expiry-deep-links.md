# WC-05: notification identity, expiry and deep links

Date: 14 November 2026 (Asia/Calcutta)  
State: implementation complete and locally source-qualified; isolated PostgreSQL replay and real provider/device acceptance remain open

## Behavior contract

- Every authoritative queued match push is identified by match, event type, event revision and recipient set.
- Retrying the same authoritative revision cannot create a second queue identity.
- A newer schedule revision cancels the older pending schedule push for that recipient.
- Match calls expire after 10 minutes, schedule changes after 30 minutes and results after 24 hours. The dispatcher cancels expired rows before contacting a provider.
- Authoritative canonical links win over legacy notification type/action fallbacks.
- Native notification taps, warm web-client messages and cold web opens resolve the same safe internal destination.
- Protocol-relative and backslash paths are rejected; the Play Store is the only external notification target.

## Implementation evidence

- `supabase/migrations/20261115130000_notification_identity_expiry.sql` adds queue identity, expiry, uniqueness and schedule supersession.
- `supabase/functions/dispatch-scheduled-notifications/index.ts` quarantines expired rows and carries event identity plus canonical links to FCM.
- `client/src/lib/notificationDeepLinks.ts` is the shared safe route resolver.
- `client/src/hooks/useNotificationDeepLinks.ts` handles native actions and warm service-worker messages independently of authentication/token registration timing.
- `client/public/firebase-messaging-sw.js` uses canonical links for both focused clients and cold opens.
- `client/src/hooks/usePushNotifications.ts` now removes only its own listeners, preventing token-registration cleanup from removing the navigation listener.

No hosted migration, edge-function deployment, real push send or production mutation was performed.

## Local acceptance evidence

| Check | Scope | Result |
| --- | --- | --- |
| Notification/deep-link and release-gate Vitest slice | Canonical precedence, unsafe paths, cold native and warm web routing, queue identity/expiry static contract | Passed |
| Full Vitest suite | 76 files / 609 tests, including the existing offline and Firebase warning-path coverage | Passed |
| `npm run check` | TypeScript and undefined-reference gate | Passed |
| `npm run build` | Production bundle | Passed |
| `git diff --check` | Whitespace-error gate | Passed (line-ending notices only) |

## Remaining qualification

- Replay the new migration and updated `following_targeted_alerts_assertions.sql` in an approved isolated PostgreSQL/Supabase environment.
- Deploy to staging and verify FCM/APNs/Web Push provider acceptance, expired-row suppression and dead-token deletion with non-production tokens.
- Exercise cold start, warm foreground/background tap and process-death recovery on Android hardware/emulator.

