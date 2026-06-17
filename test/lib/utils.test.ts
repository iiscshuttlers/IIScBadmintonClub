import { describe, it, expect } from 'vitest';
import { cn, getEloTier, getBaseShareUrl } from '@/lib/utils';

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
      expect(tier.icon).toBe('b');
    });

    it('returns Silver tier for 1000-1299 ELO', () => {
      const tier = getEloTier(1200);
      expect(tier.name).toBe('Silver');
      expect(tier.icon).toBe('s');
    });

    it('returns Gold tier for 1300-1599 ELO', () => {
      const tier = getEloTier(1500);
      expect(tier.name).toBe('Gold');
      expect(tier.icon).toBe('g');
    });

    it('returns Platinum tier for 1600-1899 ELO', () => {
      const tier = getEloTier(1750);
      expect(tier.name).toBe('Platinum');
      expect(tier.icon).toBe('p');
    });

    it('returns Diamond tier for 1900-2199 ELO', () => {
      const tier = getEloTier(2000);
      expect(tier.name).toBe('Diamond');
      expect(tier.icon).toBe('d');
    });

    it('returns Grandmaster tier for 2200+ ELO', () => {
      const tier = getEloTier(2500);
      expect(tier.name).toBe('Grandmaster');
      expect(tier.icon).toBe('gm');
    });

    it('handles undefined ELO as 1200 (default)', () => {
      const tier = getEloTier(undefined);
      expect(tier.name).toBe('Silver'); // 1200 = Silver
    });

    it('handles null ELO as 1200 (default)', () => {
      const tier = getEloTier(null);
      expect(tier.name).toBe('Silver');
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
      expect(url).toBe('https://iiscshuttlers.github.io/iiscshuttlers');
    });

    it('returns a valid URL format', () => {
      const url = getBaseShareUrl();
      expect(url).toMatch(/^https:\/\//);
    });
  });
});
