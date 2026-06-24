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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [playersRes, funcRes] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, full_name, email, department, is_approved, created_at, stats, iisc_email, contact_number, sr_number",
          )
          .order("created_at", { ascending: false }),
        supabase.functions.invoke("admin-users", { method: "GET" }),
      ]);

      if (!playersRes.error && playersRes.data)
        setPlayers(playersRes.data as Player[]);
      if (!funcRes.error && funcRes.data?.users)
        setAuthUsers(funcRes.data.users as AuthUser[]);
    } catch (err) {
      console.error("Failed to load accounts:", err);
      toast.error(
        "Failed to load full account list. Is the admin-users edge function deployed?",
      );
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
    const { data, error } = await supabase
      .from("players")
      .update({ is_approved: true })
      .eq("id", id)
      .select();
    if (error) {
      toast("Approve failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the update.",
      });
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
    const { data, error } = await supabase
      .from("players")
      .update({ is_approved: false })
      .eq("id", id)
      .select();
    if (error) {
      toast("Revoke failed: " + error.message, { icon: "❌" });
    } else if (!data || data.length === 0) {
      toast("Permission Denied", {
        icon: "❌",
        description: "Database RLS policy blocked the update.",
      });
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
    const { error } = await supabase.from("players").update({ is_approved: true }).in("id", ids);
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

  const noProfileUsers = authUsers.filter(
    (u) => !players.some((p) => p.id === u.id),
  );

  // Determine which list to show based on filter
  let displayList: any[] = [];
  if (filter === "no-profile") {
    displayList = noProfileUsers;
  } else {
    displayList = players;
  }

  const filtered = displayList.filter((item) => {
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

  const pending = players.filter((p) => !p.is_approved).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total Acc",
            value: authUsers.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Profiles",
            value: players.length,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "No Profile",
            value: noProfileUsers.length,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Pending",
            value: pending,
            color: `${pending > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl border p-4 text-center ${s.color}`}
          >
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
             className="px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-100 disabled:opacity-50 transition mr-2"
          >
             <UserCheck className="w-3.5 h-3.5 inline mr-1" />
             Approve All ({pending})
          </button>
          <button 
             onClick={exportCsv}
             className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition mr-2"
          >
             Download CSV
          </button>
          {(["profile", "no-profile", "pending", "approved"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${filter === f ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300"}`}
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
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm font-medium">
            No players found.
          </div>
        )}
        {filtered.map((item) => {
          if (filter === "no-profile") {
            const u = item as AuthUser;
            const busy = actionId === u.id;
            return (
              <div
                key={u.id}
                className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {u.email}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Account Created:{" "}
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => removeAccount(u.id, u.email)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete Account
                  </button>
                </div>
              </div>
            );
          }

          // Normal profile row
          const p = item as Player;
          const elo = p.stats?.elo ?? p.stats?.eloRating ?? null;
          const busy = actionId === p.id;
          return (
            <div
              key={p.id}
              className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {p.full_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.is_approved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}
                  >
                    {p.is_approved ? "Approved" : "Pending"}
                  </span>
                  {elo && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-bold">
                      ELO {elo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 space-x-2">
                  {p.email && <span>{p.email}</span>}
                  {p.department && <span>· {p.department}</span>}
                  {p.sr_number && <span>· SR# {p.sr_number}</span>}
                  {p.contact_number && <span>· {p.contact_number}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {!p.is_approved ? (
                  <button
                    onClick={() => approve(p.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    Approve
                  </button>
                ) : (
                  <button
                    onClick={() => revoke(p.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-600 dark:text-slate-300 hover:text-amber-700 text-xs font-bold transition disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    Revoke
                  </button>
                )}
                <button
                  onClick={() => removeProfile(p.id, p.full_name)}
                  disabled={busy}
                  title="Delete Profile Only"
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeAccount(p.id, p.email || p.full_name)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100 dark:hover:bg-rose-950/20 text-xs font-bold transition disabled:opacity-50"
                >
                  Delete Account
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/*  Umpire Mode — re-exported from dedicated module                  */
