import React, { useState, useEffect, useMemo } from "react";
import { Shield, ShieldAlert, ShieldCheck, User, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { playerService } from "@/services/playerService";
import { adminService } from "@/services/adminService";
import { PlayerRow as Player } from "@/types/player";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";

const ROLE_OPTIONS = [
  { value: "user", label: "Standard User" },
  { value: "umpire", label: "Umpire" },
  { value: "admin", label: "Admin" },
  { value: "master_admin", label: "Master Admin" },
];

export function RoleManagerPanel() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { confirm } = useConfirm();

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await playerService.fetchPlayerList();
      setPlayers(data);
    } catch (err: any) {
      toast.error("Failed to load players: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (id: string, newRole: string) => {
    if (newRole === "master_admin") {
      if (!(await confirm({
        title: 'Promote to Master Admin',
        description: 'WARNING: Promoting a user to Master Admin grants them full system control. Continue?',
        confirmVariant: 'danger',
        confirmLabel: 'Promote'
      }))) return;
    }
    if (newRole === "user") {
      if (!(await confirm({
        title: 'Demote User',
        description: 'Are you sure you want to demote this user? They will lose all elevated privileges.',
        confirmVariant: 'danger',
        confirmLabel: 'Demote'
      }))) return;
    }

    setActionId(id);
    try {
      await adminService.updatePlayerRole(id, newRole);

      setPlayers(p => p.map(player => player.id === id ? { ...player, role: newRole as any } : player));
      toast.success(`Role updated successfully`);
    } catch (err: any) {
      toast.error("Failed to update role: " + err.message);
    } finally {
      setActionId(null);
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'master_admin': return <ShieldAlert className="w-5 h-5 text-danger" />;
      case 'admin': return <ShieldCheck className="w-5 h-5 text-individual" />;
      case 'umpire': return <Shield className="w-5 h-5 text-info" />;
      default: return <User className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatRole = (role?: string) => {
    if (!role || role === 'user') return 'Standard User';
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const elevatedUsers = useMemo(() => {
    return players.filter(p => p.role && (p.role as string) !== 'user');
  }, [players]);

  const masterAdmins = useMemo(() => elevatedUsers.filter(p => p.role === 'master_admin'), [elevatedUsers]);
  const admins = useMemo(() => elevatedUsers.filter(p => p.role === 'admin'), [elevatedUsers]);
  const umpires = useMemo(() => elevatedUsers.filter(p => p.role === 'umpire'), [elevatedUsers]);

  // Search spans ALL users (standard and elevated) so any account can be found and managed.
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return players.filter(p =>
      p.full_name?.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50);
  }, [players, search]);

  const RoleDropdown = ({ user }: { user: Player }) => (
    <select
      value={user.role || "user"}
      onChange={(e) => updateRole(user.id, e.target.value)}
      disabled={actionId === user.id || user.id === profile?.id}
      title={user.id === profile?.id ? "You cannot change your own role" : "Change role"}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted text-soft border border-border-strong hover:bg-muted-strong transition-colors disabled:opacity-50 cursor-pointer"
    >
      {ROLE_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const UserRow = ({ user }: { user: Player }) => (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/50">
      <div className="flex items-center gap-3">
        {getRoleIcon(user.role)}
        <div>
          <div className="font-semibold text-foreground flex items-center gap-2">
            {user.full_name}
            {user.id === profile?.id && (
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-primary/20 text-primary">You</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{user.email} • {formatRole(user.role)}</div>
        </div>
      </div>
      <RoleDropdown user={user} />
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Search & Manage Section */}
      <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Manage User Roles</h2>
            <p className="text-sm text-muted-foreground">Search any user by name to promote or change their role</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-border bg-transparent focus:border-primary focus:outline-none transition-colors text-foreground"
          />
        </div>

        {search.trim() && (
          <div className="space-y-3">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found matching "{search}"</div>
            ) : (
              searchResults.map(user => <UserRow key={user.id} user={user} />)
            )}
          </div>
        )}
      </div>

      {/* Elevated Accounts, grouped by role */}
      <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-warning/10 rounded-2xl text-warning">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Elevated Accounts</h2>
            <p className="text-sm text-muted-foreground">System Administrators and Umpires</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-danger mb-3">
              <ShieldAlert className="w-4 h-4" /> Master Admins ({masterAdmins.length})
            </h3>
            {masterAdmins.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No Master Admins</div>
            ) : (
              <div className="space-y-3">
                {masterAdmins.map(user => <UserRow key={user.id} user={user} />)}
              </div>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-individual mb-3">
              <ShieldCheck className="w-4 h-4" /> Admins ({admins.length})
            </h3>
            {admins.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No Admins</div>
            ) : (
              <div className="space-y-3">
                {admins.map(user => <UserRow key={user.id} user={user} />)}
              </div>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-info mb-3">
              <Shield className="w-4 h-4" /> Umpires ({umpires.length})
            </h3>
            {umpires.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No Umpires</div>
            ) : (
              <div className="space-y-3">
                {umpires.map(user => <UserRow key={user.id} user={user} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
