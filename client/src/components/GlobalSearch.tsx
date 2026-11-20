import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Swords, Megaphone, ArrowRight, Loader2, CalendarDays, Users, Trophy, Radio, Home, BarChart3, Settings, CornerDownLeft } from "lucide-react";
import { fetchSearchPlayers, fetchSiteDataEntry } from "@/services/playerService";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { track } from "@/lib/analytics";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";

interface SearchResult {
  type: "player" | "announcement" | "event" | "action";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  href: string;
}

// Quick navigation commands — always available, filtered by the query. (#20)
const ACTIONS: { id: string; title: string; subtitle: string; href: string; keywords: string }[] = [
  { id: "a-home", title: "Home", subtitle: "Go to the home page", href: "/", keywords: "home start" },
  { id: "a-live", title: "Live Scores", subtitle: "Pulse — live matches & feed", href: "/pulse#live", keywords: "live scores pulse feed now" },
  { id: "a-tournaments", title: "Tournaments", subtitle: "Browse & register for events", href: "/tournaments", keywords: "tournaments events draws compete" },
  { id: "a-matches", title: "My Matches", subtitle: "Your match history & pending", href: "/my-matches", keywords: "my matches history pending results" },
  { id: "a-directory", title: "Players Directory", subtitle: "Find club members", href: "/pulse#directory", keywords: "directory players members find partner" },
  { id: "a-stats", title: "My Stats", subtitle: "Your personal stats", href: "/__my_stats__", keywords: "stats personal profile rating elo" },
  { id: "a-host", title: "Host a Tournament", subtitle: "Create a new event", href: "/host-tournament", keywords: "host create tournament organize new" },
  { id: "a-settings", title: "Settings", subtitle: "Appearance, notifications, account", href: "/settings", keywords: "settings preferences theme accent notifications account" },
];

function actionIcon(id: string) {
  if (id === "a-home") return <Home className="w-4 h-4 shrink-0 text-primary" />;
  if (id === "a-live") return <Radio className="w-4 h-4 shrink-0 text-live" />;
  if (id === "a-tournaments" || id === "a-host") return <Trophy className="w-4 h-4 shrink-0 text-gold" />;
  if (id === "a-matches") return <Swords className="w-4 h-4 shrink-0 text-info" />;
  if (id === "a-directory") return <Users className="w-4 h-4 shrink-0 text-individual" />;
  if (id === "a-stats") return <BarChart3 className="w-4 h-4 shrink-0 text-success" />;
  return <Settings className="w-4 h-4 shrink-0 text-muted-foreground" />;
}

function matchingActions(q: string): SearchResult[] {
  const lq = q.trim().toLowerCase();
  const list = !lq
    ? ACTIONS
    : ACTIONS.filter((a) => a.title.toLowerCase().includes(lq) || a.keywords.includes(lq));
  return list.map((a) => ({ type: "action" as const, id: a.id, title: a.title, subtitle: a.subtitle, href: a.href }));
}

function fuzzyMatch(term: string, target: string | null | undefined): boolean {
  if (!target) return false;
  const t = term.toLowerCase();
  const tgt = target.toLowerCase();
  if (tgt.includes(t)) return true;
  
  if (t.length < 4) return false; // Require at least 4 chars for fuzzy matching
  
  const maxDiff = t.length >= 6 ? 2 : 1; 
  
  for (let i = 0; i <= tgt.length - t.length; i++) {
    const sub = tgt.substring(i, i + t.length);
    let diff = 0;
    for (let j = 0; j < t.length; j++) {
      if (t[j] !== sub[j]) {
        diff++;
        if (diff > maxDiff) break;
      }
    }
    if (diff <= maxDiff) return true;
  }
  return false;
}

// Module-level cache for fast client-side fuzzy searching of players
let cachedSearchPlayers: any[] | null = null;

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  const { myPlayerId } = useNavigationAuth();

  // Render/navigation order — groups are shown in this order.
  const TYPE_ORDER = ["action", "player", "announcement", "event"] as const;
  const ordered = TYPE_ORDER.flatMap((t) => results.filter((r) => r.type === t));

  // Focus input when opened; seed with default quick actions.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(matchingActions(""));
      setActiveIndex(0);
    }
  }, [open]);

  // Keep the highlighted row in range as results change.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, ordered.length - 1)));
  }, [ordered.length]);

  // Keyboard: Esc closes, ↑/↓ move, Enter selects the highlighted row.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (ordered.length ? (i + 1) % ordered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (ordered.length ? (i - 1 + ordered.length) % ordered.length : 0));
      } else if (e.key === "Enter") {
        const sel = ordered[activeIndex];
        if (sel) { e.preventDefault(); handleSelect(sel.href); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, ordered, activeIndex]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults(matchingActions(q));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (q.includes("iiscshuttlers.github.io") || q.includes("localhost:3000") || q.includes("localhost:5173")) {
        try {
          const parsed = new URL(q.startsWith("http") ? q : `https://${q}`);
          // Extract everything after /IIScBadmintonClub if present, otherwise just use pathname
          let pathAfterBase = parsed.pathname;
          if (pathAfterBase.startsWith("/IIScBadmintonClub")) {
            pathAfterBase = pathAfterBase.replace("/IIScBadmintonClub", "");
          }
          if (pathAfterBase.startsWith("/iiscshuttlers")) {
            pathAfterBase = pathAfterBase.replace("/iiscshuttlers", "");
          }
          if (!pathAfterBase) pathAfterBase = "/";
          
          const fullPath = pathAfterBase + parsed.search + parsed.hash;
          
          setResults([{
            type: "event",
            id: "url-direct",
            title: "Open Shared Link",
            subtitle: fullPath,
            href: fullPath,
          }]);
          setLoading(false);
          return;
        } catch {
          /* intentional — query is not a valid URL, proceed to search */
        }
      }

      const lq = q.toLowerCase();

      const [playersRes, annRes, eventsRes] = await Promise.all([
        // We fetch all active players once to support client-side fuzzy matching
        (async () => {
          if (cachedSearchPlayers) return null;
          const data = await fetchSearchPlayers();
          if (data) cachedSearchPlayers = data;
          return null;
        })(),
        fetchSiteDataEntry("announcements"),
        fetchSiteDataEntry("events"),
      ]);

      // Filter players using fuzzy match
      const matchedPlayers = (cachedSearchPlayers || []).filter(p => fuzzyMatch(lq, p.full_name));
      const topPlayers = matchedPlayers.slice(0, 5);

      const playerResults: SearchResult[] = topPlayers.map((p) => ({
        type: "player",
        id: p.id,
        title: p.full_name,
        subtitle: `${p.department ?? ""}${p.department ? " · " : ""}${p.overall_rank ? `Rank #${p.overall_rank}` : "Unranked"}`,
        avatar: p.avatar_url,
        href: `/player/${p.id}`,
      }));

      const annList: SearchResult[] = [];
      const announcementValue = annRes.data?.value;
      const recentAnnouncements =
        announcementValue && typeof announcementValue === "object" && !Array.isArray(announcementValue)
          && Array.isArray(announcementValue.recent)
          ? announcementValue.recent
          : [];
      if (recentAnnouncements.length > 0) {
        for (const ann of recentAnnouncements) {
          if (!ann || typeof ann !== "object" || Array.isArray(ann)) continue;
          if (
            (typeof ann.title === "string" && ann.title.toLowerCase().includes(lq)) ||
            (typeof ann.content === "string" && ann.content.toLowerCase().includes(lq))
          ) {
            annList.push({
              type: "announcement",
              id: typeof ann.title === "string" ? ann.title : crypto.randomUUID(),
              title: typeof ann.title === "string" ? ann.title : "Announcement",
              subtitle: typeof ann.category === "string" ? ann.category : undefined,
              href: "/pulse",
            });
            if (annList.length >= 3) break;
          }
        }
      }

      // Search events from site_data
      const eventList: SearchResult[] = [];
      const eventsData = eventsRes.data?.value;
      const eventsObject = eventsData && typeof eventsData === "object" && !Array.isArray(eventsData)
        ? eventsData
        : null;
      const eventArray = Array.isArray(eventsData)
        ? eventsData
        : eventsObject && Array.isArray(eventsObject.upcoming)
        ? eventsObject.upcoming
        : eventsObject && Array.isArray(eventsObject.events)
        ? eventsObject.events
        : eventsObject && Array.isArray(eventsObject.all)
        ? eventsObject.all
        : [];
      for (const ev of eventArray) {
        if (!ev || typeof ev !== "object" || Array.isArray(ev)) continue;
        const title = typeof ev.title === "string" ? ev.title : "Event";
        const category = typeof ev.category === "string" ? ev.category : undefined;
        const venue = typeof ev.venue === "string" ? ev.venue : undefined;
        if (
          title.toLowerCase().includes(lq) ||
          category?.toLowerCase().includes(lq) ||
          venue?.toLowerCase().includes(lq)
        ) {
          eventList.push({
            type: "event",
            id: typeof ev.id === "string" ? ev.id : title,
            title,
            subtitle: `${category ?? "Event"}${venue ? ` · ${venue}` : ""}`,
            href: "/events",
          });
          if (eventList.length >= 3) break;
        }
      }

      setResults([...matchingActions(q), ...playerResults, ...annList, ...eventList]);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setActiveIndex(0);
    // Show matching quick actions instantly; debounce the DB search.
    setResults((prev) => [...matchingActions(val), ...prev.filter((r) => r.type !== "action")]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleSelect = (href: string) => {
    track("command_palette_select", { href });
    // "My Stats" resolves to the signed-in user's own personal page.
    const resolved =
      href === "/__my_stats__"
        ? myPlayerId
          ? `/player/${myPlayerId}/personal`
          : "/my-matches"
        : href;
    setLocation(resolved);
    onClose();
  };

  const iconFor = (r: SearchResult) => {
    if (r.type === "action") return actionIcon(r.id);
    if (r.type === "player") return <User className="w-4 h-4 shrink-0 text-primary" />;
    if (r.type === "event") return <CalendarDays className="w-4 h-4 shrink-0 text-individual" />;
    return <Megaphone className="w-4 h-4 shrink-0 text-warning" />;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-media/60 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          ref={trapRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search and quick actions"
          className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border-strong overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            {loading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search players, teams, matches, events…"
              className="flex-1 bg-transparent text-foreground placeholder-faint text-sm outline-none"
            />
            <button onClick={onClose} aria-label="Close search" className="p-1 rounded-lg hover:bg-muted transition">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && !loading && (
              <div className="py-10 text-center text-muted-foreground text-sm font-medium">
                No results for "<span className="font-bold text-soft">{query}</span>"
              </div>
            )}

            {/* Group by type (actions first) */}
            {(["action", "player", "announcement", "event"] as const).map((type) => {
              const group = results.filter((r) => r.type === type);
              if (!group.length) return null;
              const labels = { action: query ? "Jump to" : "Quick actions", player: "Players", announcement: "Announcements", event: "Events" };
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50">
                    {labels[type]}
                  </div>
                  {group.map((r) => {
                    const isActive = ordered[activeIndex]?.id === r.id && ordered[activeIndex]?.type === r.type;
                    return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onMouseEnter={() => setActiveIndex(ordered.findIndex((o) => o.id === r.id && o.type === r.type))}
                      onClick={() => handleSelect(r.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left ${isActive ? "bg-primary/20" : "hover:bg-primary/20"}`}
                    >
                      {r.avatar ? (
                        <img src={r.avatar} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border-strong" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {iconFor(r)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate transition-colors ${isActive ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
                          {r.title}
                        </div>
                        {r.subtitle && (
                          <div className="text-[11px] text-muted-foreground truncate">{r.subtitle}</div>
                        )}
                      </div>
                      {isActive
                        ? <CornerDownLeft className="w-4 h-4 text-primary shrink-0" />
                        : <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                    </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select</span>
            <span><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> close</span>
            <span className="ml-auto"><kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> to open</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
