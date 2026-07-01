import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
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
    const { data, error } = await supabase
      .from("admin_history")
      .select("*")
      .order("created_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
      
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
    if (action === "delete") return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50";
    if (action === "create") return "bg-primary/15 text-primary border-primary/40 dark:bg-primary/40 dark:text-primary dark:border-primary/50";
    if (action === "update") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50";
    return "bg-slate-100 text-muted-foreground border-slate-200 dark:bg-slate-800 dark:text-muted-foreground dark:border-slate-700";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" /> Undo History
        </h2>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-slate-800 dark:hover:text-foreground transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm mb-6 text-sm text-muted-foreground dark:text-muted-foreground">
        <p>This table shows a chronological log of all site modifications (updates, creations, deletions) stored securely in the <strong>admin_history</strong> table. These records power the Undo/Redo stack. <em>You can use the Revert button on historical items to undo them individually, but be careful as this may overwrite newer changes to the same record.</em></p>
      </div>

      {loading && history.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
          <History className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-bold">No history available.</p>
          <p className="text-xs text-muted-foreground mt-1">Modifications will appear here once you make changes.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-48">Time</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Action</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">Undo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((item, index) => {
                const isLatest = index === 0;
                
                return (
                  <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isLatest ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                    <td className="px-4 py-3 text-muted-foreground dark:text-muted-foreground whitespace-nowrap text-xs">
                      {formatTime(item.created_at || "")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getActionColor(item.action_type)}`}>
                        {item.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-bold text-muted-foreground dark:text-slate-200 text-sm mb-1">{item.label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded inline-block">
                        Table: {item.entity_type} {item.entity_id ? `| ID: ${item.entity_id.split("-")[0]}...` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isLatest && item.id === lastAction?.id ? (
                        <button
                          onClick={undo}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm text-muted-foreground dark:text-slate-300"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => revertAction(item)}
                          title="Revert this specific action (Caution: may overwrite newer changes)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 dark:hover:border-rose-800 transition shadow-sm text-muted-foreground dark:text-muted-foreground"
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
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-muted-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-foreground transition"
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
