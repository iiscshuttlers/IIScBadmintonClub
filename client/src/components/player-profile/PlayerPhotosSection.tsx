import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, ChevronLeft, ChevronRight, ExternalLink, Flag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import { fetchRemoteGalleryImages } from "@/lib/galleryStorage";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function PlayerPhotosSection({ playerId }: { playerId: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reportedPaths, setReportedPaths] = useState<Set<string>>(new Set());

  const handleReport = async (photo: { path: string; title: string }) => {
    if (reportedPaths.has(photo.path)) {
      toast.info("You've already reported this photo.");
      return;
    }
    await supabase.from("admin_logs").insert({
      admin_email: "user_report",
      action: "report_photo",
      details: `Reported photo: ${photo.title} (path: ${photo.path}) on player profile ${playerId}`,
    });
    setReportedPaths((prev) => new Set(prev).add(photo.path));
    toast.success("Photo reported. Our team will review it shortly.");
  };

  // swipe handlers
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
    if (distance > minSwipeDistance) navigate(1);
    if (distance < -minSwipeDistance) navigate(-1);
  };

  const navigate = (dir: 1 | -1) => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + dir + photos.length) % photos.length);
  };
  const { data: photos = [] } = useQuery({
    queryKey: ['player-photos', playerId],
    queryFn: async () => {
      const tags = await fetchSiteData<Record<string, any>>('gallery_tags', null).catch(() => ({}));
      const images = await fetchRemoteGalleryImages();
      return images.filter(img => {
        const itemTags = tags?.[img.path] || [];
        return itemTags.some((t: any) => t.id === playerId);
      });
    }
  });

  if (photos.length === 0) return null;

  return (
    <motion.section variants={itemVariants}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:text-foreground/35 shrink-0 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-blue-500" /> Through the Lens
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {photos.map((photo, i) => (
          <button key={i} onClick={() => setLightboxIndex(i)} className="group relative aspect-square overflow-hidden rounded-2xl block bg-slate-100 dark:bg-slate-800 shadow-sm text-left">
            <img src={photo.url} alt={photo.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-foreground text-xs font-bold truncate">{photo.title}</p>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (() => {
          const photo = photos[lightboxIndex];
          const galleryUrl = `/legacy?filter=${encodeURIComponent(photo.subfolder || photo.category)}&photo=${encodeURIComponent(photo.path)}`;
          
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-sm"
              onClick={() => setLightboxIndex(null)}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="absolute top-5 left-1/2 -translate-x-1/2 text-foreground/60 text-sm font-medium select-none">
                {lightboxIndex + 1} / {photos.length}
              </div>
              <button
                className="absolute top-4 right-2 md:right-4 text-foreground hover:text-primary transition-colors p-2 z-50"
                onClick={() => setLightboxIndex(null)}
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
              >
                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
              </button>

              <img
                key={lightboxIndex}
                src={photo.url}
                alt={photo.title}
                className="max-h-[85vh] max-w-[95vw] md:max-w-[85vw] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-200 relative z-40"
                onClick={(e) => e.stopPropagation()}
              />

              <button
                className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors p-2 z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(1);
                }}
              >
                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
              </button>

              <div className="absolute bottom-0 left-0 right-0 px-4 pb-28 md:pb-6 pt-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-50 flex flex-col items-center gap-2 pointer-events-none">
                <div className="pointer-events-auto flex flex-col items-center gap-2 w-full max-w-4xl">
                  <p className="text-foreground text-base md:text-xl font-bold tracking-wide drop-shadow-lg leading-tight text-center">
                    {photo.title}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <a
                      href={galleryUrl}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 rounded-full text-sm font-bold shadow-lg hover:bg-gray-200 transition-all active:scale-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View in Album
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReport(photo); }}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold shadow-lg transition-all active:scale-95 ${
                        reportedPaths.has(photo.path)
                          ? "bg-slate-700 text-muted-foreground cursor-default"
                          : "bg-rose-600/80 hover:bg-rose-600 text-foreground"
                      }`}
                      title="Report this photo"
                    >
                      <Flag className="w-4 h-4" />
                      {reportedPaths.has(photo.path) ? "Reported" : "Report"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.section>
  );
}
