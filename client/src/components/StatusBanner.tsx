import { useEffect, useState, useRef } from "react";
import { fetchSiteData } from "@/lib/siteData";
import { AnimatePresence, motion } from "framer-motion";

type Holiday = { date: string; name: string };
type Event = {
  date: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};

type Message = {
  text: string;
  level: 'closed' | 'warning' | 'info';
};

const LEVEL_STYLES: Record<Message['level'], string> = {
  closed:  'bg-red-600 dark:bg-red-700 text-white',
  warning: 'bg-amber-500 dark:bg-amber-600 text-white',
  info:    'bg-blue-600 dark:bg-blue-700 text-white',
};

export default function StatusBanner() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const todayDate = new Date();
  const today = todayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  useEffect(() => {
    Promise.all([
      fetchSiteData<Holiday[]>("holidays", "holidays.json"),
      fetchSiteData<Event[]>("events", "events.json"),
    ]).then(([holidays, events]) => {
      const msgs: Message[] = [];

      const todayHoliday = holidays.find((h: Holiday) => h.date === today);
      const tomorrowHoliday = holidays.find((h: Holiday) => h.date === tomorrow);

      if (todayHoliday) {
        msgs.push({ text: `🔴 Courts closed today — ${todayHoliday.name}`, level: 'closed' });
      }
      if (tomorrowHoliday) {
        msgs.push({ text: `⚠️ Courts closed tomorrow — ${tomorrowHoliday.name}`, level: 'warning' });
      }

      holidays.forEach((h: Holiday) => {
        if (h.date !== today && h.date !== tomorrow) {
          const diff = (new Date(h.date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24);
          if (diff > 1 && diff <= 3) {
            const readable = new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            msgs.push({ text: `📅 Courts closed on ${readable} — ${h.name}`, level: 'warning' });
          }
        }
      });

      events.forEach((e: Event) => {
        const diff = (new Date(e.date).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24);
        if (diff >= 0 && diff <= 7) {
          msgs.push({ text: `🎉 Upcoming: ${e.title}`, level: 'info' });
        }
        if (e.registrationDeadline === today) {
          msgs.push({ text: `⚡ Last day to register — ${e.title}`, level: 'warning' });
        }
      });

      setMessages(msgs);
      setIndex(0);
    }).catch(err => console.warn("StatusBanner data fetch failed:", err));
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length);
    }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [messages]);

  if (!messages.length) return null;

  const current = messages[index];
  const bgClass = LEVEL_STYLES[current.level];

  return (
    <div
      className={`relative overflow-hidden py-2.5 text-center text-sm font-semibold transition-colors duration-500 ${bgClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Subtle animated bar at bottom */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-white/20" />
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-white/40 transition-all duration-[4500ms] ease-linear"
        style={{ width: messages.length > 1 ? '100%' : '0%', transitionProperty: messages.length > 1 ? 'width' : 'none' }}
      />

      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="inline-block"
        >
          {current.text}
          {messages.length > 1 && (
            <span className="ml-2 text-white/50 text-xs" aria-hidden="true">
              {index + 1}/{messages.length}
            </span>
          )}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
