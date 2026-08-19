// @ts-nocheck
/**
 * Admin Features Panel
 * Central dashboard for all new features: live scores, predictions,
 * weekly challenges, notification queue, public API, and DB health.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Circle, TrendingUp, Zap, Bell, Globe, ShieldCheck,
  RefreshCw, Trash2, Play, CheckCircle, XCircle, Loader2,
  BarChart3, Trophy, Target, Coins
} from "lucide-react";
import { toast } from "sonner";
import { WeeklyChallenges } from "@/components/feed/WeeklyChallenges";
import { safeReplaceState, safeGetSearchParams, isCapacitor } from "@/lib/navUtils";


const cardCls = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm";
const sectionTitle = (icon: React.ReactNode, label: string) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/40 text-primary dark:text-primary">
      {icon}
    </div>
    <h3 className="font-black text-slate-800 dark:text-foreground text-base">{label}</h3>
  </div>
);

/* ── Notification Queue Stats ─────────────────────────────────────── */
function NotifQueuePanel() {
  const [stats, setStats] = useState({ unsent: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [unsentRes, sentRes] = await Promise.all([
      supabase.from("notification_queue").select("id", { count: "exact", head: true }).eq("sent", false),
      supabase.from("notification_queue").select("id", { count: "exact", head: true }).eq("sent", true),
    ]);
    setStats({ unsent: unsentRes.count ?? 0, sent: sentRes.count ?? 0 });
    setLoading(false);
  };

  const flushNow = async () => {
    setFlushing(true);
    const { error } = await supabase.functions.invoke("batch-notifications");
    if (error) toast.error("Flush failed: " + error.message);
    else { toast.success("Batch notifications sent!"); await load(); }
    setFlushing(false);
  };

  const clearSent = async () => {
    await supabase.from("notification_queue").delete().eq("sent", true);
    toast.success("Cleared sent notifications");
    await load();
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={cardCls}>
      {sectionTitle(<Bell className="w-4 h-4" />, "Notification Queue")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.unsent}</p>
              <p className="text-xs font-bold text-muted-foreground mt-0.5">Queued / Unsent</p>
            </div>
            <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-primary dark:text-primary">{stats.sent}</p>
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-muted-foreground dark:text-slate-300 text-sm font-black transition">
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
    const { data } = await supabase
      .from("live_matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .order("started_at", { ascending: false })
      .limit(10);
    setMatches(data ?? []);
    setLoading(false);
  };

  const endMatch = async (id: string) => {
    await supabase.from("live_matches").update({ status: "finished" }).eq("id", id);
    toast.success("Match ended");
    load();
  };

  const deleteMatch = async (id: string) => {
    await supabase.from("live_matches").delete().eq("id", id);
    toast.success("Match deleted");
    load();
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={cardCls}>
      {sectionTitle(<Circle className="w-4 h-4 fill-red-500 text-red-500" />, "Live Matches")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live or recent matches.</p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${m.status === "live" ? "bg-red-500 animate-pulse" : "bg-slate-400"}`} />
                <p className="text-sm font-bold text-muted-foreground dark:text-slate-200 truncate">
                  {m.player1?.full_name ?? "?"} vs {m.player2?.full_name ?? "?"}
                </p>
                <span className="text-xs font-black text-primary">{m.sets_p1}-{m.sets_p2}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {m.status === "live" && (
                  <button onClick={() => endMatch(m.id)}
                    className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-200 transition">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => deleteMatch(m.id)}
                  className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-200 transition">
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

/* ── Match Predictions Admin ──────────────────────────────────────── */
function PredictionsPanel() {
  const [stats, setStats] = useState({ total: 0, correct: 0, topPlayer: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [totalRes, correctRes, topRes] = await Promise.all([
        supabase.from("match_predictions").select("id", { count: "exact", head: true }),
        supabase.from("match_predictions").select("id", { count: "exact", head: true }).eq("correct", true),
        supabase.from("prediction_points").select("total_points, player:players!player_id(full_name)")
          .order("total_points", { ascending: false }).limit(1).single(),
      ]);
      setStats({
        total: totalRes.count ?? 0,
        correct: correctRes.count ?? 0,
        topPlayer: (topRes.data as any)?.player?.full_name ?? "—",
      });
      setLoading(false);
    };
    load();
  }, []);

  const resolveAll = async () => {
    const { data: unresolved } = await supabase
      .from("match_predictions")
      .select("id, match_id, player_id, predicted_winner_id, points_wagered, match:matches!match_id(winner_id, status)")
      .is("correct", null);

    if (!unresolved || unresolved.length === 0) { toast.info("No unresolved predictions"); return; }

    let resolved = 0;
    for (const pred of unresolved as any[]) {
      if (!pred.match?.winner_id || pred.match.status !== "confirmed") continue;
      const correct = pred.predicted_winner_id === pred.match.winner_id;
      const earned = correct ? pred.points_wagered * 2 : 0;
      await supabase.from("match_predictions").update({ correct, points_earned: earned }).eq("id", pred.id);
      await supabase.from("prediction_points").upsert({
        player_id: pred.player_id,
        total_points: correct ? 100 + earned : 100 - pred.points_wagered,
      }, { onConflict: "player_id" });
      resolved++;
    }
    toast.success(`Resolved ${resolved} predictions`);
  };

  return (
    <div className={cardCls}>
      {sectionTitle(<TrendingUp className="w-4 h-4" />, "Match Predictions")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Total Predictions", value: stats.total, color: "text-violet-600" },
              { label: "Correct", value: stats.correct, color: "text-primary" },
              { label: "Accuracy", value: stats.total > 0 ? `${Math.round((stats.correct / stats.total) * 100)}%` : "—", color: "text-amber-600" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">🏆 Top points: <strong>{stats.topPlayer}</strong></p>
          <button onClick={resolveAll}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-on-accent text-sm font-black transition">
            <Coins className="w-4 h-4" /> Resolve Pending Predictions
          </button>
        </>
      )}
    </div>
  );
}

/* ── Weekly Challenges Admin ──────────────────────────────────────── */
function ChallengesAdminPanel() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("matches");
  const [newTarget, setNewTarget] = useState(5);
  const [newPoints, setNewPoints] = useState(10);

  const load = async () => {
    const sunday = new Date();
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const weekStart = sunday.toISOString().slice(0, 10);
    const { data } = await supabase
      .from("weekly_challenges")
      .select("*, completions:challenge_progress(count)")
      .eq("week_start", weekStart);
    setChallenges(data ?? []);
    setLoading(false);
  };

  const deleteChallenge = async (id: string) => {
    await supabase.from("weekly_challenges").delete().eq("id", id);
    toast.success("Challenge deleted");
    load();
  };

  const addChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    const sunday = new Date();
    sunday.setDate(sunday.getDate() - sunday.getDay());
    const weekStart = sunday.toISOString().slice(0, 10);
    
    const { error } = await supabase.from("weekly_challenges").insert({
      title: newTitle,
      type: newType,
      target: newTarget,
      points: newPoints,
      week_start: weekStart,
    });
    if (error) {
      toast.error("Failed to add challenge: " + error.message);
    } else {
      toast.success("Challenge added");
      setNewTitle("");
      setIsAdding(false);
      load();
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className={cardCls}>
      {sectionTitle(<Target className="w-4 h-4" />, "Weekly Challenges (This Week)")}
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> :
        challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No challenges this week. They auto-generate when a player opens the Challenges tab.</p>
        ) : (
          <div className="space-y-2">
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-800 dark:text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.type} · target {c.target} · {c.points} pts · {(c.completions as any)?.[0]?.count ?? 0} completions</p>
                </div>
                <button onClick={() => deleteChallenge(c.id)}
                  className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-200 transition ml-2 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )
      }
      
      {isAdding ? (
        <form onSubmit={addChallenge} className="mt-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Challenge Title (e.g., Weekend Warrior)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
            required
          />
          <div className="grid grid-cols-3 gap-2">
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary">
              <option value="matches">Matches</option>
              <option value="wins">Wins</option>
              <option value="singles">Singles</option>
              <option value="doubles">Doubles</option>
              <option value="streak">Streak</option>
            </select>
            <input type="number" min="1" placeholder="Target" value={newTarget} onChange={(e) => setNewTarget(Number(e.target.value))} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" required />
            <input type="number" min="5" step="5" placeholder="Points" value={newPoints} onChange={(e) => setNewPoints(Number(e.target.value))} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" required />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 transition">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-xs font-bold bg-primary hover:bg-primary text-primary-foreground rounded-lg transition">Save Challenge</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setIsAdding(true)} className="w-full mt-4 py-2 border border-dashed border-primary/50 dark:border-primary/80 text-primary dark:text-primary rounded-xl text-sm font-bold hover:bg-primary/10 dark:hover:bg-primary/90/20 transition">
          + Add Custom Challenge
        </button>
      )}
    </div>
  );
}

/* ── Public API Info ─────────────────────────────────────────────── */
function PublicApiPanel() {
  const base = "https://htejmhsqqlfedlajqqyv.supabase.co/functions/v1/public-api";
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
      // Use supabase.functions.invoke so the anon key/auth headers are automatically attached
      const { data, error } = await supabase.functions.invoke("public-api" + path);
      if (error) {
        setResult("Error: " + error.message);
      } else {
        setResult(JSON.stringify(data, null, 2).slice(0, 500));
      }
    } catch (e: any) {
      setResult("Exception: " + e.message);
    }
    setTesting(null);
  };

  return (
    <div className={cardCls}>
      {sectionTitle(<Globe className="w-4 h-4" />, "Public API")}
      <p className="text-xs text-muted-foreground mb-3 font-mono break-all">{base}</p>
      <div className="space-y-2">
        {endpoints.map((ep) => (
          <div key={ep.path} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
            <div>
              <p className="text-xs font-mono font-black text-primary dark:text-primary">{ep.path}</p>
              <p className="text-xs text-muted-foreground">{ep.desc}</p>
            </div>
            <button onClick={() => test(ep.path)} disabled={testing === ep.path}
              className="px-3 py-1 rounded-lg bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary text-xs font-black hover:bg-primary/20 transition">
              {testing === ep.path ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </button>
          </div>
        ))}
      </div>
      {result && (
        <pre className="mt-3 p-3 bg-slate-900 text-primary rounded-xl text-[10px] overflow-auto max-h-32 font-mono">{result}</pre>
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
    const { data, error } = await supabase.functions.invoke("verify-db-backups");
    if (error) toast.error("Health check failed");
    else setHealth(data);
    setLoading(false);
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
            <div key={key} className={`flex ${typeof val === "object" && val !== null ? "flex-col items-start gap-2" : "items-center justify-between"} bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2`}>
              <span className="text-sm font-bold text-muted-foreground dark:text-slate-300 capitalize">{key.replace(/_/g, " ")}</span>
              {typeof val === "object" && val !== null ? (
                <div className="w-full mt-2 space-y-2 bg-slate-100/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                  {Object.entries(val).map(([subKey, subVal]: any) => (
                    <div key={subKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                      <span className="text-xs font-bold text-muted-foreground dark:text-slate-300 capitalize flex items-center gap-1.5">
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
                                  ? "bg-primary/10 text-primary dark:bg-primary/50 dark:text-primary border border-primary/30 dark:border-primary/80"
                                  : v === false
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
                                  : "bg-slate-50 text-muted-foreground dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                              }`}
                            >
                              <span className="opacity-70 font-semibold">{k}:</span>
                              {Array.isArray(v) ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {v.map((item: any, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded-md leading-none">{String(item)}</span>
                                  ))}
                                </div>
                              ) : typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] font-black px-2 py-1 rounded-md bg-slate-50 text-muted-foreground dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
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
                    ? "bg-primary/15 text-primary dark:bg-primary/40 dark:text-primary"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
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
function CronJobsPanel() {
  const jobs = [
    { name: "batch-notifications", schedule: "Every 15 min", desc: "Sends queued push notifications" },
    { name: "match-confirmation-nudge", schedule: "Every 2 hours", desc: "Nudges players to confirm pending matches" },
    { name: "challenge-expiry-reminders", schedule: "Sundays 8pm IST", desc: "Reminds players of expiring challenges" },
  ];

  return (
    <div className={cardCls}>
      {sectionTitle(<Zap className="w-4 h-4" />, "Scheduled Cron Jobs")}
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-sm font-black text-slate-800 dark:text-foreground">{job.name}</p>
              <span className="text-[10px] font-black bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-xs text-muted-foreground">{job.schedule} · {job.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Manage schedules in Supabase Dashboard → Database → Cron Jobs.</p>
    </div>
  );
}

export function AdminFeaturesPanel() {
  const [section, setSection] = useState<"live" | "predictions" | "challenges" | "notifications" | "api" | "health">(() => {
    const params = safeGetSearchParams();
    const tab = params.get("tab") as any;
    return ["live", "predictions", "challenges", "notifications", "api", "health"].includes(tab) ? tab : "live";
  });

  useEffect(() => {
    const params = safeGetSearchParams();
    params.set("tab", section);
    const hash = isCapacitor ? "" : window.location.hash;
    const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
    safeReplaceState(newUrl);
  }, [section]);

  const sections = [
    { id: "live", label: "Live Scores", icon: <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" /> },
    { id: "predictions", label: "Predictions", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "challenges", label: "Challenges", icon: <Target className="w-3.5 h-3.5" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-3.5 h-3.5" /> },
    { id: "api", label: "Public API", icon: <Globe className="w-3.5 h-3.5" /> },
    { id: "health", label: "DB Health", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              section === s.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 hover:border-primary"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {section === "live" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LiveMatchesPanel />
          <div className={cardCls}>
            {sectionTitle(<Circle className="w-4 h-4 fill-red-500 text-red-500" />, "Live Feed")}
            <p className="text-sm text-muted-foreground">Live matches are broadcast via the Umpire tab.</p>
          </div>
        </div>
      )}

      {section === "predictions" && <PredictionsPanel />}
      {section === "challenges" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChallengesAdminPanel />
          <div className={cardCls}>
            {sectionTitle(<Zap className="w-4 h-4" />, "Player View Preview")}
            <WeeklyChallenges />
          </div>
        </div>
      )}
      {section === "notifications" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <NotifQueuePanel />
          <CronJobsPanel />
        </div>
      )}
      {section === "api" && <PublicApiPanel />}
      {section === "health" && <DbHealthPanel />}
    </div>
  );
}
