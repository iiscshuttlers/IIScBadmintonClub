# WC-07: admin issue sources and observability

Date: 14 November 2026 (Asia/Calcutta)  
State: local implementation complete; permission/staging acceptance remains part of WC-11

## Contract

- Missing officials, court/player conflicts, delayed matches, disputed friendly results, unresolved guest identities and local score-sync problems each link to a resolving screen.
- A delayed match is an estimate: `scheduled` or `pending`, not started, and at least 15 minutes past `scheduled_at`. It never moves a fixture automatically.
- A local queue read failure is "unknown", never zero. The UI also distinguishes permission denied, fetch unknown and a verified empty result.
- Score-sync coverage is explicitly device-local; offline queues on other devices are not observable from this client.
- Cards refetch on mount/focus and disappear after their authoritative count resolves.

## Evidence and limits

- `client/src/lib/adminActions.ts` contains the pure issue, delay and priority policy.
- `client/src/hooks/queries/useAdminActionItems.ts` reads current server sources and the device queue.
- `client/src/components/admin/AdminActionCards.tsx` renders resolving routes and separate denied/unknown/empty states.
- Unit and component coverage includes delay boundaries, conflict overrides, local visibility failure, permission denial and navigation.

This does not claim server-wide offline-device health. Tournament correction history remains available in the existing correction/audit surfaces; it is not misrepresented as an unresolved incident without an authoritative unresolved state.
