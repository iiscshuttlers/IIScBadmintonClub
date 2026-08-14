import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, Pin, CalendarDays, Trophy, ExternalLink, Clock, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import { SocialCTA } from "@/components/SocialCTA";
import { supabase } from "@/lib/supabase";
import DOMPurify from "dompurify";
import { safeReplaceState, safeGetSearchParams, isCapacitor } from "@/lib/navUtils";

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
  url?: string;
};

type LiveTournament = {
  id: string;
  name: string;
  status: string;
  form_status: string;
  form_url: string | null;
  form_close_date: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  eligibility: string | null;
};

export function AnnouncementsSection() {
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<
    Announcement[]
  >([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    Announcement[]
  >([]);
  const [liveTournament, setLiveTournament] = useState<LiveTournament | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("cat") || "all";
  });

  useEffect(() => {
    const params = safeGetSearchParams();
    if (selectedCategory === "all") {
      params.delete("cat");
    } else {
      params.set("cat", selectedCategory);
    }
    const hash = isCapacitor ? "" : window.location.hash;
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${hash}`;
    safeReplaceState(newUrl);
  }, [selectedCategory]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + 10);
        }
      },
      { rootMargin: "200px" }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loading, selectedCategory]);

  function sortByNewest(items: Announcement[]) {
    return [...items].sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }

  const loadLiveTournament = useCallback(() => {
    supabase
      .from("tournaments")
      .select("id, name, status, form_status, form_url, form_close_date, start_date, end_date, venue, eligibility")
      .neq("status", "deleted")
      .neq("status", "draft")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.length) {
          const t = data[0] as LiveTournament;
          // Override form_status if deadline has passed
          if (t.form_close_date && t.form_status !== "disabled") {
            const closeTime = new Date(t.form_close_date).getTime();
            if (!isNaN(closeTime) && Date.now() >= closeTime) {
              t.form_status = "closed";
            }
          }
          setLiveTournament(t);
        } else {
          setLiveTournament(null);
        }
      });
  }, []);

  useEffect(() => {
    loadLiveTournament();
    const channel = supabase
      .channel("announcements_tournament_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
        loadLiveTournament();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLiveTournament]);

  const { data: queryData, isLoading: isQueryLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => fetchSiteData<{ recent: Announcement[] }>("announcements", "announcements.json"),
    refetchInterval: (query) => (query.state.error ? false : 60_000),
  });

  useEffect(() => {
    if (queryData) {
      const allAnnouncements = queryData.recent || [];
      const pinned = allAnnouncements.filter((item: Announcement) => {
        const status = getStatus(item);
        return status === "ongoing" || status === "upcoming";
      });

      setPinnedAnnouncements(sortByNewest(pinned));
      setRecentAnnouncements(sortByNewest(allAnnouncements));
      setLoading(false);
    } else if (!isQueryLoading) {
      setLoading(false);
    }
  }, [queryData, isQueryLoading]);

  const categories = [
    { id: "all", label: "All", color: "bg-gray-100 text-muted-foreground", icon: "📋" },
    {
      id: "tournament",
      label: "Tournament",
      color: "bg-primary/15 text-primary",
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
        color: "bg-gray-100 text-muted-foreground",
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

  const visibleRecent = filteredRecent.slice(0, visibleCount);

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
    if (status === "upcoming") return "bg-primary/15 text-primary";
    if (status === "ongoing") return "bg-blue-100 text-blue-700";
    if (status === "past") return "bg-gray-100 text-muted-foreground";
    return "bg-gray-100 text-muted-foreground";
  }

  return (
    <div className="dark:bg-slate-950" id="announcements">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Live Tournament Notice — dynamically from Supabase */}
        {liveTournament && (
          <div className="pt-8">
            <div className={`rounded-2xl border p-5 ${
              liveTournament.form_status === "open"
                ? "bg-primary/5 dark:bg-primary/10 border-primary/30"
                : liveTournament.form_status === "closing_soon"
                ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30"
                : "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    liveTournament.form_status === "open"
                      ? "bg-primary/15"
                      : liveTournament.form_status === "closing_soon"
                      ? "bg-amber-500/15"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}>
                    <Trophy className={`w-5 h-5 ${
                      liveTournament.form_status === "open"
                        ? "text-primary"
                        : liveTournament.form_status === "closing_soon"
                        ? "text-amber-500"
                        : "text-slate-500"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-black text-sm md:text-base text-foreground">{liveTournament.name}</span>
                      {liveTournament.status === "active" && (
                        <Badge className="text-[10px] font-bold border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">🏸 Active</Badge>
                      )}
                      {liveTournament.status === "upcoming" && (
                        <Badge className="text-[10px] font-bold border-0 bg-blue-500/15 text-blue-700 dark:text-blue-400">📅 Upcoming</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-1">
                      {liveTournament.start_date && (
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 opacity-70" />
                          {liveTournament.start_date}{liveTournament.end_date && liveTournament.end_date !== liveTournament.start_date ? ` – ${liveTournament.end_date}` : ""}
                        </span>
                      )}
                      {liveTournament.venue && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 opacity-70 text-rose-500" /> 
                          {liveTournament.venue}
                        </span>
                      )}
                      {liveTournament.form_close_date && liveTournament.form_status !== "closed" && (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Closes {new Date(liveTournament.form_close_date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 flex sm:block mt-2 sm:mt-0">
                  {liveTournament.form_url && liveTournament.form_status !== "closed" && liveTournament.form_status !== "disabled" && (
                    <a
                      href={liveTournament.form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                        liveTournament.form_status === "open"
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-amber-500 text-white hover:bg-amber-600"
                      }`}
                    >
                      Register Now <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {(liveTournament.form_status === "closed" || liveTournament.form_status === "disabled") && (
                    <span className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 dark:bg-slate-800 text-muted-foreground cursor-not-allowed border border-slate-300 dark:border-slate-700">
                      <CheckCircle2 className="w-4 h-4" /> Form {liveTournament.form_status === "disabled" ? "Disabled" : "Closed"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
                      className="text-2xl font-black text-blue-900 dark:text-foreground flex items-center gap-2"
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
                            <CardTitle className="text-blue-900 dark:text-foreground text-xl">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary dark:hover:text-primary transition flex items-center gap-2"
                                >
                                  {item.title}
                                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ) : (
                                item.title
                              )}
                            </CardTitle>

                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-3">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-primary" />
                                  <span className="text-muted-foreground dark:text-muted-foreground text-sm">
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
                              className="text-muted-foreground dark:text-slate-300 leading-relaxed"
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
            <section className="py-6 border-b bg-white dark:bg-slate-950 sticky top-16 z-30 shadow-sm">
              <div className="container mx-auto px-4 max-w-md">
                <div className="flex flex-col gap-3">
                  {categories.filter(c => c.id === 'all').map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full px-5 py-3 rounded-full text-sm font-bold transition-all duration-200 flex justify-center items-center gap-2 ${
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 dark:shadow-primary/50/40 scale-[1.02]"
                          : `${cat.color} hover:shadow-sm dark:bg-slate-800 dark:text-slate-300`
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span> {cat.label}
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    {categories.filter(c => c.id !== 'all').map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full px-3 py-2.5 rounded-full text-sm font-bold transition-all duration-200 flex justify-center items-center gap-2 ${
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 dark:shadow-primary/50/40 scale-[1.02]"
                            : `${cat.color} hover:shadow-sm dark:bg-slate-800 dark:text-slate-300`
                        }`}
                      >
                        <span className="text-base">{cat.icon}</span> <span className="truncate">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Recent */}
            <section className="py-14 dark:bg-slate-950">
              <div className="container mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-gradient-to-b from-primary to-teal-600 rounded-full" />
                  <h2
                    className="text-2xl font-black text-blue-900 dark:text-foreground flex items-center gap-2"
                    style={{ fontFamily: "Playfair Display, serif" }}
                  >
                    <Bell className="w-6 h-6 text-primary" />
                    Recent Updates
                  </h2>
                </div>

                {filteredRecent.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                    <p className="text-muted-foreground dark:text-muted-foreground text-lg">
                      No announcements found.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {visibleRecent.map((item, index) => {
                      const status = getStatus(item);

                      return (
                        <Card
                          key={index}
                          className="border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                        >
                          <div
                            className={`h-0.5 w-full ${
                              status === "upcoming"
                                ? "bg-primary"
                                : status === "ongoing"
                                  ? "bg-blue-400"
                                  : "bg-gray-200 dark:bg-slate-600"
                            }`}
                          />
                          <CardHeader className="pb-3">
                            <CardTitle className="text-blue-900 dark:text-foreground text-base font-bold">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary dark:hover:text-primary transition flex items-center gap-2"
                                >
                                  {item.title}
                                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ) : (
                                item.title
                              )}
                            </CardTitle>

                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-muted-foreground dark:text-muted-foreground text-xs">
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
                              className="text-muted-foreground dark:text-muted-foreground text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{
                                __html: sanitize(item.content),
                              }}
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  
                  {visibleCount < filteredRecent.length && (
                    <div ref={observerRef} className="h-20 w-full flex items-center justify-center mt-6">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  </>
                )}
              </div>
            </section>

            {/* Stay Informed */}
            <section className="py-14 bg-gradient-to-br from-blue-50 to-primary/5 dark:from-slate-900 dark:to-slate-800">
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
