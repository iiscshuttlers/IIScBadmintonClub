// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Swords, Megaphone, ArrowRight, Loader2, CalendarDays, Users, Trophy, Radio, Home, BarChart3, Settings, CornerDownLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  type: "player" | "match" | "announcement" | "event" | "team" | "action";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  href: string;
}

// Quick navigation commands — always available, filtered by the query. (#20)
const ACTIONS: { id: string; title: string; subtitle: string; href: string; keywords: string }[] = [
  { id: "a-home", title: "Home", subtitle: "Go to the home page", href: "/", keywords: "home start" },
  { id: "a-live", title: "Live Scores", subtitle: "Pulse — live matches & feed", href: "/pulse", keywords: "live scores pulse feed now" },
  { id: "a-tournaments", title: "Tournaments", subtitle: "Browse & register for events", href: "/tournaments", keywords: "tournaments events draws compete" },
  { id: "a-matches", title: "My Matches", subtitle: "Your match history & pending", href: "/my-matches", keywords: "my matches history pending results" },
  { id: "a-directory", title: "Players Directory", subtitle: "Find club members", href: "/pulse#directory", keywords: "directory players members find partner" },
  { id: "a-stats", title: "My Stats", subtitle: "Your personal stats", href: "/personal", keywords: "stats personal profile rating elo" },
  { id: "a-host", title: "Host a Tournament", subtitle: "Create a new event", href: "/host-tournament", keywords: "host create tournament organize new" },
  { id: "a-settings", title: "Settings", subtitle: "Appearance, notifications, account", href: "/settings", keywords: "settings preferences theme accent notifications account" },
];

function actionIcon(id: string) {
  if (id === "a-home") return <Home className="w-4 h-4 shrink-0 text-primary" />;
  if (id === "a-live") return <Radio className="w-4 h-4 shrink-0 text-rose-500" />;
  if (id === "a-tournaments" || id === "a-host") return <Trophy className="w-4 h-4 shrink-0 text-amber-500" />;
  if (id === "a-matches") return <Swords className="w-4 h-4 shrink-0 text-blue-500" />;
  if (id === "a-directory") return <Users className="w-4 h-4 shrink-0 text-pink-500" />;
  if (id === "a-stats") return <BarChart3 className="w-4 h-4 shrink-0 text-emerald-500" />;
  return <Settings className="w-4 h-4 shrink-0 text-slate-400" />;
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

  // Render/navigation order — groups are shown in this order.
  const TYPE_ORDER = ["action", "player", "team", "match", "announcement", "event"] as const;
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
        } catch (e) {}
      }

      const lq = q.toLowerCase();

      const [playersRes, annRes, eventsRes, teamsRes] = await Promise.all([
        // We fetch all active players once to support client-side fuzzy matching
        (async () => {
          if (cachedSearchPlayers) return null;
          const res = await supabase.from("search_players_view").select("id, full_name, avatar_url, department, overall_rank");
          if (res.data) cachedSearchPlayers = res.data;
          return null;
        })(),
        supabase
          .from("site_data")
          .select("value")
          .eq("key", "announcements")
          .maybeSingle(),
        supabase
          .from("site_data")
          .select("value")
          .eq("key", "events")
          .maybeSingle(),
        supabase
          .from("doubles_teams")
          .select("id, team_name, player1_id, player2_id, elo_rating")
          .ilike("team_name", `%${q}%`)
          .limit(4),
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

      // Use the ID list to filter matches with parameterised .in() — no raw interpolation
      const matchingIds = matchedPlayers.slice(0, 20).map((r: any) => r.id);
      let matchResults: SearchResult[] = [];
      if (matchingIds.length > 0) {
        const { data: matchRows } = await supabase
          .from("matches")
          .select("id, score, category, created_at, player1_id, player2_id, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
          .in("status", ["confirmed", "walkover"])
          .or(`player1_id.in.(${matchingIds.join(",")}),player2_id.in.(${matchingIds.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(4);
        matchResults = (matchRows || []).map((m: any) => ({
          type: "match" as const,
          id: m.id,
          title: `${m.player1?.full_name ?? "?"} vs ${m.player2?.full_name ?? "?"}`,
          subtitle: `${m.category ?? "Match"} · ${m.match_score || m.score || ""}`,
          href: m.player1_id ? `/player/${m.player1_id}` : `/pulse`,
        }));
      }

      const teamResults: SearchResult[] = (teamsRes.data || []).map((t: any) => ({
        type: "team",
        id: t.id,
        title: t.team_name,
        subtitle: undefined,
        href: `/doubles/${t.player1_id}/${t.player2_id}`,
      }));

      const annList: SearchResult[] = [];
      if (annRes.data?.value?.recent) {
        for (const ann of annRes.data.value.recent) {
          if (
            ann.title?.toLowerCase().includes(lq) ||
            ann.content?.toLowerCase().includes(lq)
          ) {
            annList.push({
              type: "announcement",
              id: ann.title,
              title: ann.title,
              subtitle: ann.category,
              href: "/pulse",
            });
            if (annList.length >= 3) break;
          }
        }
      }

      // Search events from site_data
      const eventList: SearchResult[] = [];
      const eventsData = eventsRes.data?.value;
      const eventArray = Array.isArray(eventsData)
        ? eventsData
        : (eventsData?.upcoming || eventsData?.events || eventsData?.all || []);
      for (const ev of eventArray) {
        if (
          ev.title?.toLowerCase().includes(lq) ||
          ev.category?.toLowerCase().includes(lq) ||
          ev.venue?.toLowerCase().includes(lq)
        ) {
          eventList.push({
            type: "event",
            id: ev.id || ev.title,
            title: ev.title,
            subtitle: `${ev.category ?? "Event"}${ev.venue ? ` · ${ev.venue}` : ""}`,
            href: "/events",
          });
          if (eventList.length >= 3) break;
        }
      }

      setResults([...matchingActions(q), ...playerResults, ...matchResults, ...teamResults, ...annList, ...eventList]);
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
    setLocation(href);
    onClose();
  };

  const iconFor = (r: SearchResult) => {
    if (r.type === "action") return actionIcon(r.id);
    if (r.type === "player") return <User className="w-4 h-4 shrink-0 text-primary" />;
    if (r.type === "match") return <Swords className="w-4 h-4 shrink-0 text-blue-500" />;
    if (r.type === "event") return <CalendarDays className="w-4 h-4 shrink-0 text-violet-500" />;
    if (r.type === "team") return <Users className="w-4 h-4 shrink-0 text-pink-500" />;
    return <Megaphone className="w-4 h-4 shrink-0 text-amber-500" />;
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
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
              className="flex-1 bg-transparent text-slate-800 dark:text-foreground placeholder-slate-400 text-sm outline-none"
            />
            <button onClick={onClose} aria-label="Close search" className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && !loading && (
              <div className="py-10 text-center text-muted-foreground text-sm font-medium">
                No results for "<span className="font-bold text-muted-foreground dark:text-slate-300">{query}</span>"
              </div>
            )}

            {/* Group by type (actions first) */}
            {(["action", "player", "team", "match", "announcement", "event"] as const).map((type) => {
              const group = results.filter((r) => r.type === type);
              if (!group.length) return null;
              const labels = { action: query ? "Jump to" : "Quick actions", player: "Players", team: "Teams", match: "Matches", announcement: "Announcements", event: "Events" };
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground bg-slate-50/80 dark:bg-slate-800/50">
                    {labels[type]}
                  </div>
                  {group.map((r) => {
                    const isActive = ordered[activeIndex]?.id === r.id && ordered[activeIndex]?.type === r.type;
                    return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onMouseEnter={() => setActiveIndex(ordered.findIndex((o) => o.id === r.id && o.type === r.type))}
                      onClick={() => handleSelect(r.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors group text-left ${isActive ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-primary/10 dark:hover:bg-primary/20"}`}
                    >
                      {r.avatar ? (
                        <img src={r.avatar} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {iconFor(r)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold truncate transition-colors ${isActive ? "text-primary" : "text-slate-800 dark:text-foreground group-hover:text-primary dark:group-hover:text-primary"}`}>
                          {r.title}
                        </div>
                        {r.subtitle && (
                          <div className="text-[11px] text-muted-foreground truncate">{r.subtitle}</div>
                        )}
                      </div>
                      {isActive
                        ? <CornerDownLeft className="w-4 h-4 text-primary shrink-0" />
                        : <ArrowRight className="w-4 h-4 text-slate-300 dark:text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                    </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select</span>
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> close</span>
            <span className="ml-auto"><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> to open</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
