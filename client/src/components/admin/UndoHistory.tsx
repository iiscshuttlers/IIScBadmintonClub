import { useState, useEffect, useCallback } from "react";
import { adminService } from "@/services/adminService";
import { Loader2, RefreshCw, History, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminHistory, HistoryEntry } from "@/contexts/AdminHistoryContext";

export function UndoHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const { undo, revertAction, lastAction, reloadTrigger } = useAdminHistory();
  const PAGE_SIZE = 50;

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true);
    const { data, error } = await adminService.getAdminHistoryPage(pageNum, PAGE_SIZE);

    if (!error && data) {
      if (pageNum === 0) setHistory(data as any);
      else setHistory((prev) => [...prev, ...(data as any)]);
    } else if (error) {
      toast.error("Failed to load history: " + error.message);
    }
    setLoading(false);
  }, []);

  // Reload history when page or reloadTrigger changes
  useEffect(() => {
    load(0);
    setPage(0);
  }, [reloadTrigger, load]);

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
    if (action === "delete") return "bg-danger/15 text-danger border-danger/30";
    if (action === "create") return "bg-primary/40 text-primary border-primary/50";
    if (action === "update") return "bg-info/15 text-info border-info/30";
    return "bg-muted text-muted-foreground border-border-strong";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-info" /> Undo History
        </h2>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition px-3 py-1.5 rounded-xl hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm mb-6 text-sm text-muted-foreground">
        <p>This table shows a chronological log of all site modifications (updates, creations, deletions) stored securely in the <strong>admin_history</strong> table. These records power the Undo/Redo stack. <em>You can use the Revert button on historical items to undo them individually, but be careful as this may overwrite newer changes to the same record.</em></p>
      </div>

      {loading && history.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-3xl border border-border">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No history available.</p>
          <p className="text-xs text-muted-foreground mt-1">Modifications will appear here once you make changes.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50 border-b border-border-strong">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-48">Time</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Action</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">Undo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((item, index) => {
                const isLatest = index === 0;
                
                return (
                  <tr key={item.id} className={`hover:bg-muted/50 transition-colors ${isLatest ? 'bg-info/5' : ''}`}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatTime(item.created_at || "")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getActionColor(item.action_type)}`}>
                        {item.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-bold text-soft text-sm mb-1">{item.label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded inline-block">
                        Table: {item.entity_type} {item.entity_id ? `| ID: ${item.entity_id.split("-")[0]}...` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isLatest && item.id === lastAction?.id ? (
                        <button
                          onClick={undo}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-muted border border-border-strong hover:bg-muted-strong transition shadow-sm text-soft"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => revertAction(item)}
                          title="Revert this specific action (Caution: may overwrite newer changes)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-muted border border-border-strong hover:bg-danger/10 hover:text-danger hover:border-danger/40 transition shadow-sm text-muted-foreground"
                        >
                          <Undo2 className="w-3 h-3" /> Revert
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {history.length >= (page + 1) * PAGE_SIZE && (
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
