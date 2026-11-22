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
    <div className="space-y-6">
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
    <TopPagesPanel />
    </div>
  );
}

const TOP_PAGES_DAYS = 14;
const SAMPLE_LIMIT = 1000;

interface TopPage {
  route: string;
  views: number;
  members: number;
}

/**
 * Which screens members open (page_view events, signed-in only). Uses the
 * analytics_top_pages RPC; until that migration (20261122010000) is applied,
 * falls back to counting the latest page views it can read and says so.
 */
async function fetchTopPages(): Promise<{ rows: TopPage[]; sampled: boolean }> {
  const { data, error } = await sb.rpc("analytics_top_pages", { days_back: TOP_PAGES_DAYS, max_rows: 25 });
  if (!error) {
    return {
      rows: ((data || []) as any[]).map((r) => ({ route: r.route, views: Number(r.views), members: Number(r.members) })),
      sampled: false,
    };
  }
  const since = new Date(Date.now() - TOP_PAGES_DAYS * 86_400_000).toISOString();
  const res = await sb
    .from("analytics_events")
    .select("props, player_id")
    .eq("event", "page_view")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(SAMPLE_LIMIT);
  if (res.error) throw res.error;
  const byRoute = new Map<string, { views: number; members: Set<string> }>();
  for (const row of (res.data || []) as { props: any; player_id: string | null }[]) {
    const route = typeof row.props?.route === "string" ? row.props.route : "(unknown)";
    const entry = byRoute.get(route) ?? { views: 0, members: new Set<string>() };
    entry.views += 1;
    if (row.player_id) entry.members.add(row.player_id);
    byRoute.set(route, entry);
  }
  const rows = [...byRoute.entries()]
    .map(([route, v]) => ({ route, views: v.views, members: v.members.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);
  return { rows, sampled: (res.data?.length ?? 0) >= SAMPLE_LIMIT };
}

function TopPagesPanel() {
  const { data, isLoading, error } = useQuery({
    // Plain arrays/objects only: the query cache is persisted (no Set/Map).
    queryKey: ["analytics-top-pages", TOP_PAGES_DAYS],
    queryFn: fetchTopPages,
  });
  const rows = data?.rows ?? [];
  const max = rows.reduce((m, r) => Math.max(m, r.views), 0) || 1;

  return (
    <AdminPanel
      icon={BarChart3}
      title={`Top pages (last ${TOP_PAGES_DAYS} days)`}
      description="Screens signed-in members opened, by route. Visitors aren't counted; ids are stripped."
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Couldn't load page views.</div>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={Inbox} title="No page views yet" />
      ) : (
        <div className="space-y-2">
          {data?.sampled && (
            <p className="text-xs font-bold text-warning">
              Counted from the latest {SAMPLE_LIMIT.toLocaleString()} page views. Apply migration 20261122010000 for exact counts.
            </p>
          )}
          {rows.map((r) => (
            <div key={r.route} className="flex items-center gap-3">
              <div className="w-48 shrink-0 truncate font-mono text-xs font-semibold text-foreground" title={r.route}>{r.route}</div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.views / max) * 100}%` }} />
              </div>
              <div className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                <span className="text-sm font-black text-foreground">{r.views.toLocaleString()}</span> · {r.members} {r.members === 1 ? "member" : "members"}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
