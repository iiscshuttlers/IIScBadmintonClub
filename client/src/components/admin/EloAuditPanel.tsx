import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuditEntry {
  id: number;
  admin_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface PlayerEloSnapshot {
  id: string;
  full_name: string;
  elo_rating: number;
  stats: any;
}

export function EloAuditPanel() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [players, setPlayers] = useState<PlayerEloSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"history" | "snapshot">("history");

  const load = useCallback(async () => {
    setLoading(true);
    const [logsRes, playersRes] = await Promise.all([
      supabase
        .from("admin_logs")
        .select("id, admin_email, action, details, created_at")
        .ilike("action", "elo%")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("players")
        .select("id, full_name, elo_rating, stats")
        .order("elo_rating", { ascending: false })
        .limit(30),
    ]);
    if (!logsRes.error && logsRes.data) setLogs(logsRes.data as AuditEntry[]);
    if (!playersRes.error && playersRes.data) setPlayers(playersRes.data as PlayerEloSnapshot[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-slate-800 dark:text-white">ELO Audit Log</h3>
        <button onClick={load} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="flex gap-2">
        {(["history", "snapshot"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${tab === t ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300"}`}>
            {t === "history" ? "Recalculation History" : "Current ELO Snapshot"}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <div className="space-y-3">
          {logs.length === 0 && (
            <div className={`${cardCls} text-center py-10 text-slate-400 text-sm`}>
              No ELO recalculation events yet. Use "Recalculate All ELOs" in the Matches tab to create an entry.
            </div>
          )}
          {logs.map((log) => {
            const isFailed = log.action.includes("failed");
            return (
              <div key={log.id} className={`${cardCls} flex items-start gap-3`}>
                <div className={`p-2 rounded-xl shrink-0 ${isFailed ? "bg-rose-50 dark:bg-rose-950/30 text-rose-500" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500"}`}>
                  {isFailed ? <TrendingDown className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isFailed ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"}`}>
                      {isFailed ? "FAILED" : "SUCCESS"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.action.replace(/_/g, " ")}</span>
                  </div>
                  {log.details && <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>}
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "snapshot" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 dark:text-slate-500">Top 30 players by current ELO rating (live)</p>
          {players.map((p, i) => {
            const elo = p.elo_rating ?? p.stats?.elo ?? 1200;
            const wins = p.stats?.wins ?? 0;
            const losses = p.stats?.losses ?? 0;
            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            return (
              <div key={p.id} className={`${cardCls} flex items-center gap-3`}>
                <span className={`w-7 text-center text-xs font-black shrink-0 ${i < 3 ? "text-amber-500" : "text-slate-400"}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{p.full_name}</p>
                  <p className="text-[10px] text-slate-400">{wins}W {losses}L · {winRate}% WR</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">{elo}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">ELO</p>
                </div>
                <TrendingUp className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
