import { useEffect, useState } from "react";
import { fetchLatestTournamentsForNotices, fetchRecentTournamentMatchesWithNames } from "@/services/tournamentService";
import { hubService } from "@/services/hubService";
import { fetchSiteData } from "@/lib/siteData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Trophy, Swords, Search, ShoppingBag, Clock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type NoticeType = "announcement" | "tournament" | "match" | "find_lost" | "marketplace";

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
  icon: any;
  link: string;
}

export function NoticeBoard() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      try {
        const fetchedItems: NoticeItem[] = [];

        // 1. Announcements
        const siteData = await fetchSiteData<{ recent: any[] }>("announcements", "announcements.json");
        if (siteData?.recent) {
          siteData.recent.forEach((ann: any, index: number) => {
            fetchedItems.push({
              id: `ann-${index}`,
              type: "announcement",
              title: ann.title,
              description: ann.content ? ann.content.substring(0, 100) + "..." : undefined,
              date: new Date(ann.date || Date.now()),
              badgeText: ann.category || "News",
              iconWrapperClass: "bg-info/10",
              iconClass: "text-info",
              badgeClass: "bg-info/20 text-info ring-1 ring-inset ring-info/20",
              icon: Bell,
              link: "/pulse#announcements",
            });
          });
        }

        // 2. Tournaments
        const tournaments = await fetchLatestTournamentsForNotices();

        if (tournaments) {
          tournaments.forEach((t) => {
            let badgeText = "Upcoming";
            let iconWrapperClass = "bg-individual/10";
            let iconClass = "text-individual";
            let badgeClass = "bg-individual/20 text-individual ring-1 ring-inset ring-individual/20";

            if (t.status === "active") {
              badgeText = "Active";
              iconWrapperClass = "bg-success/10";
              iconClass = "text-success";
              badgeClass = "bg-success/20 text-success ring-1 ring-inset ring-success/20";
            } else if (t.status === "archived" || t.status === "completed" || t.status === "cancelled") {
              badgeText = t.status === "archived" ? "Archived" : t.status === "completed" ? "Completed" : "Cancelled";
              iconWrapperClass = "bg-muted-foreground/10";
              iconClass = "text-muted-foreground";
              badgeClass = "bg-muted-foreground/20 text-muted-foreground ring-1 ring-inset ring-border-strong/20";
            } else if (t.status === "draft") {
              badgeText = "Draft";
            }

            fetchedItems.push({
              id: `tourn-${t.id}`,
              type: "tournament",
              title: t.name,
              description: `Tournament is ${t.status}`,
              date: new Date(t.created_at),
              badgeText,
              iconWrapperClass,
              iconClass,
              badgeClass,
              icon: Trophy,
              link: `/tournaments`,
            });
          });
        }

        // 3. Matches (Live / Scheduled / Recent)
        const matches = await fetchRecentTournamentMatchesWithNames();

        if (matches) {
          matches.forEach((m) => {
            if (m.team1_label === "BYE" || m.team2_label === "BYE") return;
            
            let badgeText = "Match";
            let iconWrapperClass = "bg-muted-foreground/10";
            let iconClass = "text-muted-foreground";
            let badgeClass = "bg-muted-foreground/20 text-soft ring-1 ring-inset ring-border-strong/20";
            let description = `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"}`;
            
            if (m.status === "in_progress") {
              badgeText = "Live Now";
              iconWrapperClass = "bg-live/10";
              iconClass = "text-live animate-pulse";
              badgeClass = "bg-live/20 text-live ring-1 ring-inset ring-live/20 animate-pulse";
            } else if (m.status === "scheduled" && m.scheduled_at) {
              badgeText = "Scheduled";
              iconWrapperClass = "bg-warning/10";
              iconClass = "text-warning";
              badgeClass = "bg-warning/20 text-warning ring-1 ring-inset ring-warning/20";
              description += ` @ ${new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
            } else if (m.status === "completed") {
              badgeText = "Completed";
              description = `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"} - ${m.score || "Finished"}`;
            }

            fetchedItems.push({
              id: `match-${m.id}`,
              type: "match",
              title: m.tournaments?.name || "Match",
              description,
              date: new Date(m.ended_at || m.started_at || m.scheduled_at || m.created_at),
              badgeText,
              iconWrapperClass,
              iconClass,
              badgeClass,
              icon: Swords,
              link: `/pulse#feed`,
            });
          });
        }

        // 4. Find & Lost
        const findLost = await hubService.getOpenFindLostForNotices();

        if (findLost) {
          findLost.forEach((post) => {
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
              link: "/club?tab=lost-found",
            });
          });
        }

        // 5. Marketplace
        const marketplace = await hubService.getActiveListingsForNotices();

        if (marketplace) {
          marketplace.forEach((listing) => {
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
              link: "/club?tab=buy-sell",
            });
          });
        }

        // Sort and limit
        fetchedItems.sort((a, b) => b.date.getTime() - a.date.getTime());
        setItems(fetchedItems.slice(0, 20)); // Limit to 20 items

      } catch (err) {
        console.error("Error fetching notices:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchNotices();
  }, []);

  if (loading) {
    return (
      <Card className="border-border bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden mt-8 mb-8">
        <CardHeader className="border-b border-border bg-muted/50 py-4">
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary animate-pulse" />
            Notice Board
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-card/40 backdrop-blur-md shadow-lg overflow-hidden mb-2 mt-2 ring-1 ring-border/50">
      <CardHeader 
        className="border-b border-border/50 bg-gradient-to-r from-card/60 to-muted/40 py-3.5 px-4 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-foreground/80 hover:from-muted/60 hover:to-muted/40 transition-all duration-300 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2.5 text-foreground">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 text-primary" />
          </div>
          Notice Board
        </CardTitle>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] sm:text-xs font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-full border border-primary/20">
            Live Feed
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-muted group-hover:bg-muted-strong transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.div>
        </div>
      </CardHeader>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: "auto" },
              collapsed: { opacity: 0, height: 0 }
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="p-0">
        <div className="max-h-[280px] overflow-y-scroll overscroll-auto visible-scrollbar pr-1">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No recent notices</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id}
                  >
                    <Link href={item.link} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors group relative">
                        <div className={cn("p-2.5 rounded-2xl shrink-0 flex items-center justify-center transition-all group-hover:scale-110", item.iconWrapperClass)}>
                          <Icon className={cn("w-5 h-5", item.iconClass)} />
                        </div>
                        {/* Left column: title + subtitle */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: item.description }} />
                          )}
                        </div>
                        {/* Right column: badge + date */}
                        <div className="shrink-0 flex flex-col items-end gap-1 text-right">
                          {item.badgeText && (
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", item.badgeClass)}>
                              {item.badgeText}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                            <Clock className="w-3 h-3 shrink-0" />
                            {item.date && !isNaN(item.date.getTime()) ? item.date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                          </span>
                        </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
