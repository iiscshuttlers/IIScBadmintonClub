import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Instagram, X, Youtube, PlayCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { fetchSiteData } from '@/lib/siteData';

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
      { rootMargin: '300px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [moduleLoader]);

  return (
    <div ref={ref} className={className} onClick={onClick}>
      {src ? (
        <img loading="lazy" src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}

export default function Gallery() {
  usePageMeta({ title: 'Gallery', description: 'Photos and videos from IISc Badminton Club tournaments and events.' });

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubfolder, setSelectedSubfolder] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [videos, setVideos] = useState<any[]>([]);

  // ── Keyboard navigation for lightbox ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') { setSelectedIndex(null); setLightboxSrc(null); }
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedIndex(null);
    setLightboxSrc(null);
  }, [selectedCategory, selectedSubfolder]);

  const loadVideos = useCallback(() => {
    fetchSiteData<any[]>("videos", "videos.json")
      .then((data) => setVideos(data))
      .catch((err) => console.error('Error loading videos:', err));
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Auto-refresh every 2 min
  useAutoRefresh(loadVideos, 120_000);

  // ── LAZY glob (not eager) ──────────────────────────────────────────
  const imageModules = import.meta.glob(
    '/src/assets/gallery/**/*.{png,jpg,jpeg,webp}',
    { eager: false }
  ) as Record<string, () => Promise<{ default: string }>>;

  const formatText = (text: string) =>
    text.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const galleryItems = Object.entries(imageModules).map(([path, loader], index) => {
    const cleanPath = path.replace('/src/assets/gallery/', '');
    const parts = cleanPath.split('/');
    const category = parts[0];
    const subfolder = parts.length > 2 ? parts[1] : '';
    const filename = parts[parts.length - 1];
    const title = formatText(filename.replace(/\.[^/.]+$/, ''));
    return { id: index + 1, title, category, subfolder, loader };
  });

  const categories = [
    { id: 'all', label: 'All' },
    ...Array.from(new Set(galleryItems.map((item) => item.category))).map((cat) => ({
      id: cat,
      label: formatText(cat),
    })),
  ];

  const subfolders =
    selectedCategory === 'all'
      ? []
      : Array.from(
        new Set(
          galleryItems
            .filter((item) => item.category === selectedCategory && item.subfolder !== '')
            .map((item) => item.subfolder)
        )
      );

  const filteredItems = galleryItems.filter((item) => {
    const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
    const subfolderMatch = selectedSubfolder === 'all' || item.subfolder === selectedSubfolder;
    return categoryMatch && subfolderMatch;
  });

  const openLightbox = (idx: number) => {
    setSelectedIndex(idx);
    filteredItems[idx].loader().then((mod) => setLightboxSrc(mod.default));
  };

  const navigate = (dir: 1 | -1) => {
    if (selectedIndex === null) return;
    const next = (selectedIndex + dir + filteredItems.length) % filteredItems.length;
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
            📸 Photos & Videos
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-5" style={{ fontFamily: 'Playfair Display, serif' }}>
            Gallery
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Relive the intensity of tournaments, the focus of practice, and the vibrant badminton community at IISc.
          </p>
        </div>
      </section>

      {/* Photo Gallery Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          {/* Main Category Filter */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedSubfolder('all'); }}
                className={`px-8 py-2 rounded-full font-bold transition-all duration-300 ${selectedCategory === cat.id
                    ? 'bg-emerald-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sub-folder Filter */}
          {subfolders.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mb-12 animate-in fade-in slide-in-from-top-4">
              <button
                onClick={() => setSelectedSubfolder('all')}
                className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${selectedSubfolder === 'all' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                All Albums
              </button>
              {subfolders.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubfolder(sub)}
                  className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${selectedSubfolder === sub ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                >
                  {formatText(sub)}
                </button>
              ))}
            </div>
          )}

          {/* ── Overlay-style Image Grid with stagger ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-2xl cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500 opacity-0"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                    {item.title}
                  </h3>
                  {item.subfolder && (
                    <p className="text-white/70 text-xs mt-0.5 italic">{formatText(item.subfolder)}</p>
                  )}
                  <Badge className="mt-2 bg-emerald-500/80 text-white border-none text-xs w-fit">
                    {formatText(item.category)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-lg italic">
              No photos in this category yet.
            </div>
          )}
        </div>
      </section>

      {/* Match Videos Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-blue-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
              Match Videos
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              From championship points to training drills, check out the action from our YouTube channel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {videos.map((video) => (
              <div key={video.id} className="group bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition duration-500">
                <div className="relative aspect-video">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-3">
                    <PlayCircle className="w-4 h-4" />
                    {video.category || 'Match Highlight'}
                  </div>
                  <h3 className="text-2xl font-bold text-blue-900 group-hover:text-emerald-600 transition-colors">
                    {video.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 italic text-lg">New videos are being processed. Stay tuned!</p>
            </div>
          )}

          <div className="mt-16 text-center">
            <a
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-red-600 font-bold hover:text-red-700 transition-colors text-xl"
            >
              <Youtube className="w-8 h-8" />
              Visit our YouTube Channel
            </a>
          </div>
        </div>
      </section>

      {/* Social Media */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-blue-900 mb-10">Follow the Journey</h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
            <a
              href="https://www.instagram.com/badminton.iisc/"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-pink-200 hover:-translate-y-1 transition-all duration-300"
            >
              <Instagram className="w-6 h-6" />
              Instagram
            </a>
            <a
              href="https://youtube.com/@iiscbadmintonclub?si=tr_GtVnxXZpyg4T7"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-red-600 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:shadow-red-200 hover:-translate-y-1 transition-all duration-300"
            >
              <Youtube className="w-6 h-6" />
              YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-sm"
          onClick={() => { setSelectedIndex(null); setLightboxSrc(null); }}
        >
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium select-none">
            {selectedIndex + 1} / {filteredItems.length}
          </div>
          <button
            className="absolute top-4 right-4 text-white hover:text-emerald-400 transition-colors p-2"
            onClick={() => { setSelectedIndex(null); setLightboxSrc(null); }}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition-colors p-2"
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            aria-label="Previous"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          {lightboxSrc ? (
            <img
              key={selectedIndex}
              src={lightboxSrc}
              alt={filteredItems[selectedIndex]?.title || ''}
              className="max-h-[85vh] max-w-[80vw] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="w-64 h-64 rounded-xl bg-gray-800 animate-pulse" />
          )}

          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-emerald-400 transition-colors p-2"
            onClick={(e) => { e.stopPropagation(); navigate(1); }}
            aria-label="Next"
          >
            <ChevronRight className="w-10 h-10" />
          </button>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            {selectedIndex !== null && (
              <>
                <p className="text-white text-sm font-semibold">{filteredItems[selectedIndex]?.title}</p>
                {filteredItems[selectedIndex]?.subfolder && (
                  <p className="text-white/50 text-xs mt-0.5">
                    {formatText(filteredItems[selectedIndex].subfolder)}
                  </p>
                )}
                <p className="text-white/30 text-xs mt-2 hidden sm:block">
                  ← → to navigate &nbsp;·&nbsp; Esc to close
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
