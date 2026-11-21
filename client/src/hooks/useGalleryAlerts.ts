import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { galleryService } from "@/services/galleryService";
import {
  LEGACY_SUBSCRIBED_KEY,
  LEGACY_UNSUBSCRIBED_KEY,
  albumAlertOn,
  albumMutedByAdmin,
  overridesByAlbum,
  readLegacyAlbumChoices,
  type AlbumAlertState,
  type AlbumOverride,
} from "@/lib/galleryAlerts";

type Settings = { enabled: boolean; overrides: AlbumOverride[] };

const MUTED_KEY = ["gallery-muted-albums"] as const;
const settingsKey = (userId: string | null) => ["gallery-alert-settings", userId] as const;

/**
 * Gallery photo alerts for the signed-in member: the gallery-wide switch, the
 * per-album bell, and (for admins) the per-album mute for everyone. Every
 * setter is optimistic and rolls back, then rethrows, when the write fails.
 */
export function useGalleryAlerts() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const queryClient = useQueryClient();

  // Settings must reflect the latest toggle, even right after a reload: skip the
  // sessionStorage cache (its writes are throttled) and re-check on every mount.
  const fresh = { staleTime: 0, refetchOnMount: "always", meta: { persist: false } } as const;

  const mutedQuery = useQuery({
    queryKey: MUTED_KEY,
    queryFn: () => galleryService.fetchMutedAlbums(),
    ...fresh,
  });

  const settingsQuery = useQuery({
    queryKey: settingsKey(userId),
    queryFn: () => galleryService.fetchAlertSettings(userId!),
    enabled: !!userId,
    ...fresh,
  });

  const muted = useMemo(() => mutedQuery.data ?? [], [mutedQuery.data]);
  const enabled = settingsQuery.data?.enabled ?? true;
  const overrides = useMemo(() => overridesByAlbum(settingsQuery.data?.overrides ?? []), [settingsQuery.data]);
  const state: AlbumAlertState = useMemo(() => ({ enabled, overrides, muted }), [enabled, overrides, muted]);

  // One-time carry-over of choices made with the old browser-only bell.
  useEffect(() => {
    if (!userId || !settingsQuery.isSuccess) return;
    let choices: AlbumOverride[];
    try {
      choices = readLegacyAlbumChoices(localStorage);
    } catch {
      return;
    }
    if (choices.length === 0) return;
    galleryService
      .importAlbumChoices(userId, choices)
      .then(() => {
        try {
          localStorage.removeItem(LEGACY_SUBSCRIBED_KEY);
          localStorage.removeItem(LEGACY_UNSUBSCRIBED_KEY);
        } catch { /* storage unavailable */ }
        return queryClient.invalidateQueries({ queryKey: settingsKey(userId) });
      })
      .catch((err) => console.warn("[gallery alerts] could not import old bell choices", err));
  }, [userId, settingsQuery.isSuccess, queryClient]);

  const patchSettings = useCallback(
    async (patch: (prev: Settings) => Settings, write: () => Promise<void>) => {
      const key = settingsKey(userId);
      const prev = queryClient.getQueryData<Settings>(key) ?? { enabled: true, overrides: [] };
      queryClient.setQueryData<Settings>(key, patch(prev));
      try {
        await write();
      } catch (err) {
        queryClient.setQueryData<Settings>(key, prev);
        throw err;
      }
    },
    [queryClient, userId],
  );

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!userId) return Promise.reject(new Error("Sign in to change photo alerts"));
      return patchSettings((s) => ({ ...s, enabled: next }), () => galleryService.setAlertsEnabled(userId, next));
    },
    [patchSettings, userId],
  );

  const setAlbum = useCallback(
    (album: string, subscribed: boolean) => {
      if (!userId) return Promise.reject(new Error("Sign in to change photo alerts"));
      return patchSettings(
        (s) => ({ ...s, overrides: [...s.overrides.filter((o) => o.album !== album), { album, subscribed }] }),
        () => galleryService.setAlbumAlert(userId, album, subscribed),
      );
    },
    [patchSettings, userId],
  );

  /** Admin: mute (or unmute) an album for everyone. */
  const setMutedForEveryone = useCallback(
    async (album: string, mute: boolean) => {
      const prev = queryClient.getQueryData<string[]>(MUTED_KEY) ?? [];
      const next = mute ? Array.from(new Set([...prev, album])) : prev.filter((a) => a !== album);
      queryClient.setQueryData<string[]>(MUTED_KEY, next);
      try {
        await galleryService.saveMutedAlbums(next);
      } catch (err) {
        queryClient.setQueryData<string[]>(MUTED_KEY, prev);
        throw err;
      }
    },
    [queryClient],
  );

  return {
    signedIn: !!userId,
    loading: mutedQuery.isLoading || (!!userId && settingsQuery.isLoading),
    enabled,
    isOn: (album: string) => albumAlertOn(album, state),
    isMutedForEveryone: (album: string) => muted.includes(album),
    isMutedForMe: (album: string) => albumMutedByAdmin(album, state),
    setEnabled,
    setAlbum,
    setMutedForEveryone,
  };
}
