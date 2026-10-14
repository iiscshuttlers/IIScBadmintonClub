import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Clock, AlertTriangle, CheckCircle2, Inbox, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { AdminPanel, AdminLoading, AdminEmptyState } from "./AdminPanel";

// RPCs / columns are new; generated types regenerate after the migration is
// applied (npx supabase db push). Cast until then.
const sb = supabase as any;

type CronJob = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
  last_end: string | null;
  last_duration_sec: number | null;
  last_message: string | null;
  runs_24h: number;
  failures_24h: number;
};

type DeliveryCount = { status: string; count: number };

type FailureRow = {
  id: string;
  title: string;
  channels: string[];
  error: string | null;
  scheduled_at: string;
  created_at: string;
};

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  cancelled: "bg-muted text-muted-foreground",
};

function relative(ts: string | null) {
  if (!ts) return "never";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function DeliveryAuditPanel() {
  const [days, setDays] = useState(7);

  const cron = useQuery({
    queryKey: ["admin-cron-health"],
    queryFn: async (): Promise<CronJob[]> => {
      const { data, error } = await sb.rpc("admin_cron_health");
      if (error) throw error;
      return (data || []) as CronJob[];
    },
    refetchInterval: 60_000,
  });

  const delivery = useQuery({
    queryKey: ["admin-notification-delivery", days],
    queryFn: async (): Promise<DeliveryCount[]> => {
      const { data, error } = await sb.rpc("admin_notification_delivery", { days_back: days });
      if (error) throw error;
      return (data || []) as DeliveryCount[];
    },
  });

  const failures = useQuery({
    queryKey: ["admin-notification-failures", days],
    queryFn: async (): Promise<FailureRow[]> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await sb
        .from("scheduled_notifications")
        .select("id, title, channels, error, scheduled_at, created_at")
        .eq("status", "failed")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as FailureRow[];
    },
  });

  const migrationMissing =
    (cron.error as any)?.message?.includes("admin_cron_health") ||
    (delivery.error as any)?.message?.includes("admin_notification_delivery");

  const totalDelivery = (delivery.data || []).reduce((s, d) => s + Number(d.count), 0);

  return (
    <AdminPanel
      icon={Radio}
      title="Delivery Audit"
      description="Scheduled-job health and notification delivery outcomes."
      actions={
        <>
          {RANGES.map((r) => (
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
          <button
            onClick={() => {
              cron.refetch();
              delivery.refetch();
              failures.refetch();
            }}
            className="rounded-xl border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Refresh"
            aria-label="Refresh delivery audit"
          >
            <RefreshCw className={`h-4 w-4 ${cron.isFetching ? "animate-spin" : ""}`} />
          </button>
        </>
      }
    >
      {migrationMissing ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-12 text-center text-sm text-muted-foreground">
          Delivery-audit functions aren't available yet. Apply the migration
          (<code className="rounded bg-muted px-1.5 py-0.5">npx supabase db push</code>) to enable this panel.
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Scheduled jobs ─────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Scheduled jobs</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Whether each pg_cron job is firing on schedule. A job that stopped running, or whose failure count
              climbs, needs attention. (A "succeeded" run means the job fired — delivery outcomes are below.)
            </p>
            {cron.isLoading ? (
              <AdminLoading label="Reading cron history…" />
            ) : (cron.data || []).length === 0 ? (
              <AdminEmptyState
                icon={Inbox}
                title="No scheduled jobs found"
                description="pg_cron may not be enabled in this environment, or no jobs are registered."
              />
            ) : (
              <div className="space-y-2">
                {(cron.data || []).map((job) => {
                  const ok = job.last_status === "succeeded";
                  const hasFailures = job.failures_24h > 0;
                  return (
                    <div key={job.jobname} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {ok ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                            )}
                            <span className="truncate text-sm font-black text-foreground">{job.jobname}</span>
                            {!job.active && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                paused
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <code className="rounded bg-muted px-1.5 py-0.5">{job.schedule}</code> · last run{" "}
                            {relative(job.last_start)}
                            {job.last_duration_sec != null && ` · ${job.last_duration_sec}s`}
                          </p>
                          {job.last_message && !ok && (
                            <p className="mt-1 max-w-lg truncate text-[11px] text-rose-500">{job.last_message}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                              hasFailures
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {job.failures_24h}/{job.runs_24h} failed · 24h
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Notification delivery ──────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                Notification delivery
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Outcomes for scheduled reminders &amp; broadcasts over the last {days} days.
            </p>
            {delivery.isLoading ? (
              <AdminLoading label="Reading delivery outcomes…" />
            ) : totalDelivery === 0 ? (
              <AdminEmptyState icon={Inbox} title="No notifications in this window" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(delivery.data || []).map((d) => (
                  <div
                    key={d.status}
                    className={`flex items-baseline gap-2 rounded-2xl px-4 py-3 ${
                      STATUS_STYLES[d.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-xl font-black tabular-nums">{Number(d.count).toLocaleString()}</span>
                    <span className="text-xs font-bold capitalize">{d.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent failures */}
            {(failures.data || []).length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-rose-500">Recent failures</p>
                {(failures.data || []).map((f) => (
                  <div key={f.id} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{f.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relative(f.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {(f.channels || []).join(", ")}
                      {f.error && <span className="text-rose-500"> · {f.error}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminPanel>
  );
}
