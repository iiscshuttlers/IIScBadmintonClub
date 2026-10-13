import { useQuery } from "@tanstack/react-query";
import { Radio, MapPin, Clock, Swords } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * #17 Spectator-facing "Up Next on Court" for a tournament.
 * Read-only companion to the admin OrderOfPlayPanel. Uses the
 * ["tournament_matches", id] cache, so the RealtimeProvider subscription on
 * tournament_matches refreshes it live. Renders nothing when there are no
 * upcoming/live matches (e.g. a finished/archived tournament).
 */

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};

const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);

interface Row {
  id: string;
  match_code: string | null;
  category: string | null;
  round_name: string | null;
  round: number | null;
  match_number: number | null;
  team1_label: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function UpNextPanel({ tournamentId }: { tournamentId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["tournament_matches", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, court_number, scheduled_at, status")
        .eq("tournament_id", tournamentId)
        .neq("status", "completed")
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 30 * 1000,
  });

  // Only show matches that have a court assigned or are live — i.e. actually
  // on the order of play right now.
  const relevant = rows.filter((r) => r.court_number || LIVE_STATUSES.has(r.status));
  if (relevant.length === 0) return null;

  // Group by court; matches with no court collect under "Unassigned".
  const byCourt = new Map<string, Row[]>();
  for (const r of relevant) {
    const key = r.court_number ? `Court ${r.court_number}` : "Order of play";
    if (!byCourt.has(key)) byCourt.set(key, []);
    byCourt.get(key)!.push(r);
  }

  const teamsLine = (r: Row) => `${r.team1_label || "TBD"}  vs  ${r.team2_label || "TBD"}`;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full" />
        <h2 className="text-2xl font-black text-blue-900 dark:text-foreground">Up Next</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from(byCourt.entries()).map(([court, matches]) => {
          const live = matches.find((m) => LIVE_STATUSES.has(m.status));
          const upcoming = matches.filter((m) => !LIVE_STATUSES.has(m.status)).slice(0, 3);
          return (
            <div key={court} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-black text-foreground">{court}</span>
              </div>

              {live && (
                <div className="mb-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500 mb-1">
                    <Radio className="w-3 h-3 animate-pulse" /> Live now
                  </div>
                  <p className="text-sm font-bold text-foreground">{teamsLine(live)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {CAT_LABELS[live.category || ""] || live.category} · {live.round_name || `Round ${live.round ?? ""}`}
                  </p>
                </div>
              )}

              {upcoming.length > 0 ? (
                <ul className="space-y-2">
                  {upcoming.map((m) => (
                    <li key={m.id} className="flex items-start gap-2">
                      <Swords className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{teamsLine(m)}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          {CAT_LABELS[m.category || ""] || m.category}
                          {m.scheduled_at && (<><span>·</span><Clock className="w-3 h-3" />{fmtTime(m.scheduled_at)}</>)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                !live && <p className="text-xs text-muted-foreground">No matches queued.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
