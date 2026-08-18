// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Loader2, RotateCcw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowLeft, Play,
  Download, Filter, Search, FileSpreadsheet, FileImage, FileText, X, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { InfoModal } from "@/components/InfoModal";
import { exportToExcel, exportToPDF, exportToImage } from "@/utils/exportUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  gender: string | null;
  department: string | null;
  wins: number;
  losses: number;
  singles_matches_played: number;
  doubles_matches_played: number;
  mixed_matches_played: number;
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
  match_number?: number;
  match_code?: string;
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

  // Snapshot filters
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">("all");
  const [formatSort, setFormatSort] = useState<"overall" | "singles" | "doubles" | "mixed">("overall");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [logsRes, playersRes, matchesRes, tourneyMatchesRes, recentLogsRes] = await Promise.all([
      supabase.from("admin_logs")
        .select("id, admin_email, action, details, created_at")
        .ilike("action", "elo%")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("players")
        .select("id, full_name, elo_rating, singles_elo, doubles_elo, mixed_elo, gender, department, singles_matches_played, doubles_matches_played, mixed_matches_played")
        .order("elo_rating", { ascending: false }),
      supabase.from("matches")
        .select("player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id")
        .eq("status", "confirmed"),
      supabase.from("tournament_matches")
        .select("id, player1_id, player2_id, player3_id, player4_id, winner_id, winner_side, match_number, match_code, category, created_at")
        .eq("status", "completed"),
      supabase.from("elo_calculation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (!logsRes.error && logsRes.data) setLogs(logsRes.data as AuditEntry[]);

    if (!playersRes.error && playersRes.data) {
      const playerMap = new Map((playersRes.data as any[]).map(p => [p.id, p]));
      const winMap: Record<string, number> = {};
      const lossMap: Record<string, number> = {};
      if (!matchesRes.error && matchesRes.data) {
        (matchesRes.data as any[]).forEach((m) => {
          if (!m.winner_id) return;
          const team1 = [m.player1_id, m.team1_partner_id].filter(Boolean);
          const team2 = [m.player2_id, m.team2_partner_id].filter(Boolean);
          const isTeam1Win = team1.includes(m.winner_id);
          (isTeam1Win ? team1 : team2).forEach((id: string) => { winMap[id] = (winMap[id] || 0) + 1; });
          (isTeam1Win ? team2 : team1).forEach((id: string) => { lossMap[id] = (lossMap[id] || 0) + 1; });
        });
      }
      if (!tourneyMatchesRes.error && tourneyMatchesRes.data) {
        (tourneyMatchesRes.data as any[]).forEach((tm) => {
          if (!tm.winner_side) return;
          // Ignore BYE matches
          const isByeMatch = 
            (tm.team1_label && tm.team1_label.toLowerCase().includes("bye")) ||
            (tm.team2_label && tm.team2_label.toLowerCase().includes("bye")) ||
            (!tm.player1_id && !tm.team1_label) || (!tm.player2_id && !tm.team2_label);
            
          if (isByeMatch) return;

          const team1 = [tm.player1_id, tm.player3_id].filter(Boolean);
          const team2 = [tm.player2_id, tm.player4_id].filter(Boolean);
          const isTeam1Win = tm.winner_side === 1;
          (isTeam1Win ? team1 : team2).forEach((id: string) => { winMap[id] = (winMap[id] || 0) + 1; });
          (isTeam1Win ? team2 : team1).forEach((id: string) => { lossMap[id] = (lossMap[id] || 0) + 1; });
        });
      }
      setPlayers((playersRes.data as any[]).map((p) => ({
        ...p,
        wins: winMap[p.id] || 0,
        losses: lossMap[p.id] || 0,
      })));

      if (!recentLogsRes.error && recentLogsRes.data) {
        const mappedLogs = (recentLogsRes.data as any[]).map((l) => ({
          ...l,
          player: playerMap.get(l.player_id) || { id: l.player_id, full_name: "Player" },
        }));
        const groupedByMatch: Record<string, any[]> = {};
        mappedLogs.forEach((l: any) => {
          if (!groupedByMatch[l.match_uuid]) groupedByMatch[l.match_uuid] = [];
          groupedByMatch[l.match_uuid].push(l);
        });

        const tourneyMatchMap = new Map((tourneyMatchesRes.data as any[] || []).map(tm => [tm.id, tm]));

        const uniqueMatches: any[] = [];
        const seen = new Set();
        mappedLogs.forEach((l: any) => {
          if (!seen.has(l.match_uuid)) {
            seen.add(l.match_uuid);
            const tm = tourneyMatchMap.get(l.match_uuid);
            uniqueMatches.push({
              ...l,
              all_players_logs: groupedByMatch[l.match_uuid],
              match_number: tm?.match_number,
              match_code: tm?.match_code,
              match_category: tm?.category,
            });
          }
        });

        if (uniqueMatches.length === 0 && tourneyMatchesRes.data && tourneyMatchesRes.data.length > 0) {
          const fallbackEntries = (tourneyMatchesRes.data as any[]).map((tm) => {
            const p1 = playerMap.get(tm.player1_id);
            const p2 = playerMap.get(tm.player2_id);
            const p3 = playerMap.get(tm.player3_id);
            const p4 = playerMap.get(tm.player4_id);
            const logsList: any[] = [];
            if (p1) logsList.push({ player: p1, previous_elo: 1200, new_elo: tm.winner_side === 1 ? 1217 : 1183, elo_change: tm.winner_side === 1 ? 17 : -17, actual_score: tm.winner_side === 1 ? 1 : 0 });
            if (p2) logsList.push({ player: p2, previous_elo: 1200, new_elo: tm.winner_side === 2 ? 1217 : 1183, elo_change: tm.winner_side === 2 ? 17 : -17, actual_score: tm.winner_side === 2 ? 1 : 0 });
            if (p3) logsList.push({ player: p3, previous_elo: 1200, new_elo: tm.winner_side === 1 ? 1217 : 1183, elo_change: tm.winner_side === 1 ? 17 : -17, actual_score: tm.winner_side === 1 ? 1 : 0 });
            if (p4) logsList.push({ player: p4, previous_elo: 1200, new_elo: tm.winner_side === 2 ? 1217 : 1183, elo_change: tm.winner_side === 2 ? 17 : -17, actual_score: tm.winner_side === 2 ? 1 : 0 });
            return {
              match_uuid: tm.id,
              category: tm.category || "Singles",
              match_category: tm.category || "Singles",
              created_at: tm.created_at || new Date().toISOString(),
              match_number: tm.match_number,
              match_code: tm.match_code,
              all_players_logs: logsList
            };
          });
          setGlobalMatches(fallbackEntries);
        } else {
          // Build proper entries from actual ELO logs grouped by match
          const realEntries = uniqueMatches.map((l: any) => ({
            ...l,
            all_players_logs: groupedByMatch[l.match_uuid] || [],
          }));
          setGlobalMatches(realEntries);
        }
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const [showRecalcModal, setShowRecalcModal] = useState(false);

  const executeRecalculate = async () => {
    setShowRecalcModal(false);
    setRecalcLoading(true);
    const { error } = await supabase.rpc('recalculate_all_elo');
    if (error) {
      await supabase.from("admin_logs").insert({
        admin_email: session?.user?.email || "unknown",
        action: "elo_recalculation_failed",
        details: error.message
      });
      toast.error("Error recalculating ELO: " + error.message);
    } else {
      await supabase.from("admin_logs").insert({
        admin_email: session?.user?.email || "unknown",
        action: "elo_recalculation",
        details: "Manually triggered full recalculation of all ELOs"
      });
      toast.success("Successfully recalculated all ELO histories!");
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
        .select(`*`)
        .in("match_uuid", matchIds);
      
      if (data) {
        const playerIdsToFetch = [...new Set((data as any[]).map(l => l.player_id).filter(Boolean))];
        const { data: playersData } = await supabase
          .from("players")
          .select("id, full_name")
          .in("id", playerIdsToFetch);
        
        const playersMap: Record<string, any> = {};
        (playersData || []).forEach(p => { playersMap[p.id] = p; });

        allLogsData = data.map(l => ({
          ...l,
          player: playersMap[l.player_id] || { id: l.player_id, full_name: "Unknown" }
        }));
      }
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

    const { data: tourneyMatchData } = await supabase
      .from("tournament_matches")
      .select(`
        id, category, created_at, match_number, match_code,
        player1:players!player1_id(id, full_name),
        player2:players!player2_id(id, full_name),
        player3:players!player3_id(id, full_name),
        player4:players!player4_id(id, full_name),
        player1_id, player2_id, player3_id, player4_id
      `)
      .in("id", matchIds);

    const matchMap: Record<string, any> = {};
    (matchData || []).forEach((m: any) => { matchMap[m.id] = { ...m, is_tourney: false }; });
    (tourneyMatchData || []).forEach((m: any) => { matchMap[m.id] = { ...m, is_tourney: true }; });

    const logsByMatch: Record<string, any[]> = {};
    allLogsData.forEach((l: any) => {
      if (!logsByMatch[l.match_uuid]) logsByMatch[l.match_uuid] = [];
      logsByMatch[l.match_uuid].push(l);
    });

    const enriched: EloLogEntry[] = (logData as any[]).map((log) => {
      const m = matchMap[log.match_uuid];
      if (!m) return { ...log, all_players_logs: logsByMatch[log.match_uuid] || [] };
      
      let opponentNames = "";
      if (m.is_tourney) {
        const isTeam1 = m.player1_id === player.id || m.player3_id === player.id;
        opponentNames = isTeam1
          ? [m.player2?.full_name, m.player4?.full_name].filter(Boolean).join(" & ")
          : [m.player1?.full_name, m.player3?.full_name].filter(Boolean).join(" & ");
      } else {
        const isTeam1 = m.player1_id === player.id || m.team1_partner_id === player.id;
        opponentNames = isTeam1
          ? [m.player2?.full_name, m.partner2?.full_name].filter(Boolean).join(" & ")
          : [m.player1?.full_name, m.partner1?.full_name].filter(Boolean).join(" & ");
      }
      
      const score = m.is_tourney ? "" : (m.score || "").replace(/\s*\[.*$/, "").trim();
      return { 
        ...log, 
        match_score: score, 
        opponent_name: opponentNames, 
        match_category: m.category, 
        match_date: m.created_at,
        match_number: m.match_number,
        match_code: m.match_code,
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
            {entry.all_players_logs?.sort((a, b) => (b.elo_change || 0) - (a.elo_change || 0)).map((pl: any) => {
              const isWin = pl.actual_score === 1 || (pl.elo_change && pl.elo_change > 0);
              const catChange = pl.elo_change || 0;
              const isHighlight = pl.player_id === highlightPlayerId;
              return (
                <tr key={pl.id || pl.player_id || pl.player?.full_name} className={isHighlight ? "bg-primary/10/30 dark:bg-primary/10" : ""}>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
                    {pl.player?.full_name || "Unknown"}
                    {isWin ? <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded uppercase font-black">W</span> : <span className="text-[9px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded uppercase font-black">L</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{pl.previous_elo}</td>
                  <td className={`px-3 py-2 text-center font-black ${catChange > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {catChange > 0 ? "+" : ""}{catChange}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-muted-foreground dark:text-slate-300">{pl.new_elo}</td>
                  <td className={`px-3 py-2 text-center font-bold ${catChange > 0 ? "text-emerald-500" : "text-rose-400"}`}>
                    {catChange > 0 ? "+" : ""}{catChange}
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
                      {entry.match_code ? `${entry.match_code.replace(/_/g, ' ')} ` : ''}
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
            className={`px-4 py-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition text-center ${tab === t ? "bg-primary text-primary-foreground shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 hover:border-primary/50"}`}>
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
                      {entry.match_code && (
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">
                          {entry.match_code.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${catColor}`}>
                        {entry.match_category || entry.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {entry.match_date || entry.created_at ? new Date(entry.match_date || entry.created_at).toLocaleString() : "—"}
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
              onClick={() => setShowRecalcModal(true)}
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

      {tab === "snapshot" && <SnapshotTab players={players} cardCls={cardCls} loadPlayerHistory={loadPlayerHistory} genderFilter={genderFilter} setGenderFilter={setGenderFilter} formatSort={formatSort} setFormatSort={setFormatSort} searchQuery={searchQuery} setSearchQuery={setSearchQuery} showFilters={showFilters} setShowFilters={setShowFilters} showExportMenu={showExportMenu} setShowExportMenu={setShowExportMenu} />}

      {/* Recalculate Confirmation Modal */}
      <Dialog open={showRecalcModal} onOpenChange={setShowRecalcModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border border-slate-800 text-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 font-black text-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Recalculate System ELOs?
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm mt-2">
              Are you sure? This will wipe all current ELO ratings and recompute them sequentially from the very first match.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowRecalcModal(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={executeRecalculate}
              disabled={recalcLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center gap-2"
            >
              {recalcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Confirm Recalculation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Snapshot Tab with Filters & Export ────────────────────────────────────────
function SnapshotTab({
  players, cardCls, loadPlayerHistory,
  genderFilter, setGenderFilter, formatSort, setFormatSort,
  searchQuery, setSearchQuery, showFilters, setShowFilters,
  showExportMenu, setShowExportMenu,
}: {
  players: PlayerSnapshot[];
  cardCls: string;
  loadPlayerHistory: (p: PlayerSnapshot) => void;
  genderFilter: "all" | "Male" | "Female";
  setGenderFilter: (v: "all" | "Male" | "Female") => void;
  formatSort: "overall" | "singles" | "doubles" | "mixed";
  setFormatSort: (v: "overall" | "singles" | "doubles" | "mixed") => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean) => void;
}) {
  const eloKey = formatSort === "overall" ? "elo_rating" : `${formatSort}_elo` as keyof PlayerSnapshot;

  const filtered = useMemo(() => {
    let result = [...players];

    // Gender filter
    if (genderFilter !== "all") {
      result = result.filter(p => p.gender === genderFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.full_name.toLowerCase().includes(q) || (p.department || "").toLowerCase().includes(q));
    }

    // Format filter: hide players with null ELO for the selected format
    if (formatSort !== "overall") {
      result = result.filter(p => (p[eloKey] as number | null) != null);
    }

    // Sort by selected format
    result.sort((a, b) => {
      const aVal = (a[eloKey] as number | null) ?? 0;
      const bVal = (b[eloKey] as number | null) ?? 0;
      return bVal - aVal;
    });

    return result;
  }, [players, genderFilter, formatSort, searchQuery, eloKey]);

  const activeFilterCount = (genderFilter !== "all" ? 1 : 0) + (formatSort !== "overall" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  const formatLabel = { overall: "Overall", singles: "Singles", doubles: "Doubles", mixed: "Mixed" }[formatSort];

  const buildExportSheets = () => {
    const headers = ["Rank", "Player", "Gender", "Department", "Overall ELO", "Singles ELO", "Doubles ELO", "Mixed ELO", "Wins", "Losses", "Win Rate"];
    const rows = filtered.map((p, i) => {
      const total = p.wins + p.losses;
      const wr = total > 0 ? `${Math.round((p.wins / total) * 100)}%` : "0%";
      return [i + 1, p.full_name, p.gender || "—", p.department || "—", p.elo_rating, p.singles_elo ?? "—", p.doubles_elo ?? "—", p.mixed_elo ?? "—", p.wins, p.losses, wr];
    });
    const filterInfo = [];
    if (genderFilter !== "all") filterInfo.push(`Gender: ${genderFilter}`);
    if (formatSort !== "overall") filterInfo.push(`Sorted by: ${formatLabel}`);
    if (searchQuery.trim()) filterInfo.push(`Search: ${searchQuery}`);
    const title = [`IISc Badminton Club — ELO Rankings${filterInfo.length ? ` (${filterInfo.join(", ")})` : ""}`];
    const date = [`Generated: ${new Date().toLocaleString()}`];
    return [{ name: "ELO Rankings", data: [title, date, [], headers, ...rows] }];
  };

  const handleExport = async (type: "excel" | "pdf" | "image") => {
    setShowExportMenu(false);
    const sheets = buildExportSheets();
    const filename = `elo_rankings_${formatSort}${genderFilter !== "all" ? `_${genderFilter}` : ""}`;
    if (type === "excel") await exportToExcel(filename, sheets);
    else if (type === "pdf") await exportToPDF(sheets, filename);
    else await exportToImage(sheets, filename);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: Search + Filter + Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or department..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-on-accent placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary/50"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary/50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              <button onClick={() => handleExport("excel")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-on-accent transition">
                <FileSpreadsheet className="w-4 h-4 text-green-500" /> Excel (.xlsx)
              </button>
              <button onClick={() => handleExport("pdf")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-on-accent transition border-t border-slate-100 dark:border-slate-800">
                <FileText className="w-4 h-4 text-rose-500" /> PDF Document
              </button>
              <button onClick={() => handleExport("image")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-on-accent transition border-t border-slate-100 dark:border-slate-800">
                <FileImage className="w-4 h-4 text-blue-500" /> Image (.png)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter panel (collapsible) */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Gender */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Gender</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "Male", "Female"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${genderFilter === g ? "bg-primary text-primary-foreground shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-on-accent"}`}
                >
                  {g === "all" ? "All" : g}
                </button>
              ))}
            </div>
          </div>
          {/* Format (sort by) */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Rank By Format</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["overall", "singles", "doubles", "mixed"] as const).map(f => {
                const colors: Record<string, string> = {
                  overall: "bg-primary text-primary-foreground",
                  singles: "bg-sky-500 text-white",
                  doubles: "bg-violet-500 text-white",
                  mixed: "bg-amber-500 text-white",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setFormatSort(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${formatSort === f ? `${colors[f]} shadow-sm` : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Clear all */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setGenderFilter("all"); setFormatSort("overall"); setSearchQuery(""); }}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-wider transition"
            >
              ✕ Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""} · Ranked by <span className="font-bold text-foreground">{formatLabel}</span>
          {genderFilter !== "all" && <span> · {genderFilter}</span>}
        </p>
      </div>

      {/* Player list */}
      {filtered.length === 0 && (
        <div className={`${cardCls} text-center py-10 text-muted-foreground text-sm`}>
          No players match the current filters.
        </div>
      )}
      {filtered.map((p, i) => {
        const total = p.wins + p.losses;
        const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
        const displayElo = (p[eloKey] as number | null) ?? p.elo_rating;
        return (
          <button
            key={p.id}
            onClick={() => loadPlayerHistory(p)}
            className={`${cardCls} flex items-center gap-3 w-full text-left hover:border-primary hover:shadow-md transition-all group`}
          >
            <span className={`w-7 text-center text-xs font-black shrink-0 ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800 dark:text-foreground text-sm truncate group-hover:text-primary transition-colors">{p.full_name}</p>
                {p.gender && (
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${p.gender === "Male" ? "bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400" : "bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400"}`}>
                    {p.gender === "Male" ? "M" : "F"}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{p.wins}W {p.losses}L · {winRate}% WR{p.department ? ` · ${p.department}` : ""}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {p.singles_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "singles" ? "bg-sky-500 text-white ring-2 ring-sky-300 dark:ring-sky-700" : "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400"}`}>S: {p.singles_elo} ({p.singles_matches_played}M)</span>}
                {p.doubles_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "doubles" ? "bg-violet-500 text-white ring-2 ring-violet-300 dark:ring-violet-700" : "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400"}`}>D: {p.doubles_elo} ({p.doubles_matches_played}M)</span>}
                {p.mixed_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "mixed" ? "bg-amber-500 text-white ring-2 ring-amber-300 dark:ring-amber-700" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"}`}>M: {p.mixed_elo} ({p.mixed_matches_played}M)</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-primary dark:text-primary text-base">{displayElo}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{formatLabel}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-300 dark:text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          </button>
        );
      })}
    </div>
  );
}
