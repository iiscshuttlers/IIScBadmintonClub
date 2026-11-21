import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/supabase-types-auto';
import { parseAlbumList, type AlbumOverride } from '@/lib/galleryAlerts';

const MUTED_ALBUMS_KEY = "gallery_muted_albums";

export const galleryService = {
  async fetchGalleryData() {
    const [likesRes, tagsRes, pendingRes] = await Promise.all([
      supabase.from("site_data").select("value").eq("key", "gallery_likes").maybeSingle(),
      supabase.from("site_data").select("value").eq("key", "gallery_tags").maybeSingle(),
      supabase.from("site_data").select("value").eq("key", "gallery_pending_tags").maybeSingle(),
    ]);

    return {
      likes: (likesRes.data?.value as Record<string, string[]>) || {},
      tags: (tagsRes.data?.value as Record<string, string[]>) || {},
      pendingTags: (pendingRes.data?.value as Record<string, string[]>) || {},
    };
  },

  // ── Photo alerts (migration 20261121150000_gallery_album_alerts) ──────────

  /** Albums an admin muted for everyone. */
  async fetchMutedAlbums(): Promise<string[]> {
    const { data, error } = await supabase.from("site_data").select("value").eq("key", MUTED_ALBUMS_KEY).maybeSingle();
    if (error) throw error;
    return parseAlbumList(data?.value);
  },

  /** Admin only (site_data RLS). */
  async saveMutedAlbums(albums: string[]): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert({ key: MUTED_ALBUMS_KEY, value: albums, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  },

  /**
   * The member's gallery switch and per-album choices. Until the migration is
   * applied the column/table don't exist; fall back to the defaults (on).
   */
  async fetchAlertSettings(userId: string): Promise<{ enabled: boolean; overrides: AlbumOverride[] }> {
    const [prefRes, rowsRes] = await Promise.all([
      supabase.from("players").select("pref_notify_gallery").eq("id", userId).maybeSingle(),
      supabase.from("gallery_album_subscriptions").select("album, subscribed").eq("user_id", userId),
    ]);
    if (prefRes.error) console.warn("[gallery alerts] switch unavailable:", prefRes.error.message);
    if (rowsRes.error) console.warn("[gallery alerts] album choices unavailable:", rowsRes.error.message);
    return {
      enabled: (prefRes.data as { pref_notify_gallery?: boolean } | null)?.pref_notify_gallery !== false,
      overrides: (rowsRes.data ?? []) as AlbumOverride[],
    };
  },

  async setAlertsEnabled(userId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.from("players").update({ pref_notify_gallery: enabled }).eq("id", userId);
    if (error) throw error;
  },

  async setAlbumAlert(userId: string, album: string, subscribed: boolean): Promise<void> {
    const { error } = await supabase
      .from("gallery_album_subscriptions")
      .upsert({ user_id: userId, album, subscribed, updated_at: new Date().toISOString() }, { onConflict: "user_id,album" });
    if (error) throw error;
  },

  /** Carries over choices from the old browser-only bell without overwriting newer ones. */
  async importAlbumChoices(userId: string, choices: AlbumOverride[]): Promise<void> {
    if (choices.length === 0) return;
    const { error } = await supabase
      .from("gallery_album_subscriptions")
      .upsert(choices.map((c) => ({ user_id: userId, album: c.album, subscribed: c.subscribed })), {
        onConflict: "user_id,album",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  },

  async toggleLike(path: string, userId: string, isLikedLocally: boolean): Promise<void> {
    const { data } = await supabase.from("site_data").select("value").eq("key", "gallery_likes").maybeSingle();
    const currentDb = (data?.value as Record<string, string[]>) || {};
    const pathLikes = currentDb[path] || [];
    const newPathLikes = isLikedLocally 
      ? pathLikes.filter(id => id !== userId)
      : Array.from(new Set([...pathLikes, userId]));
    
    const updatedDb = { ...currentDb, [path]: newPathLikes };
    await supabase.from("site_data").upsert({ key: "gallery_likes", value: updatedDb }, { onConflict: "key" });
  },

  async updateGalleryTags(tags: Record<string, any[]>): Promise<void> {
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: tags as Json }, { onConflict: "key" });
  },

  async updatePendingTags(pending: Record<string, any[]>): Promise<void> {
    await supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: pending as Json }, { onConflict: "key" });
  },

  async approvePendingTag(updatedTags: Record<string, any[]>, updatedPending: Record<string, any[]>): Promise<void> {
    await Promise.all([
      supabase.from("site_data").upsert({ key: "gallery_tags", value: updatedTags as Json }, { onConflict: "key" }),
      supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: updatedPending as Json }, { onConflict: "key" }),
    ]);
  },
};
