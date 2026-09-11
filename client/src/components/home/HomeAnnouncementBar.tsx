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

const BANNER_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string; btn: string }> = {
  blue:   { bg: "bg-blue-950/60",    border: "border-blue-700/50",   icon: "text-blue-400",   badge: "bg-blue-500",   btn: "bg-blue-600 hover:bg-blue-500" },
  green:  { bg: "bg-emerald-950/60", border: "border-emerald-700/50", icon: "text-emerald-400", badge: "bg-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-500" },
  amber:  { bg: "bg-amber-950/50",   border: "border-amber-700/50",   icon: "text-amber-400",  badge: "bg-amber-500",  btn: "bg-amber-600 hover:bg-amber-500" },
  red:    { bg: "bg-red-950/60",     border: "border-red-700/50",     icon: "text-red-400",    badge: "bg-red-500",    btn: "bg-red-600 hover:bg-red-500" },
  purple: { bg: "bg-purple-950/60",  border: "border-purple-700/50",  icon: "text-purple-400", badge: "bg-purple-500", btn: "bg-purple-600 hover:bg-purple-500" },
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
              link_url: a.url || "/admin?tab=announcements#noticeboard",
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-1.5"
            >
              <div className={`flex items-start gap-3 p-3 sm:p-4 rounded-2xl border ${colors.bg} ${colors.border} shadow-sm relative overflow-hidden`}>
                {/* accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.badge} rounded-l-2xl`} />

                <div className={`shrink-0 mt-0.5 ${colors.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white leading-tight">{banner.title}</p>
                  {banner.message && (
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed whitespace-pre-wrap">{banner.message}</p>
                  )}
                  {banner.link_url && (
                    <a
                      href={banner.link_url}
                      target={banner.link_url.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg text-xs font-black text-white transition-all ${colors.btn}`}
                    >
                      {banner.link_label || "Learn More"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {!banner.pinned && (
                  <button
                    onClick={() => handleDismiss(banner)}
                    className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
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
