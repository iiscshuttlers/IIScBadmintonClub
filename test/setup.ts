import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Node 26 exposes an incomplete experimental global localStorage unless it is
// started with --localstorage-file. Keep tests deterministic with an in-memory
// Storage implementation owned by each test worker.
const storageValues = new Map<string, string>();
const storageMock: Storage = {
  get length() { return storageValues.size; },
  clear: () => storageValues.clear(),
  getItem: (key) => storageValues.get(key) ?? null,
  key: (index) => [...storageValues.keys()][index] ?? null,
  removeItem: (key) => { storageValues.delete(key); },
  setItem: (key, value) => { storageValues.set(String(key), String(value)); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });

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

// lib/firebase.ts calls getStorage() at import time; without these mocks the
// real SDK throws "No Firebase App" into every test that imports it.
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn(),
  onMessage: vi.fn(() => () => {}),
  deleteToken: vi.fn(),
  isSupported: vi.fn(async () => false),
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
