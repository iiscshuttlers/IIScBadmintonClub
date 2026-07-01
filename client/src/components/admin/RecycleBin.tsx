import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";

interface RecycleBinItem {
  id: string;
  table_name: string;
  record_id: string;
  record_data: any;
  label: string | null;
  deleted_at: string;
  expires_at: string;
}

function daysLeft(expires_at: string): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );
}

function humanLabel(item: RecycleBinItem): string {
  if (item.label) return item.label;
  const d = item.record_data;
  if (item.table_name === "matches") {
    return `Match ${item.record_id.slice(0, 8)}`;
  }
  if (item.table_name === "players") {
    return d?.full_name ?? `Player ${item.record_id.slice(0, 8)}`;
  }
  return `${item.table_name} ${item.record_id.slice(0, 8)}`;
}

function tableIcon(tableName: string): string {
  switch (tableName) {
    case "matches": return "🏸";
    case "players": return "👤";
    default: return "📄";
  }
}

export function RecycleBin() {
  const { isMainAdmin } = useAuth();
  const { recordAction, refreshRecycleBin, reloadTrigger } = useAdminHistory();

  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recycle_bin")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("deleted_at", { ascending: false });
    if (error) toast.error("Failed to load recycle bin: " + error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (reloadTrigger > 0) load(); }, [reloadTrigger, load]);

  const restore = async (item: RecycleBinItem) => {
    setActionId(item.id);
    try {
      const { error } = await supabase
        .from(item.table_name)
        .insert(item.record_data);
      if (error) throw error;

      await supabase.from("recycle_bin").delete().eq("id", item.id);

      await recordAction({
        action_type: "create",
        entity_type: item.table_name,
        entity_id: item.record_id,
        before_state: null,
        after_state: item.record_data,
        label: `Restored: ${humanLabel(item)}`,
      });

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      await refreshRecycleBin();
      toast.success(`Restored: ${humanLabel(item)}`);
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    }
    setActionId(null);
  };

  const permanentDelete = async (item: RecycleBinItem) => {
    if (
      !confirm(
        `Permanently delete "${humanLabel(item)}"? This cannot be undone.`,
      )
    )
      return;
    setActionId(item.id);
    const { error } = await supabase
      .from("recycle_bin")
      .delete()
      .eq("id", item.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      await refreshRecycleBin();
      toast.success("Permanently deleted");
    }
    setActionId(null);
  };

  const tableNames = [...new Set(items.map((i) => i.table_name))];
  const filtered =
    filter === "all" ? items : items.filter((i) => i.table_name === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Recycle Bin
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Deleted items are kept for 30 days before permanent removal.
          {!isMainAdmin && " Only master admins can permanently delete items."}
        </p>
      </div>

      {/* Filter */}
      {tableNames.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === "all"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400"
            }`}
          >
            All ({items.length})
          </button>
          {tableNames.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                filter === t
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400"
              }`}
            >
              {tableIcon(t)} {t} ({items.filter((i) => i.table_name === t).length})
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            Recycle bin is empty
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const days = daysLeft(item.expires_at);
            const isExpiringSoon = days <= 3;
            const isLoading = actionId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <span className="text-xl shrink-0 mt-0.5 sm:mt-0">{tableIcon(item.table_name)}</span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {humanLabel(item)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-slate-400 capitalize">
                        {item.table_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        Deleted{" "}
                        {new Date(item.deleted_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-xs font-medium ${
                          isExpiringSoon
                            ? "text-rose-500"
                            : "text-amber-500"
                        }`}
                      >
                        {isExpiringSoon && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <Clock className="w-3 h-3" />
                        {days}d left
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-3 sm:pt-0 mt-1 sm:mt-0 border-t border-slate-100 dark:border-slate-800 sm:border-0">
                  <button
                    onClick={() => restore(item)}
                    disabled={isLoading}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary border border-primary/40 dark:border-primary/80 text-xs font-bold hover:bg-primary/15 dark:hover:bg-primary/90/50 transition disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Restore
                  </button>
                  {isMainAdmin && (
                    <button
                      onClick={() => permanentDelete(item)}
                      disabled={isLoading}
                      className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
