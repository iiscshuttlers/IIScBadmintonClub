import { useState, useEffect, useCallback } from "react";
import { adminService, type AdminLogEntry } from "@/services/adminService";
import { Loader2, RefreshCw, ClipboardList, Clock } from "lucide-react";
import { toast } from "sonner";

type LogEntry = AdminLogEntry;

export function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      const data = await adminService.getLogs(pageNum, PAGE_SIZE);
      if (pageNum === 0) setLogs(data);
      else setLogs((prev) => [...prev, ...data]);
    } catch (error: any) {
      if (error?.code === "42P01") {
        toast.error("admin_logs table not found. Run the DB migration first.");
      } else {
        toast.error("Failed to load logs");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const getActionColor = (action: string) => {
    if (action.toLowerCase().includes("delete") || action.toLowerCase().includes("remove")) return "bg-danger/15 text-danger border-danger/30";
    if (action.toLowerCase().includes("override") || action.toLowerCase().includes("uphold")) return "bg-warning/15 text-warning border-warning/30";
    if (action.toLowerCase().includes("approved") || action.toLowerCase().includes("saved") || action.toLowerCase().includes("updated")) return "bg-primary/40 text-primary border-primary/50";
    return "bg-info/15 text-info border-info/30";
  };

  const renderDetails = (details: any) => {
    if (!details) return null;
    let parsed = details;
    if (typeof details === "string") {
      try {
        parsed = JSON.parse(details);
      } catch (e) {
        // Not a JSON string
      }
    }
    
    if (typeof parsed === "object" && parsed !== null) {
      return (
        <div className="mt-2 space-y-1.5 bg-muted/30 p-2 rounded-xl border border-border/50 w-fit max-w-full">
          {Object.entries(parsed).map(([k, v]: any) => (
            <div key={k} className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground capitalize shrink-0">{k.replace(/_/g, " ")}:</span>
              {Array.isArray(v) ? (
                <div className="flex gap-1 flex-wrap">
                  {v.map((item: any, i: number) => (
                    <span key={i} className="px-1.5 py-0.5 bg-foreground/10 text-soft rounded text-[9px] font-black">{String(item)}</span>
                  ))}
                </div>
              ) : typeof v === "object" && v !== null ? (
                <span className="text-[9px] text-muted-foreground break-words font-mono bg-muted p-1.5 rounded-lg">
                  {JSON.stringify(v)}
                </span>
              ) : (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md text-soft bg-foreground/10">
                  {String(v)}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return <p className="text-[10px] text-muted-foreground mt-1.5 break-words font-medium">{String(details)}</p>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-info" /> Admin Activity Log
        </h2>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-xl hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-3xl border border-border">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No admin actions logged yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Actions will appear here once admins start making changes.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border-strong">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Time</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {formatTime(log.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-soft text-xs">{log.admin_email.split("@")[0]}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                      {renderDetails(log.details)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {logs.length >= (page + 1) * PAGE_SIZE && (
            <div className="p-4 border-t border-border text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-soft hover:text-foreground transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
