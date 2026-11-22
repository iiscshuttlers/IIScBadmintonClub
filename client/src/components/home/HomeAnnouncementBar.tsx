import { useEffect, useState } from "react";
import { feedService } from "@/services/feedService";
import { buildHomeBanners, type HomeBanner } from "@/lib/homeBanners";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bell, ExternalLink, Calendar, ChevronLeft, ChevronRight,
  Megaphone, AlertTriangle, Info, PartyPopper, ClipboardList
} from "lucide-react";

const BANNER_ICONS: Record<string, any> = {
  announcement: Megaphone,
  notice: Info,
  registration: ClipboardList,
  custom: PartyPopper,
};

const BANNER_COLORS: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; glow: string; btn: string; gradient: string }> = {
  blue: {
    bg: "bg-card/40",
    border: "border-info/30",
    iconBg: "bg-info/20",
    iconColor: "text-info",
    glow: "shadow-[0_0_15px_color-mix(in_srgb,var(--info)_15%,transparent)]",
    btn: "bg-gradient-to-r from-info to-info hover:from-info/90 hover:to-info/90 shadow-lg shadow-info/25 text-on-accent",
    gradient: "from-info/10 via-transparent to-transparent"
  },
  green: {
    bg: "bg-card/40",
    border: "border-success/30",
    iconBg: "bg-success/20",
    iconColor: "text-success",
    glow: "shadow-[0_0_15px_color-mix(in_srgb,var(--success)_15%,transparent)]",
    btn: "bg-gradient-to-r from-success to-team hover:from-success/90 hover:to-team/90 shadow-lg shadow-success/25 text-on-accent",
    gradient: "from-success/10 via-transparent to-transparent"
  },
  amber: {
    bg: "bg-card/40",
    border: "border-warning/30",
    iconBg: "bg-warning/20",
    iconColor: "text-warning",
    glow: "shadow-[0_0_15px_color-mix(in_srgb,var(--warning)_15%,transparent)]",
    btn: "bg-gradient-to-r from-warning to-secondary hover:from-warning/90 hover:to-secondary/90 shadow-lg shadow-warning/25 text-on-accent",
    gradient: "from-warning/10 via-transparent to-transparent"
  },
  red: {
    bg: "bg-card/40",
    border: "border-danger/30",
    iconBg: "bg-danger/20",
    iconColor: "text-danger",
    glow: "shadow-[0_0_15px_color-mix(in_srgb,var(--danger)_15%,transparent)]",
    btn: "bg-gradient-to-r from-danger to-danger hover:from-danger/90 hover:to-danger/90 shadow-lg shadow-danger/25 text-on-accent",
    gradient: "from-danger/10 via-transparent to-transparent"
  },
  purple: {
    bg: "bg-card/40",
    border: "border-individual/30",
    iconBg: "bg-individual/20",
    iconColor: "text-individual",
    glow: "shadow-[0_0_15px_color-mix(in_srgb,var(--individual)_15%,transparent)]",
    btn: "bg-gradient-to-r from-individual to-individual hover:from-individual/90 hover:to-individual/90 shadow-lg shadow-individual/25 text-on-accent",
    gradient: "from-individual/10 via-transparent to-transparent"
  },
};


export function HomeAnnouncementBar({ isAdmin }: { isAdmin?: boolean }) {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Load dismissed keys from localStorage
    const stored = localStorage.getItem("home_banner_dismissed");
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch {
        /* intentional — fallback to empty dismissed set if localStorage data is corrupt */
      }
    }

    // Same rules the admin Content hub previews with (lib/homeBanners).
    const processData = (dataList: any[]) => {
      const getVal = (k: string) => dataList.find(d => d.key === k)?.value;
      setBanners(buildHomeBanners({
        home_banners: getVal("home_banners"),
        announcements: getVal("announcements"),
        events: getVal("events"),
        flyers: getVal("flyers"),
      }));
    };

    // Fetch active banners and noticeboard items
    feedService.fetchHomeBannersData().then((data) => {
      if (data) processData(data);
    });

    // Realtime
    const unsubscribe = feedService.subscribeToHomeBanners((data) => {
      if (data) processData(data);
    });

    return () => { unsubscribe(); };
  }, []);

  const handleDismiss = (banner: HomeBanner) => {
    const key = banner.dismiss_key || banner.id;
    const next = new Set([...dismissed, key]);
    setDismissed(next);
    localStorage.setItem("home_banner_dismissed", JSON.stringify([...next]));
  };

  // buildHomeBanners already puts pinned banners first.
  const openBanners = banners.filter(b => {
    const key = b.dismiss_key || b.id;
    return b.pinned || !dismissed.has(key);
  });
  // Home shows one banner; the rest wait behind "Show N more".
  const visibleBanners = showAll ? openBanners : openBanners.slice(0, 1);
  const hiddenCount = openBanners.length - visibleBanners.length;

  return (
    <>
      {/* Banners */}
      <AnimatePresence>
        {visibleBanners.map((banner) => {
          const colors = BANNER_COLORS[banner.color] || BANNER_COLORS.blue;
          const Icon = BANNER_ICONS[banner.type] || Megaphone;
          const key = banner.dismiss_key || banner.id;
          return (
            <motion.div
              key={banner.id}
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="py-2 sm:py-3"
            >
              <div className={`relative group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300`}>

                {/* Icon Container */}
                <div className={`relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${colors.iconBg} border border-foreground/5 shadow-inner`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.iconColor} drop-shadow-md`} />
                </div>

                {/* Content */}
                <div className="relative flex-1 min-w-0 pt-0.5">
                  <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight tracking-wide">{banner.title}</h3>
                  {banner.message && (
                    <p className="text-xs sm:text-sm text-soft mt-1.5 leading-relaxed whitespace-pre-wrap">{banner.message}</p>
                  )}
                  
                  {banner.link_url && (
                    <div className="mt-3">
                      <a
                        href={banner.link_url}
                        target={banner.link_url.startsWith("http") ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all transform hover:scale-105 active:scale-95 ${colors.btn}`}
                      >
                        {banner.link_label || "Learn More"}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Dismiss Button */}
                {!banner.pinned && (
                  <button
                    onClick={() => handleDismiss(banner)}
                    className="relative shrink-0 p-1.5 -mr-1 -mt-1 rounded-full hover:bg-muted text-muted-foreground hover:text-soft transition-colors cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {(hiddenCount > 0 || (showAll && openBanners.length > 1)) && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="-mt-1 mb-2 min-h-[44px] px-1 text-xs font-black text-primary underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {showAll ? "Show fewer notices" : `Show ${hiddenCount} more notice${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}
    </>
  );
}
