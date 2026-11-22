/**
 * Gallery photo alerts (migration 20261121150000_gallery_album_alerts).
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

/** Writes one settings change needs: the gallery switch, album choices to save, album choices to drop. */
export interface AlertPlan {
  /** New value for players.pref_notify_gallery, when it changes. */
  enable?: boolean;
  set: AlbumOverride[];
  /** Albums to put back to the default (delete their row). */
  clear: string[];
}

/** "All albums" / "3 of 5 albums" / "Off": what the gallery row shows. */
export function albumAlertSummary(albums: readonly string[], state: AlbumAlertState): string {
  if (!state.enabled) return "Off";
  if (albums.length === 0) return "On";
  const on = albums.filter((a) => albumAlertOn(a, state)).length;
  return on === albums.length ? "All albums" : `${on} of ${albums.length} albums`;
}

/**
 * Every album that isn't muted for everyone is on. Albums an admin muted stay
 * off (the member can still turn one back on by hand).
 */
export function allAlbumsOn(albums: readonly string[], state: AlbumAlertState): boolean {
  return state.enabled && albums.every((a) => albumAlertOn(a, state) || albumMutedByAdmin(a, state));
}

/** "Turn all on": gallery switch on, and every album the member turned off back to the default (on). */
export function planAllOn(state: AlbumAlertState): AlertPlan {
  const clear = Object.keys(state.overrides).filter((a) => state.overrides[a] === false);
  return { enable: state.enabled ? undefined : true, set: [], clear };
}

/** "Turn all off": the gallery switch, which also covers albums added later. */
export function planAllOff(state: AlbumAlertState): AlertPlan {
  return { enable: state.enabled ? false : undefined, set: [], clear: [] };
}

/**
 * One album's switch. With the gallery switch off, turning an album on turns
 * the gallery switch back on with only that album on: every other album that
 * would come back on gets an explicit "off".
 */
export function planAlbumToggle(album: string, albums: readonly string[], state: AlbumAlertState): AlertPlan {
  if (state.enabled) return { set: [{ album, subscribed: !albumAlertOn(album, state) }], clear: [] };
  const reopened: AlbumAlertState = { ...state, enabled: true };
  const others = albums
    .filter((a) => a !== album && albumAlertOn(a, reopened))
    .map((a) => ({ album: a, subscribed: false }));
  return { enable: true, set: [{ album, subscribed: true }, ...others], clear: [] };
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
