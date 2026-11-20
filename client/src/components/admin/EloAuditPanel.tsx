import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Loader2, RotateCcw, TrendingUp, TrendingDown, ChevronDown, ChevronUp, ArrowLeft, Play,
  Download, Filter, Search, FileSpreadsheet, FileImage, FileText, X, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/adminService";
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
  Singles:  "bg-individual/15 text-individual",
  Doubles:  "bg-team/15 text-team",
  Mixed:    "bg-warning/15 text-warning",
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
    try {
      const { logs, players, tourneyMatches, recentLogs } = await adminService.getEloAuditData();

      setLogs(logs as AuditEntry[]);

      if (players && players.length > 0) {
        const playerMap = new Map((players as any[]).map(p => [p.id, p]));
        const winMap: Record<string, number> = {};
        const lossMap: Record<string, number> = {};
        if (tourneyMatches) {
          (tourneyMatches as any[]).forEach((tm) => {
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
      setPlayers((players as any[]).map((p) => ({
        ...p,
        wins: winMap[p.id] || 0,
        losses: lossMap[p.id] || 0,
      })));

      if (recentLogs && recentLogs.length > 0) {
        const mappedLogs = (recentLogs as any[]).map((l) => ({
          ...l,
          player: playerMap.get(l.player_id) || { id: l.player_id, full_name: "Player" },
        }));
        const groupedByMatch: Record<string, any[]> = {};
        mappedLogs.forEach((l: any) => {
          if (!groupedByMatch[l.match_uuid]) groupedByMatch[l.match_uuid] = [];
          groupedByMatch[l.match_uuid].push(l);
        });

        const tourneyMatchMap = new Map((tourneyMatches as any[] || []).map(tm => [tm.id, tm]));

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

        if (uniqueMatches.length === 0 && tourneyMatches && tourneyMatches.length > 0) {
          const fallbackEntries = (tourneyMatches as any[]).map((tm) => {
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
          setGlobalMatches(fallbackEntries as any);
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
  } catch (err: any) {
    toast.error(err?.message || "Failed to load ELO audit data");
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { load(); }, [load]);

  const [showRecalcModal, setShowRecalcModal] = useState(false);

  const executeRecalculate = async () => {
    setShowRecalcModal(false);
    setRecalcLoading(true);
    try {
      await adminService.recalculateAllElo();
      await adminService.logAction(
        "elo_recalculation",
        "Manually triggered full recalculation of all ELOs",
        session?.user?.email || "unknown",
      );
      toast.success("Successfully recalculated all ELO histories!");
      load();
    } catch (error: any) {
      await adminService.logAction(
        "elo_recalculation_failed",
        error.message,
        session?.user?.email || "unknown",
      );
      toast.error("Error recalculating ELO: " + error.message);
    } finally {
      setRecalcLoading(false);
    }
  };

  const loadPlayerHistory = useCallback(async (player: PlayerSnapshot) => {
    setSelectedPlayer(player);
    setHistoryLoading(true);
    setEloHistory([]);

    try {
      const { logData, allLogsData, tourneyMatchData } = await adminService.getPlayerEloHistory(player.id);
      if (!logData || logData.length === 0) {
        setHistoryLoading(false);
        return;
      }

      const matchMap: Record<string, any> = {};
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
    } catch (err: any) {
      toast.error("Failed to load player ELO history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const renderExpandedTable = (entry: EloLogEntry, highlightPlayerId?: string) => (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-muted-foreground">
          <thead className="uppercase tracking-wider text-[10px] bg-muted/50">
            <tr>
              <th className="px-3 py-2 rounded-l-lg font-bold">Player</th>
              <th className="px-3 py-2 font-bold text-center">Category Before</th>
              <th className="px-3 py-2 font-bold text-center">Cat Change</th>
              <th className="px-3 py-2 font-bold text-center">Category Now</th>
              <th className="px-3 py-2 rounded-r-lg font-bold text-center">Overall Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {entry.all_players_logs?.sort((a, b) => (b.elo_change || 0) - (a.elo_change || 0)).map((pl: any) => {
              const isWin = pl.actual_score === 1 || (pl.elo_change && pl.elo_change > 0);
              const catChange = pl.elo_change || 0;
              const isHighlight = pl.player_id === highlightPlayerId;
              return (
                <tr key={pl.id || pl.player_id || pl.player?.full_name} className={isHighlight ? "bg-primary/20" : ""}>
                  <td className="px-3 py-2 font-bold text-soft flex items-center gap-1.5 whitespace-nowrap">
                    {pl.player?.full_name || "Unknown"}
                    {isWin ? <span className="text-[9px] bg-success/15 text-success px-1 py-0.5 rounded uppercase font-black">W</span> : <span className="text-[9px] bg-danger/10 text-danger px-1 py-0.5 rounded uppercase font-black">L</span>}
                  </td>
                  <td className="px-3 py-2 text-center">{pl.previous_elo}</td>
                  <td className={`px-3 py-2 text-center font-black ${catChange > 0 ? "text-success" : "text-danger"}`}>
                    {catChange > 0 ? "+" : ""}{catChange}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-soft">{pl.new_elo}</td>
                  <td className={`px-3 py-2 text-center font-bold ${catChange > 0 ? "text-success" : "text-danger"}`}>
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

  const cardCls = "bg-card rounded-2xl border border-border p-4 shadow-sm";

  // ── Player ELO History View ──────────────────────────────────────────────────
  if (selectedPlayer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedPlayer(null); setEloHistory([]); }}
            className="p-2 rounded-xl border border-border-strong hover:bg-muted transition"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h3 className="font-black text-foreground">{selectedPlayer.full_name}</h3>
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
                  <div className={`w-2 h-8 rounded-full shrink-0 ${won ? "bg-primary" : "bg-danger"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${catColor}`}>
                        {entry.match_category || entry.category}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${won ? "bg-primary/40 text-primary" : "bg-danger/15 text-danger"}`}>
                        {won ? "WIN" : "LOSS"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-soft truncate mt-0.5">
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
                    <p className="text-xs text-muted-foreground font-mono">
                      {entry.previous_elo} → <span className="font-black text-foreground">{entry.new_elo}</span>
                    </p>
                    <p className={`text-sm font-black ${entry.elo_change > 0 ? "text-primary" : "text-danger"}`}>
                      {entry.elo_change > 0 ? "+" : ""}{entry.elo_change}
                    </p>
                  </div>

                  {/* Overall ELO change */}
                  <div className="text-right shrink-0 border-l border-border pl-3 ml-1">
                    <p className="text-[10px] text-muted-foreground font-bold">Overall</p>
                    <p className={`text-sm font-black ${overallChange > 0 ? "text-primary" : "text-danger"}`}>
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
          <h3 className="font-black text-foreground">ELO Audit Log</h3>
          <InfoModal
            title="ELO AUDIT & RECALCULATION"
            items={[
              { badge: "ALGO", title: "Recalculation Engine", desc: "Replays all historical matches in chronological order to completely rebuild the ELO state." },
              { badge: "WARN", title: "Destructive Action", desc: "Forcing a recalculation will overwrite all current ratings. Use only if database integrity is compromised." }
            ]}
          />
        </div>
        <button aria-label="Refresh ELO audit" onClick={load} className="p-2 rounded-xl border border-border-strong hover:bg-muted transition">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        {(["history", "snapshot", "matchwise"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition text-center ${tab === t ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border-strong text-soft hover:border-primary/50"}`}>
            {t === "history" ? "Recalculation History" : t === "snapshot" ? "Current ELO Snapshot" : "Matchwise ELO"}
          </button>
        ))}
      </div>

      {tab === "matchwise" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Most recent confirmed matches</p>
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
                        <span className="text-[10px] font-black text-soft">
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
                    <div className="flex items-center gap-2 text-xs font-bold text-soft">
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
            <p className="text-xs text-muted-foreground">Log of all manual ELO re-sync actions</p>
            <button 
              onClick={() => setShowRecalcModal(true)}
              disabled={recalcLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/30 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/40 transition-colors disabled:opacity-50"
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
                <div className={`p-2 rounded-xl shrink-0 ${isFailed ? "bg-danger/10 text-danger" : "bg-primary/30 text-primary"}`}>
                  {isFailed ? <TrendingDown className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isFailed ? "bg-danger/15 text-danger" : "bg-primary/40 text-primary"}`}>
                      {isFailed ? "FAILED" : "SUCCESS"}
                    </span>
                    <span className="text-xs font-bold text-soft">{log.action.replace(/_/g, " ")}</span>
                  </div>
                  {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
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
        <DialogContent className="sm:max-w-md bg-card border border-border text-foreground rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning font-black text-lg">
              <AlertTriangle className="w-5 h-5 text-warning" /> Recalculate System ELOs?
            </DialogTitle>
            <DialogDescription className="text-soft text-sm mt-2">
              Are you sure? This will wipe all current ELO ratings and recompute them sequentially from the very first match.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowRecalcModal(false)}
              className="border-border-strong text-soft hover:bg-muted hover:text-foreground rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={executeRecalculate}
              disabled={recalcLoading}
              className="bg-warning hover:bg-warning/90 text-warning-foreground font-bold rounded-xl flex items-center gap-2"
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
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border-strong text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
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
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border-strong text-muted-foreground hover:border-primary/50"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-5 h-5 rounded-full bg-danger text-danger-foreground text-[10px] font-black flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-card border border-border-strong text-muted-foreground hover:border-primary/50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border-strong rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              <button onClick={() => handleExport("excel")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition">
                <FileSpreadsheet className="w-4 h-4 text-success" /> Excel (.xlsx)
              </button>
              <button onClick={() => handleExport("pdf")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition border-t border-border">
                <FileText className="w-4 h-4 text-danger" /> PDF Document
              </button>
              <button onClick={() => handleExport("image")} className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition border-t border-border">
                <FileImage className="w-4 h-4 text-info" /> Image (.png)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ELO Formula Explainer */}
      <div className="bg-info/10 border border-info/30 rounded-xl p-4 space-y-4">
        <div>
          <h4 className="text-xs font-black text-info mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <InfoModal 
              title="Overall ELO Formula" 
              items={[
                { badge: "MATH", title: "Fixed Average", desc: "Overall ELO is an equal 1/3 weighted average of all three formats." },
                { badge: "RULE", title: "Unplayed Default", desc: "If a player has not played a format, it defaults to exactly 1200 ELO in the calculation." },
                { badge: "GOAL", title: "Incentive", desc: "This formula rewards players for participating in multiple formats by raising their average above baseline." }
              ]} 
            />
            Overall ELO Calculation Formula
          </h4>
          <div className="bg-card rounded-lg p-3 font-mono text-xs border border-border flex flex-col gap-1.5 overflow-x-auto text-soft">
            <p><span className="text-info font-bold">Overall ELO</span> = (Singles + Doubles + Mixed) / 3</p>
            <p className="text-[10px] text-muted-foreground mt-1 border-t border-border pt-1.5">* Missing formats default to 1200.</p>
          </div>
        </div>
        
        <div>
          <h4 className="text-xs font-black text-info mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <InfoModal 
              title="Win Probability Formula" 
              items={[
                { badge: "MATH", title: "Logistic Curve", desc: "Uses the standard Elo rating formula to calculate expected win probability based on rating difference." },
                { badge: "RULE", title: "Scaling Factor", desc: "A 400 point difference means the higher rated player is 10 times more likely to win." },
              ]} 
            />
            Match Win Probability Formula
          </h4>
          <div className="bg-card rounded-lg p-3 font-mono text-xs border border-border flex flex-col gap-1.5 overflow-x-auto text-soft">
            <p><span className="text-info font-bold">P1 Win %</span> = 1 / (1 + 10 ^ ((P2_Elo - P1_Elo) / 400)) * 100</p>
            <p className="text-[10px] text-muted-foreground mt-1 border-t border-border pt-1.5">* Equal ratings evaluate to exactly 50% probability.</p>
          </div>
        </div>
      </div>

      {/* Filter panel (collapsible) */}
      {showFilters && (
        <div className="bg-card border border-border-strong rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Gender */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Gender</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "Male", "Female"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${genderFilter === g ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"}`}
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
                  singles: "bg-individual text-individual-foreground",
                  doubles: "bg-team text-team-foreground",
                  mixed: "bg-warning text-warning-foreground",
                };
                return (
                  <button
                    key={f}
                    onClick={() => setFormatSort(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${formatSort === f ? `${colors[f]} shadow-sm` : "bg-muted text-muted-foreground hover:text-foreground"}`}
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
              className="text-[10px] font-bold text-danger hover:text-danger/80 uppercase tracking-wider transition"
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
            <span className={`w-7 text-center text-xs font-black shrink-0 ${i < 3 ? "text-warning" : "text-muted-foreground"}`}>#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">{p.full_name}</p>
                {p.gender && (
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${p.gender === "Male" ? "bg-info/10 text-info" : "bg-individual/10 text-individual"}`}>
                    {p.gender === "Male" ? "M" : "F"}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{p.wins}W {p.losses}L · {winRate}% WR{p.department ? ` · ${p.department}` : ""}</p>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {p.singles_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "singles" ? "bg-info text-info-foreground ring-2 ring-info" : "bg-info/10 text-info"}`}>S: {p.singles_elo} ({p.singles_matches_played}M)</span>}
                {p.doubles_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "doubles" ? "bg-individual text-individual-foreground ring-2 ring-individual" : "bg-individual/10 text-individual"}`}>D: {p.doubles_elo} ({p.doubles_matches_played}M)</span>}
                {p.mixed_elo != null && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${formatSort === "mixed" ? "bg-warning text-warning-foreground ring-2 ring-warning" : "bg-warning/10 text-warning"}`}>M: {p.mixed_elo} ({p.mixed_matches_played}M)</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-primary text-base">{displayElo}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{formatLabel}</p>
            </div>
            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          </button>
        );
      })}
    </div>
  );
}
