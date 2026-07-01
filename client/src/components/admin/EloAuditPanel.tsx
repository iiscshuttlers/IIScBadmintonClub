import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Loader2, RotateCcw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowLeft, Play
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { InfoModal } from "@/components/InfoModal";

interface AuditEntry {
  id: number;
  admin_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface PlayerSnapshot {
  id: string;
  full_name: string;
  elo_rating: number;
  singles_elo: number | null;
  doubles_elo: number | null;
  mixed_elo: number | null;
  wins: number;
  losses: number;
}

interface EloLogEntry {
  id: string;
  match_uuid: string;
  player_id: string;
  previous_elo: number;
  new_elo: number;
  elo_change: number;
  expected_score: number;
  actual_score: number;
  category: string;
  created_at: string;
  // joined from matches
  match_score?: string;
  opponent_name?: string;
  match_category?: string;
  match_date?: string;
  all_players_logs?: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Singles:  "bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  Doubles:  "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  Mixed:    "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
};

export function EloAuditPanel() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [players, setPlayers] = useState<PlayerSnapshot[]>([]);
  const [globalMatches, setGlobalMatches] = useState<EloLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"history" | "snapshot" | "matchwise">("history");
  const [recalcLoading, setRecalcLoading] = useState(false);
  const { session } = useAuth();

  // Player drill-down
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSnapshot | null>(null);
  const [eloHistory, setEloHistory] = useState<EloLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [logsRes, playersRes, matchesRes, recentLogsRes] = await Promise.all([
      supabase.from("admin_logs")
        .select("id, admin_email, action, details, created_at")
        .ilike("action", "elo%")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("players")
        .select("id, full_name, elo_rating, singles_elo, doubles_elo, mixed_elo")
        .order("elo_rating", { ascending: false })
        .limit(30),
      supabase.from("matches")
        .select("player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id")
        .eq("status", "confirmed"),
      supabase.from("elo_calculation_logs")
        .select(`*, player:players!player_id(id, full_name)`)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (!logsRes.error && logsRes.data) setLogs(logsRes.data as AuditEntry[]);

    if (!playersRes.error && playersRes.data && !matchesRes.error && matchesRes.data) {
      const winMap: Record<string, number> = {};
      const lossMap: Record<string, number> = {};
      (matchesRes.data as any[]).forEach((m) => {
        if (!m.winner_id) return;
        const team1 = [m.player1_id, m.team1_partner_id].filter(Boolean);
        const team2 = [m.player2_id, m.team2_partner_id].filter(Boolean);
        const isTeam1Win = team1.includes(m.winner_id);
        (isTeam1Win ? team1 : team2).forEach((id: string) => { winMap[id] = (winMap[id] || 0) + 1; });
        (isTeam1Win ? team2 : team1).forEach((id: string) => { lossMap[id] = (lossMap[id] || 0) + 1; });
      });
      setPlayers((playersRes.data as any[]).map((p) => ({
        ...p,
        wins: winMap[p.id] || 0,
        losses: lossMap[p.id] || 0,
      })));
    }

    if (!recentLogsRes.error && recentLogsRes.data) {
      const groupedByMatch: Record<string, any[]> = {};
      recentLogsRes.data.forEach((l: any) => {
        if (!groupedByMatch[l.match_uuid]) groupedByMatch[l.match_uuid] = [];
        groupedByMatch[l.match_uuid].push(l);
      });

      const uniqueMatches: any[] = [];
      const seen = new Set();
      recentLogsRes.data.forEach((l: any) => {
        if (!seen.has(l.match_uuid)) {
          seen.add(l.match_uuid);
          uniqueMatches.push(l);
        }
      });

      const globalEntries = uniqueMatches.map((m) => ({
        ...m,
        match_category: m.category,
        match_date: m.created_at,
        opponent_name: "Match Detail",
        all_players_logs: groupedByMatch[m.match_uuid]
      }));

      setGlobalMatches(globalEntries);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRecalculate = async () => {
    if (!confirm("Are you sure? This will wipe all current ELOs and recompute them from the very first match.")) return;
    setRecalcLoading(true);
    const { error } = await supabase.rpc('recalculate_all_elo');
    if (error) {
      await supabase.from("admin_logs").insert({
        admin_email: session?.user?.email || "unknown",
        action: "elo_recalculation_failed",
        details: error.message
      });
      alert("Error recalculating ELO: " + error.message);
    } else {
      await supabase.from("admin_logs").insert({
        admin_email: session?.user?.email || "unknown",
        action: "elo_recalculation",
        details: "Manually triggered full recalculation of all ELOs"
      });
      alert("Successfully recalculated all ELO histories!");
      load();
    }
    setRecalcLoading(false);
  };

  const loadPlayerHistory = useCallback(async (player: PlayerSnapshot) => {
    setSelectedPlayer(player);
    setHistoryLoading(true);
    setEloHistory([]);

    const { data: logData, error: logErr } = await supabase
      .from("elo_calculation_logs")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (logErr || !logData || logData.length === 0) { 
      setHistoryLoading(false); 
      return; 
    }

    const matchIds = [...new Set((logData as any[]).map((l) => l.match_uuid).filter(Boolean))];
    
    let allLogsData: any[] = [];
    if (matchIds.length > 0) {
      const { data } = await supabase
        .from("elo_calculation_logs")
        .select(`*, player:players!player_id(id, full_name)`)
        .in("match_uuid", matchIds);
      if (data) allLogsData = data;
    }

    const { data: matchData } = await supabase
      .from("matches")
      .select(`
        id, score, category, created_at,
        player1:players!player1_id(id, full_name),
        player2:players!player2_id(id, full_name),
        partner1:players!team1_partner_id(id, full_name),
        partner2:players!team2_partner_id(id, full_name),
        player1_id, player2_id, team1_partner_id, team2_partner_id
      `)
      .in("id", matchIds);

    const matchMap: Record<string, any> = {};
    (matchData || []).forEach((m: any) => { matchMap[m.id] = m; });

    const logsByMatch: Record<string, any[]> = {};
    allLogsData.forEach((l: any) => {
      if (!logsByMatch[l.match_uuid]) logsByMatch[l.match_uuid] = [];
      logsByMatch[l.match_uuid].push(l);
    });

    const enriched: EloLogEntry[] = (logData as any[]).map((log) => {
      const m = matchMap[log.match_uuid];
      if (!m) return { ...log, all_players_logs: logsByMatch[log.match_uuid] || [] };
      const isTeam1 = m.player1_id === player.id || m.team1_partner_id === player.id;
      const opponentNames = isTeam1
        ? [m.player2?.full_name, m.partner2?.full_name].filter(Boolean).join(" & ")
        : [m.player1?.full_name, m.partner1?.full_name].filter(Boolean).join(" & ");
      const score = (m.score || "").replace(/\s*\[.*$/, "").trim();
      return { 
        ...log, 
        match_score: score, 
        opponent_name: opponentNames, 
        match_category: m.category, 
        match_date: m.created_at,
        all_players_logs: logsByMatch[log.match_uuid] || []
      };
    });

    setEloHistory(enriched);
    setHistoryLoading(false);
  }, []);

  const renderExpandedTable = (entry: EloLogEntry, highlightPlayerId?: string) => (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-muted-foreground dark:text-muted-foreground">
          <thead className="uppercase tracking-wider text-[10px] bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-2 rounded-l-lg font-bold">Player</th>
              <th className="px-3 py-2 font-bold text-center">Category Before</th>
              <th className="px-3 py-2 font-bold text-center">Cat Change</th>
              <th className="px-3 py-2 font-bold text-center">Category Now</th>
              <th className="px-3 py-2 rounded-r-lg font-bold text-center">Overall Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {entry.all_players_logs?.sort((a, b) => b.actual_score - a.actual_score).map((pl: any) => {
              const isWin = pl.actual_score === 1;
              const catChange = pl.elo_change;
              const ovChange = Math.round(catChange / 3);
              const isHighlight = pl.player_id === highlightPlayerId;
              return (
                <tr key={pl.id} className={isHighlight ? "bg-primary/10/30 dark:bg-primary/10" : ""}>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                    {pl.player?.full_name || "Unknown"}
                    {isWin ? <span className="text-[9px] bg-primary/15 dark:bg-primary/30 text-primary dark:text-primary px-1 py-0.5 rounded uppercase font-black">W</span> : <span className="text-[9px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded uppercase font-black">L</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{pl.previous_elo}</td>
                  <td className={`px-3 py-2 text-center font-black ${catChange > 0 ? "text-primary" : "text-rose-500"}`}>
                    {catChange > 0 ? "+" : ""}{catChange}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-muted-foreground dark:text-slate-300">{pl.new_elo}</td>
                  <td className={`px-3 py-2 text-center font-bold ${ovChange > 0 ? "text-primary" : "text-rose-400"}`}>
                    {ovChange > 0 ? "+" : ""}{ovChange}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm";

  // ── Player ELO History View ──────────────────────────────────────────────────
  if (selectedPlayer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedPlayer(null); setEloHistory([]); }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h3 className="font-black text-slate-800 dark:text-foreground">{selectedPlayer.full_name}</h3>
            <p className="text-xs text-muted-foreground">ELO History — last 50 matches</p>
          </div>
        </div>

        {historyLoading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

        {!historyLoading && eloHistory.length === 0 && (
          <div className={`${cardCls} text-center py-10 text-muted-foreground text-sm`}>
            No ELO history found. Run Recalculate ELOs from the history tab.
          </div>
        )}

        <div className="space-y-2">
          {eloHistory.map((entry, i) => {
            const won = entry.actual_score === 1;
            const catColor = CATEGORY_COLORS[entry.match_category || entry.category] || CATEGORY_COLORS["Singles"];
            const isExpanded = expandedMatch === `${entry.match_uuid}-${i}`;
            const overallChange = Math.round(entry.elo_change / 3);

            return (
              <div key={`${entry.match_uuid}-${i}`} className={`${cardCls} cursor-pointer`}
                onClick={() => setExpandedMatch(isExpanded ? null : `${entry.match_uuid}-${i}`)}>
                {/* Row summary */}
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full shrink-0 ${won ? "bg-primary" : "bg-rose-400"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${catColor}`}>
                        {entry.match_category || entry.category}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${won ? "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
                        {won ? "WIN" : "LOSS"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground dark:text-slate-200 truncate mt-0.5">
                      vs {entry.opponent_name || "Unknown"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.match_date ? new Date(entry.match_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      {entry.match_score && <span className="ml-2 font-mono">{entry.match_score}</span>}
                    </p>
                  </div>

                  {/* Category ELO change */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground font-bold">Category ELO</p>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground font-mono">
                      {entry.previous_elo} → <span className="font-black text-slate-800 dark:text-foreground">{entry.new_elo}</span>
                    </p>
                    <p className={`text-sm font-black ${entry.elo_change > 0 ? "text-primary" : "text-rose-500"}`}>
                      {entry.elo_change > 0 ? "+" : ""}{entry.elo_change}
                    </p>
                  </div>

                  {/* Overall ELO change */}
                  <div className="text-right shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3 ml-1">
                    <p className="text-[10px] text-muted-foreground font-bold">Overall</p>
                    <p className={`text-sm font-black ${overallChange > 0 ? "text-primary" : "text-rose-400"}`}>
                      {overallChange > 0 ? "+" : ""}{overallChange}
                    </p>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>

                {isExpanded && renderExpandedTable(entry, selectedPlayer.id)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Main Panel ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-slate-800 dark:text-foreground">ELO Audit Log</h3>
          <InfoModal
            title="ELO AUDIT & RECALCULATION"
            items={[
              { badge: "ALGO", title: "Recalculation Engine", desc: "Replays all historical matches in chronological order to completely rebuild the ELO state." },
              { badge: "WARN", title: "Destructive Action", desc: "Forcing a recalculation will overwrite all current ratings. Use only if database integrity is compromised." }
            ]}
          />
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {(["history", "snapshot", "matchwise"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition text-center ${tab === t ? "bg-primary text-foreground shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 hover:border-primary/50"}`}>
            {t === "history" ? "Recalculation History" : t === "snapshot" ? "Current ELO Snapshot" : "Matchwise ELO"}
          </button>
        ))}
      </div>

      {tab === "matchwise" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Most recent confirmed matches</p>
          </div>
          {globalMatches.length === 0 && (
             <div className={`${cardCls} text-center py-10 text-muted-foreground text-sm`}>
               No match history available. Run the Recalculate script in the History tab.
             </div>
          )}
          {globalMatches.map((entry, i) => {
            const catColor = CATEGORY_COLORS[entry.match_category || entry.category] || CATEGORY_COLORS["Singles"];
            const isExpanded = expandedMatch === `global-${entry.match_uuid}-${i}`;
            return (
              <div key={`global-${entry.match_uuid}-${i}`} className={`${cardCls} cursor-pointer hover:border-primary/50 transition-colors`}
                onClick={() => setExpandedMatch(isExpanded ? null : `global-${entry.match_uuid}-${i}`)}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${catColor}`}>
                        {entry.match_category || entry.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {entry.match_date ? new Date(entry.match_date).toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground dark:text-slate-200">
                      <span>{entry.all_players_logs?.length} players updated</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>
                {isExpanded && renderExpandedTable(entry)}
              </div>
            )
          })}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Log of all manual ELO re-sync actions</p>
            <button 
              onClick={handleRecalculate}
              disabled={recalcLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 dark:bg-primary/30 text-primary dark:text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 dark:hover:bg-primary/80/50 transition-colors disabled:opacity-50"
            >
              {recalcLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Recalculate All ELOs
            </button>
          </div>
          {logs.length === 0 && (
            <div className={`${cardCls} text-center py-10 text-muted-foreground text-sm`}>
              No ELO recalculation events yet.
            </div>
          )}
          {logs.map((log) => {
            const isFailed = log.action.includes("failed");
            return (
              <div key={log.id} className={`${cardCls} flex items-start gap-3`}>
                <div className={`p-2 rounded-xl shrink-0 ${isFailed ? "bg-rose-50 dark:bg-rose-950/30 text-rose-500" : "bg-primary/10 dark:bg-primary/30 text-primary"}`}>
                  {isFailed ? <TrendingDown className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isFailed ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary"}`}>
                      {isFailed ? "FAILED" : "SUCCESS"}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground dark:text-slate-200">{log.action.replace(/_/g, " ")}</span>
                  </div>
                  {log.details && <p className="text-xs text-muted-foreground dark:text-muted-foreground">{log.details}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "snapshot" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground dark:text-muted-foreground">Top 30 players — click any row to see full ELO history</p>
          {players.map((p, i) => {
            const total = p.wins + p.losses;
            const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
            return (
              <button
                key={p.id}
                onClick={() => loadPlayerHistory(p)}
                className={`${cardCls} flex items-center gap-3 w-full text-left hover:border-primary hover:shadow-md transition-all group`}
              >
                <span className={`w-7 text-center text-xs font-black shrink-0 ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-foreground text-sm truncate group-hover:text-primary dark:group-hover:text-primary transition-colors">{p.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.wins}W {p.losses}L · {winRate}% WR</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {p.singles_elo != null && <span className="text-[9px] font-black bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-full">S: {p.singles_elo}</span>}
                    {p.doubles_elo != null && <span className="text-[9px] font-black bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full">D: {p.doubles_elo}</span>}
                    {p.mixed_elo != null && <span className="text-[9px] font-black bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">M: {p.mixed_elo}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-primary dark:text-primary text-base">{p.elo_rating}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall</p>
                </div>
                <TrendingUp className="w-4 h-4 text-slate-300 dark:text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
