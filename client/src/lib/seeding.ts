/**
 * Published seeds. Every participant row stores a `seed` (it is the full draw
 * order, 1..N, used to place players), but only the top seeds are public,
 * as in BWF draws: fewer than 16 entries → 2, 16–31 → 4, 32–63 → 8, 64+ → 16.
 * Below 4 entries there are no seeds. Everyone else shows no number, so the
 * full order stays private.
 */

export function publishedSeedCount(entries: number): number {
  if (entries >= 64) return 16;
  if (entries >= 32) return 8;
  if (entries >= 16) return 4;
  if (entries >= 4) return 2;
  return 0;
}

export interface SeedEntry {
  seed: number | null;
  player_id?: string | null;
  partner_id?: string | null;
  display_name?: string | null;
}

export interface PublishedSeeds {
  /** Seed by player id (both players of a doubles pair). */
  byId: Map<string, number>;
  /** Seed by shown name, lower-cased (guest entries have no player id). */
  byName: Map<string, number>;
  count: number;
}

const nameKey = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** The published seeds of one category's entries. */
export function publishedSeeds(entries: SeedEntry[]): PublishedSeeds {
  const count = publishedSeedCount(entries.length);
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const e of entries) {
    if (e.seed == null || e.seed < 1 || e.seed > count) continue;
    for (const id of [e.player_id, e.partner_id]) if (id) byId.set(id, e.seed);
    const key = nameKey(e.display_name);
    if (key) byName.set(key, e.seed);
  }
  return { byId, byName, count };
}

/** Seed of one side of a match (any of its player ids, else its label), or null. */
export function seedForSide(
  seeds: PublishedSeeds | null | undefined,
  ids: Array<string | null | undefined>,
  label: string | null | undefined,
): number | null {
  if (!seeds) return null;
  for (const id of ids) {
    const s = id ? seeds.byId.get(id) : undefined;
    if (s != null) return s;
  }
  return seeds.byName.get(nameKey(label)) ?? null;
}
