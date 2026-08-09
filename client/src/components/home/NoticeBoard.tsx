// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchSiteData } from "@/lib/siteData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Trophy, Swords, Search, ShoppingBag, Clock, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
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
              iconWrapperClass: "bg-blue-500/10 dark:bg-blue-400/10",
              iconClass: "text-blue-600 dark:text-blue-400",
              badgeClass: "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300 ring-1 ring-inset ring-blue-500/20 dark:ring-blue-400/20",
              icon: Bell,
              link: "/pulse#announcements",
            });
          });
        }

        // 2. Tournaments
        const { data: tournaments } = await supabase
          .from("tournaments")
          .select("*")
          .neq("status", "deleted")
          .order("created_at", { ascending: false })
          .limit(5);

        if (tournaments) {
          tournaments.forEach((t) => {
            let badgeText = "Upcoming";
            let iconWrapperClass = "bg-fuchsia-500/10 dark:bg-fuchsia-400/10";
            let iconClass = "text-fuchsia-600 dark:text-fuchsia-400";
            let badgeClass = "bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/20 dark:ring-fuchsia-400/20";
            
            if (t.status === "active") {
              badgeText = "Active";
              iconWrapperClass = "bg-emerald-500/10 dark:bg-emerald-400/10";
              iconClass = "text-emerald-600 dark:text-emerald-400";
              badgeClass = "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20 dark:ring-emerald-400/20";
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
              link: `/pulse#events`,
            });
          });
        }

        // 3. Matches (Live / Scheduled / Recent)
        const { data: matches } = await supabase
          .from("tournament_matches")
          .select("*, tournaments(name)")
          .neq("status", "deleted")
          .order("updated_at", { ascending: false })
          .limit(15);

        if (matches) {
          matches.forEach((m) => {
            if (m.team1_label === "BYE" || m.team2_label === "BYE") return;
            
            let badgeText = "Match";
            let iconWrapperClass = "bg-slate-500/10 dark:bg-slate-400/10";
            let iconClass = "text-slate-600 dark:text-slate-400";
            let badgeClass = "bg-slate-500/15 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300 ring-1 ring-inset ring-slate-500/20 dark:ring-slate-400/20";
            let description = `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"}`;
            
            if (m.status === "in_progress") {
              badgeText = "Live Now";
              iconWrapperClass = "bg-red-500/10 dark:bg-red-400/10";
              iconClass = "text-red-600 dark:text-red-400 animate-pulse";
              badgeClass = "bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-300 ring-1 ring-inset ring-red-500/20 dark:ring-red-400/20 animate-pulse";
            } else if (m.status === "scheduled" && m.scheduled_at) {
              badgeText = "Scheduled";
              iconWrapperClass = "bg-amber-500/10 dark:bg-amber-400/10";
              iconClass = "text-amber-600 dark:text-amber-400";
              badgeClass = "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20 dark:ring-amber-400/20";
              description += ` @ ${new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
            } else if (m.status === "completed") {
              badgeText = "Completed";
              description = `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"} - ${m.score || "Finished"}`;
            }

            fetchedItems.push({
              id: `match-${m.id}`,
              type: "match",
              title: m.tournaments?.name || m.tournament_slug || "Match",
              description,
              date: new Date(m.updated_at || m.created_at),
              badgeText,
              iconWrapperClass,
              iconClass,
              badgeClass,
              icon: Swords,
              link: `/pulse#feed-matches`,
            });
          });
        }

        // 4. Find & Lost
        const { data: findLost } = await supabase
          .from("find_lost_posts")
          .select("*")
          .eq("resolved", false)
          .order("created_at", { ascending: false })
          .limit(5);

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
              iconWrapperClass: isLost ? "bg-rose-500/10 dark:bg-rose-400/10" : "bg-teal-500/10 dark:bg-teal-400/10",
              iconClass: isLost ? "text-rose-600 dark:text-rose-400" : "text-teal-600 dark:text-teal-400",
              badgeClass: isLost 
                ? "bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300 ring-1 ring-inset ring-rose-500/20 dark:ring-rose-400/20"
                : "bg-teal-500/15 text-teal-700 dark:bg-teal-400/20 dark:text-teal-300 ring-1 ring-inset ring-teal-500/20 dark:ring-teal-400/20",
              icon: Search,
              link: "/hub#find-lost",
            });
          });
        }

        // 5. Marketplace
        const { data: marketplace } = await supabase
          .from("marketplace_listings")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5);

        if (marketplace) {
          marketplace.forEach((listing) => {
            fetchedItems.push({
              id: `market-${listing.id}`,
              type: "marketplace",
              title: listing.title,
              description: `₹${listing.price} - ${listing.condition}`,
              date: new Date(listing.created_at),
              badgeText: listing.category,
              iconWrapperClass: "bg-violet-500/10 dark:bg-violet-400/10",
              iconClass: "text-violet-600 dark:text-violet-400",
              badgeClass: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300 ring-1 ring-inset ring-violet-500/20 dark:ring-violet-400/20",
              icon: ShoppingBag,
              link: "/hub#marketplace",
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
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl overflow-hidden mt-8 mb-8">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 py-4">
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
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl overflow-hidden mt-8 mb-8">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 py-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notice Board
        </CardTitle>
        <span className="text-xs font-bold text-muted-foreground bg-slate-200/50 dark:bg-slate-800 px-2 py-1 rounded-md">
          Live Feed
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto visible-scrollbar">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No recent notices</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id}
                  >
                    <Link href={item.link}>
                      <a className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group relative">
                        <div className={cn("p-2.5 rounded-2xl shrink-0 flex items-center justify-center transition-all group-hover:scale-110", item.iconWrapperClass)}>
                          <Icon className={cn("w-5 h-5", item.iconClass)} />
                        </div>
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            {item.badgeText && (
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md", item.badgeClass)}>
                                {item.badgeText}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium ml-auto">
                              <Clock className="w-3 h-3" />
                              {item.date && !isNaN(item.date.getTime()) ? item.date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent"}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: item.description }} />
                          )}
                        </div>
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-4">
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </a>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
