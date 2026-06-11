import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { fetchSiteData } from "@/lib/siteData";
import { supabase } from "@/lib/supabase";
import { SocialCTA } from "@/components/SocialCTA";
import { VideoPlayerModal } from "@/components/VideoPlayerModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

// ─── Lazy Image Component ───────────────────────────────────────────────────
function LazyImage({
  moduleLoader,
  alt,
  className,
  onClick,
}: {
  moduleLoader: () => Promise<{ default: string }>;
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
          moduleLoader().then((mod) => setSrc(mod.default));
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [moduleLoader]);

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

type TagEntry = { id: string; name: string };

export default function Gallery() {
  usePageMeta({
    title: "Gallery",
    description:
      "Photos and videos from IISc Badminton Club tournaments and events.",
  });

  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"albums" | "photos" | "videos">("albums");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubfolder, setSelectedSubfolder] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);

  // ── Player tagging ──────────────────────────────────────────────────────────
  const [galleryTags, setGalleryTags] = useState<Record<string, TagEntry[]>>({});
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagPlayers, setTagPlayers] = useState<Array<{ id: string; full_name: string }>>([]);

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

  const loadVideos = useCallback(() => {
    fetchSiteData<any[]>("videos", "videos.json")
      .then((data) => setVideos(data))
      .catch((err) => console.error("Error loading videos:", err));
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Auto-refresh every 2 min
  useAutoRefresh(loadVideos, 120_000);

  // Load saved tags from site_data on mount
  useEffect(() => {
    fetchSiteData<Record<string, TagEntry[]>>("gallery_tags", null)
      .then((data) => { if (data) setGalleryTags(data); })
      .catch(() => {});
  }, []);

  // Fetch player list lazily when lightbox first opens
  useEffect(() => {
    if (selectedIndex !== null && tagPlayers.length === 0) {
      supabase
        .from("players")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name")
        .then(({ data }) => { if (data) setTagPlayers(data); });
    }
    setShowTagPanel(false);
    setTagSearch("");
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTag = async (photoPath: string, player: { id: string; full_name: string }) => {
    const current = galleryTags[photoPath] || [];
    if (current.some((t) => t.id === player.id)) return;
    const updated = { ...galleryTags, [photoPath]: [...current, { id: player.id, name: player.full_name }] };
    setGalleryTags(updated);
    setShowTagPanel(false);
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: updated }, { onConflict: "key" });
  };

  const removeTag = async (photoPath: string, playerId: string) => {
    const updated = { ...galleryTags, [photoPath]: (galleryTags[photoPath] || []).filter((t) => t.id !== playerId) };
    setGalleryTags(updated);
    await supabase.from("site_data").upsert({ key: "gallery_tags", value: updated }, { onConflict: "key" });
  };

  // ── LAZY glob (not eager) ──────────────────────────────────────────
  const imageModules = import.meta.glob("/src/assets/gallery/**/*.{png,webp}", {
    eager: false,
  }) as Record<string, () => Promise<{ default: string }>>;

  const formatText = (text: string) =>
    text.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const galleryItems = Object.entries(imageModules).map(
    ([path, loader], index) => {
      const cleanPath = path.replace("/src/assets/gallery/", "");
      const parts = cleanPath.split("/");
      const category = parts[0];
      const subfolder = parts.length > 2 ? parts[1] : "";
      const filename = parts[parts.length - 1];
      const title = formatText(filename.replace(/\.[^/.]+$/, ""));
      return { id: index + 1, title, category, subfolder, loader, path: cleanPath };
    },
  );

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

  const openLightbox = (idx: number) => {
    setSelectedIndex(idx);
    filteredItems[idx].loader().then((mod) => setLightboxSrc(mod.default));
  };

  const navigate = (dir: 1 | -1) => {
    if (selectedIndex === null) return;
    const next =
      (selectedIndex + dir + filteredItems.length) % filteredItems.length;
    setSelectedIndex(next);
    setLightboxSrc(null);
    filteredItems[next].loader().then((mod) => setLightboxSrc(mod.default));
  };

  return (
    <div className="min-h-screen font-sans">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-emerald-950 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 px-4 py-2 rounded-full text-sm font-semibold mb-5">
            <Camera className="w-4 h-4" /> Photos & Videos
          </div>
          <h1
            className="text-5xl md:text-6xl font-black mb-5"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Gallery
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Relive the intensity of tournaments, the focus of practice, and the
            vibrant badminton community at IISc.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 flex-wrap justify-center gap-1 sm:gap-0">
              <button
                onClick={() => setActiveTab("albums")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "albums"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Camera className="w-4 h-4" /> Albums
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "photos"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Camera className="w-4 h-4" /> All Photos
              </button>
              <button
                onClick={() => setActiveTab("videos")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "videos"
                    ? "bg-white text-blue-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <PlayCircle className="w-4 h-4" /> All Videos
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeTab === "albums" || activeTab === "photos" ? (
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
                        ? "bg-emerald-500 text-white shadow-lg scale-105"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`text-xs font-black px-1.5 py-0.5 rounded-full ${selectedCategory === cat.id ? "bg-white/25" : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"}`}
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
            <div className="flex flex-wrap gap-3 justify-center mb-12 animate-in fade-in slide-in-from-top-4">
              <button
                onClick={() => {
                  setSelectedSubfolder("all");
                  updateUrlFilter(selectedCategory, false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
                  selectedSubfolder === "all"
                    ? "bg-blue-900 dark:bg-blue-700 text-white"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                All Albums
              </button>
              {subfolders.map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setSelectedSubfolder(sub);
                    updateUrlFilter(sub, true);
                  }}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
                    selectedSubfolder === sub
                      ? "bg-blue-900 dark:bg-blue-700 text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {formatText(sub)}
                </button>
              ))}
            </div>
          )}

          {/* ── Masonry Gallery ── */}
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {filteredItems.map((item, idx) => {
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
                  className={`group relative ${aspectClass} overflow-hidden rounded-2xl cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500 opacity-0 mb-4 break-inside-avoid`}
                  style={{
                    animation: `fadeSlideUp 0.4s ease forwards`,
                    animationDelay: `${Math.min(idx * 40, 800)}ms`,
                  }}
                  onClick={() => openLightbox(idx)}
                >
                  {/* Lazy image */}
                  <LazyImage
                    moduleLoader={item.loader}
                    alt={item.title}
                    className="w-full h-full"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                    <h3 className="text-white font-black text-base tracking-wide drop-shadow-md line-clamp-2">
                      {item.title}
                    </h3>
                    {item.subfolder && (
                      <p className="text-emerald-300 font-bold text-xs mt-1 uppercase tracking-widest drop-shadow">
                        {formatText(item.subfolder)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18v-12A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No photos in this category yet.</p>
            </div>
          )}

          {/* Videos embedded within Albums */}
          {activeTab === "albums" && videos.filter(v => selectedCategory === "all" || (v.tournament && v.tournament.toLowerCase().includes(selectedCategory.toLowerCase().replace(/[-_]/g, ' ')))).length > 0 && (
            <div className="mt-16 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
                <h2 className="text-3xl font-black text-blue-900 dark:text-white">
                  Match Videos
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {videos.filter(v => selectedCategory === "all" || (v.tournament && v.tournament.toLowerCase().includes(selectedCategory.toLowerCase().replace(/[-_]/g, ' ')))).map((video) => (
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
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all">
                          {video.tournament}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-600/90 text-white rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-red-600 transition-all duration-300">
                          <Play className="w-8 h-8 ml-1" fill="currentColor" stroke="none" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-7">
                      <h3 className="text-lg sm:text-xl font-bold text-blue-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
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
      ) : (
      <section className="py-16 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" />
              <h2
                className="text-3xl font-black text-blue-900 dark:text-white"
                style={{ fontFamily: "Playfair Display, serif" }}
              >
                Match Videos
              </h2>
            </div>
            <p className="text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
              Championship points, finals and highlights from our YouTube
              channel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all">
                      {video.tournament}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-600/90 text-white rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-red-600 transition-all duration-300">
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
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest">
                      <PlayCircle className="w-4 h-4" />
                      {video.category || "Match Highlight"}
                    </div>
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors bg-gray-100 hover:bg-red-50 dark:bg-slate-800/50 dark:hover:bg-red-900/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Youtube className="w-3.5 h-3.5" />
                      <span>YouTube</span>
                    </a>
                  </div>
                  <h3 className="text-xl font-bold text-blue-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {video.title}
                  </h3>
                  {(video.chapters?.length ?? 0) > 0 && (
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-2">
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
              <p className="text-gray-400 dark:text-slate-500 italic">
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
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium select-none">
            {selectedIndex + 1} / {filteredItems.length}
          </div>
          <button
            className="absolute top-4 right-2 md:right-4 text-white hover:text-emerald-400 transition-colors p-2 z-50"
            onClick={() => {
              setSelectedIndex(null);
              setLightboxSrc(null);
            }}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition-colors p-2 z-50"
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
            className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition-colors p-2 z-50"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-2 z-50 flex flex-col items-center gap-2">
            {selectedIndex !== null && (() => {
              const item = filteredItems[selectedIndex];
              const tags = galleryTags[item?.path] || [];
              const filteredPlayers = tagPlayers.filter((p) =>
                p.full_name.toLowerCase().includes(tagSearch.toLowerCase())
              );
              return (
                <>
                  <p className="text-white text-base md:text-xl font-bold tracking-wide drop-shadow-lg leading-tight text-center">
                    {item?.title}
                  </p>
                  {item?.subfolder && (
                    <p className="text-emerald-300 font-medium text-xs uppercase tracking-widest drop-shadow">
                      {formatText(item.subfolder)}
                    </p>
                  )}

                  {/* Tagged player chips */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 text-white text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors group"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/player/${tag.id}`); }}
                        >
                          <Tag className="w-3 h-3 text-emerald-400" />
                          {tag.name}
                          {session && (
                            <button
                              className="ml-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => { e.stopPropagation(); removeTag(item.path, tag.id); }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tag a player button + panel */}
                  {session && (
                    <div className="relative">
                      <button
                        className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
                        onClick={(e) => { e.stopPropagation(); setShowTagPanel((v) => !v); setTagSearch(""); }}
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Tag a player
                      </button>

                      {showTagPanel && (
                        <div
                          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 border-b border-slate-700 flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              autoFocus
                              value={tagSearch}
                              onChange={(e) => setTagSearch(e.target.value)}
                              placeholder="Search player…"
                              className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredPlayers.length === 0 ? (
                              <p className="text-slate-500 text-xs text-center py-4">No players found</p>
                            ) : (
                              filteredPlayers.map((p) => (
                                <button
                                  key={p.id}
                                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-emerald-600/20 transition-colors flex items-center gap-2"
                                  onClick={() => saveTag(item.path, p)}
                                >
                                  <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  {p.full_name}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-white/30 text-[10px] mt-1 hidden sm:block">
                    ← → to navigate &nbsp;·&nbsp; Esc to close
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Video player modal */}
      {activeVideo && (
        <VideoPlayerModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
