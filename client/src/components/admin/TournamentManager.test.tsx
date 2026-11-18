import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TournamentManager } from '@/components/admin/TournamentManager';
import * as tournamentService from '@/services/tournamentService';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { user: { id: 'admin1', email: 'admin@iisc.ac.in' } },
    isMainAdmin: true,
  }),
}));

vi.mock('@/contexts/AdminHistoryContext', () => ({
  useAdminHistory: () => ({
    recordAction: vi.fn(),
  }),
}));

vi.mock('@/contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@/services/tournamentService', () => ({
  fetchTournaments: vi.fn(),
  createTournament: vi.fn(),
  updateTournament: vi.fn(),
  deleteTournament: vi.fn(),
}));

vi.mock('@/components/admin/TournamentHeader', () => ({
  TournamentHeader: ({ selected }: any) => (
    <div data-testid="tournament-header">{selected?.name}</div>
  ),
}));

vi.mock('@/components/admin/TournamentSettingsTab', () => ({
  TournamentSettingsTab: () => (
    <div data-testid="tournament-settings-tab">Settings Tab Content</div>
  ),
}));

vi.mock('@/components/admin/TournamentBracketTab', () => ({
  TournamentBracketTab: () => (
    <div data-testid="tournament-bracket-tab">Bracket Tab Content</div>
  ),
}));

vi.mock('@/components/admin/TournamentRegistrationsPanel', () => ({
  TournamentRegistrationsPanel: () => <div data-testid="tournament-registrations-panel" />,
}));

vi.mock('@/components/admin/TournamentParticipantsTab', () => ({
  TournamentParticipantsTab: () => (
    <div data-testid="tournament-participants-tab">Participants Tab Content</div>
  ),
}));

const mockTournaments = [
  {
    id: 't1',
    name: 'IISc Open 2026',
    status: 'upcoming',
    format: 'singles',
    format_family: 'INDIVIDUAL',
    categories: ['MS', 'WS'],
    require_app_registration: true,
    created_at: new Date().toISOString(),
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('TournamentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders tournament name and default setup tab', async () => {
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue(mockTournaments as any);
    const wrapper = createWrapper();

    render(<TournamentManager />, { wrapper });

    expect(await screen.findByText('IISc Open 2026')).toBeInTheDocument();
    expect(screen.getByTestId('tournament-settings-tab')).toBeInTheDocument();
  });

  it('switches to the Draw tab (bracket) on clicking Draw', async () => {
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue(mockTournaments as any);
    const wrapper = createWrapper();

    render(<TournamentManager />, { wrapper });

    expect(await screen.findByText('IISc Open 2026')).toBeInTheDocument();

    const bracketTab = await screen.findByRole('tab', { name: /draw/i });
    fireEvent.click(bracketTab);

    expect(screen.getByTestId('tournament-bracket-tab')).toBeInTheDocument();
  });

  it('switches to the Players tab (participants) on clicking Players', async () => {
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue(mockTournaments as any);
    const wrapper = createWrapper();

    render(<TournamentManager />, { wrapper });

    expect(await screen.findByText('IISc Open 2026')).toBeInTheDocument();

    const participantsTab = await screen.findByRole('tab', { name: /players/i });
    fireEvent.click(participantsTab);

    expect(screen.getByTestId('tournament-participants-tab')).toBeInTheDocument();
  });

  it('renders empty state when no tournaments exist', async () => {
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue([]);
    const wrapper = createWrapper();

    render(<TournamentManager />, { wrapper });

    expect(
      await screen.findByText('No tournaments yet. Use New above to create one.')
    ).toBeInTheDocument();
  });

  it('opens the tab an old deep link points at', async () => {
    window.history.replaceState({}, '', '/tournament-admin?tab=participants');
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue(mockTournaments as any);
    render(<TournamentManager />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('tournament-participants-tab')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /players/i })).toHaveAttribute('aria-selected', 'true');
    window.history.replaceState({}, '', '/');
  });

  it('shows five tabs', async () => {
    vi.mocked(tournamentService.fetchTournaments).mockResolvedValue(mockTournaments as any);
    render(<TournamentManager />, { wrapper: createWrapper() });
    await screen.findByText('IISc Open 2026');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Setup', 'Players', 'Draw', 'Schedule', 'Wrap-up']);
  });
});
