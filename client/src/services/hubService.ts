import { supabase } from "@/lib/supabase";
import { fetchFindLostClaimContacts } from "@/services/playerPrivateService";
import { FIND_LOST_PUBLIC_COLUMNS } from "@/lib/playerColumns";

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  category: string;
  image_url: string;
  status: string;
  listing_type: "sell" | "buy";
  fulfilled_by_id: string | null;
  fulfilled_by_name: string | null;
  created_at: string;
  seller?: {
    full_name: string;
    avatar_url: string;
    department: string;
    phone?: string;
  };
}

export type PostType = "lost" | "found";

export interface FindLostPost {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  description?: string;
  location?: string;
  contact?: string;
  image_url?: string;
  image_urls?: string[];
  resolved: boolean;
  claimed_by_id?: string;
  claimed_by_name?: string;
  claim_contact?: string;
  claimed_at?: string;
  claim_message?: string;
  remarks?: string;
  created_at: string;
  updated_at?: string;
  author?: { full_name: string; avatar_url?: string };
}

export interface ClubCourt {
  id: string;
  court_number: number;
  status: string;
  current_match_id: string | null;
  last_updated: string | null;
  matches?: {
    id: string;
    score: string | null;
    player1?: { name: string } | null;
    player2?: { name: string } | null;
    partner1?: { name: string } | null;
    partner2?: { name: string } | null;
  } | null;
}

export const hubService = {
  async getMarketplaceListings(options?: {
    status?: string[];
    category?: string;
  }): Promise<MarketplaceListing[]> {
    let query = supabase
      .from("marketplace_listings")
      .select(`
        *,
        seller:seller_id (
          full_name,
          avatar_url,
          department
        )
      `)
      .order("created_at", { ascending: false });

    if (options?.status && options.status.length > 0) {
      query = query.in("status", options.status);
    } else {
      query = query.in("status", ["active", "sold"]);
    }

    if (options?.category && options.category !== "All") {
      query = query.eq("category", options.category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as MarketplaceListing[];
  },

  async createMarketplaceListing(listing: {
    seller_id: string;
    title: string;
    description: string;
    price: number;
    condition: string;
    category: string;
    image_url?: string;
    listing_type: "sell" | "buy";
  }): Promise<MarketplaceListing> {
    const { data, error } = await supabase
      .from("marketplace_listings")
      .insert({
        ...listing,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;
    return data as unknown as MarketplaceListing;
  },

  async updateMarketplaceListingStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("marketplace_listings")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
  },

  async deleteMarketplaceListing(id: string): Promise<void> {
    const { error } = await supabase
      .from("marketplace_listings")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async fulfillMarketplaceRequest(listingId: string, fulfilledById: string, fulfilledByName: string): Promise<void> {
    const { error } = await supabase.rpc("fulfill_marketplace_request", {
      listing_uuid: listingId,
      claimer_id: fulfilledById,
      claimer_name: fulfilledByName,
    });
    if (error) throw error;
  },

  async getFindLostPosts(options?: {
    type?: "all" | PostType;
    resolved?: boolean;
  }): Promise<FindLostPost[]> {
    let query = supabase
      .from("find_lost_posts")
      .select(`${FIND_LOST_PUBLIC_COLUMNS}, author:players!author_id(full_name, avatar_url)`)
      .order("created_at", { ascending: false });

    if (options?.resolved !== undefined) {
      query = query.eq("resolved", options.resolved);
    }

    if (options?.type && options.type !== "all") {
      query = query.eq("type", options.type);
    }

    const { data, error } = await query;
    if (error) throw error;
    // A claimant's contact is shown only to the post's author, the claimant and admins.
    const posts = (data ?? []) as unknown as FindLostPost[];
    const claimed = posts.filter((p) => p.claimed_by_id).map((p) => p.id);
    if (claimed.length) {
      const contacts = await fetchFindLostClaimContacts(claimed);
      for (const p of posts) if (contacts[p.id]) p.claim_contact = contacts[p.id];
    }
    return posts;
  },

  async createFindLostPost(post: {
    author_id: string;
    type: PostType;
    title: string;
    description?: string;
    location?: string;
    contact?: string;
    remarks?: string;
    image_url?: string;
    image_urls?: string[];
  }): Promise<FindLostPost> {
    const { data, error } = await supabase
      .from("find_lost_posts")
      .insert({
        ...post,
        resolved: false,
      })
      .select(FIND_LOST_PUBLIC_COLUMNS)
      .single();

    if (error) throw error;
    return data as unknown as FindLostPost;
  },

  async updateFindLostPost(id: string, updates: Partial<FindLostPost>): Promise<void> {
    const { author: _author, id: _id, created_at: _created, ...rest } = updates;
    const { error } = await supabase
      .from("find_lost_posts")
      .update(rest)
      .eq("id", id);

    if (error) throw error;
  },

  async deleteFindLostPost(id: string): Promise<void> {
    const { error } = await supabase
      .from("find_lost_posts")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async claimFindLostPost(
    id: string,
    claimData: {
      claimedById: string;
      claimedByName: string;
      claimContact?: string;
      claimMessage?: string;
    },
  ): Promise<void> {
    const { error } = await supabase
      .from("find_lost_posts")
      .update({
        resolved: true,
        claimed_by_id: claimData.claimedById,
        claimed_by_name: claimData.claimedByName,
        claim_contact: claimData.claimContact || null,
        claim_message: claimData.claimMessage || null,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },

  async getClubCourts(): Promise<ClubCourt[]> {
    const { data, error } = await supabase
      .from("club_courts")
      .select(`
        *,
        matches (
          id,
          score,
          player1:players!matches_player1_id_fkey(name),
          player2:players!matches_player2_id_fkey(name),
          partner1:players!matches_partner1_id_fkey(name),
          partner2:players!matches_partner2_id_fkey(name)
        )
      `)
      .order("court_number", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as ClubCourt[];
  },

  async updateCourtStatus(
    courtNumber: number,
    status: string,
    matchId?: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from("club_courts")
      .update({
        status,
        current_match_id: matchId ?? null,
        last_updated: new Date().toISOString(),
      })
      .eq("court_number", courtNumber);

    if (error) throw error;
  },

  async uploadFindLostImage(file: File): Promise<string> {
    const fileName = `findlost_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const { error } = await supabase.storage.from("find-lost").upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from("find-lost").getPublicUrl(fileName);
    return data.publicUrl;
  },

  async removeFindLostImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from("find-lost").remove(paths);
    if (error) throw error;
  },

  async claimFindLostItemRpc(params: {
    postUuid: string;
    claimerId: string;
    claimerName: string;
    claimMsg?: string | null;
    claimContactInfo?: string | null;
  }): Promise<void> {
    const { error } = await supabase.rpc("claim_find_lost_item", {
      post_uuid: params.postUuid,
      claimer_id: params.claimerId,
      claimer_name: params.claimerName,
      claim_msg: params.claimMsg || null,
      claim_contact_info: params.claimContactInfo || null,
    });
    if (error) throw error;
  },

  async unclaimFindLostItemRpc(params: { postUuid: string; userId: string }): Promise<void> {
    const { error } = await supabase.rpc("unclaim_find_lost_item", {
      post_uuid: params.postUuid,
      user_id: params.userId,
    });
    if (error) throw error;
  },

  subscribeToFindLost(onInsert: (post: FindLostPost) => void): () => void {
    const channel = supabase
      .channel("find_lost_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "find_lost_posts" }, (payload) => {
        onInsert(payload.new as FindLostPost);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async notifyFindLost(params: {
    type: string;
    title: string;
    author_name: string;
    author_id: string;
  }): Promise<void> {
    await supabase.functions.invoke("notify-find-lost", { body: params });
  },
};

