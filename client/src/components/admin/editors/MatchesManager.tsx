import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";
import { optimizeImage } from '@/lib/imageUtils';
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard } from "../../feed/MatchCard";
import { Capacitor } from "@capacitor/core";

export function MatchesManager() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const { softDelete, recordAction, reloadTrigger } = useAdminHistory();

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all matches, fallback to 2 queries if relation doesn't match
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        *,
        player1:players!matches_player1_id_fkey(id, full_name, avatar_url),
        player2:players!matches_player2_id_fkey(id, full_name, avatar_url),
        partner1:players!team1_partner_id(id, full_name, avatar_url),
        partner2:players!team2_partner_id(id, full_name, avatar_url)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Join failed, fetching flat matches", error);
      const { data: flatMatches } = await supabase
        .from("matches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const { data: players } = await supabase
        .from("players")
        .select("id, full_name, avatar_url");
      const pMap = Object.fromEntries(
        (players || []).map((p) => [p.id, p]),
      );
      if (flatMatches) {
        setMatches(
          flatMatches.map((m) => ({
            ...m,
            player1: pMap[m.player1_id] ? pMap[m.player1_id] : { full_name: m.player1_id || "Unknown" },
            player2: pMap[m.player2_id] ? pMap[m.player2_id] : { full_name: m.player2_id || "Unknown" },
            partner1: m.team1_partner_id ? pMap[m.team1_partner_id] || { full_name: m.team1_partner_id } : null,
            partner2: m.team2_partner_id ? pMap[m.team2_partner_id] || { full_name: m.team2_partner_id } : null,
          })),
        );
      }
    } else if (data) {
      setMatches(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (reloadTrigger > 0) load();
  }, [reloadTrigger]);

  const deleteMatch = async (id: string) => {
    const match = matches.find((m) => m.id === id);
    const isRejected = match?.status === "rejected";
    if (!confirm(isRejected ? "Permanently delete this rejected match? This cannot be undone." : "Move this match to the recycle bin?")) return;
    setActionId(id);
    try {
      if (isRejected) {
        // Hard-delete rejected matches directly — no need to recycle bin them
        const { error } = await supabase.from("matches").delete().eq("id", id);
        if (error) throw error;
        toast.success("Match permanently deleted");
      } else {
        const { data: matchData, error: fetchErr } = await supabase
          .from("matches")
          .select("*")
          .eq("id", id)
          .single();
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

  const recalculateElo = async () => {
    if (!confirm("WARNING: This will wipe all current ELOs and recalculate them from scratch. It might take up to a minute. Proceed?")) return;
    setActionId("recalc");
    const start = Date.now();
    const { error } = await supabase.rpc("recalculate_all_elo");
    if (error) {
      toast.error("Recalculation failed: " + error.message);
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_failed", details: error.message });
    } else {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.success("ELO Recalculation complete!");
      await supabase.from("admin_logs").insert({ admin_email: "admin", action: "elo_recalculate_all", details: `Completed in ${elapsed}s` });
      load();
    }
    setActionId(null);
  };

  const revokeMatch = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to revoke this match? It will be marked as 'rejected'.",
      )
    )
      return;
    setActionId(id);
    const match = matches.find((m) => m.id === id);
    const prevStatus = match?.status ?? "confirmed";
    const { error } = await supabase
      .from("matches")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) toast.error("Failed to revoke: " + error.message);
    else {
      toast.success("Match revoked");
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "rejected" } : m)),
      );
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
        await navigator.share({
          files: [file],
          title: filename,
        });
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

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
        <h3 className="font-black text-slate-800 dark:text-white">
          Recent Matches (Last 100)
        </h3>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={recalculateElo}
            disabled={actionId === "recalc"}
            className="flex justify-center items-center gap-2 px-3 py-2 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-100 disabled:opacity-50 transition w-full md:w-auto"
          >
            {actionId === "recalc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate All ELOs
          </button>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={exportMatchesCsv}
              className="flex justify-center items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 transition flex-1 md:flex-none"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={load}
              className="flex justify-center items-center p-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {matches.map((m, idx) => {
          const busy = actionId === m.id;
          return (
            <MatchCard
              key={m.id}
              match={m}
              currentUser={user}
              hideActions={true}
              isKudosed={false}
              kudosCount={0}
              index={idx}
            >
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-3 w-full relative z-10">
                <button
                  onClick={() => revokeMatch(m.id)}
                  disabled={busy}
                  className="px-5 py-2.5 text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl disabled:opacity-50 transition w-full sm:w-auto text-center"
                >
                  Revoke Match
                </button>
                <button
                  onClick={() => deleteMatch(m.id)}
                  disabled={busy}
                  className="px-5 py-2.5 text-sm font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4" /> Delete Match
                </button>
              </div>
            </MatchCard>
          );
        })}
      </div>
    </div>
  );
}


/*  Changelog Viewer                                                 */
