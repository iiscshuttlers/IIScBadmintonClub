import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useFormDraft } from "@/hooks/useFormDraft";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
import { safeReplaceState, safeGetSearchParams, isCapacitor } from "@/lib/navUtils";
import {
  Search,
  Plus,
  MapPin,
  Phone,
  CheckCircle,
  X,
  Loader2,
  Package,
  PackageSearch,
  Bell,
  Clock,
  Edit2,
  Trash2,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PostType = "lost" | "found";

interface Post {
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
  claimed_at?: string;
  claim_message?: string;
  remarks?: string;
  created_at: string;
  updated_at?: string;
  author?: { full_name: string; avatar_url?: string };
}

const TYPE_STYLES: Record<PostType, { bg: string; badge: string; icon: any; label: string }> = {
  lost: {
    bg: "border-rose-200 dark:border-rose-900/40",
    badge: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    icon: PackageSearch,
    label: "LOST",
  },
  found: {
    bg: "border-primary/40 dark:border-primary/40",
    badge: "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary",
    icon: Package,
    label: "FOUND",
  },
};

export default function FindLost() {
  usePageMeta({ title: "Find & Lost", description: "Lost or found items at the IISc badminton courts" });
  const [, setLocation] = useLocation();

  const { session, profile, isAdmin } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | PostType>(() => {
    const params = new URLSearchParams(window.location.search);
    const postType = params.get("postType");
    return (postType === "lost" || postType === "found") ? postType : "all";
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const postType = params.get("postType");
      setFilter((postType === "lost" || postType === "found") ? postType : "all");
    };
    window.addEventListener("popstate", handlePopState);

    const params = safeGetSearchParams();
    if (filter === "all") {
      params.delete("postType");
    } else {
      params.set("postType", filter);
    }
    const hash = isCapacitor ? "" : window.location.hash;
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    
    if (newUrl !== currentUrl) {
      import("@/lib/navUtils").then(({ safePushState }) => safePushState(newUrl));
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [filter]);
  const [showResolved, setShowResolved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm, clearDraft] = useFormDraft("find-lost", { type: "lost" as PostType, title: "", description: "", location: "", contact: "", remarks: "", images: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [claimingPostId, setClaimingPostId] = useState<string | null>(null);
  const [claimContactInput, setClaimContactInput] = useState("");

  const MAX_IMAGES = 5;

  // Lightbox (enlarge + zoom) state
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - form.images.length;
    if (remaining <= 0) {
      toast.error(`You can upload a maximum of ${MAX_IMAGES} images`);
      e.target.value = "";
      return;
    }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Only ${remaining} more image(s) can be added (max ${MAX_IMAGES})`);
    }
    setUploadingImage(true);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const fileName = `findlost_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage.from("find-lost").upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from("find-lost").getPublicUrl(fileName);
        uploaded.push(data.publicUrl);
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...uploaded] }));
      toast.success(`${uploaded.length} image(s) uploaded!`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const removeImage = (url: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
  };

  // Normalise a post's images (new array column with legacy single-url fallback)
  const postImages = (post: Post): string[] =>
    post.image_urls && post.image_urls.length > 0
      ? post.image_urls
      : post.image_url
        ? [post.image_url]
        : [];

  const openLightbox = (images: string[], index: number) => {
    setZoom(1);
    setLightbox({ images, index });
  };

  const openNewPost = () => {
    setEditingId(null);
    setForm({ type: "lost", title: "", description: "", location: "", contact: "", images: [] });
    setShowForm(true);
  };

  const editPost = (post: Post) => {
    setEditingId(post.id);
    setForm({
      type: post.type,
      title: post.title,
      description: post.description || "",
      location: post.location || "",
      contact: post.contact || "",
      images: postImages(post)
    });
    setShowForm(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from("find_lost_posts")
      .select("*, author:players!author_id(full_name, avatar_url)")
      .order("created_at", { ascending: false });

    if (showResolved) {
      query.eq("resolved", true);
    } else {
      query.eq("resolved", false);
    }
    if (filter !== "all") query.eq("type", filter);

    const { data, error } = await query;
    if (!error && data) setPosts(data as Post[]);
    setLoading(false);
  }, [filter, showResolved]);

  usePullToRefresh();

  useEffect(() => { load(); }, [load]);

  // Keyboard navigation for the lightbox
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") { setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length } : lb); }
      if (e.key === "ArrowRight") { setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index + 1) % lb.images.length } : lb); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Real-time subscription for new posts → triggers push notification badge
  useEffect(() => {
    const channel = supabase
      .channel("find_lost_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "find_lost_posts" }, (payload) => {
        setPosts((prev) => [payload.new as Post, ...prev]);
        toast.info("New Find & Lost post!", { description: (payload.new as Post).title });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const submit = async () => {
    if (!profile?.id || !form.title.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        contact: form.contact.trim() || null,
        image_url: form.images[0] || null,
        image_urls: form.images.length > 0 ? form.images : null,
      };

      let error;
      if (editingId) {
        ({ error } = await supabase.from("find_lost_posts").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId));
      } else {
        ({ error } = await supabase.from("find_lost_posts").insert({ ...payload, author_id: profile.id }));
      }
      
      if (error) throw error;
      toast.success(editingId ? "Post updated!" : "Post published!");

      if (!editingId) {
        void supabase.functions.invoke("notify-find-lost", {
          body: {
            type: form.type,
            title: form.title.trim(),
            author_name: profile.full_name || "A user",
            author_id: profile.id,
          },
        }).catch((err) => console.error("Failed to broadcast Find & Lost notification:", err));
      }

      clearDraft();
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save post");
    } finally {
      setSubmitting(false);
    }
  };

  const resolve = async (post: Post) => {
    const { error } = await supabase.from("find_lost_posts").update({ resolved: true }).eq("id", post.id);
    if (!error) {
      toast.success("Marked as resolved!");
      load(); // Reload to get updated state
    } else {
      toast.error(error.message || "Failed to resolve post");
    }
  };

  const claimItem = async (post: Post, claimMsg?: string, claimContact?: string) => {
    if (!profile?.id) return;
    
    const { error } = await supabase.rpc("claim_find_lost_item", {
      post_uuid: post.id,
      claimer_id: profile.id,
      claimer_name: profile.full_name,
      claim_msg: claimMsg || null,
      claim_contact_info: claimContact || null
    });
    
    if (!error) {
      toast.success(post.type === "lost" ? "Thanks for reporting this found!" : "Successfully claimed!");
      setClaimingPostId(null);
      setClaimContactInput("");
      load(); // Reload to get updated state
    } else {
      toast.error(error.message || "Failed to claim item. Check if columns exist.");
    }
  };

  const unclaimItem = async (post: Post) => {
    if (!profile?.id) return;
    
    const { error } = await supabase.rpc("unclaim_find_lost_item", {
      post_uuid: post.id,
      user_id: profile.id
    });
    
    if (!error) {
      toast.success("Successfully unclaimed!");
      load();
    } else {
      toast.error(error.message || "Failed to unclaim item.");
    }
  };

  // Extract the storage object path (part after ".../find-lost/") from a public URL
  const storagePathFromUrl = (url: string): string | null => {
    const marker = "/find-lost/";
    const idx = url.indexOf(marker);
    return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  };

  const deletePost = async (post: Post) => {
    if (pendingDelete !== post.id) {
      setPendingDelete(post.id);
      return;
    }
    setPendingDelete(null);
    const { error } = await supabase.from("find_lost_posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message || "Failed to delete post");
      return;
    }

    // Clean up associated images from the storage bucket (best-effort)
    const paths = postImages(post)
      .map(storagePathFromUrl)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from("find-lost").remove(paths);
      if (storageErr) console.error("Failed to delete post images from storage:", storageErr);
    }

    toast.success("Post deleted");
    load();
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
  const labelCls = "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-safe pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-foreground py-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-2">
            <Search className="w-4 h-4 text-indigo-400" /> Find & Lost
            <InfoModal
              title="FIND & LOST"
              items={[
                { badge: "NOTIFY", title: "Real-time Alerts", desc: "Whenever you post an item, all users will see it in the global feed." },
                { badge: "CLAIM", title: "Claiming an item", desc: "Click 'Claim' on an item to securely ping the poster that you have their item or want to collect it." }
              ]}
              triggerClassName="text-foreground hover:text-indigo-200"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3">Lost something on court?</h1>
          <p className="text-slate-300 text-sm">Post about lost or found items at the IISc badminton courts. Get real-time notifications when someone replies.</p>
          {session && (
            <button
              onClick={openNewPost}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-foreground font-bold shadow-lg shadow-indigo-900/40 transition"
            >
              <Plus className="w-4 h-4" /> Post Item
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
        {!session ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">Sign in to view Lost & Found</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              You must be logged in to see or post items in this section.
            </p>
            <button 
              onClick={() => setLocation('/join')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl px-6 h-11 transition">
              Sign In / Join
            </button>
          </div>
        ) : (
          <>
            {/* New Post Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 dark:text-foreground">
                  {editingId ? "Edit Post" : "New Post"}
                </h3>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-200 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2 mb-4">
                {(["lost", "found"] as PostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition ${form.type === t ? (t === "lost" ? "bg-rose-600 text-primary-foreground" : "bg-primary text-primary-foreground") : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"}`}
                  >
                    {t === "lost" ? "I Lost Something" : "I Found Something"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Item Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={form.type === "lost" ? "e.g. Blue Yonex racket" : "e.g. Racket bag found near court 3"}
                    maxLength={80}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the item, when/where you lost or found it..."
                    rows={3}
                    maxLength={500}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Images (Optional · up to {MAX_IMAGES})</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {form.images.map((url) => (
                      <div key={url} className="relative group">
                        <img
                          src={url}
                          alt="Item"
                          onClick={() => openLightbox(form.images, form.images.indexOf(url))}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 cursor-zoom-in"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-foreground rounded-full p-0.5 shadow"
                          aria-label="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.images.length < MAX_IMAGES && (
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 font-bold text-sm rounded-xl transition">
                        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        {form.images.length > 0 ? "Add More" : "Upload Images"}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                      </label>
                    )}
                  </div>
                  {form.images.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{form.images.length} / {MAX_IMAGES} images · click a thumbnail to preview</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className={labelCls}>Location</label>
                    <input
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Court 2, locker room"
                      maxLength={100}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contact / WhatsApp</label>
                    <input
                      value={form.contact}
                      onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                      placeholder="Phone or email"
                      maxLength={100}
                      className={inputCls}
                    />
                  </div>
                </div>
                {form.type === "found" && (
                  <div className="flex flex-col mt-3">
                    <label className={labelCls}>Remarks / Action Taken</label>
                    <input
                      value={form.remarks || ""}
                      onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                      placeholder="e.g. Kept at table"
                      maxLength={100}
                      className={inputCls}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {["Kept at table", "Kept in wooden wardrobe", "Handed to Court Staff", "It's with me"].map(msg => (
                        <button
                          key={msg}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, remarks: msg }))}
                          className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md transition text-left"
                        >
                          {msg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                <Button
                  onClick={submit}
                  disabled={submitting || !form.title.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-foreground"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (editingId ? <Edit2 className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />)}
                  {submitting ? "Saving…" : (editingId ? "Save Changes" : "Publish Post")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["all", "lost", "found"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${filter === f ? "bg-indigo-600 text-foreground shadow-md" : "bg-white dark:bg-slate-900 text-muted-foreground dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"}`}
            >
              {f === "all" ? "All" : f === "lost" ? "Lost" : "Found"}
            </button>
          ))}
          <button
            onClick={() => setShowResolved((v) => !v)}
            className={`ml-auto px-3 py-1.5 rounded-full text-xs font-bold transition ${showResolved ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-muted-foreground border border-slate-200 dark:border-slate-700"}`}
          >
            {showResolved ? "Show Active" : "Show Resolved"}
          </button>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            <PackageSearch className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
            <h3 className="font-black text-muted-foreground dark:text-slate-300 mb-1">No posts yet</h3>
            <p className="text-muted-foreground text-sm">Be the first to post a lost or found item.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const style = TYPE_STYLES[post.type];
              const Icon = style.icon;
              const isOwn = profile?.id === post.author_id;
              const images = postImages(post);

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm ${post.resolved ? "opacity-60" : ""} ${style.bg}`}
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                      <div className={`p-2 rounded-xl ${style.badge} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                          {style.label}
                        </span>
                        {post.resolved && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-800 dark:text-foreground text-base mb-1">{post.title}</h3>
                      {post.description && (
                        <p className="text-sm text-muted-foreground dark:text-slate-300 mb-2">{post.description}</p>
                      )}
                      
                      {images.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {images.map((url, i) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => openLightbox(images, i)}
                              className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <img
                                src={url}
                                alt={`${post.title} ${i + 1}`}
                                className={`object-cover cursor-zoom-in transition group-hover:opacity-90 ${images.length === 1 ? "w-full max-w-sm max-h-72" : "w-24 h-24"}`}
                              />
                              <span className="absolute bottom-1 right-1 bg-black/55 text-foreground rounded-md p-1 opacity-0 group-hover:opacity-100 transition">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {post.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {post.location}
                          </span>
                        )}
                        {post.contact && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {(() => {
                              const isEmail = post.contact.includes("@");
                              const isPhone = !isEmail && /\d/.test(post.contact);
                              
                              let href = undefined;
                              if (isEmail) {
                                href = `mailto:${post.contact}`;
                              } else if (isPhone) {
                                const cleanPhone = post.contact.replace(/\D/g, '');
                                href = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}`;
                              }
                              
                              return href ? (
                                <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline transition">
                                  {post.contact}
                                </a>
                              ) : (
                                <span>{post.contact}</span>
                              );
                            })()}
                          </span>
                        )}
                        {post.remarks && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-indigo-500" /> <span className="text-indigo-600 dark:text-indigo-400 font-medium">{post.remarks}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(post.created_at).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {post.updated_at && (
                            <span className="italic ml-1" title={new Date(post.updated_at).toLocaleString()}>
                              (edited)
                            </span>
                          )}
                        </span>
                        {post.author && (
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            by <strong className="text-muted-foreground dark:text-slate-300 truncate max-w-[140px]">{post.author.full_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto sm:items-end">
                      {post.resolved ? (
                        <>
                          {/* Resolved status (replaces the "Mark as Resolved" action) */}
                          <span
                            title="This post has been resolved"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary cursor-default"
                          >
                            <CheckCircle className="w-4 h-4" /> Resolved
                          </span>
                          {/* Claim status (replaces the "Claim" action) */}
                          {post.claimed_by_name && (
                            <div className="flex flex-col gap-1 items-end">
                              <span
                                title={post.claimed_at ? `${post.type === 'lost' ? 'Found' : 'Claimed'} on ${new Date(post.claimed_at).toLocaleString()}` : `${post.type === 'lost' ? 'Found' : 'Claimed'} by ${post.claimed_by_name}`}
                                className="flex flex-col px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 cursor-default max-w-[12rem] text-right"
                              >
                                <span className="flex items-center justify-end gap-1.5 text-xs font-bold">
                                  <span className="truncate">{post.type === 'lost' ? 'Found' : 'Claimed'} by {post.claimed_by_name}</span>
                                  <CheckCircle className="w-4 h-4 shrink-0" />
                                </span>
                                {post.claimed_at && (
                                  <span className="text-[10px] font-medium opacity-80 mt-0.5">
                                    {new Date(post.claimed_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {post.claim_message && (
                                  <span className="text-[10px] font-medium mt-1 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded text-indigo-800 dark:text-indigo-300 inline-block w-full text-right leading-tight">
                                    {post.claim_message}
                                  </span>
                                )}
                                {post.claim_contact && (
                                  <span className="text-[10px] font-medium mt-0.5 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded text-indigo-800 dark:text-indigo-300 inline-flex items-center justify-end gap-1 w-full text-right leading-tight">
                                    <Phone className="w-2.5 h-2.5" />
                                    {(() => {
                                      const isEmail = post.claim_contact.includes("@");
                                      const isPhone = !isEmail && /\d/.test(post.claim_contact);
                                      let href = undefined;
                                      if (isEmail) href = `mailto:${post.claim_contact}`;
                                      else if (isPhone) {
                                        const cleanPhone = post.claim_contact.replace(/\D/g, '');
                                        href = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}`;
                                      }
                                      return href ? (
                                        <a href={href} target="_blank" rel="noreferrer" className="hover:underline text-indigo-600 dark:text-indigo-400">{post.claim_contact}</a>
                                      ) : <span>{post.claim_contact}</span>;
                                    })()}
                                  </span>
                                )}
                              </span>
                              {(post.claimed_by_id === profile?.id || isOwn || isAdmin) && (
                                <button
                                  onClick={() => unclaimItem(post)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition px-1"
                                >
                                  <RotateCcw className="w-3 h-3" /> Undo {post.type === 'lost' ? 'Find' : 'Claim'}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {(isOwn || isAdmin) && (
                            <button
                              onClick={() => resolve(post)}
                              title="Mark as resolved"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-900/60 transition w-full justify-center"
                            >
                              <CheckCircle className="w-4 h-4" /> Mark as Resolved
                            </button>
                          )}
                          {!isOwn && session && claimingPostId !== post.id && (
                            <button
                              onClick={() => setClaimingPostId(post.id)}
                              title={post.type === "lost" ? "I found this item!" : "Claim this item"}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition w-full justify-center"
                            >
                              <CheckCircle className="w-4 h-4" /> {post.type === "lost" ? "I found this!" : "Claim"}
                            </button>
                          )}
                          {!isOwn && session && claimingPostId === post.id && (
                            <div className="flex flex-col gap-1.5 items-end mt-1 w-full max-w-[140px]">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Your Contact / WhatsApp</span>
                              <input 
                                value={claimContactInput}
                                onChange={e => setClaimContactInput(e.target.value)}
                                placeholder="Phone or Email (Optional)"
                                className="text-[10px] w-full text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              {post.type === "lost" ? (
                                <>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Where did you keep it?</span>
                                  <div className="flex flex-col items-end gap-1.5 w-full">
                                    {["Kept at table", "Kept in wooden wardrobe", "Handed to Court Staff", "It's with me"].map(msg => (
                                      <button
                                        key={msg}
                                        onClick={() => claimItem(post, msg, claimContactInput)}
                                        className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 px-2 py-1.5 rounded-lg transition w-full text-right"
                                      >
                                        {msg}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => claimItem(post, undefined, claimContactInput)}
                                  className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition w-full text-center mt-1"
                                >
                                  Confirm Claim
                                </button>
                              )}
                              <button onClick={() => setClaimingPostId(null)} className="text-[10px] text-muted-foreground hover:underline px-1 py-0.5 mt-0.5">Cancel</button>
                            </div>
                          )}
                        </>
                      )}

                      {(isOwn || isAdmin) && (
                        <div className="flex gap-2 justify-end w-full mt-0.5">
                          <button
                            onClick={() => editPost(post)}
                            title="Edit post"
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition shrink-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          {pendingDelete === post.id ? (
                            <div className="flex gap-1 bg-rose-50 dark:bg-rose-900/20 p-1 rounded-xl shrink-0">
                              <button
                                onClick={() => deletePost(post)}
                                title="Confirm delete"
                                className="flex items-center justify-center w-6 h-6 rounded-lg font-bold bg-rose-500 text-foreground hover:bg-rose-600 transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPendingDelete(null)}
                                title="Cancel"
                                className="flex items-center justify-center w-6 h-6 rounded-lg font-bold bg-slate-200 dark:bg-slate-700 text-muted-foreground dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPendingDelete(post.id)}
                              title="Delete post"
                              className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/60 transition shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

          </>
        )}
      </div>

      {/* Image Lightbox (enlarge + zoom) */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            {/* Counter */}
            {lightbox.images.length > 1 && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 text-foreground/70 text-sm font-medium select-none">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            )}

            {/* Controls */}
            <div className="absolute top-4 right-3 z-50 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}
                disabled={zoom <= 1}
                className="text-foreground hover:text-primary disabled:opacity-30 transition p-2"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-7 h-7" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
                disabled={zoom >= 4}
                className="text-foreground hover:text-primary disabled:opacity-30 transition p-2"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-7 h-7" />
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="text-foreground hover:text-rose-400 transition p-2"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            {/* Prev */}
            {lightbox.images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length } : lb); }}
                className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition p-2 z-50"
                aria-label="Previous"
              >
                <ChevronLeft className="w-9 h-9 md:w-10 md:h-10" />
              </button>
            )}

            <div className="max-h-[90vh] max-w-[95vw] overflow-auto flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={lightbox.images[lightbox.index]}
                alt="Preview"
                onClick={() => setZoom((z) => (z >= 4 ? 1 : +(z + 0.5).toFixed(2)))}
                style={{ transform: `scale(${zoom})` }}
                className={`max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl transition-transform duration-200 ${zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
              />
            </div>

            {/* Next */}
            {lightbox.images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index + 1) % lb.images.length } : lb); }}
                className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition p-2 z-50"
                aria-label="Next"
              >
                <ChevronRight className="w-9 h-9 md:w-10 md:h-10" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
