import { useCallback, useEffect, useState } from "react";
import { Trash2, RotateCcw, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { useConfirm } from "@/contexts/ConfirmContext";

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
  const { confirm } = useConfirm();

  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.fetchRecycleBinItems();
      setItems((data as RecycleBinItem[]) ?? []);
    } catch (error: any) {
      toast.error("Failed to load recycle bin: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (reloadTrigger > 0) load(); }, [reloadTrigger, load]);

  const restore = async (item: RecycleBinItem) => {
    setActionId(item.id);
    try {
      await adminService.restoreRecycleBinItem(item);

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
    if (!(await confirm({
      title: 'Permanent Delete',
      description: `Permanently delete "${humanLabel(item)}"? This cannot be undone.`,
      confirmVariant: 'danger',
      confirmLabel: 'Permanently Delete'
    }))) return;
    setActionId(item.id);
    try {
      await adminService.deleteRecycleBinItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      await refreshRecycleBin();
      toast.success("Permanently deleted");
    } catch (error: any) {
      toast.error("Delete failed: " + error.message);
    } finally {
      setActionId(null);
    }
  };

  const tableNames = [...new Set(items.map((i) => i.table_name))];
  const filtered =
    filter === "all" ? items : items.filter((i) => i.table_name === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <Trash2 className="w-5 h-5 text-danger" />
          <h2 className="text-lg font-black text-foreground">
            Recycle Bin
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
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
                ? "bg-foreground text-on-accent"
                : "bg-card border border-border text-muted-foreground hover:border-border-strong"
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
                  ? "bg-foreground text-on-accent"
                  : "bg-card border border-border text-muted-foreground hover:border-border-strong"
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
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Trash2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
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
                className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm"
              >
                <div className="flex items-start gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <span className="text-xl shrink-0 mt-0.5 sm:mt-0">{tableIcon(item.table_name)}</span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {humanLabel(item)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground capitalize">
                        {item.table_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
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
                            ? "text-danger"
                            : "text-warning"
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

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-3 sm:pt-0 mt-1 sm:mt-0 border-t border-border sm:border-0">
                  <button
                    onClick={() => restore(item)}
                    disabled={isLoading}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-primary/30 text-primary border border-primary/60 text-xs font-bold hover:bg-primary/40 transition disabled:opacity-50"
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
                      className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/40 text-xs font-bold hover:bg-danger/20 transition disabled:opacity-50"
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
