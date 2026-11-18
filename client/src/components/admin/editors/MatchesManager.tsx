import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink, FileUp, Filter
} from "lucide-react";
import { toast } from "sonner";
import { fetchTournamentMatchesForAdmin } from "@/services/matchService";
import { fetchTournaments, undoTournamentMatch as undoTournamentMatchRpc } from "@/services/tournamentService";
import { adminService } from "@/services/adminService";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard } from "../../feed/MatchCard";
import { Capacitor } from "@capacitor/core";
import { AdminLoading, AdminEmptyState } from "../AdminPanel";

export function MatchesManager() {
  const { user } = useAuth();
  
  // UI State
  const [activeFormat, setActiveFormat] = useState<string>("MS");
  const FORMATS = ["MS", "MD", "WS", "WD", "XD"];
  
  // Data State
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const { reloadTrigger } = useAdminHistory();
  const { confirm } = useConfirm();
  
  // Tournament Dropdown state
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  useEffect(() => {
    // Load tournaments (including deleted ones so admins can clean up dummy matches)
    fetchTournaments().then((data) => {
      if (data && data.length > 0) {
        setTournaments(data);
        setSelectedTournamentId(data[0].id);
      }
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!selectedTournamentId) {
        setMatches([]);
        setLoading(false);
        return;
      }
      
      const data = await fetchTournamentMatchesForAdmin(selectedTournamentId, activeFormat);
      if (data) {
        const mapped = data.map(tm => ({
          id: tm.id,
          created_at: tm.scored_at || tm.scheduled_at || tm.created_at || new Date().toISOString(),
          is_friendly: false,
          category: tm.category,
          tournament_slug: tm.tournaments?.name || tm.tournament_id,
          player1_id: tm.player1_id,
          player2_id: tm.player2_id,
          team1_partner_id: tm.player3_id, 
          team2_partner_id: tm.player4_id,
          player1: tm.player1 ? tm.player1 : { id: tm.player1_id || `t1_${tm.id}`, full_name: tm.team1_label },
          player2: tm.player2 ? tm.player2 : { id: tm.player2_id || `t2_${tm.id}`, full_name: tm.team2_label },
          partner1: tm.player3 ? tm.player3 : null,
          partner2: tm.player4 ? tm.player4 : null,
          match_score: tm.score,
          sets_history: tm.sets_history,
          winner_id: tm.winner_side === 1 ? (tm.player1_id || `t1_${tm.id}`) : (tm.winner_side === 2 ? (tm.player2_id || `t2_${tm.id}`) : null),
          status: tm.status,
          is_tournament_match: true,
        }));
        setMatches(mapped);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load matches: " + err.message);
    }
    setLoading(false);
  }, [activeFormat, selectedTournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (reloadTrigger > 0) load();
  }, [reloadTrigger]);

  const undoTournamentMatch = async (id: string) => {
    if (!(await confirm({
      title: 'Undo Tournament Match',
      description: "Are you sure you want to undo this tournament match? This will clear the score, reset the bracket slot, and recalculate tournament ELO for all players.",
      confirmVariant: 'danger',
      confirmLabel: 'Undo Match'
    }))) return;
    setActionId(id);
    try {
      await undoTournamentMatchRpc(id);
      
      // Full reset + replay. recalculateTournamentElo alone replays on top of
      // current ratings, counting every match again.
      await adminService.recalculateAllElo();

      toast.success("Tournament match undone and ELO recalculated");
      load();
    } catch (err: any) {
      toast.error("Failed to undo tournament match: " + err.message);
    }
    setActionId(null);
  };

  const recalculateElo = async () => {
    if (!(await confirm({
      title: 'Recalculate ELO',
      description: "WARNING: This will reset all ELO ratings and replay every rated match from scratch. It might take up to a minute. Proceed?",
      confirmVariant: 'danger',
      confirmLabel: 'Recalculate'
    }))) return;
    setActionId("recalc");
    const start = Date.now();
    try {
      await adminService.recalculateAllElo();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.success("ELO recalculation complete!");
      await adminService.logAction("elo_recalculate_all", `Completed in ${elapsed}s`, "admin");
      load();
    } catch (error: any) {
      toast.error("Recalculation failed: " + error.message);
      await adminService.logAction("elo_recalculate_failed", error.message, "admin");
    }
    setActionId(null);
  };

  const exportMatchesCsv = async () => {
    if (matches.length === 0) return;
    const headers = [
      "ID", "Status", "Created At", "Category", "Is Friendly", "Tournament",
      "Player 1", "Partner 1", "Player 2", "Partner 2", 
      "Score", "Sets History", "Confirmed By", "Winner ID", 
      "P1 Elo Change", "Partner1 Elo Change", "P2 Elo Change", "Partner2 Elo Change"
    ];
    
    const rows = matches.map(m => {
      let rawScore = m.match_score || m.score || "";
      if (typeof rawScore === "object") rawScore = JSON.stringify(rawScore);
      const cleanScore = typeof rawScore === "string" ? rawScore.replace(/\s*\[.*Doubles:.*\]/i, '') : "";

      const setsHistorySafe = Array.isArray(m.sets_history) ? JSON.stringify(m.sets_history) : (m.sets_history || "");
      const confirmedBySafe = Array.isArray(m.confirmed_by) ? JSON.stringify(m.confirmed_by) : (m.confirmed_by || "");

      return [
        m.id,
        m.status,
        m.created_at,
        m.category || "friendly",
        m.is_friendly || false,
        `"${m.tournament_slug || ""}"`,
        `"${m.player1?.full_name || m.player1_id || ""}"`,
        `"${m.partner1?.full_name || m.team1_partner_id || ""}"`,
        `"${m.player2?.full_name || m.player2_id || ""}"`,
        `"${m.partner2?.full_name || m.team2_partner_id || ""}"`,
        `"${cleanScore}"`,
        `"${setsHistorySafe.replace(/"/g, '""')}"`,
        `"${confirmedBySafe.replace(/"/g, '""')}"`,
        m.winner_id || "",
        m.elo_change_p1 || "",
        m.elo_change_p3 || "",
        m.elo_change_p2 || "",
        m.elo_change_p4 || ""
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `matches_export_${new Date().toISOString().split("T")[0]}.csv`;
    const csvContent = '\uFEFF' + csv;
    const file = new File([csvContent], filename, { type: "text/csv;charset=utf-8;" });
    
    try {
      const isNative = Capacitor.isNativePlatform();
      if (isNative && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export error", err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="font-black text-slate-800 dark:text-foreground">Match Administration</h3>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button onClick={exportMatchesCsv} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-muted-foreground dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={recalculateElo} disabled={actionId === "recalc"} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-3 py-2 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-100 disabled:opacity-50 transition">
            {actionId === "recalc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate ELOs
          </button>
          <button aria-label="Refresh matches" onClick={load} className="flex justify-center items-center p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Tournament</label>
        <select value={selectedTournamentId} onChange={e => setSelectedTournamentId(e.target.value)} className="w-full p-2.5 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-foreground outline-none focus:ring-2 focus:ring-primary">
          {tournaments.map(t => (
             <option key={t.id} value={t.id}>{t.name} {t.status === 'completed' ? '(Completed)' : t.status === 'deleted' ? '(Deleted/Trashed)' : ''}</option>
          ))}
          {tournaments.length === 0 && <option value="" disabled>No tournaments found</option>}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        {FORMATS.map(f => (
          <button key={f} onClick={() => setActiveFormat(f)} className={`shrink-0 px-5 py-2 rounded-t-xl text-xs font-black transition-all border-b-2 ${activeFormat === f ? 'border-primary text-primary bg-primary/10 dark:bg-primary/20' : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-4">
        {loading ? (
          <AdminLoading label="Loading matches…" />
        ) : matches.length === 0 ? (
          <AdminEmptyState
            icon={Activity}
            title="No tournament matches found"
            description={`Nothing in the ${activeFormat} format yet.`}
          />
        ) : matches.map((m, idx) => {
          const busy = actionId === m.id;
          return (
            <MatchCard key={m.id} match={m} currentUser={user} hideActions={true} index={idx}>
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3 w-full relative z-10">
                <button onClick={() => undoTournamentMatch(m.id)} disabled={busy} className="px-5 py-2 text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl disabled:opacity-50 transition w-full sm:w-auto text-center flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Undo Match & Recalculate ELO
                </button>
              </div>
            </MatchCard>
          );
        })}
      </div>
    </div>
  );
}
