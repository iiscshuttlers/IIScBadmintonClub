import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bell, ExternalLink, Calendar, ChevronLeft, ChevronRight,
  Megaphone, AlertTriangle, Info, PartyPopper, ClipboardList
} from "lucide-react";

interface HomeBanner {
  id: string;
  type: "announcement" | "notice" | "registration" | "custom";
  title: string;
  message: string;
  color: "blue" | "green" | "amber" | "red" | "purple";
  link_url?: string;
  link_label?: string;
  active: boolean;
  pinned?: boolean;
  dismiss_key?: string; // if set, user can dismiss permanently
}

const BANNER_ICONS: Record<string, any> = {
  announcement: Megaphone,
  notice: Info,
  registration: ClipboardList,
  custom: PartyPopper,
};

const BANNER_COLORS: Record<string, { bg: string; border: string; iconBg: string; iconColor: string; glow: string; btn: string; gradient: string }> = {
  blue: {
    bg: "bg-slate-900/40",
    border: "border-blue-500/30",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    btn: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 text-white",
    gradient: "from-blue-500/10 via-transparent to-transparent"
  },
  green: {
    bg: "bg-slate-900/40",
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    btn: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 text-white",
    gradient: "from-emerald-500/10 via-transparent to-transparent"
  },
  amber: {
    bg: "bg-slate-900/40",
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    btn: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25 text-white",
    gradient: "from-amber-500/10 via-transparent to-transparent"
  },
  red: {
    bg: "bg-slate-900/40",
    border: "border-rose-500/30",
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-400",
    glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    btn: "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-500/25 text-white",
    gradient: "from-rose-500/10 via-transparent to-transparent"
  },
  purple: {
    bg: "bg-slate-900/40",
    border: "border-purple-500/30",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    glow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
    btn: "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-lg shadow-purple-500/25 text-white",
    gradient: "from-purple-500/10 via-transparent to-transparent"
  },
};


export function HomeAnnouncementBar({ isAdmin }: { isAdmin?: boolean }) {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load dismissed keys from localStorage
    const stored = localStorage.getItem("home_banner_dismissed");
    if (stored) {
      try { setDismissed(new Set(JSON.parse(stored))); } catch {}
    }

    // Helper to process all data into banners
    const processData = (dataList: any[]) => {
      let combined: HomeBanner[] = [];
      const getVal = (k: string) => dataList.find(d => d.key === k)?.value;

      // 1. Explicit Home Banners
      const hb = getVal("home_banners");
      if (hb) {
        const list = Array.isArray(hb) ? hb : (hb.banners || []);
        combined.push(...list.filter((b: any) => b.active));
      }

      // 2. Announcements
      const ann = getVal("announcements");
      if (ann?.recent) {
        ann.recent.forEach((a: any, i: number) => {
          if (a.showOnHome || a.flyer?.showOnHome) {
            const uniqueId = `ann_${a.title?.replace(/[^a-zA-Z0-9]/g, '_') || i}`;
            combined.push({
              id: uniqueId,
              type: "announcement",
              title: a.title,
              message: a.content,
              color: "blue",
              link_url: a.url || `/pulse#feed-${a.title?.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
              link_label: "View",
              active: true,
              pinned: a.priority === "high",
              dismiss_key: uniqueId,
            });
          }
        });
      }

      // 3. Events
      const evs = getVal("events");
      if (Array.isArray(evs)) {
        evs.forEach((e: any, i: number) => {
          if (e.showOnHome) {
            const uniqueId = `ev_${e.title?.replace(/[^a-zA-Z0-9]/g, '_') || i}`;
            combined.push({
              id: uniqueId,
              type: "registration",
              title: e.title,
              message: e.date ? `Event Date: ${new Date(e.date).toLocaleDateString()}` : "",
              color: "green",
              link_url: e.link || e.url || undefined,
              link_label: e.link || e.url ? "View Details" : undefined,
              active: true,
              dismiss_key: uniqueId,
            });
          }
        });
      }

      // 4. Flyers
      const flyers = getVal("flyers");
      if (Array.isArray(flyers)) {
        flyers.forEach((f: any) => {
          if (f.showOnHome && f.enabled) {
            const text = f.items?.map((i: any) => i.text).join(" • ");
            if (text) {
              combined.push({
                id: f.id,
                type: "notice",
                title: text,
                message: "",
                color: "purple",
                link_url: f.url || undefined,
                link_label: f.url ? "View" : undefined,
                active: true,
              });
            }
          }
        });
      }
      
      setBanners(combined);
    };

    // Fetch active banners and noticeboard items
    supabase
      .from("site_data")
      .select("key, value")
      .in("key", ["home_banners", "announcements", "events", "flyers"])
      .then(({ data }) => {
        if (data) processData(data);
      });

    // Realtime
    const ch = supabase.channel("home_banners_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=in.(home_banners,announcements,events,flyers)" }, async () => {
        // Refetch all to process correctly (easier than maintaining state patches for 4 keys)
        const { data } = await supabase.from("site_data").select("key, value").in("key", ["home_banners", "announcements", "events", "flyers"]);
        if (data) processData(data);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleDismiss = (banner: HomeBanner) => {
    const key = banner.dismiss_key || banner.id;
    const next = new Set([...dismissed, key]);
    setDismissed(next);
    localStorage.setItem("home_banner_dismissed", JSON.stringify([...next]));
  };

  const visibleBanners = banners.filter(b => {
    const key = b.dismiss_key || b.id;
    return b.pinned || !dismissed.has(key);
  });

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
              <div className={`relative group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300`}>

                {/* Icon Container */}
                <div className={`relative shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${colors.iconBg} border border-white/5 shadow-inner`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.iconColor} drop-shadow-md`} />
                </div>

                {/* Content */}
                <div className="relative flex-1 min-w-0 pt-0.5">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight tracking-wide">{banner.title}</h3>
                  {banner.message && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-wrap">{banner.message}</p>
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
                    className="relative shrink-0 p-1.5 -mr-1 -mt-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
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
    </>
  );
}
