import { useEffect, useState } from "react";
import { hubService } from "@/services/hubService";
import { fetchSiteData } from "@/lib/siteData";
import { Bell, Search, ShoppingBag, Clock, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * Home's club noticeboard: announcements, lost & found and buy & sell posts,
 * newest first. Shows three; "Show all" opens up to twenty. Tournament and
 * match items live in "Happening now" and the Tournaments tab instead.
 */

type NoticeType = "announcement" | "find_lost" | "marketplace";

interface NoticeItem {
  id: string;
  type: NoticeType;
  title: string;
  description?: string;
  date: Date;
  badgeText?: string;
  iconWrapperClass: string;
  iconClass: string;
  badgeClass: string;
  icon: LucideIcon;
  link: string;
}

const COLLAPSED_COUNT = 3;
const MAX_ITEMS = 20;

/** Plain-text preview of announcement content (which may carry markup). */
function preview(text: string | undefined | null, max = 100): string | undefined {
  if (!text) return undefined;
  const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return undefined;
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

export function NoticeBoard() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchNotices() {
      const [annRes, lostRes, marketRes] = await Promise.allSettled([
        fetchSiteData<{ recent: any[] }>("announcements", "announcements.json"),
        hubService.getOpenFindLostForNotices(),
        hubService.getActiveListingsForNotices(),
      ]);
      const fetchedItems: NoticeItem[] = [];

      // 1. Announcements
      const siteData = annRes.status === "fulfilled" ? annRes.value : null;
      siteData?.recent?.forEach((ann: any, index: number) => {
        fetchedItems.push({
          id: `ann-${index}`,
          type: "announcement",
          title: ann.title,
          description: preview(ann.content),
          date: new Date(ann.date || Date.now()),
          badgeText: ann.category || "News",
          iconWrapperClass: "bg-info/10",
          iconClass: "text-info",
          badgeClass: "bg-info/20 text-info ring-1 ring-inset ring-info/20",
          icon: Bell,
          link: "/club?tab=news",
        });
      });

      // 2. Lost & found
      const findLost = lostRes.status === "fulfilled" ? lostRes.value : null;
      findLost?.forEach((post) => {
        const isLost = post.type === "lost";
        fetchedItems.push({
          id: `fl-${post.id}`,
          type: "find_lost",
          title: post.title,
          description: isLost ? "Lost Item" : "Found Item",
          date: new Date(post.created_at),
          badgeText: isLost ? "Lost" : "Found",
          iconWrapperClass: isLost ? "bg-danger/10" : "bg-team/10",
          iconClass: isLost ? "text-danger" : "text-team",
          badgeClass: isLost
            ? "bg-danger/20 text-danger ring-1 ring-inset ring-danger/20"
            : "bg-team/20 text-team ring-1 ring-inset ring-team/20",
          icon: Search,
          link: "/club?tab=market&sub=lost-found",
        });
      });

      // 3. Buy & sell
      const marketplace = marketRes.status === "fulfilled" ? marketRes.value : null;
      marketplace?.forEach((listing) => {
        fetchedItems.push({
          id: `market-${listing.id}`,
          type: "marketplace",
          title: listing.title,
          description: `₹${listing.price} - ${listing.condition}`,
          date: new Date(listing.created_at),
          badgeText: listing.category,
          iconWrapperClass: "bg-individual/10",
          iconClass: "text-individual",
          badgeClass: "bg-individual/20 text-individual ring-1 ring-inset ring-individual/20",
          icon: ShoppingBag,
          link: "/club?tab=market&sub=buy-sell",
        });
      });

      for (const r of [annRes, lostRes, marketRes]) {
        if (r.status === "rejected") console.error("Error fetching notices:", r.reason);
      }

      const time = (d: Date) => (isNaN(d.getTime()) ? 0 : d.getTime());
      fetchedItems.sort((a, b) => time(b.date) - time(a.date));
      if (!cancelled) {
        setItems(fetchedItems.slice(0, MAX_ITEMS));
        setLoading(false);
      }
    }

    void fetchNotices();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-24 mb-3 rounded-2xl bg-card/40 ring-1 ring-border/50 animate-pulse" aria-hidden />;
  }
  if (items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby="noticeboard-heading" className="mb-3 rounded-2xl bg-card/40 shadow-lg overflow-hidden ring-1 ring-border/50">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
        <h2 id="noticeboard-heading" className="text-sm sm:text-base font-black flex items-center gap-2.5 text-foreground">
          <span className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center" aria-hidden>
            <Bell className="w-3.5 h-3.5 text-primary" />
          </span>
          Club noticeboard
        </h2>
        {items.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="min-h-[44px] px-2 text-xs font-black text-primary underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {showAll ? "Show fewer" : `Show all (${items.length})`}
          </button>
        )}
      </div>
      <ul className={cn("divide-y divide-border", showAll && "max-h-[360px] overflow-y-auto overscroll-contain")}>
        {shown.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link href={item.link} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors group">
                <span className={cn("p-2.5 rounded-2xl shrink-0 flex items-center justify-center", item.iconWrapperClass)} aria-hidden>
                  <Icon className={cn("w-5 h-5", item.iconClass)} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">{item.description}</span>
                  )}
                </span>
                <span className="shrink-0 flex flex-col items-end gap-1 text-right">
                  {item.badgeText && (
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", item.badgeClass)}>
                      {item.badgeText}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                    <Clock className="w-3 h-3 shrink-0" aria-hidden />
                    {!isNaN(item.date.getTime()) ? item.date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
