import { supabase } from '@/lib/supabase';

export const galleryService = {
  async fetchGalleryData() {
    const [likesRes, tagsRes, defaultsRes, pendingRes] = await Promise.all([
      supabase.from("site_data").select("value").eq("key", "gallery_likes").maybeSingle(),
      supabase.from("site_data").select("value").eq("key", "gallery_tags").maybeSingle(),
      supabase.from("site_data").select("value").eq("key", "gallery_default_subscriptions").maybeSingle(),
      supabase.from("site_data").select("value").eq("key", "gallery_pending_tags").maybeSingle(),
    ]);

    return {
      likes: (likesRes.data?.value as Record<string, string[]>) || {},
      tags: (tagsRes.data?.value as Record<string, string[]>) || {},
      defaultSubscriptions: (defaultsRes.data?.value as string[]) || [],
      pendingTags: (pendingRes.data?.value as Record<string, string[]>) || {},
    };
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

  async updateDefaultSubscriptions(nextDefaults: string[]): Promise<void> {
    await supabase.from("site_data").upsert({ key: "gallery_default_subscriptions", value: nextDefaults }, { onConflict: "key" });
  },

  async updateGalleryTags(tags: Record<string, any[]>): Promise<void> {
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: tags as any }, { onConflict: "key" });
  },

  async updatePendingTags(pending: Record<string, any[]>): Promise<void> {
    await supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: pending as any }, { onConflict: "key" });
  },

  async approvePendingTag(updatedTags: Record<string, any[]>, updatedPending: Record<string, any[]>): Promise<void> {
    await Promise.all([
      supabase.from("site_data").upsert({ key: "gallery_tags", value: updatedTags as any }, { onConflict: "key" }),
      supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: updatedPending as any }, { onConflict: "key" }),
    ]);
  },
};
