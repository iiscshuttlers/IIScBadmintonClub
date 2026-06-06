import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Bell, Pin, CalendarDays } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { fetchSiteData } from '@/lib/siteData';
import { SocialCTA } from '@/components/SocialCTA';
import DOMPurify from 'dompurify';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
function sanitize(html: string) {
  const clean = DOMPurify.sanitize(parseMarkdown(html || ''));
  const cleanStr = typeof clean === 'string' ? clean : clean.toString();
  if (!BASE) return cleanStr;
  // Prepend base URL to internal absolute links that don't already have it
  return cleanStr.replace(/href="(\/[^"/][^"]*)"/g, (_, path) =>
    path.startsWith(BASE) ? `href="${path}"` : `href="${BASE}${path}"`
  );
}

function parseMarkdown(text: string) {
  if (!text) return "";
  // If it already looks like HTML (legacy), don't parse it as Markdown
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer' style='color:#10b981;font-weight:bold;text-decoration:underline;'>$1</a>")
    .replace(/\n/g, '<br/>');
}

type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  content: string;
};

export function AnnouncementsSection() {
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<Announcement[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  function sortByNewest(items: Announcement[]) {
    return [...items].sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
    );
  }

  const loadAnnouncements = useCallback(() => {
    fetchSiteData<{ recent: Announcement[] }>("announcements", "announcements.json")
      .then((data) => {
        const allAnnouncements = data.recent || [];

        const pinned = allAnnouncements.filter((item: Announcement) => {
          const status = getStatus(item);

          return status === 'ongoing' || status === 'upcoming';
        });

        setPinnedAnnouncements(sortByNewest(pinned));
        setRecentAnnouncements(sortByNewest(allAnnouncements));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Announcements load failed:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Auto-refresh every 60s
  useAutoRefresh(loadAnnouncements, 60_000, !loading);

  const categories = [
    { id: 'all', label: 'All', color: 'bg-gray-100 text-gray-700', icon: 'ðŸ—‚ï¸' },
    { id: 'tournament', label: 'Tournament', color: 'bg-emerald-100 text-emerald-800', icon: 'ðŸ¸' },
    { id: 'facility', label: 'Facility', color: 'bg-blue-100 text-blue-800', icon: 'ðŸŸï¸' },
    { id: 'general', label: 'General', color: 'bg-purple-100 text-purple-800', icon: 'ðŸ“¢' },
    { id: 'others', label: 'Others', color: 'bg-orange-100 text-orange-800', icon: 'ðŸ“Œ' },
  ];

  const getCategoryBadge = (category: string) => {
    const found = categories.find((c) => c.id === category);
    return found ?? { label: category, color: 'bg-gray-100 text-gray-700', icon: 'â€¢' };
  };

  const filteredRecent =
    selectedCategory === 'all'
      ? recentAnnouncements
      : recentAnnouncements.filter(
        (item) => item.category === selectedCategory
      );

  function getStatus(item: Announcement) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (item.startDate && item.endDate) {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (today < start) return 'upcoming';
      if (today >= start && today <= end) return 'ongoing';
      return 'past';
    }

    if (item.date) {
      const date = new Date(item.date);
      date.setHours(0, 0, 0, 0);

      if (today < date) return 'upcoming';
      if (today.getTime() === date.getTime()) return 'ongoing';
      return 'past';
    }

    return 'unknown';
  }

  function getStatusColor(status: string) {
    if (status === 'upcoming') return 'bg-emerald-100 text-emerald-700';
    if (status === 'ongoing') return 'bg-blue-100 text-blue-700';
    if (status === 'past') return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-600';
  }

  return (
    <div className="dark:bg-slate-950 py-16" id="announcements">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-black mb-4 text-slate-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            Club Announcements
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Stay up to date with the latest tournament registrations, court closures, and club events.
          </p>
        </div>

      {/* Loading */}
      {loading && (
        <section className="py-16">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 animate-pulse">
                <div className="h-6 w-3/4 rounded bg-gray-200" />
                <div className="flex gap-3">
                  <div className="h-5 w-20 rounded-full bg-gray-200" />
                  <div className="h-5 w-16 rounded-full bg-gray-200" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-5/6 rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && (
        <>
          {/* Pinned */}
          {pinnedAnnouncements.length > 0 && (
            <section className="py-14 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-900 dark:to-slate-800">
              <div className="container mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                  <h2
                    className="text-2xl font-black text-blue-900 dark:text-white flex items-center gap-2"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    <Pin className="w-6 h-6 text-orange-500" />
                    Important Announcements
                  </h2>
                </div>

                <div className="space-y-4">
                  {pinnedAnnouncements.map((item, index) => {
                    const status = getStatus(item);

                    return (
                      <Card key={index} className="border-2 border-orange-300 dark:border-orange-900/50 bg-white dark:bg-slate-800 hover:shadow-lg transition-all duration-300 overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
                        <CardHeader>
                            })()}
                            <Badge className={`${getStatusColor(status)} border-0 font-semibold capitalize text-xs`}>
                              {status}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent>
                          <p
                            className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: sanitize(item.content) }}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
      </div>
    </div>
  );
}

export default AnnouncementsSection;

