import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, Pin, CalendarDays } from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { fetchSiteData } from "@/lib/siteData";
import { SocialCTA } from "@/components/SocialCTA";
import DOMPurify from "dompurify";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function sanitize(html: string) {
  const clean = DOMPurify.sanitize(parseMarkdown(html || ""));
  const cleanStr = clean as string;
  if (!BASE) return cleanStr;
  // Prepend base URL to internal absolute links that don't already have it
  return cleanStr.replace(/href="(\/[^"/][^"]*)"/g, (_, path) =>
    path.startsWith(BASE) ? `href="${path}"` : `href="${BASE}${path}"`,
  );
}

function parseMarkdown(text: string) {
  if (!text) return "";
  // If it already looks like HTML (legacy), don't parse it as Markdown
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /\[(.*?)\]\((.*?)\)/g,
      "<a href='$2' target='_blank' rel='noopener noreferrer' style='color:#10b981;font-weight:bold;text-decoration:underline;'>$1</a>",
    )
    .replace(/\n/g, "<br/>");
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
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<
    Announcement[]
  >([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    Announcement[]
  >([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  function sortByNewest(items: Announcement[]) {
    return [...items].sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }

  const loadAnnouncements = useCallback(() => {
    fetchSiteData<{ recent: Announcement[] }>(
      "announcements",
      "announcements.json",
    )
      .then((data) => {
        const allAnnouncements = data.recent || [];

        const pinned = allAnnouncements.filter((item: Announcement) => {
          const status = getStatus(item);

          return status === "ongoing" || status === "upcoming";
        });

        setPinnedAnnouncements(sortByNewest(pinned));
        setRecentAnnouncements(sortByNewest(allAnnouncements));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Announcements load failed:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Auto-refresh every 60s
  useAutoRefresh(loadAnnouncements, 60_000, !loading);

  const categories = [
    { id: "all", label: "All", color: "bg-gray-100 text-gray-700", icon: "📋" },
    {
      id: "tournament",
      label: "Tournament",
      color: "bg-emerald-100 text-emerald-800",
      icon: "🏆",
    },
    {
      id: "facility",
      label: "Facility",
      color: "bg-blue-100 text-blue-800",
      icon: "🏸",
    },
    {
      id: "general",
      label: "General",
      color: "bg-purple-100 text-purple-800",
      icon: "📢",
    },
    {
      id: "others",
      label: "Others",
      color: "bg-orange-100 text-orange-800",
      icon: "📌",
    },
  ];

  const getCategoryBadge = (category: string) => {
    const found = categories.find((c) => c.id === category);
    return (
      found ?? {
        label: category,
        color: "bg-gray-100 text-gray-700",
        icon: "📄",
      }
    );
  };

  const filteredRecent =
    selectedCategory === "all"
      ? recentAnnouncements
      : recentAnnouncements.filter(
          (item) => item.category === selectedCategory,
        );

  function getStatus(item: Announcement) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (item.startDate && item.endDate) {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (today < start) return "upcoming";
      if (today >= start && today <= end) return "ongoing";
      return "past";
    }

    if (item.date) {
      const date = new Date(item.date);
      date.setHours(0, 0, 0, 0);

      if (today < date) return "upcoming";
      if (today.getTime() === date.getTime()) return "ongoing";
      return "past";
    }

    return "unknown";
  }

  function getStatusColor(status: string) {
    if (status === "upcoming") return "bg-emerald-100 text-emerald-700";
    if (status === "ongoing") return "bg-blue-100 text-blue-700";
    if (status === "past") return "bg-gray-100 text-gray-600";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="dark:bg-slate-950" id="announcements">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Loading */}
        {loading && (
          <section className="py-16">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 animate-pulse"
                >
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
                      style={{ fontFamily: "Playfair Display, serif" }}
                    >
                      <Pin className="w-6 h-6 text-orange-500" />
                      Important Announcements
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {pinnedAnnouncements.map((item, index) => {
                      const status = getStatus(item);

                      return (
                        <Card
                          key={index}
                          className="border-2 border-orange-300 dark:border-orange-900/50 bg-white dark:bg-slate-800 hover:shadow-lg transition-all duration-300 overflow-hidden"
                        >
                          <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
                          <CardHeader>
                            <CardTitle className="text-blue-900 dark:text-white text-xl">
                              {item.title}
                            </CardTitle>

                            <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-3">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-emerald-500" />
                                  <span className="text-gray-500 dark:text-slate-400 text-sm">
                                    Published: {item.date}
                                  </span>
                                </div>
                              )}
                              {(item.startDate || item.endDate) && (
                                <div className="flex items-center gap-1.5 ml-2 mr-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 font-medium text-xs border border-blue-200 dark:border-blue-800">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  <span>
                                    Event: {item.startDate || "TBD"}{" "}
                                    {item.endDate &&
                                    item.endDate !== item.startDate
                                      ? `— ${item.endDate}`
                                      : ""}
                                  </span>
                                </div>
                              )}
                              {(() => {
                                const b = getCategoryBadge(item.category);
                                return (
                                  <Badge
                                    className={`${b.color} border-0 font-semibold`}
                                  >
                                    {b.icon} {b.label}
                                  </Badge>
                                );
                              })()}
                              <Badge
                                className={`${getStatusColor(status)} border-0 font-semibold capitalize`}
                              >
                                {status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p
                              className="text-gray-700 dark:text-slate-300 leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: sanitize(item.content),
                              }}
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
            <section className="py-6 border-b bg-white dark:bg-slate-950 sticky top-16 z-10 shadow-sm">
              <div className="container mx-auto px-4">
                <div className="flex flex-wrap gap-2.5 justify-center">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                        selectedCategory === cat.id
                          ? "bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/40 scale-105"
                          : `${cat.color} hover:shadow-sm dark:bg-slate-800 dark:text-slate-300`
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Recent */}
            <section className="py-14 dark:bg-slate-950">
              <div className="container mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full" />
                  <h2
                    className="text-2xl font-black text-blue-900 dark:text-white flex items-center gap-2"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    <Bell className="w-6 h-6 text-emerald-500" />
                    Recent Updates
                  </h2>
                </div>

                {filteredRecent.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                    <p className="text-gray-500 dark:text-slate-400 text-lg">
                      No announcements found.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredRecent.map((item, index) => {
                      const status = getStatus(item);

                      return (
                        <Card
                          key={index}
                          className="border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                        >
                          <div
                            className={`h-0.5 w-full ${
                              status === "upcoming"
                                ? "bg-emerald-400"
                                : status === "ongoing"
                                  ? "bg-blue-400"
                                  : "bg-gray-200 dark:bg-slate-600"
                            }`}
                          />
                          <CardHeader className="pb-3">
                            <CardTitle className="text-blue-900 dark:text-white text-base font-bold">
                              {item.title}
                            </CardTitle>

                            <div className="flex flex-wrap gap-2 text-sm text-gray-600 mt-2">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-gray-500 dark:text-slate-400 text-xs">
                                    Published: {item.date}
                                  </span>
                                </div>
                              )}
                              {(item.startDate || item.endDate) && (
                                <div className="flex items-center gap-1.5 ml-2 mr-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 font-medium text-xs border border-blue-200 dark:border-blue-800">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  <span>
                                    Event: {item.startDate || "TBD"}{" "}
                                    {item.endDate &&
                                    item.endDate !== item.startDate
                                      ? `— ${item.endDate}`
                                      : ""}
                                  </span>
                                </div>
                              )}
                              {(() => {
                                const b = getCategoryBadge(item.category);
                                return (
                                  <Badge
                                    className={`${b.color} border-0 font-semibold text-xs`}
                                  >
                                    {b.icon} {b.label}
                                  </Badge>
                                );
                              })()}
                              <Badge
                                className={`${getStatusColor(status)} border-0 font-semibold capitalize text-xs`}
                              >
                                {status}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent>
                            <p
                              className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: sanitize(item.content),
                              }}
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
            <section className="py-14 bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-slate-900 dark:to-slate-800">
              <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                  <SocialCTA />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default AnnouncementsSection;
