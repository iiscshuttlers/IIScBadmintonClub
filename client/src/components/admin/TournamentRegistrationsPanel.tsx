import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchTournamentRegistrationRows, reviewTournamentRegistration } from "@/services/tournamentService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2, ClipboardList, Check, X, Clock, CheckCircle2, XCircle,
  Phone, Receipt, MessageSquare, Users2, RefreshCw,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles",
  MD: "Men's Doubles", WD: "Women's Doubles", XD: "Mixed Doubles",
  BS: "Boys' Singles", GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};

type Status = "pending" | "approved" | "rejected" | "withdrawn";

interface RegRow {
  id: string;
  status: Status;
  full_name: string;
  email: string | null;
  phone: string | null;
  categories: string[];
  partner_names: string | null;
  transaction_id: string | null;
  message: string | null;
  created_at: string;
  player?: { id: string; full_name: string; avatar_url: string | null } | null;
}

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function TournamentRegistrationsPanel({ tournament }: { tournament: { id: string; created_by?: string | null } }) {
  const { profile, isAdmin } = useAuth();
  const [rows, setRows] = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [actingId, setActingId] = useState<string | null>(null);

  const canManage = isAdmin || tournament.created_by === profile?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchTournamentRegistrationRows(tournament.id);
    if (error) {
      console.error("Failed to load registrations", error);
      toast.error("Could not load registrations");
      setLoadError(true);
    } else {
      setLoadError(false);
      setRows((data as any) ?? []);
    }
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0, withdrawn: 0, all: rows.length };
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const review = async (row: RegRow, status: "approved" | "rejected") => {
    setActingId(row.id);
    const { error } = await reviewTournamentRegistration(row.id, status, profile?.id ?? null);
    setActingId(null);
    if (error) return toast.error(error.message || "Could not update");
    toast.success(status === "approved" ? "Registration approved" : "Registration rejected");
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
  };

  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const cardCls = "bg-card rounded-2xl border border-border p-5 shadow-sm";

  const statusChip = (s: Status) => {
    const map: Record<Status, { icon: typeof Clock; cls: string }> = {
      pending: { icon: Clock, cls: "text-warning bg-warning/10" },
      approved: { icon: CheckCircle2, cls: "text-success bg-success/10" },
      rejected: { icon: XCircle, cls: "text-danger bg-danger/10" },
      withdrawn: { icon: XCircle, cls: "text-muted-foreground bg-muted" },
    };
    const { icon: Icon, cls } = map[s];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black capitalize ${cls}`}>
        <Icon className="w-3 h-3" /> {s}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className={cardCls}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Registrations</h3>
            <p className="text-xs text-muted-foreground">Review and approve players entering this event.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Button
                key={f.key}
                size="pill"
                variant="tab"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-soft hover:bg-muted-strong"
                }`}
              >
                {f.label}
                <span className={`px-1.5 rounded-full text-[10px] ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-strong"}`}>
                  {counts[f.key] ?? 0}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-8">
            <p className="text-sm text-soft font-bold">Couldn't load registrations.</p>
            <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No {filter === "all" ? "" : filter} registrations yet.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-background/40 p-3.5">
                <div className="flex items-start gap-3">
                  {r.player?.avatar_url ? (
                    <img src={r.player.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-black text-xs shrink-0">
                      {(r.player?.full_name ?? r.full_name ?? "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-foreground truncate">
                        {r.player?.full_name ?? r.full_name}
                      </span>
                      {statusChip(r.status)}
                    </div>
                    {r.categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {r.categories.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                            {CATEGORY_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {r.partner_names && <p className="flex items-start gap-1.5"><Users2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {r.partner_names}</p>}
                      {r.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {r.phone}</p>}
                      {r.transaction_id && <p className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5 shrink-0" /> {r.transaction_id}</p>}
                      {r.message && <p className="flex items-start gap-1.5"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {r.message}</p>}
                    </div>
                  </div>
                </div>

                {canManage && r.status !== "withdrawn" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => review(r, "approved")}
                      disabled={actingId === r.id || r.status === "approved"}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-success hover:bg-success/90 text-success-foreground text-xs font-black transition disabled:opacity-40"
                    >
                      {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
                    </button>
                    <button
                      onClick={() => review(r, "rejected")}
                      disabled={actingId === r.id || r.status === "rejected"}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 text-xs font-black transition disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
