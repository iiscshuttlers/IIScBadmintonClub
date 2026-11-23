/**
 * Admin Features Panel
 * Central dashboard for live scores, notification queue, public API and
 * DB health. (The predictions and weekly-challenge sections were removed on
 * 18 Nov 2026: their tables don't exist in production.)
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { adminService } from "@/services/adminService";
import { MatchService } from "@/services/matchService";
import {
  Circle, Zap, Bell, Globe, ShieldCheck,
  RefreshCw, Trash2, Play, CheckCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { safeReplaceState, safeGetSearchParams, isCapacitor } from "@/lib/navUtils";


const cardCls = "bg-card border border-border rounded-3xl p-5 shadow-sm";
const sectionTitle = (icon: React.ReactNode, label: string) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="p-1.5 rounded-lg bg-primary/40 text-primary">
      {icon}
    </div>
    <h3 className="font-black text-foreground text-base">{label}</h3>
  </div>
);

/* ── Notification Queue Stats ─────────────────────────────────────── */
function NotifQueuePanel() {
  const [stats, setStats] = useState({ unsent: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await adminService.getNotificationQueueStats();
      setStats(s);
    } catch {
      /* intentional */
    } finally {
      setLoading(false);
    }
  };

  const flushNow = async () => {
    setFlushing(true);
    try {
      await adminService.flushNotificationQueue();
      toast.success("Batch notifications sent!");
      await load();
    } catch (err: any) {
      toast.error("Flush failed: " + err?.message);
    } finally {
      setFlushing(false);
    }
  };

  const clearSent = async () => {
    try {
      await adminService.clearSentNotifications();
      toast.success("Cleared sent notifications");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to clear notifications");
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={cardCls}>
      {sectionTitle(<Bell className="w-4 h-4" />, "Notification Queue")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-warning/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-warning">{stats.unsent}</p>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">Queued / Unsent</p>
            </div>
            <div className="bg-primary/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-primary">{stats.sent}</p>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">Sent (all time)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={flushNow} disabled={flushing || stats.unsent === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-primary-foreground text-sm font-black transition">
              {flushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Send Now
            </button>
            <button onClick={clearSent} disabled={stats.sent === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted-strong disabled:opacity-50 text-soft text-sm font-black transition">
              <Trash2 className="w-4 h-4" /> Clear sent
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Auto-runs every 15 min via cron.</p>
        </>
      )}
    </div>
  );
}

/* ── Live Matches Admin ────────────────────────────────────────────── */
function LiveMatchesPanel() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await MatchService.getLiveMatchesAdminList(10);
      setMatches(data);
    } catch {
      /* intentional */
    } finally {
      setLoading(false);
    }
  };

  const endMatch = async (id: string) => {
    try {
      await MatchService.updateLiveMatchStatus(id, "finished");
      toast.success("Match ended");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to end match");
    }
  };

  const deleteMatch = async (id: string) => {
    try {
      await MatchService.deleteLiveMatch(id);
      toast.success("Match deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete match");
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={cardCls}>
      {sectionTitle(<Circle className="w-4 h-4 fill-danger text-danger" />, "Live Matches")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live or recent matches.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${m.status === "live" ? "bg-live animate-pulse" : "bg-muted-foreground"}`} />
                <p className="text-sm font-bold text-soft truncate">
                  {m.player1?.full_name ?? "?"} vs {m.player2?.full_name ?? "?"}
                </p>
                <span className="text-xs font-black text-primary">{m.sets_p1}-{m.sets_p2}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {m.status === "live" && (
                  <button onClick={() => endMatch(m.id)}
                    className="p-1.5 rounded-lg bg-warning/15 text-warning hover:bg-warning/15 transition">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteMatch(m.id)}
                  className="p-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger/15 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Public API Info ─────────────────────────────────────────────── */
function PublicApiPanel() {
  const base = `${import.meta.env.VITE_SUPABASE_URL || "https://htejmhsqqlfedlajqqyv.supabase.co"}/functions/v1/public-api`;
  const endpoints = [
    { path: "/leaderboard", desc: "Top 20 players by ELO" },
    { path: "/recent-matches", desc: "Last 20 confirmed matches" },
    { path: "/stats", desc: "Club aggregate stats" },
    { path: "/widget", desc: "Embeddable HTML leaderboard" },
  ];

  const [testing, setTesting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const test = async (path: string) => {
    setTesting(path);
    setResult(null);
    try {
      const data = await adminService.invokePublicApi(path);
      setResult(JSON.stringify(data, null, 2).slice(0, 500));
    } catch (e: any) {
      setResult("Exception: " + e.message);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className={cardCls}>
      {sectionTitle(<Globe className="w-4 h-4" />, "Public API")}
      <p className="text-xs text-muted-foreground mb-3 font-mono break-all">{base}</p>
      <div className="space-y-2">
        {endpoints.map((ep) => (
          <div key={ep.path} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
            <div>
              <p className="text-xs font-mono font-black text-primary">{ep.path}</p>
              <p className="text-xs text-muted-foreground">{ep.desc}</p>
            </div>
            <button onClick={() => test(ep.path)} disabled={testing === ep.path}
              className="px-3 py-1 rounded-lg bg-primary/40 text-primary text-xs font-black hover:bg-primary/20 transition">
              {testing === ep.path ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </button>
          </div>
        ))}
      </div>
      {result && (
        <pre className="mt-3 p-3 bg-card text-primary rounded-xl text-[10px] overflow-auto max-h-32 font-mono">{result}</pre>
      )}
    </div>
  );
}

/* ── DB Health ───────────────────────────────────────────────────── */
function DbHealthPanel() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const data = await adminService.verifyDbBackups();
      setHealth(data);
    } catch {
      toast.error("Health check failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cardCls}>
      {sectionTitle(<ShieldCheck className="w-4 h-4" />, "Database Health Check")}
      <button onClick={run} disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-primary-foreground text-sm font-black transition mb-4">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Run Health Check
      </button>
      {health && (
        <div className="space-y-2">
          {Object.entries(health).map(([key, val]: any) => (
            <div key={key} className={`flex ${typeof val === "object" && val !== null ? "flex-col items-start gap-2" : "items-center justify-between"} bg-muted rounded-xl px-3 py-2`}>
              <span className="text-sm font-bold text-soft capitalize">{key.replace(/_/g, " ")}</span>
              {typeof val === "object" && val !== null ? (
                <div className="w-full mt-2 space-y-2 bg-card/50 p-3 rounded-xl border border-border-strong/50">
                  {Object.entries(val).map(([subKey, subVal]: any) => (
                    <div key={subKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-muted rounded-lg shadow-sm border border-border-strong">
                      <span className="text-xs font-bold text-soft capitalize flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {subKey.replace(/_/g, " ")}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {typeof subVal === "object" && subVal !== null ? (
                          Object.entries(subVal).map(([k, v]: any) => (
                            <div
                              key={k}
                              className={`text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1.5 ${
                                v === true || (typeof v === "number" && v > 0)
                                  ? "bg-primary/50 text-primary border border-primary/80"
                                  : v === false
                                  ? "bg-danger/20 text-danger border border-danger/40"
                                  : "bg-muted-strong text-soft border border-border-strong"
                              }`}
                            >
                              <span className="opacity-70 font-semibold">{k}:</span>
                              {Array.isArray(v) ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {v.map((item: any, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-foreground/10 rounded-md leading-none">{String(item)}</span>
                                  ))}
                                </div>
                              ) : typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] font-black px-2 py-1 rounded-md bg-muted-strong text-soft border border-border-strong">
                            {String(subVal)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  val === true || (typeof val === "number" && val > 0)
                    ? "bg-primary/40 text-primary"
                    : "bg-danger/15 text-danger"
                }`}>{String(val)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Cron Jobs Status ─────────────────────────────────────────────── */
/** Scheduled jobs live in Delivery & jobs, which reads the real cron history
 *  (this tab used to show a hand-written list that went stale). */
function CronJobsLink() {
  const open = () => {
    window.history.pushState(null, "", `${window.location.pathname}#delivery`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return (
    <div className={cardCls}>
      {sectionTitle(<Zap className="w-4 h-4" />, "Scheduled jobs")}
      <p className="text-sm text-muted-foreground">
        Every cron job, when it last ran and whether it worked, is in System → Delivery &amp; jobs.
      </p>
      <Button type="button" variant="outline" className="mt-3" onClick={open}>
        Open Delivery &amp; jobs
      </Button>
    </div>
  );
}

export function AdminFeaturesPanel() {
  // Old ?tab=predictions / ?tab=challenges links fall back to "live".
  const [section, setSection] = useState<"live" | "notifications" | "api" | "health">(() => {
    const params = safeGetSearchParams();
    const tab = params.get("tab") as any;
    return ["live", "notifications", "api", "health"].includes(tab) ? tab : "live";
  });

  useEffect(() => {
    const params = safeGetSearchParams();
    params.set("tab", section);
    const hash = isCapacitor ? "" : window.location.hash;
    const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
    safeReplaceState(newUrl);
  }, [section]);

  const sections = [
    { id: "live", label: "Live Scores", icon: <Circle className="w-3.5 h-3.5 fill-live text-live" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-3.5 h-3.5" /> },
    { id: "api", label: "Public API", icon: <Globe className="w-3.5 h-3.5" /> },
    { id: "health", label: "DB Health", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <Button
            key={s.id}
            size="pill"
            variant="tab"
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              section === s.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card border border-border-strong text-soft hover:border-primary"
            }`}
          >
            {s.icon} {s.label}
          </Button>
        ))}
      </div>

      {section === "live" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LiveMatchesPanel />
          <div className={cardCls}>
            {sectionTitle(<Circle className="w-4 h-4 fill-danger text-danger" />, "Live Feed")}
            <p className="text-sm text-muted-foreground">Live matches are broadcast via the Umpire tab.</p>
          </div>
        </div>
      )}

      {section === "notifications" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <NotifQueuePanel />
          <CronJobsLink />
        </div>
      )}
      {section === "api" && <PublicApiPanel />}
      {section === "health" && <DbHealthPanel />}
    </div>
  );
}
