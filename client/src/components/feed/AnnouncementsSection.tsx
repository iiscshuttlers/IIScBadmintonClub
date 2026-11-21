import { useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Bell, Pin, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSiteData } from "@/lib/siteData";
import DOMPurify from "dompurify";
import { safeReplaceState, safeGetSearchParams, isCapacitor } from "@/lib/navUtils";
import { buildAutoAnnouncements, type AutoAnnouncement } from "@/lib/autoAnnouncements";
import { useAutoFeedTournaments } from "@/hooks/queries/useAutoFeedTournaments";
import { AutoPostBody } from "@/components/feed/AutoPostBody";

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
      "<a href='$2' target='_blank' rel='noopener noreferrer' style='color:var(--primary);font-weight:bold;text-decoration:underline;'>$1</a>",
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
  /** Set on posts built from tournament data (see lib/autoAnnouncements). */
  auto?: AutoAnnouncement;
};

type AnnouncementsValue = { recent?: Announcement[]; hiddenAuto?: string[] };

function sortByNewest(items: Announcement[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
  );
}

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

export function AnnouncementsSection() {
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
  const [visibleCount, setVisibleCount] = useState(10);
  const observerRef = useRef<HTMLDivElement>(null);

  const { data: queryData, isLoading: isQueryLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => fetchSiteData<AnnouncementsValue>("announcements", "announcements.json"),
    refetchInterval: (query) => (query.state.error ? false : 60_000),
  });
  const { data: autoRows } = useAutoFeedTournaments();
  const loading = isQueryLoading && !queryData;

  // Tournament posts are worked out from live data and merged with the
  // hand-written ones; admins can hide one through `hiddenAuto`.
  const hiddenAuto = queryData?.hiddenAuto;
  const autoItems = useMemo<Announcement[]>(
    () =>
      buildAutoAnnouncements(autoRows, Array.isArray(hiddenAuto) ? hiddenAuto : []).map((post) => ({
        title: post.title,
        date: post.date,
        startDate: post.startDate,
        endDate: post.endDate,
        category: post.category,
        content: "",
        auto: post,
      })),
    [autoRows, hiddenAuto],
  );
  const recentAnnouncements = useMemo(
    () => sortByNewest([...(Array.isArray(queryData?.recent) ? queryData.recent : []), ...autoItems]),
    [queryData, autoItems],
  );
  const pinnedAnnouncements = useMemo(
    () =>
      recentAnnouncements.filter((item) => {
        const status = getStatus(item);
        return status === "ongoing" || status === "upcoming";
      }),
    [recentAnnouncements],
  );

  // Scroll to a shared #feed-… post once it has rendered.
  const scrolledHash = useRef<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#feed-") || scrolledHash.current === hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.substring(1));
      if (!el) return;
      scrolledHash.current = hash;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add a brief highlight effect
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
      }, 2000);
    }, 100);
    return () => clearTimeout(timer);
  }, [recentAnnouncements]);

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

  const categories = [
    { id: "all", label: "All", color: "bg-muted/50 text-muted-foreground border border-border-strong/50", icon: "📋" },
    {
      id: "tournament",
      label: "Tournament",
      color: "bg-warning/10 text-warning border border-warning/30",
      icon: "🏆",
    },
    {
      id: "facility",
      label: "Facility",
      color: "bg-info/10 text-info border border-info/30",
      icon: "🏸",
    },
    {
      id: "general",
      label: "General",
      color: "bg-individual/10 text-individual border border-individual/30",
      icon: "📢",
    },
    {
      id: "others",
      label: "Others",
      color: "bg-danger/10 text-danger border border-danger/30",
      icon: "📌",
    },
  ];

  const getCategoryBadge = (category: string) => {
    const found = categories.find((c) => c.id === category);
    return (
      found ?? {
        label: category,
        color: "bg-muted/50 text-muted-foreground border border-border-strong/50",
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

  function getStatusColor(status: string) {
    if (status === "upcoming") return "bg-primary/15 text-primary";
    if (status === "ongoing") return "bg-info/10 text-info";
    if (status === "past") return "bg-muted text-muted-foreground";
    return "bg-muted text-muted-foreground";
  }

  return (
    <div className="bg-background" id="announcements">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Loading */}
        {loading && (
          <section className="py-16">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-card p-6 space-y-4 animate-pulse"
                >
                  <div className="h-6 w-3/4 rounded bg-soft" />
                  <div className="flex gap-3">
                    <div className="h-5 w-20 rounded-full bg-soft" />
                    <div className="h-5 w-16 rounded-full bg-soft" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-soft" />
                    <div className="h-4 w-5/6 rounded bg-soft" />
                    <div className="h-4 w-2/3 rounded bg-soft" />
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
              <section className="py-14 bg-gradient-to-r from-card to-muted">
                <div className="container mx-auto px-4">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-2 h-8 bg-gradient-to-b from-secondary to-warning rounded-full" />
                    <h2
                      className="text-2xl font-black text-foreground flex items-center gap-2 font-display"
                    >
                      <Pin className="w-6 h-6 text-secondary" />
                      Important Announcements
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {pinnedAnnouncements.map((item, index) => {
                      const status = getStatus(item);

                      return (
                        <Card
                          key={index}
                          id={`feed-${item.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                          className="border-2 border-secondary/30 bg-muted hover:shadow-lg transition-all duration-300 overflow-hidden"
                        >
                          <div className="h-1 bg-gradient-to-r from-secondary to-warning" />
                          <CardHeader>
                            <CardTitle className="text-foreground text-xl">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary transition flex items-center gap-2"
                                >
                                  {item.title}
                                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ) : (
                                item.title
                              )}
                            </CardTitle>

                            <div className="flex flex-col gap-2 mt-3 text-sm text-muted-foreground">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4 text-primary" />
                                  <span className="text-muted-foreground text-sm">
                                    Published: {item.date}
                                  </span>
                                </div>
                              )}
                              
                              {(item.startDate || item.endDate) && (
                                <div className="flex items-center gap-1.5 bg-info/10 px-2.5 py-1 rounded-md text-info font-medium text-xs border border-info/40 w-full">
                                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">
                                    Event: {item.startDate || "TBD"}{" "}
                                    {item.endDate && item.endDate !== item.startDate
                                      ? `— ${item.endDate}`
                                      : ""}
                                  </span>
                                </div>
                              )}

                              <div className="flex gap-2 w-full">
                                {(() => {
                                  const b = getCategoryBadge(item.category);
                                  return (
                                    <Badge
                                      className={`${b.color} border-0 font-semibold flex-1 justify-center py-1`}
                                    >
                                      <span className="mr-1.5">{b.icon}</span> <span className="truncate">{b.label}</span>
                                    </Badge>
                                  );
                                })()}
                                <Badge
                                  className={`${getStatusColor(status)} border-0 font-semibold capitalize flex-1 justify-center py-1`}
                                >
                                  {status}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {item.auto ? (
                              <AutoPostBody post={item.auto} />
                            ) : (
                              <p
                                className="text-soft leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: sanitize(item.content),
                                }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Filter */}
            <section className="py-6 border-b bg-background sticky top-16 z-30 shadow-sm">
              <div className="container mx-auto px-4 max-w-md">
                <div className="flex flex-col gap-2">
                  {categories.filter(c => c.id === 'all').map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 flex justify-center items-center gap-2 ${
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/40 scale-[1.02] border border-primary/50"
                          : `${cat.color} hover:shadow-sm`
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span> {cat.label}
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    {categories.filter(c => c.id !== 'all').map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full px-3 py-1.5 rounded-full text-sm font-bold transition-all duration-200 flex justify-center items-center gap-1.5 ${
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/40 scale-[1.02] border border-primary/50"
                            : `${cat.color} hover:shadow-sm`
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
            <section className="py-14 bg-background">
              <div className="container mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-8 bg-gradient-to-b from-primary to-team rounded-full" />
                  <h2
                    className="text-2xl font-black text-foreground flex items-center gap-2 font-display"
                  >
                    <Bell className="w-6 h-6 text-primary" />
                    Recent Updates
                  </h2>
                </div>

                {filteredRecent.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl border-2 border-dashed border-border-strong">
                    <p className="text-muted-foreground text-lg">
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
                          id={`feed-${item.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                          className="border border-border-strong bg-muted hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                        >
                          <div
                            className={`h-0.5 w-full ${
                              status === "upcoming"
                                ? "bg-primary"
                                : status === "ongoing"
                                  ? "bg-info"
                                  : "bg-faint"
                            }`}
                          />
                          <CardHeader className="pb-3">
                            <CardTitle className="text-foreground text-base font-bold">
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary transition flex items-center gap-2"
                                >
                                  {item.title}
                                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ) : (
                                item.title
                              )}
                            </CardTitle>

                            <div className="flex flex-col gap-2 mt-3 text-sm text-muted-foreground">
                              {item.date && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-muted-foreground text-xs">
                                    Published: {item.date}
                                  </span>
                                </div>
                              )}
                              
                              {(item.startDate || item.endDate) && (
                                <div className="flex items-center gap-1.5 bg-info/10 px-2.5 py-1 rounded-md text-info font-medium text-xs border border-info/40 w-full">
                                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">
                                    Event: {item.startDate || "TBD"}{" "}
                                    {item.endDate && item.endDate !== item.startDate
                                      ? `— ${item.endDate}`
                                      : ""}
                                  </span>
                                </div>
                              )}

                              <div className="flex gap-2 w-full">
                                {(() => {
                                  const b = getCategoryBadge(item.category);
                                  return (
                                    <Badge
                                      className={`${b.color} border-0 font-semibold flex-1 justify-center py-1 text-xs`}
                                    >
                                      <span className="mr-1.5">{b.icon}</span> <span className="truncate">{b.label}</span>
                                    </Badge>
                                  );
                                })()}
                                <Badge
                                  className={`${getStatusColor(status)} border-0 font-semibold capitalize flex-1 justify-center py-1 text-xs`}
                                >
                                  {status}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent>
                            {item.auto ? (
                              <AutoPostBody post={item.auto} compact />
                            ) : (
                              <p
                                className="text-muted-foreground text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{
                                  __html: sanitize(item.content),
                                }}
                              />
                            )}
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

          </>
        )}
      </div>
    </div>
  );
}

export default AnnouncementsSection;
