import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

afterEach(() => {
  cleanup();
});

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
  Plugins: {},
}));

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
  })),
}));

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: '11111111-2222-3333-4444-555555555555',
  email: 'test@example.com',
  nickname: 'TestPlayer',
  gender: 'M',
  level: 'Intermediate',
  hand: 'R',
  ...overrides,
});

export const createMockMatch = (overrides = {}) => ({
  id: '33333333-4444-5555-6666-777777777777',
  format: 'MS',
  score: [21, 15],
  player1_id: '11111111-2222-3333-4444-555555555555',
  player2_id: '22222222-3333-4444-5555-666666666666',
  winner_id: '11111111-2222-3333-4444-555555555555',
  tournament_id: '44444444-5555-6666-7777-888888888888',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockTournament = (overrides = {}) => ({
  id: '44444444-5555-6666-7777-888888888888',
  name: 'Test Tournament',
  format: 'Single Elimination',
  start_date: new Date().toISOString(),
  end_date: new Date(Date.now() + 86400000).toISOString(),
  status: 'ongoing',
  ...overrides,
});
