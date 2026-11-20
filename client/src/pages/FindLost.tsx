import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

import { hubService } from "@/services/hubService";
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
  claim_contact?: string;
  claimed_at?: string;
  claim_message?: string;
  remarks?: string;
  created_at: string;
  updated_at?: string;
  author?: { full_name: string; avatar_url?: string };
}

const TYPE_STYLES: Record<PostType, { bg: string; badge: string; icon: any; label: string }> = {
  lost: {
    bg: "border-danger/25",
    badge: "bg-danger/15 text-danger",
    icon: PackageSearch,
    label: "LOST",
  },
  found: {
    bg: "border-primary/40",
    badge: "bg-primary/40 text-primary",
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
        const publicUrl = await hubService.uploadFindLostImage(file);
        uploaded.push(publicUrl);
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
    setForm({ type: "lost", title: "", description: "", location: "", contact: "", remarks: "", images: [] });
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
      remarks: post.remarks || "",
      images: postImages(post)
    });
    setShowForm(true);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hubService.getFindLostPosts({
        type: filter,
        resolved: showResolved,
      });
      setPosts(data as unknown as Post[]);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
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
    return hubService.subscribeToFindLost((newPost) => {
      setPosts((prev) => [newPost as Post, ...prev]);
      toast.info("New Find & Lost post!", { description: (newPost as Post).title });
    });
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

      if (editingId) {
        await hubService.updateFindLostPost(editingId, { ...payload, updated_at: new Date().toISOString() });
      } else {
        await hubService.createFindLostPost({ ...payload, author_id: profile.id });
      }
      
      toast.success(editingId ? "Post updated!" : "Post published!");

      if (!editingId) {
        void hubService.notifyFindLost({
          type: form.type,
          title: form.title.trim(),
          author_name: profile.full_name || "A user",
          author_id: profile.id,
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
    try {
      await hubService.updateFindLostPost(post.id, { resolved: true });
      toast.success("Marked as resolved!");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to resolve post");
    }
  };

  const claimItem = async (post: Post, claimMsg?: string, claimContact?: string) => {
    if (!profile?.id) return;
    
    try {
      await hubService.claimFindLostItemRpc({
        postUuid: post.id,
        claimerId: profile.id,
        claimerName: profile.full_name,
        claimMsg: claimMsg || null,
        claimContactInfo: claimContact || null,
      });
      toast.success(post.type === "lost" ? "Thanks for reporting this found!" : "Successfully claimed!");
      setClaimingPostId(null);
      setClaimContactInput("");
      load(); // Reload to get updated state
    } catch (error: any) {
      toast.error(error.message || "Failed to claim item. Check if columns exist.");
    }
  };

  const unclaimItem = async (post: Post) => {
    if (!profile?.id) return;
    
    try {
      await hubService.unclaimFindLostItemRpc({
        postUuid: post.id,
        userId: profile.id,
      });
      toast.success("Successfully unclaimed!");
      load();
    } catch (error: any) {
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
    try {
      await hubService.deleteFindLostPost(post.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete post");
      return;
    }

    // Clean up associated images from the storage bucket (best-effort)
    const paths = postImages(post)
      .map(storagePathFromUrl)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      hubService.removeFindLostImages(paths).catch((storageErr) => {
        console.error("Failed to delete post images from storage:", storageErr);
      });
    }

    toast.success("Post deleted");
    load();
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-border-strong bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
  const labelCls = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-background pb-safe pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-r from-card via-info/20 to-card text-on-accent py-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,color-mix(in_srgb,var(--info)_15%,transparent),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/10 border border-foreground/20 text-[10px] font-black uppercase tracking-widest mb-1.5">
            <Search className="w-3 h-3 text-info" /> Find &amp; Lost
            <InfoModal
              title="FIND &amp; LOST"
              items={[
                { badge: "NOTIFY", title: "Real-time Alerts", desc: "Whenever you post an item, all users will see it in the global feed." },
                { badge: "CLAIM", title: "Claiming an item", desc: "Click 'Claim' on an item to securely ping the poster that you have their item or want to collect it." }
              ]}
              triggerClassName="text-foreground hover:text-info"
            />
          </div>
          <h1 className="text-xl font-black mb-1">Lost something on court?</h1>
          <p className="text-soft text-xs leading-snug">Post lost or found items at IISc courts. Get real-time notifications when someone replies.</p>
          {session && (
            <Button
              onClick={openNewPost}
              className="mt-3 bg-info hover:bg-info/90 shadow-lg shadow-info/40"
            >
              <Plus className="w-3.5 h-3.5" /> Post Item
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
        {!session ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-card rounded-3xl border border-border text-center shadow-sm">
            <Search className="w-12 h-12 text-faint mb-4" />
            <h2 className="text-xl font-black text-soft mb-2">Sign in to view Lost & Found</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              You must be logged in to see or post items in this section.
            </p>
            <Button onClick={() => setLocation('/join')} className="rounded-xl px-6 h-11">
              Sign In / Join
            </Button>
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
              className="bg-card rounded-3xl p-6 border border-border shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-foreground">
                  {editingId ? "Edit Post" : "New Post"}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditingId(null); }} aria-label="Close form" className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Type toggle */}
              <div className="flex bg-background p-1.5 rounded-2xl mb-6 shadow-inner ring-1 ring-inset ring-border/60">
                {(["lost", "found"] as PostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                      form.type === t 
                        ? (t === "lost" 
                            ? "bg-danger/20 text-danger ring-1 ring-danger/30 shadow-[0_0_15px_color-mix(in_srgb,var(--danger)_10%,transparent)]" 
                            : "bg-team/20 text-team ring-1 ring-team/30 shadow-[0_0_15px_color-mix(in_srgb,var(--team)_10%,transparent)]")
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
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
                          className="w-16 h-16 rounded-xl object-cover border border-border-strong cursor-zoom-in"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute -top-2 -right-2 bg-danger hover:bg-danger/90 text-on-accent rounded-full p-0.5 shadow"
                          aria-label="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {form.images.length < MAX_IMAGES && (
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted-strong text-soft font-bold text-sm rounded-xl transition">
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
                          className="text-[10px] font-bold bg-info/10 hover:bg-info/20 text-info px-2 py-1 rounded-md transition text-left"
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
                  className="bg-info hover:bg-info/90 text-on-accent"
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
            <Button
              key={f}
              size="pill"
              variant={filter === f ? "pillActive" : "pillMuted"}
              onClick={() => setFilter(f)}
              className={filter === f ? "bg-info text-info-foreground shadow-md" : "border border-border-strong hover:border-info"}
            >
              {f === "all" ? "All" : f === "lost" ? "Lost" : "Found"}
            </Button>
          ))}
          <Button
            size="pill"
            variant={showResolved ? "pillActive" : "pillMuted"}
            onClick={() => setShowResolved((v) => !v)}
            className={`ml-auto ${showResolved ? "bg-info text-info-foreground" : "border border-border-strong"}`}
          >
            {showResolved ? "Show Active" : "Show Resolved"}
          </Button>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-info" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border">
            <PackageSearch className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-black text-soft mb-1">No posts yet</h3>
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
                  className={`bg-card rounded-2xl p-5 border shadow-sm ${post.resolved ? "opacity-60" : ""} ${style.bg}`}
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
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-foreground text-base mb-1">{post.title}</h3>
                      {post.description && (
                        <p className="text-sm text-soft mb-2">{post.description}</p>
                      )}
                      
                      {images.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {images.map((url, i) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => openLightbox(images, i)}
                              className="relative group rounded-xl overflow-hidden border border-border focus:outline-none focus:ring-2 focus:ring-info"
                            >
                              <img
                                src={url}
                                alt={`${post.title} ${i + 1}`}
                                className={`object-cover cursor-zoom-in transition group-hover:opacity-90 ${images.length === 1 ? "w-full max-w-sm max-h-72" : "w-24 h-24"}`}
                              />
                              <span className="absolute bottom-1 right-1 bg-media/55 text-on-media rounded-md p-1 opacity-0 group-hover:opacity-100 transition">
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
                                <a href={href} target="_blank" rel="noreferrer" className="text-info hover:underline transition">
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
                            <CheckCircle className="w-3.5 h-3.5 text-info" /> <span className="text-info font-medium">{post.remarks}</span>
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
                            by <strong className="text-soft truncate max-w-[140px]">{post.author.full_name}</strong>
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/40 text-primary cursor-default"
                          >
                            <CheckCircle className="w-4 h-4" /> Resolved
                          </span>
                          {/* Claim status (replaces the "Claim" action) */}
                          {post.claimed_by_name && (
                            <div className="flex flex-col gap-1 items-end">
                              <span
                                title={post.claimed_at ? `${post.type === 'lost' ? 'Found' : 'Claimed'} on ${new Date(post.claimed_at).toLocaleString()}` : `${post.type === 'lost' ? 'Found' : 'Claimed'} by ${post.claimed_by_name}`}
                                className="flex flex-col px-3 py-1.5 rounded-xl bg-info/15 text-info cursor-default max-w-[12rem] text-right"
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
                                  <span className="text-[10px] font-medium mt-1 bg-info/10 px-1.5 py-0.5 rounded text-info inline-block w-full text-right leading-tight">
                                    {post.claim_message}
                                  </span>
                                )}
                                {post.claim_contact && (
                                  <span className="text-[10px] font-medium mt-0.5 bg-info/10 px-1.5 py-0.5 rounded text-info inline-flex items-center justify-end gap-1 w-full text-right leading-tight">
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
                                        <a href={href} target="_blank" rel="noreferrer" className="hover:underline text-info">{post.claim_contact}</a>
                                      ) : <span>{post.claim_contact}</span>;
                                    })()}
                                  </span>
                                )}
                              </span>
                              {(post.claimed_by_id === profile?.id || isOwn || isAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="pill"
                                  onClick={() => unclaimItem(post)}
                                  className="text-danger hover:text-danger/80 hover:bg-danger/10 gap-1 text-[10px]"
                                >
                                  <RotateCcw className="w-3 h-3" /> Undo {post.type === 'lost' ? 'Find' : 'Claim'}
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {(isOwn || isAdmin) && (
                            <Button
                              size="pill"
                              onClick={() => resolve(post)}
                              title="Mark as resolved"
                              className="bg-team/15 text-team hover:bg-team/25 w-full justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                            >
                              <CheckCircle className="w-4 h-4" /> Mark as Resolved
                            </Button>
                          )}
                          {!isOwn && session && claimingPostId !== post.id && (
                            <Button
                              size="pill"
                              onClick={() => setClaimingPostId(post.id)}
                              title={post.type === "lost" ? "I found this item!" : "Claim this item"}
                              className="bg-info/15 text-info hover:bg-info/25 w-full justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                            >
                              <CheckCircle className="w-4 h-4" /> {post.type === "lost" ? "I found this!" : "Claim"}
                            </Button>
                          )}
                          {!isOwn && session && claimingPostId === post.id && (
                            <div className="flex flex-col gap-1.5 items-end mt-1 w-full max-w-[140px]">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Contact / WhatsApp</span>
                              <input 
                                value={claimContactInput}
                                onChange={e => setClaimContactInput(e.target.value)}
                                placeholder="Phone or Email (Optional)"
                                className="text-[10px] w-full text-right bg-card border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-info"
                              />
                              {post.type === "lost" ? (
                                <>
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Where did you keep it?</span>
                                  <div className="flex flex-col items-end gap-1.5 w-full">
                                    {["Kept at table", "Kept in wooden wardrobe", "Handed to Court Staff", "It's with me"].map(msg => (
                                      <button
                                        key={msg}
                                        onClick={() => claimItem(post, msg, claimContactInput)}
                                        className="text-[10px] font-bold bg-info/15 hover:bg-info/25 text-info px-2 py-1.5 rounded-lg transition w-full text-right"
                                      >
                                        {msg}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <Button
                                  size="pill"
                                  onClick={() => claimItem(post, undefined, claimContactInput)}
                                  className="bg-info hover:bg-info/90 text-info-foreground w-full text-center mt-1 px-3 py-1.5 rounded-lg text-[10px]"
                                >
                                  Confirm Claim
                                </Button>
                              )}
                              <Button variant="ghost" size="pill" onClick={() => setClaimingPostId(null)} className="text-[10px] text-muted-foreground px-1 py-0.5 mt-0.5">Cancel</Button>
                            </div>
                          )}
                        </>
                      )}

                      {(isOwn || isAdmin) && (
                        <div className="flex gap-2 justify-end w-full mt-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => editPost(post)}
                            aria-label="Edit post"
                            className="w-8 h-8 rounded-xl bg-warning/15 text-warning hover:bg-warning/25 shrink-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          
                          {pendingDelete === post.id ? (
                            <div className="flex gap-1 bg-danger/10 p-1 rounded-xl shrink-0">
                              <Button
                                size="icon"
                                onClick={() => deletePost(post)}
                                aria-label="Confirm delete"
                                className="w-6 h-6 rounded-lg bg-danger text-danger-foreground hover:bg-danger/90"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPendingDelete(null)}
                                aria-label="Cancel delete"
                                className="w-6 h-6 rounded-lg bg-muted-strong text-muted-foreground hover:bg-faint"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPendingDelete(post.id)}
                              aria-label="Delete post"
                              className="w-8 h-8 rounded-xl bg-danger/15 text-danger hover:bg-danger/25 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
            className="fixed inset-0 z-[100] bg-media/95 backdrop-blur-sm flex items-center justify-center"
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
                className="text-foreground hover:text-danger transition p-2"
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
