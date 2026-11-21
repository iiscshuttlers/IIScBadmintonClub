import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink, Sunset, ArrowUp, ArrowDown
} from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/services/adminService";
import { playerService } from "@/services/playerService";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";
import { optimizeImage } from '@/lib/imageUtils';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmContext";
import { AdminLoading, AdminEmptyState } from "../AdminPanel";

export function PlayersManager() {
  const { confirm } = useConfirm();
  const [players, setPlayers] = useState<Player[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "profile" | "no-profile" | "pending" | "approved"
  >("profile");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmStyle: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  } | null>(null);
  const { recordAction, softDelete } = useAdminHistory();
  const { isMainAdmin, updateRole } = useAuth();

  const showConfirm = (action: typeof confirmAction) => setConfirmAction(action);
  const dismissConfirm = () => setConfirmAction(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const playersRes = await adminService.getPlayersForAdmin();
      setPlayers(playersRes as Player[]);

      // Fetch auth users without blocking UI
      const fetchAuthUsers = async () => {
        try {
          const users = await adminService.fetchAuthUsers();
          setAuthUsers(users as AuthUser[]);
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
    try {
      await adminService.approvePlayers([id], true);
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
    } catch (error: any) {
      toast("Approve failed: " + error.message, { icon: "❌" });
    }
    setActionId(null);
  };

  const revoke = async (id: string) => {
    setActionId(id);
    const player = players.find((p) => p.id === id);
    try {
      await adminService.approvePlayers([id], false);
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
    } catch (error: any) {
      toast("Revoke failed: " + error.message, { icon: "❌" });
    }
    setActionId(null);
  };

  const approveAllPending = async () => {
    const pendingPlayers = players.filter((p) => !p.is_approved);
    if (pendingPlayers.length === 0) return;
    
    showConfirm({
      title: 'Approve All Pending',
      message: `Approve all ${pendingPlayers.length} pending players?`,
      confirmLabel: 'Approve All',
      confirmStyle: 'default',
      onConfirm: async () => {
        const ids = pendingPlayers.map(p => p.id);
        try {
          await adminService.approvePlayers(ids, true);
          toast.success(`Approved ${pendingPlayers.length} players!`);
          setPlayers(p => p.map(pl => ids.includes(pl.id) ? { ...pl, is_approved: true } : pl));
        } catch (error: any) {
          toast.error("Bulk approve failed: " + error.message);
        }
      }
    });
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
    showConfirm({
      title: 'Move to Recycle Bin',
      message: `Delete profile for "${name}"? This deletes their player card but NOT their login account.`,
      confirmLabel: 'Move to Recycle Bin',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setActionId(id);
        try {
          const data = await playerService.fetchPlayer(id);
          if (!data) {
            toast.error("Could not fetch player data");
            setActionId(null);
            return;
          }
          await softDelete("players", id, data, `Player Profile: ${name}`);
          toast("Profile moved to recycle bin.", { icon: "🗑️" });
          setPlayers((p) => p.filter((pl) => pl.id !== id));
        } catch (error: any) {
          if (error.code === "23503" || error.message?.includes("foreign key constraint")) {
            toast("Cannot Delete Player", {
              icon: "❌",
              description: "They have participated in matches or tournaments. Please retire them instead.",
            });
          } else {
            toast("Delete failed: " + error.message, { icon: "❌" });
          }
        }
        setActionId(null);
      }
    });
  };

  const removeAccount = async (id: string, email: string) => {
    showConfirm({
      title: 'Delete Account',
      message: `Permanently delete account "${email}"? This will wipe their login and their profile if it exists. Cannot be undone!`,
      confirmLabel: 'Permanently Delete',
      confirmStyle: 'danger',
      onConfirm: async () => {
        setActionId(id);
        try {
          await adminService.deleteAuthUser(id);
          toast("Account permanently deleted.", { icon: "🗑️" });
          setAuthUsers((u) => u.filter((user) => user.id !== id));
          setPlayers((p) => p.filter((pl) => pl.id !== id));
        } catch (error: any) {
          toast("Delete failed: " + error.message, { icon: "❌" });
        }
        setActionId(null);
      }
    });
  };

  const forceVerify = async (id: string, email: string) => {
    showConfirm({
      title: 'Force Verify Email',
      message: `Force verify email for "${email}"?`,
      confirmLabel: 'Verify Email',
      confirmStyle: 'warning',
      onConfirm: async () => {
        setActionId(id);
        try {
          await adminService.verifyAuthUser(id);
          toast("Email verified successfully.", { icon: "✅" });
          setAuthUsers((u) => u.map((user) => user.id === id ? { ...user, email_confirmed_at: new Date().toISOString() } : user));
        } catch (error: any) {
          toast("Verify failed: " + error.message, { icon: "❌" });
        }
        setActionId(null);
      }
    });
  };

  const resendVerifyEmail = async (id: string, email: string) => {
    setActionId(id);
    try {
      await adminService.resendAuthVerification(email);
      toast("Verification email resent.", { icon: "✉️" });
    } catch (error: any) {
      toast("Resend failed: " + error.message, { icon: "❌" });
    }
    setActionId(null);
  };

  const handleRoleChange = (id: string, name: string, newRole: string) => {
    const roleLabel: Record<string, string> = { user: 'Regular', umpire: 'Umpire', admin: 'Admin', master_admin: 'Master Admin' };
    showConfirm({
      title: 'Change Role',
      message: `Change role for "${name}" to ${roleLabel[newRole] ?? newRole}?${
        newRole === 'master_admin' ? '\n\n⚠️ Warning: Master Admin grants full system control.' : ''
      }`,
      confirmLabel: 'Yes, Change Role',
      confirmStyle: newRole === 'master_admin' ? 'danger' : newRole === 'admin' ? 'warning' : 'default',
      onConfirm: async () => {
        setActionId(id);
        try {
          await updateRole(id, newRole);
          toast('Role updated successfully', { icon: '✅' });
          setPlayers((p) => p.map((pl) => (pl.id === id ? { ...pl, role: newRole } : pl)));
          await recordAction({
            action_type: 'update',
            entity_type: 'players',
            entity_id: id,
            before_state: { role: players.find(p => p.id === id)?.role },
            after_state: { role: newRole },
            label: `Updated role for ${name} to ${newRole}`,
          });
        } catch (err: any) {
          toast.error(err.message || 'Failed to update role');
        } finally {
          setActionId(null);
        }
      },
    });
  };

  const doRetirePlayer = async (id: string, name: string, currentlyRetired: boolean) => {
    setActionId(id);
    try {
      await adminService.updatePlayerRetirement(id, !currentlyRetired);
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
    } catch (error: any) {
      toast.error("Failed to update retirement status: " + error.message);
    }
    setActionId(null);
  };

  const retirePlayer = (id: string, name: string, currentlyRetired: boolean) => {
    if (!currentlyRetired) {
      showConfirm({
        title: 'Retire Player',
        message: `Mark "${name}" as retired?\n\nThey will be hidden from matchmaking and all challenges will be disabled.`,
        confirmLabel: 'Yes, Retire',
        confirmStyle: 'danger',
        onConfirm: () => doRetirePlayer(id, name, false),
      });
    } else {
      doRetirePlayer(id, name, true);
    }
  };

  const noProfileUsers = authUsers.filter(
    (u) => !players.some((p) => p.id === u.id || (u.email && (p.email === u.email || p.iisc_email === u.email))),
  );

  const [sortField, setSortField] = useState<"name" | "created_at" | "elo" | "singles" | "doubles" | "mixed">("elo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const toggleSelect = (id: string) => {
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const bulkApprove = async (approved: boolean) => {
    const ok = await confirm({ title: "Confirm", description: `Bulk ${approved ? 'approve' : 'revoke'} ${selectedPlayers.length} players?`, confirmLabel: "Confirm", confirmVariant: approved ? "primary" : "danger" });
    if (!ok) return;
    setLoading(true);
    try {
      await adminService.approvePlayers(selectedPlayers, approved);
      toast.success("Success");
      for (const id of selectedPlayers) {
        await recordAction({
          action_type: approved ? "approve" : "revoke",
          entity_type: "players",
          entity_id: id,
          before_state: { is_approved: !approved },
          after_state: { is_approved: approved },
          label: `Bulk ${approved ? 'Approved' : 'Revoked'} player: ${players.find(p => p.id === id)?.full_name ?? id}`,
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    }
    await load();
    setSelectedPlayers([]);
    setLoading(false);
  };

  const bulkRetire = async (retired: boolean) => {
    const ok = await confirm({ title: "Confirm", description: `Bulk ${retired ? 'retire' : 'restore'} ${selectedPlayers.length} players?`, confirmLabel: "Confirm", confirmVariant: "danger" });
    if (!ok) return;
    setLoading(true);
    try {
      await adminService.bulkRetirePlayers(selectedPlayers, retired);
      toast.success("Success");
      for (const id of selectedPlayers) {
        await recordAction({
          action_type: "update",
          entity_type: "players",
          entity_id: id,
          before_state: { is_retired: !retired },
          after_state: { is_retired: retired },
          label: `Bulk ${retired ? 'Retired' : 'Restored'} player: ${players.find(p => p.id === id)?.full_name ?? id}`,
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    }
    await load();
    setSelectedPlayers([]);
    setLoading(false);
  };

  const bulkDelete = async () => {
    const ok = await confirm({ title: "Delete Players", description: `Delete ${selectedPlayers.length} players? (Accounts with matches will be skipped)`, confirmLabel: "Delete", confirmVariant: "danger" });
    if (!ok) return;
    setLoading(true);
    let success = 0, failed = 0;
    for (const id of selectedPlayers) {
       const player = players.find(p => p.id === id);
       if (!player) continue;
       try {
         const data = await playerService.fetchPlayer(id);
         if (!data) { failed++; continue; }
         await softDelete("players", id, data, `Player Profile: ${player.full_name}`);
         success++;
       } catch (err: any) {
         failed++;
       }
    }
    toast.success(`Deleted ${success}, Skipped ${failed}`);
    await load();
    setSelectedPlayers([]);
    setLoading(false);
  };

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
        const matchesGender = genderFilter === "all" || (p.gender && p.gender.toLowerCase() === genderFilter);
        return matchesSearch && matchesFilter && matchesGender;
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
  }, [displayList, playersWithRanks, filter, genderFilter, search, sortField, sortDirection]);

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-muted-foreground opacity-0 group-hover:opacity-100 ml-1">↕</span>;
    return sortDirection === "asc" ? <ArrowUp className="inline w-3 h-3 ml-1 text-primary" /> : <ArrowDown className="inline w-3 h-3 ml-1 text-primary" />;
  };

  const pending = players.filter((p) => !p.is_approved).length;

  if (loading)
    return <AdminLoading label="Loading players…" />;

  return (
    <div className="space-y-4">
      {/* ── In-app Confirmation Modal ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={dismissConfirm}>
          <div className="absolute inset-0 bg-media/60 backdrop-blur-sm" />
          <div
            className="relative bg-card rounded-2xl shadow-2xl border border-border-strong w-full max-w-sm p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              confirmAction.confirmStyle === 'danger' ? 'bg-danger/10' :
              confirmAction.confirmStyle === 'warning' ? 'bg-warning/10' :
              'bg-primary/10'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                confirmAction.confirmStyle === 'danger' ? 'text-danger' :
                confirmAction.confirmStyle === 'warning' ? 'text-warning' :
                'text-primary'
              }`} />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-lg text-foreground">{confirmAction.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{confirmAction.message}</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={dismissConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border-strong text-sm font-semibold text-muted-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { dismissConfirm(); confirmAction.onConfirm(); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                  confirmAction.confirmStyle === 'danger' ? 'bg-danger hover:bg-danger/90 text-danger-foreground' :
                  confirmAction.confirmStyle === 'warning' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' :
                  'bg-primary hover:bg-primary/90 text-primary-foreground'
                }`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          {
            label: "Total Acc",
            value: authUsers.length,
            color: "bg-info/10 text-info",
          },
          {
            label: "Profiles",
            value: players.length,
            color: "bg-primary/10 text-primary",
          },
          {
            label: "No Profile",
            value: noProfileUsers.length,
            color: "bg-warning/10 text-warning",
          },
          {
            label: "Pending",
            value: pending,
            color: `${pending > 0 ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"}`,
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

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4">
        {/* Row 1: Search and Actions */}
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
          <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <button 
               onClick={approveAllPending}
               disabled={pending === 0}
               className="flex-1 sm:flex-none justify-center px-3 py-2.5 rounded-xl border border-primary/80 bg-primary/30 text-primary font-bold text-xs hover:bg-primary/15 disabled:opacity-50 transition flex items-center"
            >
               <UserCheck className="w-3.5 h-3.5 mr-1.5" />
               Approve All ({pending})
            </button>
            <button 
               onClick={exportCsv}
               className="flex-1 sm:flex-none justify-center px-3 py-2.5 rounded-xl border border-border-strong bg-card text-soft font-bold text-xs hover:bg-muted disabled:opacity-50 transition"
            >
               Download CSV
            </button>
            <button aria-label="Refresh players"
              onClick={load}
              className="px-3 py-2.5 rounded-xl border border-border-strong bg-card hover:bg-muted transition"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Row 2: Tabs and Dropdowns */}
        <div className="flex flex-col xl:flex-row justify-between gap-3 items-start xl:items-center w-full min-w-0 overflow-hidden">
          {/* View Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full xl:w-auto shrink-0">
            {(["profile", "pending", "approved", "no-profile"] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex items-center justify-center text-center px-2 py-2 rounded-xl text-xs font-bold transition sm:whitespace-nowrap sm:shrink-0 ${filter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                >
                  {f === "profile"
                    ? "Profile Created"
                    : f === "no-profile"
                      ? "No Profile (Acc Only)"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ),
            )}
          </div>

          {/* Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto shrink-0 min-w-0">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
              className="flex-1 sm:flex-none min-w-0 px-3 py-2 rounded-xl border border-border-strong bg-card text-soft font-bold text-xs focus:ring-2 focus:ring-primary outline-none transition"
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-");
                setSortField(field as any);
                setSortDirection(dir as "asc" | "desc");
              }}
              className="flex-1 sm:flex-none min-w-0 lg:hidden px-3 py-2 rounded-xl border border-border-strong bg-card text-soft font-bold text-xs focus:ring-2 focus:ring-primary outline-none transition"
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="created_at-desc">Sort: Status (Newest)</option>
              <option value="created_at-asc">Sort: Status (Oldest)</option>
              <option value="elo-desc">Sort: Overall Rank (High to Low)</option>
              <option value="elo-asc">Sort: Overall Rank (Low to High)</option>
              <option value="singles-desc">Sort: Singles Rank (High to Low)</option>
              <option value="doubles-desc">Sort: Doubles Rank (High to Low)</option>
              <option value="mixed-desc">Sort: Mixed Rank (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2 overflow-x-auto pb-8">
        {selectedPlayers.length > 0 && filter !== "no-profile" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-primary/10 rounded-xl mb-4">
            <span className="text-sm font-bold text-primary flex-1 min-w-[120px]">
              {selectedPlayers.length} selected
            </span>
            <button onClick={() => bulkApprove(true)} className="px-3 py-1.5 text-xs font-bold text-success bg-success/10 hover:bg-success/15 rounded-lg transition flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Approve
            </button>
            <button onClick={() => bulkApprove(false)} className="px-3 py-1.5 text-xs font-bold text-warning bg-warning/10 hover:bg-warning/15 rounded-lg transition flex items-center gap-1">
              <UserX className="w-3 h-3" /> Revoke
            </button>
            <button onClick={() => bulkRetire(true)} className="px-3 py-1.5 text-xs font-bold text-background bg-soft hover:bg-soft/90 rounded-lg transition flex items-center gap-1">
              <Sunset className="w-3 h-3" /> Retire
            </button>
            <button onClick={() => bulkDelete()} className="px-3 py-1.5 text-xs font-bold text-danger bg-danger/10 hover:bg-danger/15 rounded-lg transition flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button onClick={() => setSelectedPlayers([])} className="px-3 py-1.5 text-xs font-bold text-background bg-soft hover:bg-soft/90 rounded-lg transition flex items-center gap-1">
              Clear
            </button>
          </div>
        )}
        {sortedAndFiltered.length === 0 && (
          <AdminEmptyState
            icon={Search}
            title="No players found"
            description="Try a different search term or switch the filter above."
          />
        )}
        
        {sortedAndFiltered.length > 0 && filter === "no-profile" && (
          <div className="space-y-2">
            {sortedAndFiltered.map((item) => {
              const u = item as AuthUser;
              const busy = actionId === u.id;
              return (
                <div key={u.id} className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-center`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Account Created: {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => removeAccount(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-danger bg-danger/10 hover:bg-danger/10 text-xs font-bold transition disabled:opacity-50">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Account
                    </button>
                    {!u.email_confirmed_at && (
                      <>
                        <button onClick={() => resendVerifyEmail(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-info bg-info/10 hover:bg-info/20 text-xs font-bold transition disabled:opacity-50">
                          Resend Email
                        </button>
                        <button onClick={() => forceVerify(u.id, u.email)} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-primary bg-primary/30 hover:bg-primary/40 text-xs font-bold transition disabled:opacity-50">
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
                <tr className="border-b border-border text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-3 w-10">
                    <input 
                      type="checkbox" 
                      checked={sortedAndFiltered.length > 0 && selectedPlayers.length === sortedAndFiltered.length}
                      onChange={() => {
                        if (selectedPlayers.length === sortedAndFiltered.length) setSelectedPlayers([]);
                        else setSelectedPlayers(sortedAndFiltered.map(p => (p as Player).id));
                      }}
                      className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("name")}>Player <SortIcon field="name" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("created_at")}>Status <SortIcon field="created_at" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("elo")}>Overall (Rank) <SortIcon field="elo" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("singles")}>Singles (Rank) <SortIcon field="singles" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("doubles")}>Doubles (Rank) <SortIcon field="doubles" /></th>
                  <th className="p-3 font-bold cursor-pointer hover:text-foreground group select-none whitespace-nowrap" onClick={() => handleSort("mixed")}>Mixed (Rank) <SortIcon field="mixed" /></th>
                  <th className="p-3 font-bold text-right sticky right-0 bg-background/90 backdrop-blur shadow-[-8px_0_12px_-8px_color-mix(in_srgb,var(--scrim)_15%,transparent)] z-10 border-l border-border">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedAndFiltered.map((item) => {
                  const p = item as Player & { ranks: any };
                  const busy = actionId === p.id;
                  
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition group">
                      <td className="p-3">
                        <input 
                          type="checkbox" 
                          checked={selectedPlayers.includes(p.id)} 
                          onChange={() => toggleSelect(p.id)} 
                          className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-3">
                        <Link href={`/player/${p.id}`} className="block font-bold text-sm text-soft whitespace-nowrap hover:text-primary transition cursor-pointer">{p.full_name}</Link>
                        <div className="text-[10px] sm:text-xs text-muted-foreground space-x-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={p.email || ""}>
                          {p.email && <span>{p.email}</span>}
                          {p.department && <span>· {p.department}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${p.is_approved ? "bg-primary/30 text-primary" : "bg-warning/10 text-warning"}`}>
                            {p.is_approved ? "Approved" : "Pending"}
                          </span>
                          {p.is_retired && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-danger/10 text-danger whitespace-nowrap">
                              Retired
                            </span>
                          )}
                          {isMainAdmin && (
                            <div className="relative inline-block ml-1">
                              <select
                                value={p.role || "user"}
                                onChange={(e) => handleRoleChange(p.id, p.full_name, e.target.value)}
                                disabled={busy}
                                className={cn(
                                  "appearance-none px-2 pr-5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 cursor-pointer shadow-sm border",
                                  p.role === "master_admin" ? "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20" :
                                  p.role === "admin" ? "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20" :
                                  p.role === "umpire" ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" :
                                  "bg-muted text-muted-foreground border-border-strong hover:bg-muted-strong"
                                )}
                              >
                                <option value="user" className="bg-card text-soft">Reg</option>
                                <option value="umpire" className="bg-card text-soft">Ump</option>
                                <option value="admin" className="bg-card text-soft">Adm</option>
                                <option value="master_admin" className="bg-card text-soft">M-Adm</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 opacity-50">
                                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-soft">{p.stats?.elo ?? p.stats?.eloRating ?? "-"}</span>
                          {p.ranks?.overall !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.overall}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-soft">{p.stats?.singles ?? "-"}</span>
                          {p.ranks?.singles !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.singles}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-soft">{p.stats?.doubles ?? "-"}</span>
                          {p.ranks?.doubles !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.doubles}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-sm text-soft">{p.stats?.mixed ?? "-"}</span>
                          {p.ranks?.mixed !== "-" && <span className="text-[10px] text-primary font-black tracking-tighter">{p.ranks?.mixed}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-right sticky right-0 bg-background group-hover:bg-muted/20 transition backdrop-blur shadow-[-8px_0_12px_-8px_color-mix(in_srgb,var(--scrim)_15%,transparent)] border-l border-border/50 z-10">
                        <div className="flex gap-1.5 shrink-0 justify-end flex-nowrap">
                          {!p.is_approved ? (
                            <button onClick={() => approve(p.id)} disabled={busy} title="Approve" className="p-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition disabled:opacity-50 shadow-sm">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button onClick={() => revoke(p.id)} disabled={busy} title="Revoke Approval" className="p-2 rounded-xl bg-muted hover:bg-warning/10 text-muted-foreground hover:text-warning text-xs font-bold transition disabled:opacity-50">
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => retirePlayer(p.id, p.full_name, !!p.is_retired)} disabled={busy} title={p.is_retired ? "Unretire player" : "Retire player"} className={`p-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${p.is_retired ? "bg-warning/10 text-warning hover:bg-warning/15" : "bg-muted text-muted-foreground hover:bg-muted-strong"}`}>
                            <Sunset className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeProfile(p.id, p.full_name)} disabled={busy} title="Delete Profile Only" className="p-2 rounded-xl text-danger hover:bg-danger/10 transition disabled:opacity-50">
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
                 <div key={p.id} className={`${cardCls} flex flex-col gap-3 p-4 relative`}>
                    <div className="absolute top-4 right-4">
                       <input 
                          type="checkbox" 
                          checked={selectedPlayers.includes(p.id)} 
                          onChange={() => toggleSelect(p.id)} 
                          className="w-4 h-4 rounded border-border-strong text-primary focus:ring-primary"
                        />
                    </div>
                    <div className="flex justify-between items-start gap-2 pr-8">
                       <div className="flex-1 min-w-0">
                         <Link href={`/player/${p.id}`} className="block font-black text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground truncate text-lg tracking-tight pb-0.5 hover:opacity-80 transition cursor-pointer">{p.full_name}</Link>
                         <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs mt-0.5 min-w-0">
                           <span className="truncate text-info font-medium">{p.email}</span>
                           {p.department && (
                             <div className="flex items-center min-w-0">
                               <span className="truncate font-bold text-[9px] uppercase tracking-wider text-success bg-success/20 px-2 py-0.5 rounded-full">{p.department}</span>
                             </div>
                           )}
                         </div>
                       </div>
                       <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${p.is_approved ? "bg-primary/30 text-primary" : "bg-warning/10 text-warning"}`}>
                            {p.is_approved ? "Approved" : "Pending"}
                          </span>
                          {p.is_retired && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-danger/10 text-danger whitespace-nowrap">
                              Retired
                            </span>
                          )}
                       </div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-1 py-3 border-y border-border/50 bg-card/20 rounded-xl px-1">
                       <div className="flex flex-col items-center justify-center text-center">
                          <span className="text-[9px] text-warning uppercase font-extrabold tracking-wider">Overall</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-sm text-foreground">{p.stats?.elo ?? p.stats?.eloRating ?? "-"}</span>
                            {p.ranks?.overall !== "-" && <span className="text-[10px] text-warning font-black tracking-tighter">#{p.ranks?.overall}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-border-strong/50">
                          <span className="text-[9px] text-info uppercase font-extrabold tracking-wider">Singles</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-sm text-foreground">{p.stats?.singles ?? "-"}</span>
                            {p.ranks?.singles !== "-" && <span className="text-[10px] text-info font-black tracking-tighter">#{p.ranks?.singles}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-border-strong/50">
                          <span className="text-[9px] text-info uppercase font-extrabold tracking-wider">Doubles</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-sm text-foreground">{p.stats?.doubles ?? "-"}</span>
                            {p.ranks?.doubles !== "-" && <span className="text-[10px] text-info font-black tracking-tighter">#{p.ranks?.doubles}</span>}
                          </div>
                       </div>
                       <div className="flex flex-col items-center justify-center text-center border-l border-border-strong/50">
                          <span className="text-[9px] text-individual uppercase font-extrabold tracking-wider">Mixed</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-sm text-foreground">{p.stats?.mixed ?? "-"}</span>
                            {p.ranks?.mixed !== "-" && <span className="text-[10px] text-individual font-black tracking-tighter">#{p.ranks?.mixed}</span>}
                          </div>
                       </div>
                    </div>

                    {/* Actions Row */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                       {isMainAdmin && (
                          <select
                            value={p.role || "user"}
                            onChange={(e) => handleRoleChange(p.id, p.full_name, e.target.value)}
                            disabled={busy}
                            className="w-full px-2 py-2 rounded-xl text-xs font-bold bg-info/10 border border-info/30 text-info outline-none focus:ring-1 focus:ring-info transition disabled:opacity-50 h-full"
                          >
                            <option value="user">Regular</option>
                            <option value="umpire">Umpire</option>
                            <option value="admin">Admin</option>
                            <option value="master_admin">Master</option>
                          </select>
                       )}
                       
                        {!p.is_approved ? (
                          <button onClick={() => approve(p.id)} disabled={busy} title="Approve" className="flex justify-center items-center gap-1.5 p-2.5 rounded-xl bg-success/10 hover:bg-success/15 text-success text-xs font-bold transition disabled:opacity-50 shadow-sm w-full">
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            <span>Approve</span>
                          </button>
                        ) : (
                          <button onClick={() => revoke(p.id)} disabled={busy} title="Revoke Approval" className="flex justify-center items-center gap-1.5 p-2.5 rounded-xl bg-warning/10 hover:bg-warning/15 text-warning text-xs font-bold transition disabled:opacity-50 w-full">
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                            <span>Revoke</span>
                          </button>
                        )}
                        <button onClick={() => retirePlayer(p.id, p.full_name, !!p.is_retired)} disabled={busy} title={p.is_retired ? "Unretire player" : "Retire player"} className={`flex justify-center items-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 w-full ${p.is_retired ? "bg-success/10 text-success hover:bg-success/10" : "bg-secondary/10 hover:bg-secondary/10 text-secondary"}`}>
                          <Sunset className="w-3.5 h-3.5" />
                          <span>{p.is_retired ? "Unretire" : "Retire"}</span>
                        </button>
                        <button onClick={() => removeProfile(p.id, p.full_name)} disabled={busy} title="Delete Profile Only" className="flex justify-center items-center gap-1.5 p-2.5 rounded-xl bg-danger/10 hover:bg-danger/15 text-danger transition disabled:opacity-50 w-full">
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
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
