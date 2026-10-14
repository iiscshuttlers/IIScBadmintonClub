import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AdminPanel, AdminLoading, AdminEmptyState } from "./AdminPanel";
import { useAuth } from "@/contexts/AuthContext";

// user_reports is new; generated types regenerate after the migration is
// applied (npx supabase db push). Cast until then.
const sb = supabase as any;

const REASON_LABELS: Record<string, string> = {
  harassment: "Harassment or bullying",
  inappropriate: "Inappropriate behavior",
  impersonation: "Fake profile / impersonation",
  spam: "Spam",
  other: "Other",
};

type Filter = "open" | "reviewed" | "dismissed" | "all";

export function ModerationPanel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ["moderation-reports", filter],
    queryFn: async () => {
      let q = sb
        .from("user_reports")
        .select("id, reason, details, status, created_at, reporter_id, reported_player_id, reporter:players!user_reports_reporter_id_fkey(full_name), reported:players!user_reports_reported_player_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const setStatus = async (id: string, status: "reviewed" | "dismissed") => {
    setBusyId(id);
    try {
      const { error } = await sb
        .from("user_reports")
        .update({ status, reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(status === "reviewed" ? "Marked as reviewed" : "Dismissed");
      queryClient.invalidateQueries({ queryKey: ["moderation-reports"] });
    } catch (e: any) {
      toast.error("Couldn't update report");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPanel
      icon={Flag}
      title="Reports & Moderation"
      description="Review player reports and take action."
      actions={(["open", "reviewed", "dismissed", "all"] as Filter[]).map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`rounded-xl px-3 py-1.5 text-xs font-black capitalize transition ${
            filter === f
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {f}
        </button>
      ))}
    >
      {isLoading ? (
        <AdminLoading />
      ) : error ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Couldn't load reports. (Has the trust-safety migration been applied?)
        </div>
      ) : reports.length === 0 ? (
        <AdminEmptyState title={`No ${filter === "all" ? "" : filter} reports`.replace("  ", " ").trim()} />
      ) : (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-foreground">{r.reported?.full_name || "Unknown player"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-black uppercase tracking-wider">
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.status === "open" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : r.status === "reviewed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  {r.details && <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{r.details}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Reported by {r.reporter?.full_name || "someone"} · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {r.status === "open" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" disabled={busyId === r.id} onClick={() => setStatus(r.id, "dismissed")}>
                      <X className="w-4 h-4" /> Dismiss
                    </Button>
                    <Button variant="default" size="sm" disabled={busyId === r.id} onClick={() => setStatus(r.id, "reviewed")}>
                      {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Reviewed
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
