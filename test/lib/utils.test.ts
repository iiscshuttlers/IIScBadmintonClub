import { describe, it, expect } from 'vitest';
import { cn, getBaseShareUrl } from '@/lib/utils';
import { getEloTier } from '@/lib/tiers';

describe('Utils', () => {
  describe('cn - className merger', () => {
    it('merges simple classes', () => {
      const result = cn('p-4', 'text-white');
      expect(result).toContain('p-4');
      expect(result).toContain('text-white');
    });

    it('handles conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
    });

    it('removes false values', () => {
      const result = cn('p-4', false && 'hidden', 'm-2');
      expect(result).not.toContain('hidden');
      expect(result).toContain('p-4');
      expect(result).toContain('m-2');
    });

    it('handles tailwind overrides correctly', () => {
      const result = cn('p-4 p-8');
      expect(result).toContain('p-8'); // Later value should win
    });
  });

  describe('getEloTier', () => {
    it('returns Bronze tier for low ELO', () => {
      const tier = getEloTier(800);
      expect(tier.name).toBe('Bronze');
      expect(tier.icon).toBe('🥉');
    });

    it('returns Silver tier for 1000-1199 ELO', () => {
      const tier = getEloTier(1050);
      expect(tier.name).toBe('Silver');
      expect(tier.icon).toBe('🥈');
    });

    it('returns Gold tier for 1200-1399 ELO', () => {
      const tier = getEloTier(1250);
      expect(tier.name).toBe('Gold');
      expect(tier.icon).toBe('🥇');
    });

    it('returns Platinum tier for 1400-1599 ELO', () => {
      const tier = getEloTier(1450);
      expect(tier.name).toBe('Platinum');
      expect(tier.icon).toBe('✨');
    });

    it('returns Diamond tier for 1600-1799 ELO', () => {
      const tier = getEloTier(1650);
      expect(tier.name).toBe('Diamond');
      expect(tier.icon).toBe('💎');
    });

    it('returns Grandmaster tier for 1800+ ELO', () => {
      const tier = getEloTier(1900);
      expect(tier.name).toBe('Grandmaster');
      expect(tier.icon).toBe('👑');
    });

    it('handles undefined ELO as Bronze (default)', () => {
      const tier = getEloTier(undefined);
      expect(tier.name).toBe('Bronze');
    });

    it('handles null ELO as Bronze (default)', () => {
      const tier = getEloTier(null);
      expect(tier.name).toBe('Bronze');
    });

    it('has correct styling properties', () => {
      const tier = getEloTier(1500);
      expect(tier).toHaveProperty('text');
      expect(tier).toHaveProperty('bg');
      expect(tier.text).toContain('text-');
      expect(tier.bg).toContain('bg-');
    });
  });

  describe('getBaseShareUrl', () => {
    it('returns correct base share URL', () => {
      const url = getBaseShareUrl();
      expect(url).toBe('https://iiscshuttlers.github.io/IIScBadmintonClub');
    });

    it('returns a valid URL format', () => {
      const url = getBaseShareUrl();
      expect(url).toMatch(/^https:\/\//);
    });
  });
});
