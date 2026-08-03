import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink, Sunset, ArrowUp, ArrowDown
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";
import { optimizeImage } from '@/lib/imageUtils';
import { useAuth } from '@/contexts/AuthContext';

export function PlayersManager() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "profile" | "no-profile" | "pending" | "approved"
  >("profile");
  const [actionId, setActionId] = useState<string | null>(null);
  const { recordAction } = useAdminHistory();
  const { isMainAdmin, updateRole } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const playersRes = await supabase
        .from("players")
        .select(
          "id, full_name, email, department, is_approved, created_at, stats, iisc_email, contact_number, sr_number, role, is_retired",
        )
        .order("created_at", { ascending: false });

      if (!playersRes.error && playersRes.data) {
        setPlayers(playersRes.data as Player[]);
      }

      // Fetch auth users without blocking UI
      const fetchAuthUsers = async () => {
        try {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));
          const funcRes = await Promise.race([
            supabase.functions.invoke("admin-users", { method: "GET" }),
            timeout
          ]) as any;
          if (!funcRes.error && funcRes.data?.users) {
            setAuthUsers(funcRes.data.users as AuthUser[]);
          }
        } catch (err) {
          console.warn("Auth users fetch failed or timed out:", err);
        }
      };
      fetchAuthUsers();
    } catch (err) {
      console.error("Failed to load players list:", err);
      toast.error("Failed to load players list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    const player = players.find((p) => p.id === id);
    const { error } = await supabase.rpc("admin_approve_players", { p_ids: [id], p_approved: true });
    if (error) {
      toast("Approve failed: " + error.message, { icon: "❌" });
    } else {
      toast("Player approved!", { icon: "✅" });
      setPlayers((p) =>
        p.map((pl) => (pl.id === id ? { ...pl, is_approved: true } : pl)),
      );
      await recordAction({
        action_type: "approve",
        entity_type: "players",
        entity_id: id,
        before_state: { is_approved: false },
        after_state: { is_approved: true },
        label: `Approved player: ${player?.full_name ?? id}`,
      });
    }
    setActionId(null);
  };

  const revoke = async (id: string) => {
    setActionId(id);
    const player = players.find((p) => p.id === id);
    const { error } = await supabase.rpc("admin_approve_players", { p_ids: [id], p_approved: false });
    if (error) {
      toast("Revoke failed: " + error.message, { icon: "❌" });
    } else {
      toast("Approval revoked.", { icon: "⚠️" });
      setPlayers((p) =>
        p.map((pl) => (pl.id === id ? { ...pl, is_approved: false } : pl)),
      );
      await recordAction({
        action_type: "revoke",
        entity_type: "players",
        entity_id: id,
        before_state: { is_approved: true },
        after_state: { is_approved: false },
        label: `Revoked approval: ${player?.full_name ?? id}`,
      });
    }
    setActionId(null);
  };

  const approveAllPending = async () => {
    const pendingPlayers = players.filter((p) => !p.is_approved);
    if (pendingPlayers.length === 0) return;
    if (!confirm(`Approve all ${pendingPlayers.length} pending players?`)) return;
    
    const ids = pendingPlayers.map(p => p.id);
    const { error } = await supabase.rpc("admin_approve_players", { p_ids: ids });
    if (error) {
      toast.error("Bulk approve failed: " + error.message);
    } else {
      toast.success(`Approved ${pendingPlayers.length} players!`);
      setPlayers(p => p.map(pl => ids.includes(pl.id) ? { ...pl, is_approved: true } : pl));
    }
  };

  const exportCsv = () => {
    if (players.length === 0) return;
    const headers = ["ID", "Name", "Email", "Department", "Approved", "Created At", "ELO", "Singles", "Doubles", "Mixed"];
    const rows = players.map(p => {
      const elo = p.stats?.elo ?? p.stats?.eloRating ?? "";
      const s = p.stats?.singles ?? "";
      const d = p.stats?.doubles ?? "";
      const xd = p.stats?.mixed ?? "";
      return [
        p.id,
        `"${p.full_name || ""}"`,
        `"${p.email || ""}"`,
        `"${p.department || ""}"`,
        p.is_approved,
        p.created_at,
        elo, s, d, xd
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `players_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeProfile = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete profile for "${name}"? This deletes their player card but NOT their login account.`,
      )
    )
      return;
    setActionId(id);
    const { data, error } = await supabase
      .from("players")
      .delete()
      .eq("id", id)
      .select();
    if (error) {
      toast("Delete failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the deletion.",
      });
    } else {
      toast("Profile deleted.", { icon: "🗑️" });
      setPlayers((p) => p.filter((pl) => pl.id !== id));
    }
    setActionId(null);
  };

  const removeAccount = async (id: string, email: string) => {
    if (
      !confirm(
        `Permanently delete account "${email}"? This will wipe their login and their profile if it exists. Cannot be undone!`,
      )
    )
      return;
    setActionId(id);
    const { error } = await supabase.functions.invoke("admin-users", {
      method: "DELETE",
      body: { userId: id },
    });
    if (error) {
      toast("Delete failed: " + error.message, { icon: "❌" });
    } else {
      toast("Account permanently deleted.", { icon: "🗑️" });
      setAuthUsers((u) => u.filter((user) => user.id !== id));
      setPlayers((p) => p.filter((pl) => pl.id !== id));
    }
    setActionId(null);
  };

  const forceVerify = async (id: string, email: string) => {
    if (!confirm(`Force verify email for "${email}"?`)) return;
    setActionId(id);
    const { error } = await supabase.functions.invoke("admin-users", {
      method: "POST",
      body: { action: "verify", userId: id },
    });
    if (error) {
      toast("Verify failed: " + error.message, { icon: "❌" });
    } else {
      toast("Email verified successfully.", { icon: "✅" });
      setAuthUsers((u) => u.map((user) => user.id === id ? { ...user, email_confirmed_at: new Date().toISOString() } : user));
    }
    setActionId(null);
  };

  const resendVerifyEmail = async (id: string, email: string) => {
    setActionId(id);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      toast("Resend failed: " + error.message, { icon: "❌" });
    } else {
      toast("Verification email resent.", { icon: "✉️" });
    }
    setActionId(null);
  };

  const handleRoleChange = async (id: string, name: string, newRole: string) => {
    if (!confirm(`Change role for "${name}" to ${newRole.toUpperCase()}?`)) return;
    setActionId(id);
    try {
      await updateRole(id, newRole);
      toast("Role updated successfully", { icon: "✅" });
      setPlayers((p) => p.map((pl) => (pl.id === id ? { ...pl, role: newRole } : pl)));
      await recordAction({
        action_type: "update",
        entity_type: "players",
        entity_id: id,
        before_state: { role: players.find(p => p.id === id)?.role },
        after_state: { role: newRole },
        label: `Updated role for ${name} to ${newRole}`,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setActionId(null);
    }
  };

  const retirePlayer = async (id: string, name: string, currentlyRetired: boolean) => {
    if (!currentlyRetired && !confirm(`Mark "${name}" as retired? They will be hidden from matchmaking and challenges will be disabled.`)) return;
    setActionId(id);
    const { error } = await supabase
      .from("players")
      .update({ is_retired: !currentlyRetired })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update retirement status: " + error.message);
    } else {
      toast.success(currentlyRetired ? `${name} unretired.` : `${name} marked as retired.`, { icon: currentlyRetired ? "✅" : "🏅" });
      setPlayers((p) => p.map((pl) => (pl.id === id ? { ...pl, is_retired: !currentlyRetired } : pl)));
      await recordAction({
        action_type: "update",
        entity_type: "players",
        entity_id: id,
        before_state: { is_retired: currentlyRetired },
        after_state: { is_retired: !currentlyRetired },
        label: `${currentlyRetired ? "Unretired" : "Retired"} player: ${name}`,
      });
    }
    setActionId(null);
  };

  const noProfileUsers = authUsers.filter(
    (u) => !players.some((p) => p.id === u.id || (u.email && (p.email === u.email || p.iisc_email === u.email))),
  );

  const [sortField, setSortField] = useState<"name" | "created_at" | "elo" | "singles" | "doubles" | "mixed">("elo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Determine which list to show based on filter
  let displayList: any[] = [];
  if (filter === "no-profile") {
    displayList = noProfileUsers;
  } else {
    displayList = players;
  }

  const playersWithRanks = useMemo(() => {
    const active = players.filter(p => !p.is_retired);
    const sortBy = (getVal: (p: Player) => number) => 
      [...active].sort((a, b) => getVal(b) - getVal(a));

    const getElo = (p: Player) => p.stats?.elo ?? p.stats?.eloRating ?? 0;
    const getS = (p: Player) => p.stats?.singles ?? 0;
    const getD = (p: Player) => p.stats?.doubles ?? 0;
    const getM = (p: Player) => p.stats?.mixed ?? 0;

    const rankedOverall = sortBy(getElo);
    const rankedS = sortBy(getS);
    const rankedD = sortBy(getD);
    const rankedM = sortBy(getM);

    return players.map(p => {
      if (p.is_retired) return { ...p, ranks: { overall: "-", singles: "-", doubles: "-", mixed: "-" } };
      
      const overallRank = rankedOverall.findIndex(x => x.id === p.id) + 1;
      const sRank = rankedS.findIndex(x => x.id === p.id) + 1;
      const dRank = rankedD.findIndex(x => x.id === p.id) + 1;
      const mRank = rankedM.findIndex(x => x.id === p.id) + 1;

      return {
        ...p,
        ranks: {
          overall: getElo(p) > 0 ? `#${overallRank}` : "-",
          singles: getS(p) > 0 ? `#${sRank}` : "-",
          doubles: getD(p) > 0 ? `#${dRank}` : "-",
          mixed: getM(p) > 0 ? `#${mRank}` : "-",
        }
      };
    });
  }, [players]);

  const sortedAndFiltered = useMemo(() => {
    let list = displayList.map(item => {
      if (filter !== "no-profile") {
        return playersWithRanks.find(p => p.id === item.id) || item;
      }
      return item;
    }).filter((item) => {
      const s = search.toLowerCase();
      if (filter === "no-profile") {
        const u = item as AuthUser;
        return !s || u.email?.toLowerCase().includes(s);
      } else {
        const p = item as Player;
        const matchesSearch =
          !s ||
          p.full_name?.toLowerCase().includes(s) ||
          p.email?.toLowerCase().includes(s) ||
          p.department?.toLowerCase().includes(s);
        const matchesFilter =
          filter === "profile" ||
          (filter === "approved" ? p.is_approved : !p.is_approved);
        return matchesSearch && matchesFilter;
      }
    });

    if (filter === "no-profile") return list;

    return list.sort((a, b) => {
      const pa = a as Player & { ranks: any };
      const pb = b as Player & { ranks: any };
      
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === "name") {
        valA = pa.full_name?.toLowerCase() || "";
        valB = pb.full_name?.toLowerCase() || "";
      } else if (sortField === "created_at") {
        valA = new Date(pa.created_at).getTime();
        valB = new Date(pb.created_at).getTime();
      } else if (sortField === "elo") {
        valA = pa.stats?.elo ?? pa.stats?.eloRating ?? 0;
        valB = pb.stats?.elo ?? pb.stats?.eloRating ?? 0;
      } else if (sortField === "singles") {
        valA = pa.stats?.singles ?? 0;
        valB = pb.stats?.singles ?? 0;
      } else if (sortField === "doubles") {
        valA = pa.stats?.doubles ?? 0;
        valB = pb.stats?.doubles ?? 0;
      } else if (sortField === "mixed") {
        valA = pa.stats?.mixed ?? 0;
        valB = pb.stats?.mixed ?? 0;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayList, playersWithRanks, filter, search, sortField, sortDirection]);

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 ml-1">↕</span>;
    return sortDirection === "asc" ? <ArrowUp className="inline w-3 h-3 ml-1 text-primary" /> : <ArrowDown className="inline w-3 h-3 ml-1 text-primary" />;
  };

  const pending = players.filter((p) => !p.is_approved).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          {
            label: "Total Acc",
            value: authUsers.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Profiles",
            value: players.length,
            color: "bg-primary/10 text-primary",
          },
          {
            label: "No Profile",
            value: noProfileUsers.length,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Pending",
            value: pending,
            color: `${pending > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-muted-foreground"}`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border p-3 sm:p-4 flex flex-col items-center justify-center text-center ${s.color}`}
          >
            <div className="text-xl sm:text-2xl font-black leading-none">{s.value}</div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mt-1.5 sm:mt-0.5 leading-tight">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, department..."
            className={`${inputCls} pl-10`}
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button 
             onClick={approveAllPending}
             disabled={pending === 0}
             className="px-3 py-2.5 rounded-xl border border-primary/40 dark:border-primary/80 bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary font-bold text-xs hover:bg-primary/15 disabled:opacity-50 transition mr-2"
          >
             <UserCheck className="w-3.5 h-3.5 inline mr-1" />
             Approve All ({pending})
          </button>
          <button 
             onClick={exportCsv}
             className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-muted-foreground dark:text-slate-300 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition mr-2"
          >
             Download CSV
          </button>
          {(["profile", "no-profile", "pending", "approved"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${filter === f ? "bg-primary text-primary-foreground" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-muted-foreground dark:text-slate-300 hover:border-primary/50"}`}
              >
                {f === "profile"
                  ? "Profile Created"
                  : f === "no-profile"
                    ? "No Profile (Acc Only)"
                    : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ),
          )}
          <button
            onClick={load}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2 overflow-x-auto pb-8">
        {sortedAndFiltered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground dark:text-muted-foreground text-sm font-medium">
            No players found.
          </div>
        )}
        
        {sortedAndFiltered.length > 0 && filter === "no-profile" && (
          <div className="space-y-2">
            {sortedAndFiltered.map((item) => {
              const u = item as AuthUser;
              const busy = actionId === u.id;
              return (
                <div key={u.id} className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground dark:text-foreground">{u.email}</div>
                    <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                      Account Created: {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => removeAccount(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-xs font-bold transition disabled:opacity-50">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Account
                    </button>
                    {!u.email_confirmed_at && (
                      <>
                        <button onClick={() => resendVerifyEmail(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sky-600 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 text-xs font-bold transition disabled:opacity-50">
                          Resend Email
                        </button>
                        <button onClick={() => forceVerify(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-primary bg-primary/10 hover:bg-primary/15 dark:bg-primary/30 dark:hover:bg-primary/80/50 text-xs font-bold transition disabled:opacity-50">
                          Force Verify
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Desktop Table View */}
        {sortedAndFiltered.length > 0 && filter !== "no-profile" && (
          <div className="hidden lg:block overflow-x-auto pb-8">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("name")}>Player <SortIcon field="name" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("created_at")}>Status <SortIcon field="created_at" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("elo")}>Overall (Rank) <SortIcon field="elo" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("singles")}>Singles (Rank) <SortIcon field="singles" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("doubles")}>Doubles (Rank) <SortIcon field="doubles" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("mixed")}>Mixed (Rank) <SortIcon field="mixed" /></th>
                  <th className="p-3 font-bold text-right sticky right-0 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.1)] z-10 border-l border-slate-100 dark:border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {sortedAndFiltered.map((item) => {
                  const p = item as Player & { ranks: any };
                  const busy = actionId === p.id;
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition group">
                      <td className="p-3">
                        <div className="font-bold text-sm text-foreground dark:text-slate-200 whitespace-nowrap">{p.full_name}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground space-x-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={p.email || ""}>
                          {p.email && <span>{p.email}</span>}
                          {p.department && <span>· {p.department}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${p.is_approved ? "bg-primary/15 text-primary dark:bg-primary/30 dark:text-primary" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                            {p.is_approved ? "Approved" : "Pending"}
                          </span>
                          {p.is_retired && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 whitespace-nowrap">
                              Retired
                            </span>
                          )}
                          {isMainAdmin && (
                            <select
                              value={p.role || "player"}
                              onChange={(e) => handleRoleChange(p.id, p.full_name, e.target.value)}
                              disabled={busy}
                              className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-50"
                            >
                              <option value="player">Reg</option>
                              <option value="umpire">Ump</option>
                              <option value="admin">Adm</option>
                              <option value="master_admin">M-Adm</option>
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-foreground dark:text-slate-200">{p.stats?.elo ?? p.stats?.eloRating ?? "-"}</span>
                          {p.ranks?.overall !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.overall}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-foreground dark:text-slate-200">{p.stats?.singles ?? "-"}</span>
                          {p.ranks?.singles !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.singles}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-foreground dark:text-slate-200">{p.stats?.doubles ?? "-"}</span>
                          {p.ranks?.doubles !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.doubles}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-foreground dark:text-slate-200">{p.stats?.mixed ?? "-"}</span>
                          {p.ranks?.mixed !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.mixed}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-right sticky right-0 bg-white dark:bg-[#0B1120] group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/20 transition backdrop-blur shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.1)] border-l border-slate-100 dark:border-slate-800/50 z-10">
                        <div className="flex gap-1.5 shrink-0 justify-end flex-nowrap">
                          {!p.is_approved ? (
                            <button onClick={() => approve(p.id)} disabled={busy} title="Approve" className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 shadow-sm">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button onClick={() => revoke(p.id)} disabled={busy} title="Revoke Approval" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-muted-foreground hover:text-amber-700 text-xs font-bold transition disabled:opacity-50">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => retirePlayer(p.id, p.full_name, !!p.is_retired)} disabled={busy} title={p.is_retired ? "Unretire player" : "Retire player"} className={`p-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${p.is_retired ? "bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                            <Sunset className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeProfile(p.id, p.full_name)} disabled={busy} title="Delete Profile Only" className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards View */}
        {sortedAndFiltered.length > 0 && filter !== "no-profile" && (
          <div className="lg:hidden space-y-3 pb-8">
            {sortedAndFiltered.map((item) => {
               const p = item as Player & { ranks: any };
               const busy = actionId === p.id;
               
               return (
                 <div key={p.id} className={`${cardCls} flex flex-col gap-3 p-4`}>
                    <div className="flex justify-between items-start gap-2">
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-foreground dark:text-foreground truncate text-base">{p.full_name}</div>
                         <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5 truncate">
                           {p.email} {p.department ? `· ${p.department}` : ""}
                         </div>
                       </div>
                       <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${p.is_approved ? "bg-primary/15 text-primary dark:bg-primary/30 dark:text-primary" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
                            {p.is_approved ? "Approved" : "Pending"}
                          </span>
                          {p.is_retired && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 whitespace-nowrap">
                              Retired
                            </span>
                          )}
                       </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-100 dark:border-slate-800/50">
                       <div className="flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Overall (Rank)</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-bold text-sm text-foreground">{p.stats?.elo ?? p.stats?.eloRating ?? "-"}</span>
                            {p.ranks?.overall !== "-" && <span className="text-[9px] text-primary font-black">{p.ranks?.overall}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-slate-100 dark:border-slate-800/50">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Singles (Rank)</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-bold text-sm text-foreground">{p.stats?.singles ?? "-"}</span>
                            {p.ranks?.singles !== "-" && <span className="text-[9px] text-primary font-black">{p.ranks?.singles}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-slate-100 dark:border-slate-800/50">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Doubles (Rank)</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-bold text-sm text-foreground">{p.stats?.doubles ?? "-"}</span>
                            {p.ranks?.doubles !== "-" && <span className="text-[9px] text-primary font-black">{p.ranks?.doubles}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-slate-100 dark:border-slate-800/50">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Mixed (Rank)</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-bold text-sm text-foreground">{p.stats?.mixed ?? "-"}</span>
                            {p.ranks?.mixed !== "-" && <span className="text-[9px] text-primary font-black">{p.ranks?.mixed}</span>}
                          </div>
                       </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex gap-2 justify-between items-center">
                       {isMainAdmin ? (
                          <select
                            value={p.role || "player"}
                            onChange={(e) => handleRoleChange(p.id, p.full_name, e.target.value)}
                            disabled={busy}
                            className="px-2 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-50"
                          >
                            <option value="player">Regular</option>
                            <option value="umpire">Umpire</option>
                            <option value="admin">Admin</option>
                            <option value="master_admin">Master</option>
                          </select>
                       ) : <div />}
                       
                       <div className="flex gap-2 shrink-0 justify-end flex-nowrap">
                          {!p.is_approved ? (
                            <button onClick={() => approve(p.id)} disabled={busy} title="Approve" className="p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 shadow-sm">
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          ) : (
                            <button onClick={() => revoke(p.id)} disabled={busy} title="Revoke Approval" className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 text-muted-foreground hover:text-amber-700 text-xs font-bold transition disabled:opacity-50">
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                            </button>
                          )}
                          <button onClick={() => retirePlayer(p.id, p.full_name, !!p.is_retired)} disabled={busy} title={p.is_retired ? "Unretire player" : "Retire player"} className={`p-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${p.is_retired ? "bg-amber-100 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"}`}>
                            <Sunset className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeProfile(p.id, p.full_name)} disabled={busy} title="Delete Profile Only" className="p-2.5 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 transition disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                 </div>
               )
            })}
          </div>
        )}
      </div>
    </div>
  );
}


/*  Umpire Mode — re-exported from dedicated module                  */
