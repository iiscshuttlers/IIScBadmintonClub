import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard } from "../../feed/MatchCard";
import { Capacitor } from "@capacitor/core";

export function MatchesManager() {
  const { user } = useAuth();
  
  // UI State
  const [activeTab, setActiveTab] = useState<"friendly" | "tournament">("friendly");
  const [activeFormat, setActiveFormat] = useState<string>("MS");
  const FORMATS = ["MS", "MD", "WS", "WD", "XD"];
  
  // Data State
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const { softDelete, recordAction, reloadTrigger } = useAdminHistory();
  
  // Tournament Dropdown state
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");

  useEffect(() => {
    // Load tournaments
    supabase.from("tournaments").select("id, name, status, categories").neq("status", "deleted").order("created_at", { ascending: false }).then(({data}) => {
      if (data && data.length > 0) {
        setTournaments(data);
        setSelectedTournamentId(data[0].id);
      }
    });
  }, []);

  const getFriendlyFormat = (m: any) => {
     const cat = m.category || "";
     if (FORMATS.includes(cat)) return cat;
     
     // Infer from gender
     const isDoubles = !!m.team1_partner_id || !!m.partner1;
     const g1 = m.player1?.gender;
     const g3 = m.partner1?.gender;
     
     if (isDoubles) {
        if (g1 === 'Female' && g3 === 'Female') return 'WD';
        if (g1 === 'Male' && g3 === 'Male') return 'MD';
        return 'XD';
     } else {
        if (g1 === 'Female') return 'WS';
        return 'MS';
     }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "friendly") {
        const { data, error } = await supabase
          .from("matches")
          .select(`
            *,
            player1:players!matches_player1_id_fkey(id, full_name, avatar_url, gender),
            player2:players!matches_player2_id_fkey(id, full_name, avatar_url, gender),
            partner1:players!team1_partner_id(id, full_name, avatar_url, gender),
            partner2:players!team2_partner_id(id, full_name, avatar_url, gender)
          `)
          .order("created_at", { ascending: false })
          .limit(500);
        
        if (error) throw error;
        
        if (data) {
          const filtered = data.filter(m => getFriendlyFormat(m) === activeFormat);
          setMatches(filtered);
        }
      } else {
        if (!selectedTournamentId) {
          setMatches([]);
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from("tournament_matches")
          .select(`
            *,
            tournaments(name),
            player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
            player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
            player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
            player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url)
          `)
          .eq("tournament_id", selectedTournamentId)
          .eq("category", activeFormat)
          .not("winner_side", "is", null)
          .not("score", "is", null)
          .order("scored_at", { ascending: false });
          
        if (error) throw error;
        
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
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load matches: " + err.message);
    }
    setLoading(false);
  }, [activeTab, activeFormat, selectedTournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (reloadTrigger > 0) load();
  }, [reloadTrigger]);

  const deleteFriendlyMatch = async (id: string) => {
    const match = matches.find((m) => m.id === id);
    const isRejected = match?.status === "rejected";
    if (!confirm(isRejected ? "Permanently delete this rejected match? This cannot be undone." : "Move this match to the recycle bin?")) return;
    setActionId(id);
    try {
      if (isRejected) {
        const { error } = await supabase.from("matches").delete().eq("id", id);
        if (error) throw error;
        toast.success("Match permanently deleted");
      } else {
        const { data: matchData, error: fetchErr } = await supabase.from("matches").select("*").eq("id", id).single();
        if (fetchErr || !matchData) {
          toast.error("Could not fetch match data");
          setActionId(null);
          return;
        }
        const p1 = match?.player1?.full_name ?? matchData.player1_id;
        const p2 = match?.player2?.full_name ?? matchData.player2_id;
        await softDelete("matches", id, matchData, `Match: ${p1} vs ${p2}`);
        toast.success("Match moved to recycle bin");
      }
      setMatches((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      toast.error("Failed to delete: " + err.message);
    }
    setActionId(null);
  };

  const undoTournamentMatch = async (id: string) => {
    if (!confirm("Are you sure you want to undo this tournament match? This will clear the score, reset the bracket slot, and recalculate tournament ELO for all players.")) return;
    setActionId(id);
    try {
      const { error } = await supabase.from("tournament_matches").update({
        score: null,
        sets_history: [],
        winner_side: null,
        status: "pending",
        locked: false,
        scored_at: null,
      }).eq("id", id);
      if (error) throw error;
      
      const { error: calcErr } = await supabase.rpc("recalculate_tournament_elo");
      if (calcErr) throw calcErr;

      toast.success("Tournament match undone and ELO recalculated");
      load();
    } catch (err: any) {
      toast.error("Failed to undo tournament match: " + err.message);
    }
    setActionId(null);
  };

  const recalculateElo = async () => {
    if (!confirm("WARNING: This will wipe all friendly ELOs and recalculate them from scratch. It might take up to a minute. Proceed?")) return;
    setActionId("recalc");
    const start = Date.now();
    const { error } = await supabase.rpc("recalculate_all_elo");
    if (error) {
      toast.error("Recalculation failed: " + error.message);
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_failed", details: error.message });
    } else {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.success("Friendly ELO Recalculation complete!");
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_all", details: `Completed in ${elapsed}s` });
      load();
    }
    setActionId(null);
  };

  const revokeMatch = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this match? It will be marked as 'rejected'.")) return;
    setActionId(id);
    const match = matches.find((m) => m.id === id);
    const prevStatus = match?.status ?? "confirmed";
    const { error } = await supabase.from("matches").update({ status: "rejected" }).eq("id", id);
    if (error) toast.error("Failed to revoke: " + error.message);
    else {
      toast.success("Match revoked");
      setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)));
      await recordAction({
        action_type: "update",
        entity_type: "matches",
        entity_id: id,
        before_state: { status: prevStatus },
        after_state: { status: "rejected" },
        label: `Revoked match: ${match?.player1?.full_name ?? id} vs ${match?.player2?.full_name ?? ""}`,
      });
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
        <h3 className="font-black text-slate-800 dark:text-white">Match Administration</h3>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button onClick={exportMatchesCsv} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={recalculateElo} disabled={actionId === "recalc"} className="flex flex-1 md:flex-none justify-center items-center gap-2 px-3 py-2 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-100 disabled:opacity-50 transition">
            {actionId === "recalc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate Friendly ELOs
          </button>
          <button onClick={load} className="flex justify-center items-center p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/50 p-1">
        <button onClick={() => { setActiveTab("friendly"); setActiveFormat("MS"); }} className={`flex-1 py-2 text-sm font-black rounded-lg transition ${activeTab === 'friendly' ? 'bg-white dark:bg-slate-700 shadow text-primary dark:text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Friendly</button>
        <button onClick={() => { setActiveTab("tournament"); setActiveFormat("MS"); }} className={`flex-1 py-2 text-sm font-black rounded-lg transition ${activeTab === 'tournament' ? 'bg-white dark:bg-slate-700 shadow text-primary dark:text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Tournament</button>
      </div>
      
      {activeTab === "tournament" && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Tournament</label>
          <select value={selectedTournamentId} onChange={e => setSelectedTournamentId(e.target.value)} className="w-full p-2.5 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary">
            {tournaments.map(t => (
               <option key={t.id} value={t.id}>{t.name} {t.status === 'completed' ? '(Completed)' : ''}</option>
            ))}
            {tournaments.length === 0 && <option value="" disabled>No active tournaments found</option>}
          </select>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-100 dark:border-slate-800">
        {FORMATS.map(f => (
          <button key={f} onClick={() => setActiveFormat(f)} className={`shrink-0 px-5 py-2 rounded-t-xl text-xs font-black transition-all border-b-2 ${activeFormat === f ? 'border-primary text-primary bg-primary/10 dark:bg-primary/20' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-4">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>
        ) : matches.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center">
            <Activity className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-slate-400 font-bold">No {activeTab} matches found for {activeFormat}.</p>
          </div>
        ) : matches.map((m, idx) => {
          const busy = actionId === m.id;
          return (
            <MatchCard key={m.id} match={m} currentUser={user} hideActions={true} isKudosed={false} kudosCount={0} index={idx}>
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3 w-full relative z-10">
                {m.is_tournament_match ? (
                  <button onClick={() => undoTournamentMatch(m.id)} disabled={busy} className="px-5 py-2 text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl disabled:opacity-50 transition w-full sm:w-auto text-center flex items-center justify-center gap-2">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Undo Match & Recalculate ELO
                  </button>
                ) : (
                  <>
                    <button onClick={() => revokeMatch(m.id)} disabled={busy} className="px-5 py-2 text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl disabled:opacity-50 transition w-full sm:w-auto text-center">
                      Revoke
                    </button>
                    <button onClick={() => deleteFriendlyMatch(m.id)} disabled={busy} className="px-5 py-2 text-sm font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition w-full sm:w-auto">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}
              </div>
            </MatchCard>
          );
        })}
      </div>
    </div>
  );
}
