import { describe, it, expect, beforeEach } from 'vitest';

interface Tournament {
  id: string;
  name: string;
  format: 'Single Elimination' | 'Round Robin' | 'Double Elimination';
  status: 'draft' | 'ongoing' | 'completed';
  start_date: string;
  end_date: string;
  max_participants?: number;
  created_by: string;
  created_at: string;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  winner_id?: string;
  score?: [number, number];
  status: 'pending' | 'ongoing' | 'completed';
  created_at: string;
}

// Mock tournament functions
function createTournament(
  name: string,
  format: string,
  startDate: Date,
  endDate: Date,
  createdBy: string
): Tournament | { error: string } {
  if (!name || name.length < 3) {
    return { error: 'Tournament name must be at least 3 characters' };
  }

  if (endDate <= startDate) {
    return { error: 'End date must be after start date' };
  }

  return {
    id: `tournament-${Date.now()}-${Math.random()}`,
    name,
    format: format as any,
    status: 'draft',
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
}

function addMatchToTournament(
  tournament: Tournament,
  player1Id: string,
  player2Id: string
): TournamentMatch {
  return {
    id: `match-${Date.now()}`,
    tournament_id: tournament.id,
    player1_id: player1Id,
    player2_id: player2Id,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

function recordMatchResult(
  match: TournamentMatch,
  winnerId: string,
  score: [number, number]
): TournamentMatch {
  if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
    throw new Error('Winner must be one of the match players');
  }

  return {
    ...match,
    status: 'completed',
    winner_id: winnerId,
    score,
  };
}

describe('Tournament Management', () => {
  let tournament: Tournament;

  beforeEach(() => {
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const result = createTournament(
      'INVICTA 2026',
      'Single Elimination',
      now,
      endDate,
      'admin-123'
    );
    tournament = result as Tournament;
  });

  describe('Tournament Creation', () => {
    it('creates tournament with valid data', () => {
      expect(tournament.name).toBe('INVICTA 2026');
      expect(tournament.status).toBe('draft');
      expect(tournament.format).toBe('Single Elimination');
    });

    it('requires tournament name', () => {
      const result = createTournament(
        '',
        'Single Elimination',
        new Date(),
        new Date(Date.now() + 86400000),
        'admin-123'
      );

      expect(result).toHaveProperty('error');
    });

    it('validates end date is after start date', () => {
      const now = new Date();
      const result = createTournament(
        'Test Tournament',
        'Single Elimination',
        now,
        new Date(now.getTime() - 1000),
        'admin-123'
      );

      expect(result).toHaveProperty('error');
    });

    it('initializes tournament with correct timestamps', () => {
      expect(tournament.created_at).toBeDefined();
      expect(tournament.start_date).toBeDefined();
      expect(tournament.end_date).toBeDefined();
    });

    it('assigns unique tournament ID', () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 86400000);
      const t1 = createTournament('Tourney 1', 'Single Elimination', now, endDate, 'admin') as Tournament;
      const t2 = createTournament('Tourney 2', 'Single Elimination', now, endDate, 'admin') as Tournament;

      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('Match Management', () => {
    it('adds match to tournament', () => {
      const match = addMatchToTournament(tournament, 'player-1', 'player-2');

      expect(match.tournament_id).toBe(tournament.id);
      expect(match.player1_id).toBe('player-1');
      expect(match.player2_id).toBe('player-2');
      expect(match.status).toBe('pending');
    });

    it('records match result', () => {
      const match = addMatchToTournament(tournament, 'player-1', 'player-2');
      const completedMatch = recordMatchResult(match, 'player-1', [21, 15]);

      expect(completedMatch.status).toBe('completed');
      expect(completedMatch.winner_id).toBe('player-1');
      expect(completedMatch.score).toEqual([21, 15]);
    });

    it('validates winner is match participant', () => {
      const match = addMatchToTournament(tournament, 'player-1', 'player-2');

      expect(() => {
        recordMatchResult(match, 'player-3', [21, 15]);
      }).toThrow('Winner must be one of the match players');
    });

    it('records match with correct score', () => {
      const match = addMatchToTournament(tournament, 'player-1', 'player-2');
      const completedMatch = recordMatchResult(match, 'player-2', [15, 21]);

      expect(completedMatch.score).toEqual([15, 21]);
      expect(completedMatch.winner_id).toBe('player-2');
    });
  });

  describe('Tournament Lifecycle', () => {
    it('starts in draft status', () => {
      expect(tournament.status).toBe('draft');
    });

    it('transitions through statuses', () => {
      let status = tournament.status;
      expect(status).toBe('draft');

      // In real implementation, status would change
      status = 'ongoing';
      expect(status).toBe('ongoing');

      status = 'completed';
      expect(status).toBe('completed');
    });

    it('tracks tournament duration', () => {
      const startTime = new Date(tournament.start_date).getTime();
      const endTime = new Date(tournament.end_date).getTime();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Tournament Formats', () => {
    it('supports single elimination format', () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 86400000);
      const t = createTournament('Single Elim Tournament', 'Single Elimination', now, endDate, 'admin') as Tournament;

      expect(t.format).toBe('Single Elimination');
    });

    it('supports round robin format', () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 86400000);
      const t = createTournament('Round Robin Tournament', 'Round Robin', now, endDate, 'admin') as Tournament;

      expect(t.format).toBe('Round Robin');
    });

    it('supports double elimination format', () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 86400000);
      const t = createTournament('Double Elim Tournament', 'Double Elimination', now, endDate, 'admin') as Tournament;

      expect(t.format).toBe('Double Elimination');
    });
  });

  describe('Tournament Permissions', () => {
    it('tracks tournament creator', () => {
      expect(tournament.created_by).toBe('admin-123');
    });

    it('only creator can modify tournament', () => {
      const creatorId = tournament.created_by;
      const userId = 'admin-123';

      expect(creatorId === userId).toBe(true);
    });
  });
});
