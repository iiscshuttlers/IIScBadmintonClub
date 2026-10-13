import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag, Check, X, ShieldBan, Loader2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
          <Flag className="w-5 h-5 text-rose-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground">Reports & Moderation</h2>
          <p className="text-sm text-muted-foreground">Review player reports and take action.</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {(["open", "reviewed", "dismissed", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black capitalize transition ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Couldn't load reports. (Has the trust-safety migration been applied?)
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-muted-foreground">
          <Inbox className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm font-bold">No {filter === "all" ? "" : filter} reports</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r: any) => (
            <div key={r.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-foreground">{r.reported?.full_name || "Unknown player"}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-black uppercase tracking-wider">
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      r.status === "open" ? "bg-amber-500/15 text-amber-500" : r.status === "reviewed" ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-500/15 text-slate-400"
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
    </div>
  );
}
