import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, Inbox } from "lucide-react";
import { supabase } from "@/lib/supabase";

// analytics_events / RPC are new; generated types regenerate after the
// migration is applied (npx supabase db push). Cast until then.
const sb = supabase as any;

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

export function AnalyticsPanel() {
  const [days, setDays] = useState(30);

  const { data: counts = [], isLoading, error } = useQuery({
    queryKey: ["analytics-counts", days],
    queryFn: async () => {
      const { data, error } = await sb.rpc("analytics_event_counts", { days_back: days });
      if (error) throw error;
      return (data || []) as { event: string; count: number }[];
    },
  });

  const max = counts.reduce((m: number, c: any) => Math.max(m, Number(c.count)), 0) || 1;
  const total = counts.reduce((s: number, c: any) => s + Number(c.count), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-black text-foreground">Product Analytics</h2>
          <p className="text-sm text-muted-foreground">Event counts over the selected window.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                days === r.days ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Couldn't load analytics. (Has the analytics migration been applied?)
        </div>
      ) : counts.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-muted-foreground">
          <Inbox className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm font-bold">No events in this window yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">{total.toLocaleString()} events</p>
          {counts.map((c: any) => (
            <div key={c.event} className="flex items-center gap-3">
              <div className="w-48 shrink-0 text-sm font-semibold text-foreground truncate">{c.event}</div>
              <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(Number(c.count) / max) * 100}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right text-sm font-black text-foreground tabular-nums">{Number(c.count).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
