/**
 * Limits and waitlist for in-app registration (pure; mirrored in SQL by
 * save_my_tournament_entries / organiser_save_entry).
 *
 * - tournaments.max_events_per_player is checked for BOTH members of a pair.
 * - tournament_category_settings.max_entries counts rows (pairs), not players.
 */
import { rowHas, type EntryRow, type WaitlistRow } from "./partners";

/** Categories a player is in (entered or waitlisted). */
export function playerCategories(rows: EntryRow[], waitlist: WaitlistRow[], playerId: string): string[] {
  const cats = new Set<string>();
  rows.forEach((r) => rowHas(r, playerId) && cats.add(r.category));
  waitlist.forEach((w) => rowHas(w, playerId) && cats.add(w.category));
  return [...cats];
}

/**
 * Players (of `playerIds`) who would exceed `maxEvents` by being added to
 * `category`. Already being in that category doesn't count twice.
 */
export function overEventsLimit(
  rows: EntryRow[],
  waitlist: WaitlistRow[],
  playerIds: (string | null | undefined)[],
  category: string,
  maxEvents: number | null | undefined,
): string[] {
  if (!maxEvents || maxEvents <= 0) return [];
  return playerIds.filter((id): id is string => {
    if (!id) return false;
    const cats = playerCategories(rows, waitlist, id);
    if (cats.includes(category)) return false;
    return cats.length + 1 > maxEvents;
  });
}

export function categoryFull(rowCount: number, maxEntries: number | null | undefined): boolean {
  return !!maxEntries && maxEntries > 0 && rowCount >= maxEntries;
}

/** 1-based waitlist position of a player in a category, or null. Rows must be in join order. */
export function waitlistPosition(waitlist: WaitlistRow[], category: string, playerId: string): number | null {
  const inCat = waitlist.filter((w) => w.category === category);
  const idx = inCat.findIndex((w) => rowHas(w, playerId));
  return idx < 0 ? null : idx + 1;
}
