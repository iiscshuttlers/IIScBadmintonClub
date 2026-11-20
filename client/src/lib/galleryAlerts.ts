/**
 * Gallery photo alerts (migration 20261121100000_gallery_album_alerts).
 *
 * Alerts are on by default for every album, including albums added later.
 * A member turns them off everywhere with `players.pref_notify_gallery`, or
 * per album with a `gallery_album_subscriptions` row. Admins can mute an album
 * for everyone (`site_data.gallery_muted_albums`); a member's explicit "on"
 * still wins. The database trigger applies the same rule when it picks
 * recipients, so this file and that trigger must agree.
 */

export interface AlbumOverride {
  album: string;
  subscribed: boolean;
}

export interface AlbumAlertState {
  /** players.pref_notify_gallery */
  enabled: boolean;
  /** album → explicit choice */
  overrides: Record<string, boolean>;
  /** albums an admin muted for everyone */
  muted: readonly string[];
}

export function overridesByAlbum(rows: readonly AlbumOverride[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.album] = r.subscribed;
  return out;
}

/** Whether new photos in `album` reach this member. */
export function albumAlertOn(album: string, state: AlbumAlertState): boolean {
  if (!state.enabled) return false;
  if (Object.prototype.hasOwnProperty.call(state.overrides, album)) return state.overrides[album];
  return !state.muted.includes(album);
}

/** Muted for everyone and the member hasn't turned it back on. */
export function albumMutedByAdmin(album: string, state: AlbumAlertState): boolean {
  return state.muted.includes(album) && state.overrides[album] !== true;
}

/** "BPL-2024" → "BPL 2024" (matches the label in the alert text). */
export function albumLabel(album: string): string {
  return album.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Albums that can receive alerts: those with photos stored in site_data, newest names first. */
export function alertableAlbums(photos: readonly { subfolder?: string | null; category?: string | null }[]) {
  const byAlbum = new Map<string, string>();
  for (const p of photos) {
    const album = p.subfolder ?? "";
    if (album.trim() && !byAlbum.has(album)) byAlbum.set(album, p.category ?? "");
  }
  return Array.from(byAlbum, ([album, category]) => ({ album, category })).sort((a, b) =>
    b.album.localeCompare(a.album, undefined, { numeric: true }),
  );
}

export function parseAlbumList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
}

// Before alerts were stored on the server, the bell lived in localStorage.
export const LEGACY_SUBSCRIBED_KEY = "gallery_subscriptions";
export const LEGACY_UNSUBSCRIBED_KEY = "gallery_unsubscriptions";

/** Choices a member made with the old browser-only bell, to carry over once. */
export function readLegacyAlbumChoices(storage: Pick<Storage, "getItem">): AlbumOverride[] {
  const read = (key: string) => {
    try {
      return parseAlbumList(JSON.parse(storage.getItem(key) || "[]"));
    } catch {
      return [];
    }
  };
  const off = new Set(read(LEGACY_UNSUBSCRIBED_KEY));
  const on = read(LEGACY_SUBSCRIBED_KEY).filter((a) => !off.has(a));
  return [...on.map((album) => ({ album, subscribed: true })), ...[...off].map((album) => ({ album, subscribed: false }))];
}
