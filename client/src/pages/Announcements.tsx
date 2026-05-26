import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Bell, Pin } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { fetchSiteData } from '@/lib/siteData';
import DOMPurify from 'dompurify';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
function sanitize(html: string) {
  const clean = DOMPurify.sanitize(html);
  if (!BASE) return clean;
  // Prepend base URL to internal absolute links that don't already have it
  return clean.replace(/href="(\/[^"/][^"]*)"/g, (_, path) =>
    path.startsWith(BASE) ? `href="${path}"` : `href="${BASE}${path}"`
  );
}

type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  content: string;
};

export default function Announcements() {
  usePageMeta({ title: 'Announcements', description: 'Latest news, court notices, event updates and club announcements from IISc Badminton Club.' });
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<Announcement[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  function sortByNewest(items: Announcement[]) {
    return [...items].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
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
    { id: 'all',        label: 'All',         color: 'bg-gray-100 text-gray-700',       icon: '🗂️' },
    { id: 'tournament', label: 'Tournament',  color: 'bg-emerald-100 text-emerald-800', icon: '🏸' },
    { id: 'facility',   label: 'Facility',    color: 'bg-blue-100 text-blue-800',       icon: '🏟️' },
    { id: 'general',    label: 'General',     color: 'bg-purple-100 text-purple-800',   icon: '📢' },
    { id: 'others',     label: 'Others',      color: 'bg-orange-100 text-orange-800',   icon: '📌' },
  ];

  const getCategoryBadge = (category: string) => {
    const found = categories.find((c) => c.id === category);
    return found ?? { label: category, color: 'bg-gray-100 text-gray-700', icon: '•' };
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
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-emerald-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Announcements & News
          </h1>

          <p className="text-lg text-gray-200 max-w-2xl mx-auto">
            Stay updated with tournaments, events, facility notices and latest IISc Badminton Club news.
          </p>
        </div>
      </section>

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
            <section className="py-16 bg-gradient-to-r from-orange-50 to-blue-50">
              <div className="container mx-auto px-4">
                <h2
                  className="text-3xl font-bold text-blue-900 mb-8 flex items-center gap-3"
                  style={{ fontFamily: 'Playfair Display, serif' }}
                >
                  <Pin className="w-8 h-8 text-orange-500" />
                  Important Announcements
                </h2>

                <div className="space-y-5">
                  {pinnedAnnouncements.map((item, index) => {
                    const status = getStatus(item);

                    return (
                      <Card key={index} className="border-2 border-orange-300 hover:shadow-lg transition">
                        <CardHeader>
                          <CardTitle className="text-blue-900 text-xl">
                            {item.title}
                          </CardTitle>

                          <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-emerald-500" />
                              <span className="text-gray-500 text-sm">{item.date}</span>
                            </div>
                            {(() => { const b = getCategoryBadge(item.category); return (
                              <Badge className={`${b.color} border-0 font-semibold`}>
                                {b.icon} {b.label}
                              </Badge>
                            ); })()}
                            <Badge className={`${getStatusColor(status)} border-0 font-semibold capitalize`}>
                              {status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p
                            className="text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: sanitize(item.content) }}
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Filter */}
          <section className="py-8 border-b bg-white">
            <div className="container mx-auto px-4">
              <div className="flex flex-wrap gap-3 justify-center">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-5 py-2 rounded-full font-semibold transition ${selectedCategory === cat.id
                        ? 'bg-emerald-500 text-white shadow-md'
                        : `${cat.color} hover:shadow`
                      }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Recent */}
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2
                className="text-3xl font-bold text-blue-900 mb-8 flex items-center gap-3"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                <Bell className="w-8 h-8 text-emerald-500" />
                Recent Updates
              </h2>

              {filteredRecent.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 text-lg">
                    No announcements found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredRecent.map((item, index) => {
                    const status = getStatus(item);

                    return (
                      <Card key={index} className="border border-gray-200 hover:shadow-lg transition">
                        <CardHeader>
                          <CardTitle className="text-blue-900 text-lg">
                            {item.title}
                          </CardTitle>

                          <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-2">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-emerald-500" />
                              <span className="text-gray-500 text-sm">{item.date}</span>
                            </div>
                            {(() => { const b = getCategoryBadge(item.category); return (
                              <Badge className={`${b.color} border-0 font-semibold`}>
                                {b.icon} {b.label}
                              </Badge>
                            ); })()}
                            <Badge className={`${getStatusColor(status)} border-0 font-semibold capitalize`}>
                              {status}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent>
                          <p
                            className="text-gray-700 text-sm leading-relaxed"
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

          {/* Stay Informed */}
          <section className="py-16 bg-gradient-to-r from-blue-50 to-emerald-50">
            <div className="container mx-auto px-4">
              <h2
                className="text-3xl font-bold text-blue-900 mb-8 text-center"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Stay Informed
              </h2>

              <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-md border-l-4 border-emerald-500">
                <p className="text-gray-700 text-lg leading-relaxed mb-6">
                  Don't miss important moments! Follow us on Instagram.
                </p>

                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200 space-y-6">

                  <div>
                    <p className="font-semibold text-blue-900 text-xl mb-2">
                      📱 For important updates:
                    </p>
                    <p className="text-gray-700 text-lg">
                      Join our official WhatsApp group.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-blue-900 text-xl mb-2">
                      📸 Follow us on Instagram:
                    </p>

                    <a
                      href="https://www.instagram.com/iisc.badminton/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 font-semibold hover:underline text-lg"
                    >
                      @iisc.badminton
                    </a>
                  </div>

                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
