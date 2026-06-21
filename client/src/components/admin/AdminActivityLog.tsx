import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, RefreshCw, ClipboardList, Clock } from "lucide-react";
import { toast } from "sonner";

interface LogEntry {
  id: number;
  admin_email: string;
  action: string;
  details?: string;
  created_at: string;
}

export function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
    if (!error && data) {
      if (pageNum === 0) setLogs(data);
      else setLogs((prev) => [...prev, ...data]);
    } else if (error) {
      // Table may not exist yet
      if (error.code === "42P01") {
        toast.error("admin_logs table not found. Run the DB migration first.");
      } else {
        toast.error("Failed to load logs");
      }
    }
    setLoading(false);
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
    if (action.toLowerCase().includes("delete") || action.toLowerCase().includes("remove")) return "text-rose-600 dark:text-rose-400";
    if (action.toLowerCase().includes("override") || action.toLowerCase().includes("uphold")) return "text-amber-600 dark:text-amber-400";
    if (action.toLowerCase().includes("approved") || action.toLowerCase().includes("saved") || action.toLowerCase().includes("updated")) return "text-emerald-600 dark:text-emerald-400";
    return "text-blue-600 dark:text-blue-400";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-500" /> Admin Activity Log
        </h2>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
          <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">No admin actions logged yet.</p>
          <p className="text-xs text-slate-400 mt-1">Actions will appear here once admins start making changes.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Time</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Admin</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {formatTime(log.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{log.admin_email.split("@")[0]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold text-xs ${getActionColor(log.action)}`}>{log.action}</span>
                    {log.details && (
                      <p className="text-[10px] text-slate-400 mt-0.5 break-words">
                        {typeof log.details === "object" ? JSON.stringify(log.details) : log.details}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length >= (page + 1) * PAGE_SIZE && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
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
