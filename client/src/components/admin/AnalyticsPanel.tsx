import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Inbox } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminPanel, AdminLoading, AdminEmptyState } from "./AdminPanel";

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
    <AdminPanel
      icon={BarChart3}
      title="Product Analytics"
      description="Event counts over the selected window."
      actions={RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => setDays(r.days)}
          className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
            days === r.days
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Couldn't load analytics. (Has the analytics migration been applied?)
        </div>
      ) : counts.length === 0 ? (
        <AdminEmptyState icon={Inbox} title="No events in this window yet" />
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">{total.toLocaleString()} events</p>
          {counts.map((c: any) => (
            <div key={c.event} className="flex items-center gap-3">
              <div className="w-48 shrink-0 truncate text-sm font-semibold text-foreground">{c.event}</div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(Number(c.count) / max) * 100}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right text-sm font-black tabular-nums text-foreground">{Number(c.count).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
