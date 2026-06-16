import { useEffect, useState } from "react";
import { fetchSiteData } from "@/lib/siteData";
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
};

function getActiveAnnouncements(announcements: Announcement[]): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return announcements
    .filter((item) => {
      if (item.startDate && item.endDate) {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        if (today >= start && today <= end) return true;
      }
      if (item.date) {
        const date = new Date(item.date);
        const diff = (today.getTime() - date.getTime()) / (1000 * 3600 * 24);
        // Show announcements from the last 30 days or future ones up to 14 days
        return diff >= -14 && diff <= 30;
      }
      return false;
    })
    .filter(
      (item) => item.category === "tournament" || item.priority === "high",
    )
    .map((item) => `🏸 ${item.title}`);
}

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
        }
        const holidays = Array.isArray(holidaysData) ? holidaysData : [];
        const events = Array.isArray(eventsData) ? eventsData : [];
        const announcements = Array.isArray(announcementsData?.recent)
          ? announcementsData.recent
          : [];
        const flyers = Array.isArray(flyersData) ? flyersData : [];
        setDynamicFlyers(flyers.filter((f) => f.enabled));

        const todayDate = new Date();
        const today = todayDate.toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });
        const tomorrowDate = new Date(todayDate);
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
                colorClass: "text-white",
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
              colorClass: "text-white",
            });
          }
          if (e.registrationDeadline === today) {
            msgs.push({
              text: `⚡ Last day to register — ${e.title}`,
              colorClass: "text-white",
            });
          }
        });

        // 3. Announcements
        const liveAnnouncements = getActiveAnnouncements(announcements);
        liveAnnouncements.forEach((a) =>
          msgs.push({ text: a, colorClass: "text-white" }),
        );

        if (msgs.length > 0) {
          setMessages(msgs);
        } else {
          setMessages([
            {
              text: "🏸 Welcome to IISc Badminton Club — Check Announcements for latest updates",
              colorClass: "text-white",
            },
          ]);
        }
      })
      .catch((err) => console.warn("StatusBanner data fetch failed:", err));
  }, []);

  if (location !== "/" && !maintenance.mode) return null;

  return (
    <div className="flex flex-col">
      {maintenance.mode && (
        <div className="bg-rose-600 text-white p-3 text-center text-sm font-bold shadow-md z-50 relative flex items-center justify-center gap-2">
          <span className="animate-pulse">🔴</span>
          {maintenance.msg}
        </div>
      )}

      {location === "/" && !isClosed && messages.length > 0 && (
    <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 overflow-hidden flex items-center z-20 shadow-md">
      <Link href="/feed" className="flex-1 overflow-hidden min-w-0 pr-10">
        <div className="marquee-anim flex gap-8 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer">
          {Array(2)
            .fill(null)
            .map((_, blockIdx) => (
              <span
                key={blockIdx}
                className="whitespace-nowrap flex items-center gap-8"
              >
                {Array(10)
                  .fill(messages)
                  .flat()
                  .map((msg, idx) => (
                    <span
                      key={`${blockIdx}-${idx}`}
                      className="flex items-center gap-8"
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
        <X className="w-5 h-5 text-white/90" />
      </button>
    </div>
  )}
      
      {/* Dynamic Admin Flyers */}
      {location === "/" && dynamicFlyers.filter(f => !closedFlyers.has(f.id)).map((flyer) => (
        <div key={flyer.id} className={`relative ${flyer.bgColorClass} text-white py-2.5 overflow-hidden flex items-center z-20 shadow-md`}>
          <div className="flex-1 overflow-hidden min-w-0 pr-10">
            <div className="marquee-anim flex gap-8 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity">
              {Array(2)
                .fill(null)
                .map((_, blockIdx) => (
                  <span
                    key={blockIdx}
                    className="whitespace-nowrap flex items-center gap-8"
                  >
                    {Array(10)
                      .fill(flyer.items)
                      .flat()
                      .map((msg, idx) => (
                        <span
                          key={`${blockIdx}-${idx}`}
                          className="flex items-center gap-8"
                        >
                          <span className={msg.colorClass}>{msg.text}</span>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                        </span>
                      ))}
                  </span>
                ))}
            </div>
          </div>
          <button
            onClick={() => {
              const newClosed = new Set(closedFlyers);
              newClosed.add(flyer.id);
              setClosedFlyers(newClosed);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/10 rounded-full transition-colors z-30"
            aria-label="Close flyer"
          >
            <X className="w-5 h-5 text-white/90" />
          </button>
        </div>
      ))}
    </div>
  );
}
