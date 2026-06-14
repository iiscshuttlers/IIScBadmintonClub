import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, User, Swords, Megaphone, ArrowRight, Loader2, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  type: "player" | "match" | "announcement" | "event";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Keyboard shortcut: Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lq = q.toLowerCase();

      const [playersRes, matchesRes, annRes, eventsRes] = await Promise.all([
        supabase
          .from("players")
          .select("id, full_name, avatar_url, department, elo_rating")
          .ilike("full_name", `%${q}%`)
          .is("deleted_at", null)
          .limit(5),
        supabase
          .from("matches")
          .select(
            "id, match_score, score, category, created_at, player1:players!player1_id(full_name), player2:players!player2_id(full_name)"
          )
          .eq("status", "confirmed")
          .or(
            `player1_id.in.(select id from players where full_name ilike '%${q}%'),player2_id.in.(select id from players where full_name ilike '%${q}%')`
          )
          .order("created_at", { ascending: false })
          .limit(4),
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
      ]);

      const playerResults: SearchResult[] = (playersRes.data || []).map((p) => ({
        type: "player",
        id: p.id,
        title: p.full_name,
        subtitle: `${p.department ?? ""}${p.elo_rating ? ` · ${p.elo_rating} ELO` : ""}`,
        avatar: p.avatar_url,
        href: `/player/${p.id}`,
      }));

      const matchResults: SearchResult[] = (matchesRes.data || []).map((m: any) => ({
        type: "match",
        id: m.id,
        title: `${m.player1?.full_name ?? "?"} vs ${m.player2?.full_name ?? "?"}`,
        subtitle: `${m.category ?? "Match"} · ${m.match_score || m.score || ""}`,
        href: `/feed`,
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
              href: "/feed",
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

      setResults([...playerResults, ...matchResults, ...annList, ...eventList]);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleSelect = (href: string) => {
    setLocation(href);
    onClose();
  };

  const iconFor = (type: SearchResult["type"]) => {
    if (type === "player") return <User className="w-4 h-4 shrink-0 text-emerald-500" />;
    if (type === "match") return <Swords className="w-4 h-4 shrink-0 text-blue-500" />;
    if (type === "event") return <CalendarDays className="w-4 h-4 shrink-0 text-violet-500" />;
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
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search players, matches, events, announcements…"
              className="flex-1 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 text-sm outline-none"
            />
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && !loading && (
              <div className="py-10 text-center text-slate-400 text-sm font-medium">
                No results for "<span className="font-bold text-slate-600 dark:text-slate-300">{query}</span>"
              </div>
            )}
            {results.length === 0 && query.length < 2 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Type at least 2 characters to search
              </div>
            )}

            {/* Group by type */}
            {(["player", "match", "announcement", "event"] as const).map((type) => {
              const group = results.filter((r) => r.type === type);
              if (!group.length) return null;
              const labels = { player: "Players", match: "Matches", announcement: "Announcements", event: "Events" };
              return (
                <div key={type}>
                  <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/50">
                    {labels[type]}
                  </div>
                  {group.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelect(r.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group text-left"
                    >
                      {r.avatar ? (
                        <img src={r.avatar} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {iconFor(r.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {r.title}
                        </div>
                        {r.subtitle && (
                          <div className="text-[11px] text-slate-400 truncate">{r.subtitle}</div>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] text-slate-400">
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">↵</kbd> select</span>
            <span><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> close</span>
            <span className="ml-auto"><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd> to open</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
