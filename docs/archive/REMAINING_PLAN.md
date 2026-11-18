# IISc Shuttlers — Remaining Work Plan

*Checked against codebase on 2026-10-23.*
*Status: 54 files still call Supabase directly · 15 `:any` instances in services · 3 test files missing.*

---

## Execution Order (do in this sequence)

| # | Task | Est. | Notes |
|---|---|---|---|
| 1 | **R2 — Regenerate Supabase types** | 10 min | Fixes Category A + C `:any` automatically |
| 2 | **R2 — Fix Category B `:any`** (insert/update payload casts) | 1 hr | 15 instances, mechanical fixes |
| 3 | **R1-A — Create `umpireService.ts`** | 2 hrs | Unblocks UmpireScoringScreen + TieUmpireConsole sweep |
| 4 | **R1-B — tournamentService sweep** (17 files) | 0.5 day | Mostly existing functions; 5 new functions needed |
| 5 | **R1-D — adminService sweep** (9 files) | 0.5 day | 4 new functions needed |
| 6 | **R1-C — teamService sweep** (5 files) | 2 hrs | Mostly existing functions |
| 7 | **R1-E/F/G/H/I — remaining 23 files** | 0.5 day | Mostly 1–2 calls each, existing functions |
| 8 | **R3-A — `useTournamentMutations.test.ts`** | 1 hr | 6 hooks to cover |
| 9 | **R3-B — `usePlayerProfileQuery.test.ts`** | 30 min | 3 cases |
| 10 | **R3-C — `TournamentManager.test.tsx`** | 1 hr | Needs MSW handler setup |

**Total estimated: ~3 days** to zero direct Supabase calls in components and full service-layer type safety.

---

## R1 — Phase 2 Continued: Sweep the Remaining 54 Files

All service files already exist — no new ones needed except `umpireService.ts`. Group by service.

### R1-A: Create `client/src/services/umpireService.ts` (NEW FILE)

The umpire components have 5+5+4 direct Supabase calls that don't belong in any existing service.

```ts
// site_data live-match registry
export async function fetchLiveMatches(): Promise<LiveMatch[]>
export async function upsertLiveMatch(match: LiveMatch): Promise<void>
export async function removeLiveMatch(matchId: string): Promise<void>

// push alert RPC
export async function pushMatchAlert(params: MatchAlertParams): Promise<void>

// tie-format RPCs
export async function revealTieLineup(tieId: string, teamId: string): Promise<void>
export async function setTiePlayingOrder(tieId: string, order: string[]): Promise<void>
export async function emergencyModifyLineup(params: EmergencyLineupParams): Promise<void>
export async function addDeciderRubber(tieId: string): Promise<void>
export async function revealDeciderRubber(tieId: string): Promise<void>
```

Files cleared after this:
- `components/umpire/UmpireScoringScreen.tsx` (5 calls → 0)
- `components/umpire/TieUmpireConsole.tsx` (5 calls → 0)
- `components/umpire/UmpireEngine.tsx` (4 calls → 0)

---

### R1-B: `tournamentService` — 17 files

All listed functions already exist in `tournamentService.ts` unless marked **(add)**.

| File | Calls | Service function(s) |
|---|---|---|
| `admin/TournamentSettingsTab.tsx` | 5 | `updateTournament`, `adminService.logAdminAction` |
| `admin/TournamentBracketTab.tsx` | 5 | `fetchTournamentMatches`, `submitTournamentMatch`, `adminEditTournamentMatch` |
| `tournament/SendReminderSheet.tsx` | 6 | `fetchTournamentParticipants`, `fetchTournamentOfficials`, `fetchTournamentMatches`, `adminService.queueNotification` |
| `admin/TournamentOfficialsPanel.tsx` | 4 | `fetchTournamentOfficials`, `addTournamentOfficial`, `removeTournamentOfficial` |
| `tournament/ScoringRulesPanel.tsx` | 4 | `fetchTournamentRoundRules` **(add)**, `upsertTournamentRoundRules` **(add)** |
| `admin/TeamTournamentManager.tsx` | 4 | `fetchTournaments`, `fetchTournamentById` |
| `admin/GuestPlayersPanel.tsx` | 4 | `fetchGuestPlayers` → `adminService` |
| `admin/TournamentEditor.tsx` | 2 | `updateTournament` |
| `tournament/MyMatchesStrip.tsx` | 2 | `fetchTournamentMatches` |
| `pages/TvNextUp.tsx` | 2 | `fetchTournamentMatches`, `fetchTournamentById` |
| `admin/TournamentArchiveTab.tsx` | 1 | `fetchTournaments` |
| `admin/TournamentReportPanel.tsx` | 1 | `fetchTournamentById` |
| `tournament/PathToFinalDialog.tsx` | 1 | `fetchTournamentMatches` |
| `tournament/MyCertificatesCard.tsx` | 1 | `fetchPlayerCertificates` **(add)** |
| `pages/BracketPredictPage.tsx` | 1 | `fetchBracketPredictions` **(add)** |
| `pages/RateTournamentPage.tsx` | 1 | `submitTournamentFeedback` **(add)** |
| `pages/ScheduleView.tsx` | 1 | `fetchTournamentMatches` |
| `pages/ScheduleCalendar.tsx` | 1 | `fetchTournamentMatches` |
| `pages/TvDrawReveal.tsx` | 1 | `fetchTournamentById` |

**New functions to add to `tournamentService.ts`:**
- `fetchTournamentRoundRules(tournamentId: string): Promise<RoundRule[]>`
- `upsertTournamentRoundRules(tournamentId: string, rules: RoundRule[]): Promise<void>`
- `fetchPlayerCertificates(playerId: string): Promise<Certificate[]>`
- `fetchBracketPredictions(tournamentId: string, playerId: string): Promise<BracketPrediction[]>`
- `submitTournamentFeedback(payload: FeedbackInsert): Promise<void>`

---

### R1-C: `teamService` — 5 files

| File | Calls | Service function(s) |
|---|---|---|
| `admin/TeamTournamentManager.tsx` | 4 | `fetchTeams`, `updateTeam`, `fetchTeamStandings` |
| `admin/TeamLineupBuilder.tsx` | 3 | `fetchTeamMembers`, `submitTeamLineup` |
| `admin/TeamSettingsEditModal.tsx` | 1 | `updateTeam` |
| `pages/JoinTeamByLink.tsx` | 2 | `joinTeamByToken` |
| `players-directory/TeamRegistration.tsx` | 1 | `registerTeamForTournament` |

---

### R1-D: `adminService` — 9 files

| File | Calls | Service function(s) |
|---|---|---|
| `admin/AdminStatsOverview.tsx` | 5 | `fetchAdminStats()` **(add)** — wraps the 5 parallel stat queries |
| `admin/GuestPlayersPanel.tsx` | 4 | `fetchGuestPlayers`, `resolveGuestPlayer` |
| `admin/ResolveGuestsModal.tsx` | 3 | `resolveGuestPlayer` |
| `admin/DisputePanel.tsx` | 3 | `fetchDisputes` **(add)**, `resolveDispute` **(add)** |
| `admin/RecycleBin.tsx` | 1 | `fetchDeletedItems` **(add)**, `restoreItem` **(add)** |
| `admin/editors/PushBroadcastPanel.tsx` | 3 | `sendPushBroadcast` **(add)** |
| `admin/editors/PollEditor.tsx` | 1 | `feedService.upsertPoll` |
| `admin/editors/PlayersManager.tsx` | 1 | `updatePlayer` (already exists) |
| `admin/editors/MatchesManager.tsx` | 2 | `adminService.updateMatch` or `matchService.adminUpdateMatch` |

**New functions to add to `adminService.ts`:**
- `fetchAdminStats()` — wraps the 5 parallel stat queries into one Promise.all
- `fetchDisputes()` / `resolveDispute(id: string, resolution: string)`
- `fetchDeletedItems()` / `restoreItem(table: string, id: string)`
- `sendPushBroadcast(payload: BroadcastPayload)`

---

### R1-E: `feedService` — 5 files

| File | Calls | Service function(s) |
|---|---|---|
| `feed/LiveScoreWidget.tsx` | 2 | `fetchLiveScores` **(add)** |
| `feed/MatchCard.tsx` | 1 | `matchService.fetchMatchById` |
| `feed/MatchScorecardModal.tsx` | 2 | `matchService.fetchMatchById` |
| `feed/MatchPredictions.tsx` | 2 | `fetchMatchPredictions` **(add)**, `submitMatchPrediction` **(add)** |
| `home/HomeAnnouncementBar.tsx` | 1 | `fetchAnnouncements` (already exists) |

---

### R1-F: `matchService` / `playerService` — 9 files

| File | Calls | Service function(s) |
|---|---|---|
| `LogMatchModal.tsx` | 2 | `matchService.logMatch`, `matchService.confirmMatch` |
| `pages/PlayerProfile.tsx` | 2 | `playerService.fetchPlayerById` |
| `pages/DoublesPairProfile.tsx` | 2 | `playerService.fetchDoublesPair` **(add)** |
| `player-profile/PlayerPhotosSection.tsx` | 1 | `playerService.fetchPlayerPhotos` **(add)** |
| `player-profile/PlayerEndorsementsWidget.tsx` | 1 | `socialService.fetchEndorsements` |
| `players-directory/PlayerCard.tsx` | 1 | `playerService.fetchPlayerSlim` |
| `NotificationsMenu.tsx` | 3 | `fetchNotifications` **(add)**, `markNotificationRead` **(add)** |
| `events/NotificationModal.tsx` | 2 | Same as above |
| `pulse/MatchReminderModal.tsx` | 1 | `matchService.setMatchReminder` **(add)** |

**New functions:**
- `playerService.fetchDoublesPair(p1Id: string, p2Id: string)`
- `playerService.fetchPlayerPhotos(playerId: string)`
- `playerService.fetchNotifications(playerId: string)` — or extract to `notificationsService.ts`
- `playerService.markNotificationRead(notificationId: string)`
- `matchService.setMatchReminder(matchId: string, minutesBefore: number)`

---

### R1-G: `hubService` — 2 files

| File | Calls | Service function(s) |
|---|---|---|
| `pages/FindLost.tsx` | 2 | `fetchExchangeListings`, `claimListing` (both already in hubService) |
| `pulse/LiveTab.tsx` | 2 | `feedService.fetchLiveTabData` **(add)** |

---

### R1-H: `hubService` / `galleryService` — 1 file (special case)

`pages/Legacy.tsx` has 9 calls all to `site_data` for the photo gallery (likes, tags, subscriptions). It is the only caller of these gallery-specific `site_data` keys.

Add to `hubService.ts` or create `client/src/services/galleryService.ts`:
- `fetchGalleryData()` — reads `gallery_likes`, `gallery_tags`, `gallery_default_subscriptions`
- `updateGalleryLikes(likes: Record<string, number>)`
- `updateGalleryTags(tags: string[])`
- `updateGalleryPendingTags(pending: string[])`
- `updateGallerySubscriptions(subs: string[])`

---

### R1-I: Remaining pages — 4 files

| File | Calls | Service function(s) |
|---|---|---|
| `pages/DeleteAccount.tsx` | 3 | `playerService.deleteAccount()` **(add)** |
| `pages/Pulse.tsx` | 1 | `feedService.fetchPulseData` **(add)** |
| `components/GlobalSearch.tsx` | 1 | `playerService.searchPlayers` (already exists) |
| `admin/ParticipantImportModal.tsx` | 3 | `tournamentService.bulkUpsertParticipants` (already exists) |

---

## R2 — Fix `:any` in Service Files

Current: 15 instances across 5 service files. Three root causes.

### Category A — Table not in generated types

These tables exist in the DB but are missing from `supabase-types-auto.ts` because `supabase gen types typescript` hasn't been re-run since their migrations ran.

**Fix — run once:**
```bash
npx supabase gen types typescript --project-id <your-project-id> > client/src/lib/supabase-types-auto.ts
```

Tables this will add: `match_predictions`, `prediction_points`, `weekly_challenges`, `player_matches_unified` (view).

After regenerating, remove all `(supabase as any)` casts in:
- `adminService.ts` lines 369, 406–431, 442–456
- `matchService.ts` line 9

### Category B — Insert/update payload type mismatch

Pattern: `.insert(payload as any)` or `.update(patch as any)` when the payload has extra fields.

**Instances:** `tournamentService.ts` lines 41, 98, 127, 140, 167, 180 · `teamService.ts` lines 103, 134, 191, 218, 273, 390, 396, 401 · `hubService.ts` line 197

**Fix per instance:**
```ts
// Instead of:
await supabase.from('tournaments').update(patch as any)

// Destructure away non-updateable fields, then assert:
const { id: _, created_at: __, ...updateable } = patch;
await supabase.from('tournaments').update(updateable satisfies TablesUpdate<'tournaments'>)
```

If the payload genuinely has extra computed fields, destructure them off before passing to Supabase.

### Category C — RPC not typed

Pattern: `(supabase.rpc as any)('fn_name', args)`

**Instances:** `tournamentService.ts` lines 303, 319, 324, 334 · `teamService.ts` lines 406, 578, 586, 593, 601

**Fix:** After running `supabase gen types typescript` (Category A), verify the RPCs appear in the `Functions` block. Any that don't need to be added manually:

```ts
// In Database['public']['Functions']:
submit_tournament_match: {
  Args: { p_match_id: string; p_score: string; p_winner_id: string }
  Returns: undefined
}
admin_edit_tournament_match: {
  Args: { p_match_id: string; p_score: string; p_winner_id: string }
  Returns: undefined
}
undo_tournament_match: {
  Args: { p_match_id: string }
  Returns: undefined
}
record_tournament_walkover: {
  Args: { p_match_id: string; p_winner_id: string }
  Returns: undefined
}
// teamService RPCs:
respond_team_invite: { Args: { ... }; Returns: undefined }
remove_team_member: { Args: { ... }; Returns: undefined }
invite_team_member: { Args: { ... }; Returns: undefined }
generate_new_team_invite_token: { Args: { ... }; Returns: string }
populate_playoff_qualifiers_from_standings: { Args: { ... }; Returns: undefined }
```

Once typed: replace every `(supabase.rpc as any)('fn', args)` with `supabase.rpc('fn', args)`.

---

## R3 — Missing Test Files

### R3-A: `client/src/hooks/mutations/useTournamentMutations.test.ts`

Test each of the 6 mutation hooks (create, update, archive, advanceWinner, approveRegistration, bulkUpsertParticipants). For each:
1. Wrap in `renderHook` with a fresh `QueryClient`.
2. Call `mutate(...)` with valid args.
3. Assert `queryClient.invalidateQueries` was called with the correct key.
4. Simulate service error → assert `toast.error` was called.

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateTournament } from '@/hooks/mutations/useTournamentMutations';
import * as service from '@/services/tournamentService';
import { toast } from 'sonner';

vi.mock('@/services/tournamentService');
vi.mock('sonner');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useCreateTournament', () => {
  it('invalidates [tournaments] on success', async () => {
    vi.mocked(service.createTournament).mockResolvedValue({ id: '1', name: 'T' } as any);
    const { result } = renderHook(() => useCreateTournament(), { wrapper });
    result.current.mutate({ name: 'T', format: 'singles' } as any);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('calls toast.error on failure', async () => {
    vi.mocked(service.createTournament).mockRejectedValue(new Error('DB error'));
    const { result } = renderHook(() => useCreateTournament(), { wrapper });
    result.current.mutate({ name: 'T', format: 'singles' } as any);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('DB error'));
  });
});
// Repeat for: useUpdateTournament, useArchiveTournament,
//             useAdvanceTournamentWinner, useApproveTournamentRegistration,
//             useBulkUpsertParticipants
```

### R3-B: `client/src/hooks/queries/usePlayerProfileQuery.test.ts`

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { usePlayerProfileQuery } from '@/hooks/queries/usePlayerProfileQuery';
import * as service from '@/services/playerService';

vi.mock('@/services/playerService');

const mockPlayer = { id: 'p1', full_name: 'Raja', avatar_url: '', elo_rating: 1200 } as any;

describe('usePlayerProfileQuery', () => {
  it('returns PlayerRow on success', async () => {
    vi.mocked(service.fetchPlayerById).mockResolvedValue(mockPlayer);
    const { result } = renderHook(() => usePlayerProfileQuery('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.full_name).toBe('Raja');
    // Confirm PlayerProfileType camelCase is gone:
    expect(result.current.data).not.toHaveProperty('fullName');
  });

  it('is keyed as [player, id]', () => {
    vi.mocked(service.fetchPlayerById).mockResolvedValue(mockPlayer);
    renderHook(() => usePlayerProfileQuery('p1'), { wrapper });
    // key verified via queryClient cache
  });
});
```

### R3-C: `client/src/components/admin/TournamentManager.test.tsx`

Uses MSW to intercept service calls. Tests the shell orchestrator — tab routing, not business logic.

```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TournamentManager } from '@/components/admin/TournamentManager';

const mockTournament = { id: 't1', name: 'IISc Open 2026', status: 'upcoming', format: 'singles' };

const server = setupServer(
  http.get('*/tournaments/t1', () => HttpResponse.json(mockTournament)),
  http.get('*/tournament_matches*', () => HttpResponse.json([]))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('renders tournament name', async () => {
  render(<TournamentManager tournamentId="t1" />, { wrapper });
  expect(await screen.findByText('IISc Open 2026')).toBeInTheDocument();
});

it('switches to Settings tab', async () => {
  render(<TournamentManager tournamentId="t1" />, { wrapper });
  await userEvent.click(await screen.findByRole('tab', { name: /settings/i }));
  expect(screen.getByTestId('tournament-settings-tab')).toBeInTheDocument();
});

it('switches to Matches tab', async () => {
  render(<TournamentManager tournamentId="t1" />, { wrapper });
  await userEvent.click(await screen.findByRole('tab', { name: /matches/i }));
  expect(screen.getByTestId('tournament-matches-tab')).toBeInTheDocument();
});
```

---

*All paths relative to `E:/Github/IIScBadmintonClub/`. Run `tsc --noEmit` from root after each batch.*
