import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { toast } from "sonner";
import { PlayerSelect } from "@/components/ui/PlayerSelect";
import { Loader2, Plus, Trash2, Gavel, Flag, UserCog, ShieldCheck, X } from "lucide-react";

type OfficialRole = "ORGANIZER" | "UMPIRE" | "REFEREE";

const ROLES: { key: OfficialRole; label: string; desc: string; icon: typeof Gavel }[] = [
  { key: "ORGANIZER", label: "Organizer", desc: "Co-manage the tournament", icon: UserCog },
  { key: "REFEREE", label: "Referee", desc: "Oversee & resolve disputes", icon: Gavel },
  { key: "UMPIRE", label: "Umpire", desc: "Score matches in this event", icon: Flag },
];

interface OfficialRow {
  id: string;
  role: OfficialRole;
  user_id: string;
  user?: { id: string; full_name: string; avatar_url: string | null } | null;
}

export function TournamentOfficialsPanel({ tournament }: { tournament: { id: string; created_by?: string | null } }) {
  const { profile, isAdmin } = useAuth();
  const { confirm } = useConfirm();

  const [officials, setOfficials] = useState<OfficialRow[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [roles, setRoles] = useState<OfficialRole[]>(["UMPIRE"]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const canManage = isAdmin || tournament.created_by === profile?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const [offRes, plRes] = await Promise.all([
      supabase
        .from("tournament_officials")
        .select("id, role, user_id, user:players!tournament_officials_user_id_fkey(id, full_name, avatar_url)")
        .eq("tournament_id", tournament.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("players")
        .select("id, full_name, avatar_url")
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
    ]);
    if (offRes.error) {
      console.error("Failed to load officials", offRes.error);
      toast.error("Could not load officials");
      setLoadError(true);
    } else {
      setLoadError(false);
      setOfficials((offRes.data as any) ?? []);
    }
    setPlayers((plRes.data as any) ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = (r: OfficialRole) => {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const addOfficial = async () => {
    if (selectedPlayers.length === 0) {
      toast.error("Pick at least one player");
      return;
    }
    if (roles.length === 0) {
      toast.error("Select at least one role");
      return;
    }
    const rows = selectedPlayers.flatMap((pid) =>
      roles
        .filter((r) => !officials.some((o) => o.user_id === pid && o.role === r))
        .map((r) => ({ tournament_id: tournament.id, user_id: pid, role: r, assigned_by: profile?.id ?? null })),
    );
    if (rows.length === 0) {
      toast.error("All selected players already hold the selected roles");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tournament_officials").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not assign official");
      return;
    }
    toast.success(`Assigned ${rows.length} role${rows.length > 1 ? "s" : ""}`);
    setSelectedPlayers([]);
    load();
  };

  const removeOfficial = async (o: OfficialRow) => {
    const ok = await confirm({
      title: "Remove official?",
      description: `Remove ${o.user?.full_name ?? "this person"} as ${o.role.toLowerCase()}?`,
      confirmLabel: "Remove",
      confirmVariant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("tournament_officials").delete().eq("id", o.id);
    if (error) {
      toast.error(error.message || "Could not remove official");
      return;
    }
    toast.success("Official removed");
    setOfficials((prev) => prev.filter((x) => x.id !== o.id));
  };

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-foreground">Officials</h3>
            <p className="text-xs text-muted-foreground">
              The organiser ({"created you"}) is set automatically. Assign umpires and referees for this tournament.
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mt-4 space-y-3">
            {/* Role picker */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = roles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleRole(r.key)}
                    className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <div className={`text-sm font-black ${active ? "text-primary" : "text-slate-700 dark:text-slate-200"}`}>
                        {r.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Player picker + add */}
            <div className="space-y-2">
              {selectedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlayers.map((pid) => {
                    const p = players.find((x) => x.id === pid);
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold"
                      >
                        {p?.full_name ?? "Unknown"}
                        <button
                          type="button"
                          onClick={() => setSelectedPlayers((prev) => prev.filter((x) => x !== pid))}
                          className="hover:text-rose-500 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0">
                  <PlayerSelect
                    value=""
                    onChange={(id) => {
                      if (id && !selectedPlayers.includes(id)) setSelectedPlayers((prev) => [...prev, id]);
                    }}
                    players={players.filter((p) => !selectedPlayers.includes(p.id))}
                    placeholder="Search a player to assign…"
                    className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <button
                  onClick={addOfficial}
                  disabled={saving || selectedPlayers.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black transition disabled:opacity-50 shrink-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Assign</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current officials grouped by role */}
      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load officials.</p>
            <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {ROLES.map((r) => {
              const rows = officials.filter((o) => o.role === r.key);
              const Icon = r.icon;
              return (
                <div key={r.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {r.label}s
                    </h4>
                    <span className="text-[11px] font-bold text-muted-foreground">({rows.length})</span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6">None assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-3 py-2"
                        >
                          {o.user?.avatar_url ? (
                            <img src={o.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-black text-xs shrink-0">
                              {(o.user?.full_name ?? "?").charAt(0)}
                            </div>
                          )}
                          <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {o.user?.full_name ?? "Unknown player"}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => removeOfficial(o)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
