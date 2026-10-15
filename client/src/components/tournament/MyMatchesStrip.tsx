import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Swords, Clock, Radio, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { matchesToEvents, shareIcs } from "@/lib/calendarExport";

const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);

// Each category/format gets its own colour so a glance tells you the discipline.
const CATEGORY_COLOR: Record<string, string> = {
  MS: "text-sky-400",
  WS: "text-pink-400",
  MD: "text-blue-400",
  WD: "text-violet-400",
  XD: "text-amber-400",
  BS: "text-cyan-400",
  GS: "text-rose-400",
  BD: "text-teal-400",
  GD: "text-fuchsia-400",
};
const catColor = (c?: string) => CATEGORY_COLOR[(c || "").toUpperCase()] || "text-slate-300";

/**
 * Compact "My Matches" strip — the current player's tournament matches ordered
 * live → upcoming → completed. Shown on the Home dashboard and the Tournaments
 * hub so players instantly see when they're playing. Tournament matches only.
 */
export function MyMatchesStrip({
  myPlayerId,
  limit = 4,
  className = "",
}: {
  myPlayerId: string | null | undefined;
  limit?: number;
  className?: string;
}) {
  const [myMatches, setMyMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!myPlayerId) {
      setMyMatches([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("tournament_matches")
      .select(
        "id, tournament_id, category, round_name, team1_label, team2_label, court_number, scheduled_at, status, score, tournaments(name)",
      )
      .or(
        `player1_id.eq.${myPlayerId},player2_id.eq.${myPlayerId},player3_id.eq.${myPlayerId},player4_id.eq.${myPlayerId}`,
      )
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(50)
      .then(({ data }: any) => {
        if (!cancelled) setMyMatches(data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [myPlayerId]);

  const sortedMyMatches = useMemo(() => {
    const rank = (m: any) => (LIVE_STATUSES.has(m.status) ? 0 : m.status === "completed" ? 2 : 1);
    return [...myMatches]
      .sort((a, b) => {
        const ra = rank(a),
          rb = rank(b);
        if (ra !== rb) return ra - rb;
        const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return ra === 2 ? tb - ta : ta - tb;
      })
      .slice(0, limit);
  }, [myMatches, limit]);

  const calendarEvents = useMemo(() => matchesToEvents(myMatches), [myMatches]);

  const addToCalendar = async () => {
    try {
      await shareIcs(calendarEvents, "my-matches", "My IISc Shuttlers matches");
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes("cancel")) return; // share sheet dismissed
      toast.error("Couldn't create the calendar file.");
    }
  };

  if (!myPlayerId || sortedMyMatches.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-black text-primary uppercase tracking-wider">
          <Swords className="w-3.5 h-3.5" /> My Matches
        </span>
        <div className="flex items-center gap-3">
          {calendarEvents.length > 0 && (
            <button
              type="button"
              onClick={addToCalendar}
              aria-label={`Add ${calendarEvents.length} upcoming match${calendarEvents.length === 1 ? "" : "es"} to your calendar`}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline font-bold"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
            </button>
          )}
          <Link href="/my-matches">
            <span className="text-[11px] text-primary hover:underline font-bold cursor-pointer">View all →</span>
          </Link>
        </div>
      </div>
      <div className="space-y-2">
        {sortedMyMatches.map((m) => {
          const isLive = LIVE_STATUSES.has(m.status);
          const isDone = m.status === "completed";
          return (
            <Link key={m.id} href="/my-matches">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-primary/40 transition-colors cursor-pointer">
                <div className="shrink-0">
                  {isLive ? (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                    </span>
                  ) : isDone ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-600/40 text-slate-300 text-[9px] font-black uppercase">Done</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Upcoming</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {m.team1_label || "TBD"} <span className="text-slate-500">vs</span> {m.team2_label || "TBD"}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] truncate">
                      <span className={`font-black ${catColor(m.category)}`}>{m.category}</span>
                      <span className="text-slate-400">
                        {m.round_name ? ` · ${m.round_name}` : ""}
                        {m.court_number ? ` · Court ${m.court_number}` : ""}
                      </span>
                    </p>
                    {isDone ? (
                      <span className="shrink-0 text-[11px] font-black text-emerald-400 whitespace-nowrap tabular-nums">{m.score || "Final"}</span>
                    ) : m.scheduled_at ? (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-sky-400 font-bold whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {new Date(m.scheduled_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
