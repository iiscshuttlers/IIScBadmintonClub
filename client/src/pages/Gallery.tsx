import { useState, useEffect, useRef } from "react";
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
  BellOff,
  BellRing,
  Download,
  Megaphone,
  MegaphoneOff,
} from "lucide-react";
import { useGalleryAlerts } from "@/hooks/useGalleryAlerts";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import { galleryService } from "@/services/galleryService";
import { fetchPlayerList } from "@/services/playerService";
import { SocialCTA } from "@/components/SocialCTA";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
const VideoPlayerModal = lazy(() => import("@/components/VideoPlayerModal").then(mod => ({ default: mod.VideoPlayerModal })));
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useLocation } from "wouter";
import { fetchRemoteGalleryImages, saveRemoteGalleryImages, deleteRemoteGalleryImage, deleteRemoteGalleryImages, type RemoteGalleryItem } from "@/lib/galleryStorage";
import { GalleryUploader } from "@/components/admin/GalleryUploader";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { GalleryLightboxTags, type TagEntry } from "@/components/gallery/GalleryLightboxTags";
import { TeaserOverlay } from "@/components/TeaserOverlay";

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
        <div className="w-full h-full bg-soft animate-pulse" />
      )}
    </div>
  );
}



/**
 * The club gallery: albums, photos and videos. Rendered inside Club →
 * Gallery (the /legacy page was retired in the nav regroup, 21 Nov 2026;
 * Champions and Records moved to Players). Sub-tabs live in the #hash and a
 * folder filter in ?filter=, alongside Club's own ?tab=gallery.
 */
export default function Gallery() {

  const queryClient = useQueryClient();
  const { session, isAdmin, profile } = useAuth();
  const { confirm } = useConfirm();
  const [, setLocation] = useLocation();

  const initialFilter = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("filter") : null;

  const [activeTab, setActiveTab] = useHashTab(
    ["albums", "photos", "videos"] as const,
    "albums"
  );
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [galleryLikes, setGalleryLikes] = useState<Record<string, string[]>>({});
  const alerts = useGalleryAlerts();

  const handleLike = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (!session?.user) {
      toast.error("You must be signed in to like photos.");
      return;
    }
    const userId = session.user.id;
    const isLikedLocally = likedPhotos.has(path) || (galleryLikes[path] || []).includes(userId);

    // Optimistic UI update
    setLikedPhotos(prev => {
      const next = new Set(prev);
      if (isLikedLocally) next.delete(path);
      else next.add(path);
      return next;
    });

    setGalleryLikes(prev => {
      const current = prev[path] || [];
      return {
        ...prev,
        [path]: isLikedLocally ? current.filter(id => id !== userId) : [...current, userId]
      };
    });

    try {
      await galleryService.toggleLike(path, userId, isLikedLocally);
    } catch (err) {
      console.error("Failed to sync like", err);
    }
  };

  // Album bell: the member's own alerts for this album (on by default).
  const handleAlbumAlert = async (e: React.MouseEvent, album: string) => {
    e.stopPropagation();
    const label = formatText(album);
    if (!alerts.signedIn) {
      toast("Sign in to get photo alerts", {
        description: `Members are notified when new photos are added to ${label}.`,
      });
      return;
    }
    if (!alerts.enabled) {
      toast("Gallery photo alerts are off", {
        description: "You turned them off in Notification settings.",
        action: {
          label: "Turn on",
          onClick: () => {
            alerts
              .setEnabled(true)
              .then(() => toast.success("Gallery photo alerts are on"))
              .catch(() => toast.error("Couldn't turn photo alerts on. Try again."));
          },
        },
      });
      return;
    }
    const next = !alerts.isOn(album);
    try {
      await alerts.setAlbum(album, next);
      if (next) {
        toast.success(`Alerts on for ${label}`, { description: "You'll be notified when new photos are added." });
      } else {
        toast(`Alerts off for ${label}`, {
          description: "You won't be notified about new photos in this album.",
          icon: <BellOff className="w-4 h-4 text-muted-foreground" />,
        });
      }
    } catch (err) {
      console.error("Failed to save album alert", err);
      toast.error(`Couldn't update alerts for ${label}. Try again.`);
    }
  };

  // Album megaphone (admins): new photos alert everyone unless muted here.
  const handleAlbumMute = async (e: React.MouseEvent, album: string) => {
    e.stopPropagation();
    if (!isAdmin) return;
    const label = formatText(album);
    const mute = !alerts.isMutedForEveryone(album);
    try {
      await alerts.setMutedForEveryone(album, mute);
      if (mute) {
        toast(`${label} muted for everyone`, {
          description: "New photos here won't alert members, except those who turn this album's bell on.",
        });
      } else {
        toast.success(`${label} alerts everyone again`, {
          description: "Members are notified when new photos are added.",
        });
      }
    } catch (err) {
      console.error("Failed to save album mute", err);
      toast.error(`Couldn't update ${label}. Try again.`);
    }
  };

  const [selectedSubfolder, setSelectedSubfolder] = useState(initialFilter || "all");
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
  const [tagPlayers, setTagPlayers] = useState<any[]>([]);

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
    queryFn: () =>
      fetchSiteData<any[]>("videos", "videos.json").then((d) => (d || []).filter((v) => !v.hidden)),
    refetchInterval: (query) => (query.state.error ? false : 120_000),
  });

  const { data: remotePhotos = [], isLoading: loadingRemote } = useQuery({
    queryKey: ["gallery-remote-photos"],
    queryFn: fetchRemoteGalleryImages,
    refetchInterval: (query) => (query.state.error ? false : 300_000), // Refetch every 5 minutes
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
    fetchSiteData<Record<string, string[]>>("gallery_likes", null)
      .then((data) => { if (data) setGalleryLikes(data); })
      .catch(() => {});
  }, []);

  // Fetch player list lazily when lightbox first opens
  useEffect(() => {
    if (selectedIndex !== null && tagPlayers.length === 0) {
      fetchPlayerList()
        .then((data) => { if (data) setTagPlayers(data); });
    }
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTag = async (photoPath: string, player: { id: string; full_name: string }) => {
    const current = galleryTags[photoPath] || [];
    if (current.some((t) => t.id === player.id)) return;
    const updated = { ...galleryTags, [photoPath]: [...current, { id: player.id, name: player.full_name }] };
    setGalleryTags(updated);
    await galleryService.updateGalleryTags(updated);
  };

  const removeTag = async (photoPath: string, playerId: string) => {
    const updated = { ...galleryTags, [photoPath]: (galleryTags[photoPath] || []).filter((t) => t.id !== playerId) };
    setGalleryTags(updated);
    await galleryService.updateGalleryTags(updated);
  };

  const requestTag = async (photoPath: string) => {
    if (!session?.user) return;
    const currentUserPlayer = tagPlayers.find((p) => p.id === profile?.id);
    if (!currentUserPlayer) {
      toast.error("Your email is registered, but you must complete your basic profile before requesting a tag.", {
        action: {
          label: "Complete Profile",
          onClick: () => setLocation("/profile/setup"),
        },
      });
      return;
    }

    const currentPending = pendingTags[photoPath] || [];
    if (currentPending.some((t) => t.id === currentUserPlayer.id)) return;
    
    const updated = { ...pendingTags, [photoPath]: [...currentPending, { id: currentUserPlayer.id, name: currentUserPlayer.full_name }] };
    setPendingTags(updated);
    await galleryService.updatePendingTags(updated);
    toast.success("Tag request sent!");
  };

  const approveTag = async (photoPath: string, tag: TagEntry) => {
    // Add to galleryTags
    const currentTags = galleryTags[photoPath] || [];
    const updatedTags = { ...galleryTags, [photoPath]: [...currentTags, tag] };
    setGalleryTags(updatedTags);

    // Remove from pendingTags
    const currentPending = pendingTags[photoPath] || [];
    const updatedPending = { ...pendingTags, [photoPath]: currentPending.filter((t) => t.id !== tag.id) };
    setPendingTags(updatedPending);

    await galleryService.approvePendingTag(updatedTags, updatedPending);
  };

  const rejectTag = async (photoPath: string, tag: TagEntry) => {
    // Remove from pendingTags
    const currentPending = pendingTags[photoPath] || [];
    const updatedPending = { ...pendingTags, [photoPath]: currentPending.filter((t) => t.id !== tag.id) };
    setPendingTags(updatedPending);
    await galleryService.updatePendingTags(updatedPending);
  };

  const handleEditTitle = async (item: UnifiedGalleryItem) => {
    if (!item.url || !item.path) return;
    const newTitle = window.prompt("Enter new title for this photo:", item.title);
    if (!newTitle || newTitle.trim() === "" || newTitle === item.title) return;

    try {
      const currentPhotos = await fetchRemoteGalleryImages();
      const updatedPhotos = currentPhotos.map(p => 
        p.path === item.path ? { ...p, title: newTitle.trim() } : p
      );
      
      await saveRemoteGalleryImages(updatedPhotos);
      queryClient.invalidateQueries({ queryKey: ["gallery-remote-photos"] });
      toast.success("Photo title updated successfully!");
    } catch (err: any) {
      console.error("Failed to update title:", err);
      toast.error("Failed to update title: " + err.message);
    }
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
      const rawCategory = parts[0];
      const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
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

  // Ensure the active filter is always visible as a pill, even if empty
  if (selectedSubfolder !== "all" && !subfolders.includes(selectedSubfolder)) {
    subfolders.push(selectedSubfolder);
  }

  // Only albums stored in site_data get new-photo alerts; bundled ones never change.
  const alertAlbums = new Set(remotePhotos.map((p) => p.subfolder).filter(Boolean));


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
      {/* Albums · Photos · Videos */}
        <section className="pt-6 pb-2 bg-background/50 relative border-b border-border">
          <div className="container mx-auto px-4 flex justify-center">
            <div className="bg-card p-1.5 rounded-2xl flex gap-1 border border-border w-full sm:w-auto shadow-inner">
              <button
                onClick={() => setActiveTab("albums")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "albums"
                    ? "bg-muted text-info shadow-md ring-1 ring-foreground/10 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Camera className="w-4 h-4" /> Albums
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "photos"
                    ? "bg-muted text-info shadow-md ring-1 ring-foreground/10 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Camera className="w-4 h-4" /> Photos
              </button>
              <button
                onClick={() => setActiveTab("videos")}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "videos"
                    ? "bg-muted text-info shadow-md ring-1 ring-foreground/10 scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <PlayCircle className="w-4 h-4" /> Videos
              </button>
            </div>
          </div>
        </section>

      {(activeTab === "albums" || activeTab === "photos") && (
      <section className="py-8 bg-background relative">
        <TeaserOverlay isLocked={!session}>
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
                        : "bg-muted text-soft hover:bg-muted-strong"
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`text-xs font-black px-1.5 py-0.5 rounded-full ${selectedCategory === cat.id ? "bg-foreground/25" : "bg-muted-strong text-muted-foreground"}`}
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
                    ? "bg-info text-on-accent"
                    : "bg-muted text-muted-foreground hover:bg-muted-strong"
                }`}
              >
                {activeTab === "photos" ? "Photos" : "Albums"}
              </button>
              {subfolders.map((sub, i) => {
                const isOddLast = (subfolders.length % 2 !== 0) && (i === subfolders.length - 1);
                const label = formatText(sub);
                const canAlert = alertAlbums.has(sub);
                const showMute = canAlert && isAdmin;
                const alertOn = alerts.signedIn && alerts.isOn(sub);
                const mutedForEveryone = alerts.isMutedForEveryone(sub);
                // On the selected (accent) pill, icons take the pill's text colour for contrast.
                const selected = selectedSubfolder === sub;
                const bellTitle = !alerts.signedIn
                  ? `Sign in to get alerts for new photos in ${label}`
                  : !alerts.enabled
                    ? "Gallery photo alerts are off in Notification settings"
                    : alertOn
                      ? `Alerts on: you'll be notified about new photos in ${label}. Click to turn off.`
                      : alerts.isMutedForMe(sub)
                        ? `Muted for everyone by admins. Click to get alerts for ${label} anyway.`
                        : `Alerts off for ${label}. Click to turn on.`;
                return (
                  <div key={sub} className={`flex items-center gap-1 group relative w-full ${isOddLast ? 'col-span-2' : 'col-span-1'}`}>
                    <button
                      onClick={() => {
                        setSelectedSubfolder(sub);
                        updateUrlFilter(sub, true);
                      }}
                      className={`w-full px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-[13px] sm:text-sm font-semibold transition truncate ${
                        showMute ? "pr-[4.5rem]" : canAlert ? "pr-10" : ""
                      } ${
                        selectedSubfolder === sub
                          ? "bg-info text-on-accent shadow-md"
                          : "bg-muted text-muted-foreground hover:bg-muted-strong"
                      }`}
                    >
                      {label}
                    </button>
                    {showMute && (
                      <button
                        onClick={(e) => handleAlbumMute(e, sub)}
                        className={`absolute right-9 p-1.5 rounded-full transition-colors ${
                          selected
                            ? mutedForEveryone
                              ? "text-on-accent/70 hover:text-on-accent hover:bg-on-accent/15"
                              : "text-on-accent bg-on-accent/15 hover:bg-on-accent/25"
                            : mutedForEveryone
                              ? "text-muted-foreground hover:text-danger hover:bg-danger/10"
                              : "text-danger hover:text-danger/80 bg-danger/10"
                        }`}
                        title={mutedForEveryone
                          ? `Muted for everyone: new photos in ${label} don't alert members. Click to alert everyone.`
                          : `New photos in ${label} alert everyone. Click to mute this album for everyone.`}
                        aria-label={mutedForEveryone ? `Alert everyone about ${label}` : `Mute ${label} for everyone`}
                        aria-pressed={!mutedForEveryone}
                      >
                        {mutedForEveryone ? <MegaphoneOff className="w-3.5 h-3.5" /> : <Megaphone className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {canAlert && (
                      <button
                        onClick={(e) => handleAlbumAlert(e, sub)}
                        className={`absolute right-1.5 p-1.5 rounded-full transition-colors ${
                          selected
                            ? alertOn
                              ? "text-on-accent bg-on-accent/15 hover:bg-on-accent/25"
                              : "text-on-accent/70 hover:text-on-accent hover:bg-on-accent/15"
                            : alertOn
                              ? "text-primary hover:text-primary bg-primary/10"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                        }`}
                        title={bellTitle}
                        aria-label={alertOn ? `Turn off alerts for ${label}` : `Turn on alerts for ${label}`}
                        aria-pressed={alertOn}
                      >
                        {alertOn
                          ? <BellRing className="w-3.5 h-3.5" />
                          : alerts.signedIn
                            ? <BellOff className="w-3.5 h-3.5" />
                            : <Bell className="w-3.5 h-3.5" />}
                      </button>
                    )}
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
                  className={`group relative ${aspectClass} overflow-hidden rounded-2xl cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500 opacity-0 mb-4 break-inside-avoid ${isSelectionMode && selectedPaths.has(item.path) ? "ring-4 ring-danger scale-[0.98]" : ""}`}
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
                        <div className="w-6 h-6 rounded-full bg-danger text-on-accent flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-media/40 border-2 border-on-media/80 text-transparent flex items-center justify-center shadow-lg backdrop-blur-sm" />
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
                  <div className="absolute inset-0 bg-media/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center">
                    <div className="flex items-center gap-2">
                      {!/^\d+$/.test(item.title) ? (
                        <h3 className="text-foreground font-black text-base tracking-wide drop-shadow-md line-clamp-2">
                          {item.title}
                        </h3>
                      ) : isAdmin ? (
                        <h3 className="text-foreground/50 italic text-sm tracking-wide drop-shadow-md line-clamp-2">
                          No caption
                        </h3>
                      ) : <div />}
                      {isAdmin && item.url && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditTitle(item); }}
                          className="p-1.5 hover:bg-foreground/20 text-foreground/70 hover:text-foreground rounded-full transition-all shrink-0"
                          title="Edit Title"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      )}
                    </div>
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
              <div className="w-8 h-8 border-4 border-info border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18v-12A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
                </svg>
              </div>
              <p className="text-muted-foreground font-medium">No photos in this category yet.</p>
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
                <div className="w-2 h-8 bg-gradient-to-b from-danger to-secondary rounded-full" />
                <h2 className="text-3xl font-black text-foreground">
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
                    className="group text-left bg-muted rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl border border-border-strong transition duration-500"
                    onClick={() => setActiveVideo(video)}
                  >
                    <div className="relative aspect-video">
                      <img
                        src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {video.tournament && (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-on-media/20 hover:bg-on-media/30 backdrop-blur-md border border-on-media/30 text-on-media text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_color-mix(in_srgb,var(--color-on-media)_30%,transparent)] transition-all">
                          {video.tournament}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-media/20 group-hover:bg-media/10 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 bg-danger/90 text-on-accent rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-danger transition-all duration-300">
                          <Play className="w-8 h-8 ml-1" fill="currentColor" stroke="none" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-7">
                      <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {video.title}
                      </h3>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        </TeaserOverlay>
      </section>
      )}

      {activeTab === "videos" && (
      <section className="py-16 bg-background relative">
        <TeaserOverlay isLocked={!session}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-2 h-8 bg-gradient-to-b from-danger to-secondary rounded-full" />
              <h2
                className="text-3xl font-black text-foreground font-display"
              >
                Match Videos
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Championship points, finals and highlights from our YouTube
              channel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {videos.map((video) => (
              <button
                key={video.id}
                className="group text-left bg-muted rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl border border-border-strong transition duration-500"
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
                    <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-on-media/20 hover:bg-on-media/30 backdrop-blur-md border border-on-media/30 text-on-media text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full shadow-[0_0_15px_color-mix(in_srgb,var(--color-on-media)_30%,transparent)] transition-all">
                      {video.tournament}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-media/20 group-hover:bg-media/10 transition-colors flex items-center justify-center">
                    <div className="w-16 h-16 bg-danger/90 text-on-accent rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg group-hover:scale-110 group-hover:bg-danger transition-all duration-300">
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
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                      <PlayCircle className="w-4 h-4" />
                      {video.category || "Match Highlight"}
                    </div>
                    <a
                      href={`https://youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-danger transition-colors bg-muted/50 hover:bg-danger/10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Youtube className="w-3.5 h-3.5" />
                      <span>YouTube</span>
                    </a>
                  </div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {video.title}
                  </h3>
                  {(video.chapters?.length ?? 0) > 0 && (
                    <p className="text-muted-foreground text-xs mt-2">
                      {video.chapters.length} chapter
                      {video.chapters.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-border-strong">
              <p className="text-muted-foreground italic">
                New videos are being processed. Stay tuned!
              </p>
            </div>
          )}

          <div className="mt-12 text-center">
            <a
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-danger font-bold hover:text-danger/80 transition-colors text-lg"
            >
              <Youtube className="w-7 h-7" />
              Visit our YouTube Channel
            </a>
          </div>
        </div>
        </TeaserOverlay>
      </section>
      )}

      {/* Social Media */}
      {activeTab === "videos" && (
        <section className="py-16 bg-background border-t border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <SocialCTA />
          </div>
        </section>
      )}

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-media/95 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => {
            setSelectedIndex(null);
            setLightboxSrc(null);
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="absolute top-12 md:top-6 left-1/2 -translate-x-1/2 text-on-media/75 text-sm font-medium select-none z-50">
            {selectedIndex + 1} / {filteredItems.length}
          </div>
          <button
            className="absolute top-10 md:top-4 right-2 md:right-4 text-on-media hover:text-primary transition-colors p-2 z-50"
            onClick={() => {
              setSelectedIndex(null);
              setLightboxSrc(null);
            }}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 rounded-full bg-media/40 hover:bg-media/60 backdrop-blur-sm text-on-media hover:text-primary transition-colors p-2 z-50"
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
            <div className="w-64 h-64 rounded-xl bg-on-media/10 animate-pulse relative z-40" />
          )}

          <button
            className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 rounded-full bg-media/40 hover:bg-media/60 backdrop-blur-sm text-on-media hover:text-primary transition-colors p-2 z-50"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-4 pb-28 md:pb-6 pt-24 bg-gradient-to-t from-media/90 via-media/50 to-transparent z-50 flex flex-col items-center gap-2 pointer-events-none">
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
                      <div className="flex items-center gap-2">
                        <p className="text-on-media text-base md:text-xl font-bold tracking-wide drop-shadow-lg leading-tight text-center">
                          {item?.title}
                        </p>
                        {isAdmin && item?.url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditTitle(item); }}
                            className="p-1.5 bg-on-media/10 hover:bg-on-media/20 text-on-media/80 hover:text-on-media rounded-full backdrop-blur-sm border border-on-media/20 transition-all pointer-events-auto"
                            title="Edit Title"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                          </button>
                        )}
                      </div>
                      {(() => {
                        const path = item?.path || "";
                        const count = galleryLikes[path]?.length || 0;
                        const isLiked = likedPhotos.has(path) || (galleryLikes[path] || []).includes(session?.user?.id || "");
                        return (
                          <div className="flex items-center gap-1.5 p-2 -mr-2">
                            <motion.button
                              onClick={(e) => handleLike(e, path)}
                              whileTap={{ scale: 0.8 }}
                              animate={isLiked ? { scale: [1, 1.4, 1] } : {}}
                              transition={{ duration: 0.3 }}
                              className="flex items-center"
                            >
                              <Heart 
                                className={`w-6 h-6 md:w-7 md:h-7 drop-shadow-lg transition-colors ${
                                  isLiked 
                                    ? "fill-danger text-danger" 
                                    : "text-on-media hover:text-danger"
                                }`} 
                              />
                            </motion.button>
                            <span className="text-on-media font-bold text-sm drop-shadow-lg min-w-[3rem] text-left">
                              {count} {count === 1 ? 'like' : 'likes'}
                            </span>
                          </div>
                        );
                      })()}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!item?.url) return;
                          const downloadUrl = item.url.replace('/upload/', '/upload/fl_attachment/');
                          const link = document.createElement('a');
                          link.href = downloadUrl;
                          link.target = "_blank";
                          link.download = item.title || "download";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="ml-2 p-2 bg-on-media/10 hover:bg-on-media/20 text-on-media/90 hover:text-on-media rounded-full backdrop-blur-sm border border-on-media/20 transition-all pointer-events-auto flex items-center justify-center"
                        title="Download Image"
                      >
                        <Download className="w-5 h-5 md:w-6 md:h-6 drop-shadow-lg" />
                      </button>
                    </div>
                    {item?.subfolder && (
                      <p className="text-on-media/75 font-semibold text-xs uppercase tracking-widest drop-shadow-md">
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
                        className="flex items-center gap-1.5 text-on-media/75 hover:text-on-media text-xs font-bold px-3 py-1.5 rounded-full border border-on-media/25 hover:border-danger hover:bg-danger/30 transition-all"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "Remove Photo?",
                            description: "Are you sure you want to remove this photo from the gallery?",
                            confirmLabel: "Remove",
                            confirmVariant: "danger"
                          });
                          if (ok) {
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
                  <p className="text-on-media/60 text-[10px] mt-1 hidden sm:block">
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
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
          {isSelectionMode ? (
            <div className="bg-card text-foreground px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
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
              <div className="w-px h-6 bg-muted-strong" />
              <button
                className="text-danger hover:text-danger/80 font-bold transition flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                disabled={selectedPaths.size === 0 || isDeleting}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete Images?",
                    description: `Are you sure you want to permanently delete ${selectedPaths.size} selected images? This cannot be undone.`,
                    confirmLabel: "Delete Images",
                    confirmVariant: "danger"
                  });
                  if (ok) {
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
              className="bg-card/80 hover:bg-card backdrop-blur-md text-foreground px-6 py-3 rounded-full shadow-2xl font-bold transition-all hover:scale-105 active:scale-95"
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

