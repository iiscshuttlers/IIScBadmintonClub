import { Link } from 'wouter';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchSiteData } from '@/lib/siteData';

type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  content: string;
  priority?: string;
};

function getActiveMessages(announcements: Announcement[]): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return announcements
    .filter((item) => {
      if (item.startDate && item.endDate) {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        return today >= start && today <= end;
      }
      if (item.date) {
        const date = new Date(item.date);
        const diff = (date.getTime() - today.getTime()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= 14; // show items up to 14 days ahead
      }
      return false;
    })
    .filter((item) => item.category === 'tournament' || item.priority === 'high')
    .map((item) => `🏸 ${item.title}`);
}

export default function RunningFlyer() {
  const [dismissed, setDismissed] = useState(false);
  const [messages, setMessages] = useState<string[]>([
    '🏸 Welcome to IISc Badminton Club — Check Announcements for latest updates',
  ]);

  // Try to pull live messages from announcements.json
  useEffect(() => {
    fetchSiteData<{ recent: Announcement[] }>('announcements', 'announcements.json')
      .then((data) => {
        const live = getActiveMessages(data.recent || []);
        if (live.length > 0) setMessages(live);
      })
      .catch(() => {
        // Keep default message on error
      });
  }, []);

  if (dismissed) return null;

  const text = messages.join('  ·  ');

  return (
    <div className="relative bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 overflow-hidden flex items-center z-20 shadow-md">
      <Link href="/announcements" className="flex-1 overflow-hidden min-w-0">
        <div className="marquee-anim flex gap-16 font-semibold tracking-wide text-sm md:text-base whitespace-nowrap hover:opacity-90 transition-opacity cursor-pointer">
          {Array(5).fill(null).map((_, i) => (
            <span key={i} className="whitespace-nowrap flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
              {text}
            </span>
          ))}
        </div>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="flex-shrink-0 ml-2 mr-2 p-1 rounded-full hover:bg-white/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
