import { useState, useEffect, useRef, useCallback } from "react";
import { useHashTab } from "@/hooks/useHashTab";
import {
  X,
  Youtube,
  Play,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Camera,
  Tag,
  UserPlus,
  Search,
  CheckCircle2,
  Check,
  Heart,
  Bell,
  BellRing,
  Trophy,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { WinnersWallSection } from "@/components/events/WinnersWallSection";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import { supabase } from "@/lib/supabase";
import { SocialCTA } from "@/components/SocialCTA";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
const VideoPlayerModal = lazy(() => import("@/components/VideoPlayerModal").then(mod => ({ default: mod.VideoPlayerModal })));
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { fetchRemoteGalleryImages, deleteRemoteGalleryImage, deleteRemoteGalleryImages, type RemoteGalleryItem } from "@/lib/galleryStorage";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { GalleryLightboxTags, type TagEntry } from "@/components/gallery/GalleryLightboxTags";

// ─── Lazy Image Component ───────────────────────────────────────────────────
function LazyImage({
  moduleLoader,
  url,
  alt,
  className,
  onClick,
}: {
  moduleLoader?: () => Promise<{ default: string }>;
  url?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (url) {
            setSrc(url);
          } else if (moduleLoader) {
            moduleLoader().then((mod) => setSrc(mod.default));
          }
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [moduleLoader, url]);

  return (
    <div ref={ref} className={className} onClick={onClick}>
      {src ? (
        <img
          loading="lazy"
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}



export default function Legacy() {
  usePageMeta({
    title: "Legacy",
    description:
      "Honoring the history, champions, and memories of IISc Badminton Club.",
  });

  const queryClient = useQueryClient();
  const { session, isAdmin, profile } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useHashTab(
    ["champions", "albums", "photos", "videos"] as const,
    "champions"
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [subscribedTags, setSubscribedTags] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("gallery_subscriptions") || "[]")); }
    catch { return new Set(); }
  });

  const handleLike = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setLikedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSubscribe = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setSubscribedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
        toast("Unsubscribed from " + formatText(tag), { icon: <Bell className="w-4 h-4 text-muted-foreground" /> });
      } else {
        next.add(tag);
        toast.success("Subscribed to " + formatText(tag) + "! You'll be notified of new photos.");
      }
      localStorage.setItem("gallery_subscriptions", JSON.stringify([...next]));
      return next;
    });
  };

  const [selectedSubfolder, setSelectedSubfolder] = useState("all");
  const [tagSearch, setTagSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(20);
  }, [activeTab, selectedCategory, selectedSubfolder]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + 20);
        }
      },
      { rootMargin: "400px" }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [activeTab, selectedCategory, selectedSubfolder]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);

  // ── Admin Selection Mode ────────────────────────────────────────────────────
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPaths(new Set());
  };

  const [galleryTags, setGalleryTags] = useState<Record<string, TagEntry[]>>({});
  const [pendingTags, setPendingTags] = useState<Record<string, TagEntry[]>>({});
  const [tagPlayers, setTagPlayers] = useState<{ id: string; full_name: string }[]>([]);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) navigate(1);
    if (isRightSwipe) navigate(-1);
  };

  // ── Keyboard navigation for lightbox ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "Escape") {
        setSelectedIndex(null);
        setLightboxSrc(null);
      }
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedIndex(null);
    setLightboxSrc(null);
  }, [selectedCategory, selectedSubfolder]);

  const { data: queryVideos = [] } = useQuery({
    queryKey: ["gallery-videos"],
    queryFn: () => fetchSiteData<any[]>("videos", "videos.json").then((d) => d || []),
    refetchInterval: 120_000,
  });

  const { data: remotePhotos = [], isLoading: loadingRemote } = useQuery({
    queryKey: ["gallery-remote-photos"],
    queryFn: fetchRemoteGalleryImages,
    refetchInterval: 300_000, // Refetch every 5 minutes
  });

  useEffect(() => {
    if (queryVideos.length > 0) setVideos(queryVideos);
  }, [queryVideos]);

  // Load saved tags from site_data on mount
  useEffect(() => {
    fetchSiteData<Record<string, TagEntry[]>>("gallery_tags", null)
      .then((data) => { if (data) setGalleryTags(data); })
      .catch(() => {});
    fetchSiteData<Record<string, TagEntry[]>>("gallery_pending_tags", null)
      .then((data) => { if (data) setPendingTags(data); })
      .catch(() => {});
  }, []);

  // Fetch player list lazily when lightbox first opens
  useEffect(() => {
    if (selectedIndex !== null && tagPlayers.length === 0) {
      supabase
        .from("players")
        .select("id, full_name")
        .order("full_name")
        .then(({ data }) => { if (data) setTagPlayers(data); });
    }
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTag = async (photoPath: string, player: { id: string; full_name: string }) => {
    const current = galleryTags[photoPath] || [];
    if (current.some((t) => t.id === player.id)) return;
    const updated = { ...galleryTags, [photoPath]: [...current, { id: player.id, name: player.full_name }] };
    setGalleryTags(updated);
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: updated }, { onConflict: "key" });
  };

  const removeTag = async (photoPath: string, playerId: string) => {
    const updated = { ...galleryTags, [photoPath]: (galleryTags[photoPath] || []).filter((t) => t.id !== playerId) };
    setGalleryTags(updated);
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: updated }, { onConflict: "key" });
  };

  const requestTag = async (photoPath: string) => {
    if (!session?.user) return;
    const currentUserPlayer = tagPlayers.find((p) => p.id === session.user.id);
    if (!currentUserPlayer) {
      toast.error("Your player profile could not be found.");
      return;
    }

    const currentPending = pendingTags[photoPath] || [];
    if (currentPending.some((t) => t.id === currentUserPlayer.id)) return;
    
    const updated = { ...pendingTags, [photoPath]: [...currentPending, { id: currentUserPlayer.id, name: currentUserPlayer.full_name }] };
    setPendingTags(updated);
    await supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: updated }, { onConflict: "key" });
    toast.success("Tag request sent!");
  };

  const approveTag = async (photoPath: string, tag: TagEntry) => {
    // Add to galleryTags
    const currentTags = galleryTags[photoPath] || [];
    const updatedTags = { ...galleryTags, [photoPath]: [...currentTags, tag] };
    setGalleryTags(updatedTags);
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: updatedTags }, { onConflict: "key" });

    // Remove from pendingTags
    const currentPending = pendingTags[photoPath] || [];
    const updatedPending = { ...pendingTags, [photoPath]: currentPending.filter((t) => t.id !== tag.id) };
    setPendingTags(updatedPending);
    await supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: updatedPending }, { onConflict: "key" });
  };

  const rejectTag = async (photoPath: string, tag: TagEntry) => {
    // Remove from pendingTags
    const currentPending = pendingTags[photoPath] || [];
    const updatedPending = { ...pendingTags, [photoPath]: currentPending.filter((t) => t.id !== tag.id) };
    setPendingTags(updatedPending);
    await supabase.from("site_data").upsert({ key: "gallery_pending_tags", value: updatedPending }, { onConflict: "key" });
  };

  // ── LAZY glob (not eager) ──────────────────────────────────────────
  const imageModules = import.meta.glob("/src/assets/gallery/**/*.{png,webp}", {
    eager: false,
  }) as Record<string, () => Promise<{ default: string }>>;

  const formatText = (text: string) =>
    text.replace(/[-_]/g, " ").replace(/\//g, " > ").replace(/\b\w/g, (c) => c.toUpperCase());

  const localGalleryItems = Object.entries(imageModules).map(
    ([path, loader], index) => {
      const cleanPath = path.replace("/src/assets/gallery/", "");
      const parts = cleanPath.split("/");
      const category = parts[0];
      const subfolder = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
      const filename = parts[parts.length - 1];
      const title = formatText(filename.replace(/\.[^/.]+$/, ""));
      return { id: index + 1, title, category, subfolder, loader, path: cleanPath };
    },
  );

  type UnifiedGalleryItem = {
    id: number;
    title: string;
    category: string;
    subfolder: string;
    path: string;
    url?: string;
    loader?: () => Promise<{ default: string }>;
  };

  // Merge remote items with local items, formatting remote items to match structure
  const galleryItems: UnifiedGalleryItem[] = [
    ...localGalleryItems,
    ...remotePhotos.map((photo, index) => ({
      ...photo,
      id: localGalleryItems.length + index + 1,
    }))
  ];

  const categories = [
    { id: "all", label: "All" },
    ...Array.from(new Set(galleryItems.map((item) => item.category))).map(
      (cat) => ({
        id: cat,
        label: formatText(cat),
      }),
    ),
  ];

  const subfolders =
    selectedCategory === "all" && categories.length > 2
      ? []
      : Array.from(
          new Set(
            galleryItems
              .filter(
                (item) =>
                  (selectedCategory === "all" ||
                    item.category === selectedCategory) &&
                  item.subfolder !== "",
              )
              .map((item) => item.subfolder),
          ),
        );


  // Read URL params to auto-select album
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter");
    if (filter) {
      const decoded = decodeURIComponent(filter);
      const isCategory = galleryItems.some((i) => i.category === decoded);
      if (isCategory) {
        setSelectedCategory(decoded);
        setSelectedSubfolder("all");
      } else {
        const match = galleryItems.find((i) => i.subfolder === decoded);
        if (match) {
          setSelectedCategory(match.category);
          // Small delay so state batching doesn't miss the subfolder selection
          setTimeout(() => setSelectedSubfolder(decoded), 0);
        }
      }
    }
  }, []);

  const updateUrlFilter = (filterValue: string, isSubfolder: boolean) => {
    const url = new URL(window.location.href);
    if (filterValue === "all" && !isSubfolder) {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", filterValue);
    }
    window.history.pushState({}, "", url.toString());
  };

  const filteredItems = galleryItems.filter((item) => {
    const categoryMatch =
      selectedCategory === "all" || item.category === selectedCategory;
    const subfolderMatch =
      selectedSubfolder === "all" || item.subfolder === selectedSubfolder;
    return categoryMatch && subfolderMatch;
  });

  const visibleItems = filteredItems.slice(0, visibleCount);
  
  const hasOpenedPhoto = useRef(false);
  useEffect(() => {
    if (hasOpenedPhoto.current || filteredItems.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const photoParam = params.get("photo");
    if (photoParam) {
      const decodedPath = decodeURIComponent(photoParam);
      const idx = filteredItems.findIndex(i => i.path === decodedPath);
      if (idx !== -1) {
        hasOpenedPhoto.current = true;
        setSelectedIndex(idx);
        const item = filteredItems[idx];
        if (item.url) setLightboxSrc(item.url);
        else if (item.loader) item.loader().then((mod: any) => setLightboxSrc(mod.default));
      }
    }
  }, [filteredItems]);

  const openLightbox = (idx: number) => {
    const item = filteredItems[idx];
    if (isSelectionMode && session && item.url) {
      const newSet = new Set(selectedPaths);
      if (newSet.has(item.path)) newSet.delete(item.path);
      else newSet.add(item.path);
      setSelectedPaths(newSet);
      return;
    }
    if (isSelectionMode) return; // Ignore clicks on local images during selection mode

    setSelectedIndex(idx);
    if (item.url) {
      setLightboxSrc(item.url);
    } else if (item.loader) {
      item.loader().then((mod) => setLightboxSrc(mod.default));
    }
  };

  const navigate = (dir: 1 | -1) => {
    if (selectedIndex === null) return;
    const next =
      (selectedIndex + dir + filteredItems.length) % filteredItems.length;
    setSelectedIndex(next);
    setLightboxSrc(null);
    const item = filteredItems[next];
    if (item.url) {
      setLightboxSrc(item.url);
    } else if (item.loader) {
      item.loader().then((mod) => setLightboxSrc(mod.default));
    }
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Hero Section */}
      <section className="bg-gradient-to-tr from-teal-800 via-emerald-700 to-lime-600 text-foreground py-4 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-1.5 rounded-full text-sm font-semibold mb-2">
            <Trophy className="w-4 h-4 text-amber-300" />
            Club Legends
          </div>
          <h1
            className="text-5xl md:text-6xl font-black mb-2 text-white"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Legacy
          </h1>
          <p className="text-xl text-emerald-50 max-w-2xl mx-auto leading-relaxed">
            Honoring the champions, the fighters, and the top performers of IISc Badminton Club, along with all our memories.
          </p>
          <div className="mt-4 flex justify-center w-full px-2">
            <div className="grid grid-cols-2 sm:flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 sm:flex-wrap sm:justify-center gap-1.5 sm:gap-0 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("champions")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "champions"
                    ? "bg-white text-emerald-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Trophy className="w-4 h-4" /> Champions
              </button>
              <button
                onClick={() => setActiveTab("albums")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "albums"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Camera className="w-4 h-4" /> Albums
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "photos"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <Camera className="w-4 h-4" /> All Photos
              </button>
              <button
                onClick={() => setActiveTab("videos")}
                className={`flex w-full sm:w-auto items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-[13px] sm:text-sm font-black transition-all ${
                  activeTab === "videos"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-foreground/80 hover:text-foreground hover:bg-white/10 scale-95"
                }`}
              >
                <PlayCircle className="w-4 h-4" /> All Videos
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeTab === "champions" && <WinnersWallSection />}

      {(activeTab === "albums" || activeTab === "photos") && (
      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          {/* Main Category Filter */}
          {(activeTab === "albums" || activeTab === "photos") && categories.length > 2 && (
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {categories.map((cat) => {
                const count =
                  cat.id === "all"
                    ? galleryItems.length
                    : galleryItems.filter((i) => i.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedSubfolder("all");
                      updateUrlFilter(cat.id, false);
                    }}
                    className={`px-6 py-2 rounded-full font-bold transition-all duration-300 flex items-center gap-2 ${
                      selectedCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-lg scale-105"
                        : "bg-gray-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`text-xs font-black px-1.5 py-0.5 rounded-full ${selectedCategory === cat.id ? "bg-white/25" : "bg-gray-200 dark:bg-slate-700 text-muted-foreground dark:text-muted-foreground"}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-folder Filter */}
          {(activeTab === "albums" || activeTab === "photos") && subfolders.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 justify-center mb-12 animate-in fade-in slide-in-from-top-4 w-full sm:max-w-2xl sm:mx-auto">
              <button
                onClick={() => {
                  setSelectedSubfolder("all");
                  updateUrlFilter(selectedCategory, false);
                }}
                className={`col-span-2 w-full px-5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-sm font-semibold transition ${
                  selectedSubfolder === "all"
                    ? "bg-blue-900 dark:bg-blue-700 text-foreground"
                    : "bg-gray-100 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                {activeTab === "photos" ? "All Photos" : "All Albums"}
              </button>
              {subfolders.map((sub, i) => {
                const isOddLast = (subfolders.length % 2 !== 0) && (i === subfolders.length - 1);
                return (
                  <div key={sub} className={`flex items-center gap-1 group relative w-full ${isOddLast ? 'col-span-2' : 'col-span-1'}`}>
                    <button
                      onClick={() => {
                        setSelectedSubfolder(sub);
                        updateUrlFilter(sub, true);
                      }}
                      className={`w-full px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-[13px] sm:text-sm font-semibold transition pr-10 truncate ${
                        selectedSubfolder === sub
                          ? "bg-blue-900 dark:bg-blue-700 text-foreground shadow-md"
                          : "bg-gray-100 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {formatText(sub)}
                    </button>
                    <button
                      onClick={(e) => handleSubscribe(e, sub)}
                      className={`absolute right-1.5 p-1.5 rounded-full transition-colors ${
                        subscribedTags.has(sub) 
                          ? "text-primary hover:text-primary bg-primary/10" 
                          : "text-gray-400 hover:text-primary hover:bg-primary/10 opacity-0 sm:group-hover:opacity-100"
                      }`}
                      title={subscribedTags.has(sub) ? "Unsubscribe" : "Subscribe to notifications"}
                    >
                      {subscribedTags.has(sub) ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Masonry Gallery ── */}
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {visibleItems.map((item, idx) => {
              // Vary aspect ratio for true masonry feel
              const aspectClass =
                idx % 5 === 0
                  ? "aspect-[3/4]"
                  : idx % 5 === 3
                    ? "aspect-[4/3]"
                    : "aspect-square";
              return (
                <div
                  key={item.id}
                  className={`group relative ${aspectClass} overflow-hidden rounded-2xl cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500 opacity-0 mb-4 break-inside-avoid ${isSelectionMode && selectedPaths.has(item.path) ? "ring-4 ring-red-500 scale-[0.98]" : ""}`}
                  style={{
                    animation: `fadeSlideUp 0.4s ease forwards`,
                    animationDelay: `${Math.min(idx * 40, 800)}ms`,
                  }}
                  onClick={() => openLightbox(idx)}
                >
                  {/* Selection Checkbox */}
                  {isSelectionMode && session && item.url && (
                    <div className="absolute top-3 left-3 z-20">
                      {selectedPaths.has(item.path) ? (
                        <div className="w-6 h-6 rounded-full bg-red-500 text-foreground flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-black/40 border-2 border-white/80 text-transparent flex items-center justify-center shadow-lg backdrop-blur-sm" />
                      )}
                    </div>
                  )}

                  {/* Lazy image */}
                  <LazyImage
                    moduleLoader={item.loader}
                    url={item.url}
                    alt={item.title}
                    className="w-full h-full"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                    <h3 className="text-foreground font-black text-base tracking-wide drop-shadow-md line-clamp-2">
                      {item.title}
                    </h3>
                    {item.subfolder && (
                      <p className="text-primary/70 font-bold text-xs mt-1 uppercase tracking-widest drop-shadow">
                        {formatText(item.subfolder)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < filteredItems.length && (
            <div ref={observerRef} className="h-20 w-full flex items-center justify-center mt-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18v-12A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
                </svg>
              </div>
              <p className="text-muted-foreground dark:text-muted-foreground font-medium">No photos in this category yet.</p>
            </div>
          )}

          {/* Videos embedded within Albums */}
          {activeTab === "albums" && videos.filter(v => {
            if (selectedCategory !== "all" && (!v.tournament || !v.tournament.toLowerCase().includes(selectedCategory.toLowerCase().replace(/[-_]/g, ' ')))) return false;
            if (selectedSubfolder !== "all" && (!v.tournament || !v.tournament.toLowerCase().includes(selectedSubfolder.toLowerCase().replace(/[-_]/g, ' ')))) return false;
            return true;
          }).length > 0 && (
            <div className="mt-12 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
                <h2 className="text-3xl font-black text-blue-900 dark:text-foreground">
                  Match Videos
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {videos.filter(v => {
                  if (selectedCategory !== "all" && (!v.tournament || !v.tournament.toLowerCase().includes(selectedCategory.toLowerCase().replace(/[-_]/g, ' ')))) return false;
                  if (selectedSubfolder !== "all" && (!v.tournament || !v.tournament.toLowerCase().includes(selectedSubfolder.toLowerCase().replace(/[-_]/g, ' ')))) return false;
                  return true;
                }).map((video) => (
                  <button
                    key={video.id}
                    className="group text-left bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl border border-slate-100 dark:border-slate-700 transition duration-500"
                    onClick={() => setActiveVideo(video)}
                  >
                    <div className="relative aspect-video">
                      <img
                        src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {video.tournament && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-foreground text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all">
                          {video.tournament}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-600/90 text-foreground rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-red-600 transition-all duration-300">
                          <Play className="w-8 h-8 ml-1" fill="currentColor" stroke="none" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-7">
                      <h3 className="text-lg sm:text-xl font-bold text-blue-900 dark:text-foreground group-hover:text-primary dark:group-hover:text-primary transition-colors line-clamp-2">
                        {video.title}
                      </h3>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === "videos" && (
      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
              <h2
                className="text-3xl font-black text-blue-900 dark:text-foreground"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Match Videos
              </h2>
            </div>
            <p className="text-muted-foreground dark:text-muted-foreground max-w-2xl mx-auto">
              Championship points, finals and highlights from our YouTube
              channel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {videos.map((video) => (
              <button
                key={video.id}
                className="group text-left bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl border border-slate-100 dark:border-slate-700 transition duration-500"
                onClick={() => setActiveVideo(video)}
              >
                <div className="relative aspect-video">
                  <img
                    src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      if (!e.currentTarget.src.includes("mqdefault")) {
                        e.currentTarget.src = `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
                      }
                    }}
                  />
                  {video.tournament && (
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-foreground text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all">
                      {video.tournament}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-600/90 text-foreground rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-red-600 transition-all duration-300">
                      <Play
                        className="w-8 h-8 ml-1"
                        fill="currentColor"
                        stroke="none"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-primary dark:text-primary font-bold text-xs uppercase tracking-widest">
                      <PlayCircle className="w-4 h-4" />
                      {video.category || "Match Highlight"}
                    </div>
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-red-600 dark:text-muted-foreground dark:hover:text-red-400 transition-colors bg-gray-100 hover:bg-red-50 dark:bg-slate-800/50 dark:hover:bg-red-900/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Youtube className="w-3.5 h-3.5" />
                      <span>YouTube</span>
                    </a>
                  </div>
                  <h3 className="text-xl font-bold text-blue-900 dark:text-foreground group-hover:text-primary dark:group-hover:text-primary transition-colors">
                    {video.title}
                  </h3>
                  {(video.chapters?.length ?? 0) > 0 && (
                    <p className="text-gray-400 dark:text-muted-foreground text-xs mt-2">
                      {video.chapters.length} chapter
                      {video.chapters.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
              <p className="text-gray-400 dark:text-muted-foreground italic">
                New videos are being processed. Stay tuned!
              </p>
            </div>
          )}

          <div className="mt-12 text-center">
            <a
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-red-600 dark:text-red-400 font-bold hover:text-red-700 dark:hover:text-red-300 transition-colors text-lg"
            >
              <Youtube className="w-7 h-7" />
              Visit our YouTube Channel
            </a>
          </div>
        </div>
      </section>
      )}

      {/* Social Media */}
      <section className="py-16 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <SocialCTA />
        </div>
      </section>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => {
            setSelectedIndex(null);
            setLightboxSrc(null);
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-foreground/60 text-sm font-medium select-none">
            {selectedIndex + 1} / {filteredItems.length}
          </div>
          <button
            className="absolute top-4 right-2 md:right-4 text-foreground hover:text-primary transition-colors p-2 z-50"
            onClick={() => {
              setSelectedIndex(null);
              setLightboxSrc(null);
            }}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors p-2 z-50"
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          {lightboxSrc ? (
            <img
              key={selectedIndex}
              src={lightboxSrc}
              alt={filteredItems[selectedIndex]?.title || ""}
              className="max-h-[85vh] max-w-[95vw] md:max-w-[85vw] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200 relative z-40"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="w-64 h-64 rounded-xl bg-gray-800 animate-pulse relative z-40" />
          )}

          <button
            className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors p-2 z-50"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-4 pb-28 md:pb-6 pt-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-50 flex flex-col items-center gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-2 w-full max-w-4xl">
              {selectedIndex !== null && (() => {
                const item = filteredItems[selectedIndex];
                const tags = galleryTags[item?.path] || [];
                const filteredPlayers = tagPlayers.filter((p) =>
                  p.full_name.toLowerCase().includes(tagSearch.toLowerCase())
                );
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <p className="text-foreground text-base md:text-xl font-bold tracking-wide drop-shadow-lg leading-tight text-center">
                        {item?.title}
                      </p>
                      <motion.button
                        onClick={(e) => handleLike(e, item?.path || "")}
                        whileTap={{ scale: 0.8 }}
                        animate={likedPhotos.has(item?.path || "") ? { scale: [1, 1.4, 1] } : {}}
                        transition={{ duration: 0.3 }}
                        className="p-2 -mr-2"
                      >
                        <Heart 
                          className={`w-6 h-6 md:w-7 md:h-7 drop-shadow-lg transition-colors ${
                            likedPhotos.has(item?.path || "") 
                              ? "fill-rose-500 text-rose-500" 
                              : "text-foreground hover:text-rose-400"
                          }`} 
                        />
                      </motion.button>
                    </div>
                    {item?.subfolder && (
                      <p className="text-primary/70 font-medium text-xs uppercase tracking-widest drop-shadow-md">
                        {formatText(item.subfolder)}
                      </p>
                    )}

                  {/* Extracted Tagging Component */}
                  <GalleryLightboxTags
                    key={item?.path}
                    itemPath={item?.path || ""}
                    tags={tags}
                    pendingTags={pendingTags[item?.path] || []}
                    session={session}
                    isAdmin={isAdmin}
                    currentUserProfile={profile}
                    tagPlayers={tagPlayers}
                    setLocation={setLocation}
                    removeTag={removeTag}
                    approveTag={approveTag}
                    rejectTag={rejectTag}
                    requestTag={requestTag}
                    saveTag={saveTag}
                  />

                  {/* Remove Button for Remote Photos */}
                  {isAdmin && item?.url && (
                      <button
                        className="flex items-center gap-1.5 text-foreground/50 hover:text-red-400 text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 hover:border-red-400/40 hover:bg-red-400/10 transition-all"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Remove this photo from the gallery?")) {
                            try {
                              await deleteRemoteGalleryImage(item.path);
                              toast.success("Photo removed from gallery");
                              setSelectedIndex(null);
                              setLightboxSrc(null);
                              queryClient.invalidateQueries({ queryKey: ["gallery-remote-photos"] });
                            } catch (err) {
                              toast.error("Failed to remove photo");
                            }
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  <p className="text-foreground/30 text-[10px] mt-1 hidden sm:block">
                    ← → to navigate &nbsp;·&nbsp; Esc to close
                  </p>
                </>
              );
            })()}
            </div>
          </div>
        </div>
      )}

      {/* Video player modal */}
      {activeVideo && (
        <Suspense fallback={null}>
          <VideoPlayerModal
            video={activeVideo}
            onClose={() => setActiveVideo(null)}
          />
        </Suspense>
      )}
      {/* Admin Uploader */}
      {session && <GalleryUploader remotePhotos={remotePhotos} />}

      {/* Admin Bulk Selection Toolbar */}
      {session && (activeTab === "albums" || activeTab === "photos") && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3">
          {isSelectionMode ? (
            <div className="bg-slate-900 text-foreground px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
              <span className="font-bold">{selectedPaths.size} selected</span>
              <button
                className="text-primary hover:text-primary/70 font-bold transition flex items-center gap-2 text-sm whitespace-nowrap"
                onClick={() => {
                  const remotePaths = filteredItems.filter(i => i.url).map(i => i.path);
                  if (selectedPaths.size === remotePaths.length && remotePaths.length > 0) {
                    setSelectedPaths(new Set());
                  } else {
                    setSelectedPaths(new Set(remotePaths));
                  }
                }}
              >
                {selectedPaths.size > 0 && selectedPaths.size === filteredItems.filter(i => i.url).length ? "Deselect All" : "Select All"}
              </button>
              <div className="w-px h-6 bg-slate-700" />
              <button
                className="text-red-400 hover:text-red-300 font-bold transition flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                disabled={selectedPaths.size === 0 || isDeleting}
                onClick={async () => {
                  if (confirm(`Delete ${selectedPaths.size} images permanently?`)) {
                    setIsDeleting(true);
                    try {
                      await deleteRemoteGalleryImages(Array.from(selectedPaths));
                      toast.success(`Deleted ${selectedPaths.size} images!`);
                      setIsSelectionMode(false);
                      setSelectedPaths(new Set());
                      queryClient.invalidateQueries({ queryKey: ["gallery-remote-photos"] });
                    } catch (err) {
                      toast.error("Failed to delete images.");
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                className="text-muted-foreground hover:text-foreground transition font-medium ml-2"
                onClick={toggleSelectionMode}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md text-foreground px-6 py-3 rounded-full shadow-2xl font-bold transition-all hover:scale-105 active:scale-95"
              onClick={toggleSelectionMode}
            >
              Select Photos
            </button>
          )}
        </div>
      )}
    </div>
  );
}

