import { useEffect, useState } from "react";
import { fetchSiteData } from "@/lib/siteData";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { X } from "lucide-react";

type Holiday = { date: string; name: string };
type Event = {
  date: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};
type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  priority?: string;
  flyer?: DynamicFlyer;
};

type BannerMessage = {
  text: string;
  colorClass: string;
};

export type DynamicFlyer = {
  id: string;
  enabled: boolean;
  bgColorClass: string;
  items: BannerMessage[];
  startDate?: string;
  endDate?: string;
  speed?: "slow" | "normal" | "fast" | "custom";
  customSpeed?: number;
  url?: string;
};

/* Flyer colors may be a raw CSS color/gradient (from the admin color picker)
   or a Tailwind class string. CSS values are applied via inline style since
   Tailwind can't generate arbitrary classes at runtime. */
const isCssColor = (v?: string) =>
  !!v && typeof v === "string" && /^(#|rgb|hsl)|gradient\(/i.test(v.trim());



export default function StatusBanner() {
  const [messages, setMessages] = useState<BannerMessage[]>([]);
  const [dynamicFlyers, setDynamicFlyers] = useState<DynamicFlyer[]>([]);
  const [location] = useLocation();
  const [isClosed, setIsClosed] = useState(false);
  const [closedFlyers, setClosedFlyers] = useState<Set<string>>(new Set());
  const [maintenance, setMaintenance] = useState<{mode: boolean, msg: string}>({ mode: false, msg: "" });

  useEffect(() => {
    Promise.all([
      fetchSiteData<Holiday[]>("holidays", "holidays.json").catch(() => []),
      fetchSiteData<Event[]>("events", "events.json").catch(() => []),
      fetchSiteData<{ recent: Announcement[] }>(
        "announcements",
        "announcements.json",
      ).catch(() => ({ recent: [] })),
      fetchSiteData<DynamicFlyer[]>("flyers", "flyers.json").catch(() => []),
      fetchSiteData<any>("club_settings", "settings.json").catch(() => null),
    ])
      .then(([holidaysData, eventsData, announcementsData, flyersData, settingsData]) => {
        if (settingsData?.maintenanceMode) {
          setMaintenance({ mode: true, msg: settingsData.maintenanceMessage || "Site is under maintenance. Please check back shortly." });
        } else {
          setMaintenance({ mode: false, msg: "" });
        }
        const holidays = Array.isArray(holidaysData) ? holidaysData : [];
        const events = Array.isArray(eventsData) ? eventsData : [];
        const announcements: Announcement[] = Array.isArray(announcementsData?.recent)
          ? announcementsData.recent
          : [];
        const baseFlyers: DynamicFlyer[] = Array.isArray(flyersData) ? flyersData : [];
        
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Filter valid flyers based on start/end dates
        const isValidFlyer = (f: DynamicFlyer) => {
          if (!f.enabled) return false;
          
          if (f.startDate) {
            const start = new Date(`${f.startDate}T00:00:00`);
            if (todayDate < start) return false;
          }
          if (f.endDate) {
            const end = new Date(`${f.endDate}T23:59:59`);
            if (todayDate > end) return false;
          }
          return true;
        };

        const announcementFlyers = announcements
          .filter(a => a.flyer && isValidFlyer(a.flyer))
          .map(a => a.flyer as DynamicFlyer);
        
        setDynamicFlyers([...baseFlyers.filter(isValidFlyer), ...announcementFlyers]);

        const today = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });

        const msgs: BannerMessage[] = [];

        // 1. Holidays
        const todayHoliday = holidays.find((h: Holiday) => h.date === today);
        const tomorrowHoliday = holidays.find(
          (h: Holiday) => h.date === tomorrow,
        );

        if (todayHoliday) {
          msgs.push({
            text: `🔴 Courts closed today — ${todayHoliday.name}`,
            colorClass: "text-red-300 font-bold drop-shadow-md",
          });
        } else if (tomorrowHoliday) {
          msgs.push({
            text: `⚠️ Courts closed tomorrow — ${tomorrowHoliday.name}`,
            colorClass: "text-amber-300 font-bold drop-shadow-md",
          });
        }

        holidays.forEach((h: Holiday) => {
          if (!h.date) return;
          if (h.date !== today && h.date !== tomorrow) {
            const diff =
              (new Date(h.date).getTime() - new Date(today).getTime()) /
              (1000 * 3600 * 24);
            if (diff === 2) {
              const readable = new Date(h.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              });
              msgs.push({
                text: `📅 Courts closed on ${readable} — ${h.name}`,
                colorClass: "text-foreground",
              });
            }
          }
        });

        // 2. Events
        events.forEach((e: Event) => {
          if (!e.date) return;
          const diff =
            (new Date(e.date).getTime() - new Date(today).getTime()) /
            (1000 * 3600 * 24);
          if (diff >= 0 && diff <= 7) {
            msgs.push({
              text: `🎉 Upcoming: ${e.title}`,
              colorClass: "text-foreground",
            });
          }
          if (e.registrationDeadline === today) {
            msgs.push({
              text: `⚡ Last day to register — ${e.title}`,
              colorClass: "text-foreground",
            });
          }
        });

        // 3. Announcements logic removed (Option B: No announcements in default banner)

        if (msgs.length > 0) {
          setMessages(msgs);
        } else {
          setMessages([]);
        }
      })
      .catch((err) => console.warn("StatusBanner data fetch failed:", err));

    const channel = supabase.channel('club-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_data', filter: "key=eq.club_settings" },
        (payload: any) => {
          const newSettings = payload.new?.value;
          if (newSettings?.maintenanceMode) {
            setMaintenance({ mode: true, msg: newSettings.maintenanceMessage || "Site is under maintenance. Please check back shortly." });
          } else {
            setMaintenance({ mode: false, msg: "" });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (location !== "/" && !maintenance.mode) return null;

  return (
    <div className="flex flex-col">
      {maintenance.mode && (
        <div className="bg-rose-600 text-foreground p-3 text-center text-sm font-bold shadow-md z-50 relative flex items-center justify-center gap-2">
          <span className="animate-pulse">🔴</span>
          {maintenance.msg}
        </div>
      )}

      {location === "/" && !isClosed && messages.length > 0 && (
    <div className="relative bg-gradient-to-r from-primary to-primary text-foreground py-2.5 overflow-hidden flex items-center z-20 shadow-md">
      <Link href="/feed" className="flex-1 overflow-hidden min-w-0 pr-10">
        <div className="marquee-anim flex gap-6 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer">
          {Array(2)
            .fill(null)
            .map((_, blockIdx) => (
              <span
                key={blockIdx}
                className="whitespace-nowrap flex items-center gap-6"
              >
                {Array(10)
                  .fill(messages)
                  .flat()
                  .map((msg, idx) => (
                    <span
                      key={`${blockIdx}-${idx}`}
                      className="flex items-center gap-6"
                    >
                      <span className={msg.colorClass}>{msg.text}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                    </span>
                  ))}
              </span>
            ))}
        </div>
      </Link>
      <button
        onClick={() => setIsClosed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/10 rounded-full transition-colors z-30"
        aria-label="Close banner"
      >
        <X className="w-5 h-5 text-foreground/90" />
      </button>
    </div>
  )}
      
      {/* Dynamic Admin Flyers */}
      {dynamicFlyers.filter(f => !closedFlyers.has(f.id)).map((flyer) => {
        const bgIsCss = isCssColor(flyer.bgColorClass);
        const flyerContent = (
          <div className="flex-1 overflow-hidden min-w-0 pr-10">
            <div 
              className="marquee-anim flex gap-6 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity"
              style={{ animationDuration: flyer.speed === 'custom' ? `${flyer.customSpeed || 90}s` : flyer.speed === 'slow' ? '150s' : flyer.speed === 'fast' ? '45s' : '90s' }}
            >
              {Array(2)
                .fill(null)
                .map((_, blockIdx) => (
                  <span
                    key={blockIdx}
                    className="whitespace-nowrap flex items-center gap-6"
                  >
                    {Array(10)
                      .fill(flyer.items || [])
                      .flat()
                      .map((msg, idx) => {
                        if (!msg) return null;
                        return (
                          <span
                            key={`${blockIdx}-${idx}`}
                            className="flex items-center gap-6"
                          >
                              <span
                                className={isCssColor(msg.colorClass) ? "" : msg.colorClass}
                                style={isCssColor(msg.colorClass) ? { color: msg.colorClass } : undefined}
                              >{msg.text}</span>
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                            </span>
                        );
                      })}
                  </span>
                ))}
                </div>
              </div>
            );

            return (
              <div
                key={flyer.id}
                className={`relative ${bgIsCss ? "" : flyer.bgColorClass} text-foreground py-2.5 overflow-hidden flex items-center z-20 shadow-md`}
                style={bgIsCss ? { background: flyer.bgColorClass } : undefined}
              >
                {flyer.url ? (
                  <a href={flyer.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 pr-10 cursor-pointer hover:opacity-90 transition-opacity">
                    {flyerContent}
                  </a>
                ) : (
                  flyerContent
                )}
                <button
                  onClick={() => {
                    const newClosed = new Set(closedFlyers);
                    newClosed.add(flyer.id);
                    setClosedFlyers(newClosed);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/10 rounded-full transition-colors z-30"
                  aria-label="Close flyer"
                >
                  <X className="w-5 h-5 text-foreground/90" />
                </button>
              </div>
            );
          })}
    </div>
  );
}
