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
  type AlertPlan,
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

  /**
   * Several changes at once (lib/galleryAlerts plan*). Album choices are written
   * before the gallery switch turns on, so no upload in between alerts albums
   * the member meant to leave off. A failed write re-reads the saved settings,
   * since earlier writes in the plan may have landed.
   */
  const applyPlan = useCallback(
    async (plan: AlertPlan) => {
      if (!userId) throw new Error("Sign in to change photo alerts");
      const key = settingsKey(userId);
      const prev = queryClient.getQueryData<Settings>(key) ?? { enabled: true, overrides: [] };
      const touched = new Set([...plan.clear, ...plan.set.map((c) => c.album)]);
      queryClient.setQueryData<Settings>(key, {
        enabled: plan.enable ?? prev.enabled,
        overrides: [...prev.overrides.filter((o) => !touched.has(o.album)), ...plan.set],
      });
      try {
        if (plan.enable === false) await galleryService.setAlertsEnabled(userId, false);
        await galleryService.clearAlbumAlerts(userId, plan.clear);
        await galleryService.setAlbumAlerts(userId, plan.set);
        if (plan.enable === true) await galleryService.setAlertsEnabled(userId, true);
      } catch (err) {
        queryClient.setQueryData<Settings>(key, prev);
        void queryClient.invalidateQueries({ queryKey: key });
        throw err;
      }
    },
    [queryClient, userId],
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
    state,
    isOn: (album: string) => albumAlertOn(album, state),
    isMutedForEveryone: (album: string) => muted.includes(album),
    isMutedForMe: (album: string) => albumMutedByAdmin(album, state),
    setEnabled,
    setAlbum,
    applyPlan,
    setMutedForEveryone,
  };
}
