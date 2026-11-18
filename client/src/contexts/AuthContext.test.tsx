import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: vi.fn().mockReturnValue({
    session: null,
    loading: false,
  }),
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: vi.fn(),
}));

vi.mock('@/lib/biometricAuth', () => ({
  isBiometricEnabled: vi.fn().mockReturnValue(false),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('provides default unauthenticated state when no session exists', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isMainAdmin).toBe(false);
    expect(result.current.isMasterAdmin).toBe(false);
    expect(result.current.isUmpire).toBe(false);
  });
});
