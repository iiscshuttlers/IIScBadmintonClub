import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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
  created_at: string;
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
    bg: "border-emerald-200 dark:border-emerald-900/40",
    badge: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    icon: Package,
    label: "FOUND",
  },
};

export default function FindLost() {
  usePageMeta({ title: "Find & Lost", description: "Lost or found items at the IISc badminton courts" });

  const { session, profile, isAdmin } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | PostType>("all");
  const [showResolved, setShowResolved] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({ type: "lost" as PostType, title: "", description: "", location: "", contact: "", images: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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

    if (!showResolved) query.eq("resolved", false);
    if (filter !== "all") query.eq("type", filter);

    const { data, error } = await query;
    if (!error && data) setPosts(data as Post[]);
    setLoading(false);
  }, [filter, showResolved]);

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
        ({ error } = await supabase.from("find_lost_posts").update(payload).eq("id", editingId));
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

      setForm({ type: "lost", title: "", description: "", location: "", contact: "", images: [] });
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

  const claimItem = async (post: Post) => {
    if (!profile?.id) return;
    
    const { error } = await supabase.rpc("claim_find_lost_item", {
      post_uuid: post.id,
      claimer_id: profile.id,
      claimer_name: profile.full_name
    });
    
    if (!error) {
      toast.success("Successfully claimed!");
      load(); // Reload to get updated state
    } else {
      toast.error(error.message || "Failed to claim item. Check if columns exist.");
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
  const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-4">
            <Search className="w-4 h-4 text-indigo-400" /> Find & Lost
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3">Lost something on court?</h1>
          <p className="text-slate-300 text-sm">Post about lost or found items at the IISc badminton courts. Get real-time notifications when someone replies.</p>
          {session && (
            <button
              onClick={openNewPost}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-900/40 transition"
            >
              <Plus className="w-4 h-4" /> Post Item
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
        {/* New Post Form */}
        <AnimatePresence>
          {showForm && session && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 dark:text-white">
                  {editingId ? "Edit Post" : "New Post"}
                </h3>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2 mb-4">
                {(["lost", "found"] as PostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition ${form.type === t ? (t === "lost" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white") : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}
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
                          className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow"
                          aria-label="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.images.length < MAX_IMAGES && (
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition">
                        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        {form.images.length > 0 ? "Add More" : "Upload Images"}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                      </label>
                    )}
                  </div>
                  {form.images.length > 0 && (
                    <p className="mt-1.5 text-xs text-slate-400">{form.images.length} / {MAX_IMAGES} images · click a thumbnail to preview</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
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
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                <Button
                  onClick={submit}
                  disabled={submitting || !form.title.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${filter === f ? "bg-indigo-600 text-white shadow-md" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400"}`}
            >
              {f === "all" ? "All" : f === "lost" ? "Lost" : "Found"}
            </button>
          ))}
          <button
            onClick={() => setShowResolved((v) => !v)}
            className={`ml-auto px-3 py-1.5 rounded-full text-xs font-bold transition ${showResolved ? "bg-slate-800 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700"}`}
          >
            {showResolved ? "Hide Resolved" : "Show Resolved"}
          </button>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
            <PackageSearch className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="font-black text-slate-700 dark:text-slate-300 mb-1">No posts yet</h3>
            <p className="text-slate-400 text-sm">Be the first to post a lost or found item.</p>
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
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl ${style.badge} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.badge}`}>
                          {style.label}
                        </span>
                        {post.resolved && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-slate-800 dark:text-white text-base mb-1">{post.title}</h3>
                      {post.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{post.description}</p>
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
                              <span className="absolute bottom-1 right-1 bg-black/55 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        {post.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {post.location}
                          </span>
                        )}
                        {post.contact && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> {post.contact}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(post.created_at).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {post.author && (
                          <span className="flex items-center gap-1">
                            by <strong className="text-slate-600 dark:text-slate-300">{post.author.full_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 ml-3">
                      {post.resolved ? (
                        <>
                          {/* Resolved status (replaces the "Mark as Resolved" action) */}
                          <span
                            title="This post has been resolved"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 cursor-default"
                          >
                            <CheckCircle className="w-4 h-4" /> Resolved
                          </span>
                          {/* Claim status (replaces the "Claim" action) */}
                          {post.claimed_by_name && (
                            <span
                              title={`Claimed by ${post.claimed_by_name}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 cursor-default max-w-[12rem]"
                            >
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <span className="truncate">Claimed by {post.claimed_by_name}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {(isOwn || isAdmin) && (
                            <>
                              <button
                                onClick={() => resolve(post)}
                                title="Mark as resolved"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition"
                              >
                                <CheckCircle className="w-4 h-4" /> Mark as Resolved
                              </button>
                              <button
                                onClick={() => editPost(post)}
                                title="Edit post"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                              >
                                <Edit2 className="w-4 h-4" /> Edit
                              </button>
                            </>
                          )}
                          {!isOwn && session && (
                            <button
                              onClick={() => claimItem(post)}
                              title="Claim this item"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
                            >
                              <CheckCircle className="w-4 h-4" /> Claim
                            </button>
                          )}
                        </>
                      )}

                      {/* Delete is always available to author/admin */}
                      {(isOwn || isAdmin) && (
                        pendingDelete === post.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => deletePost(post)}
                              title="Confirm delete"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Confirm
                            </button>
                            <button
                              onClick={() => setPendingDelete(null)}
                              title="Cancel"
                              className="px-2 py-1.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => deletePost(post)}
                            title="Delete post"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/60 transition"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!session && (
          <div className="text-center py-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <Bell className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Sign in to post items and get notifications</p>
          </div>
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
              <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium select-none">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            )}

            {/* Controls */}
            <div className="absolute top-4 right-3 z-50 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}
                disabled={zoom <= 1}
                className="text-white hover:text-emerald-400 disabled:opacity-30 transition p-2"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-7 h-7" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
                disabled={zoom >= 4}
                className="text-white hover:text-emerald-400 disabled:opacity-30 transition p-2"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-7 h-7" />
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="text-white hover:text-rose-400 transition p-2"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            {/* Prev */}
            {lightbox.images.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setZoom(1); setLightbox((lb) => lb ? { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length } : lb); }}
                className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition p-2 z-50"
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
                className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition p-2 z-50"
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
