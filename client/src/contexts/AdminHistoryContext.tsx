import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/* ── Types ─────────────────────────────────────────────────────── */
export type ActionType = "create" | "update" | "delete" | "approve" | "revoke";

export interface HistoryEntry {
  id?: string;
  action_type: ActionType;
  /** "site_data" | "matches" | "players" | etc. */
  entity_type: string;
  /** record id for DB rows; key name for site_data */
  entity_id?: string;
  before_state: any;
  after_state: any;
  label: string;
  created_at?: string;
}

interface AdminHistoryContextType {
  canUndo: boolean;
  canRedo: boolean;
  lastAction: HistoryEntry | null;
  nextRedoAction: HistoryEntry | null;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  revertAction: (action: HistoryEntry) => Promise<void>;
  recordAction: (entry: Omit<HistoryEntry, "id" | "created_at">) => Promise<void>;
  softDelete: (
    tableName: string,
    recordId: string,
    recordData: any,
    label: string,
  ) => Promise<void>;
  recycleBinCount: number;
  refreshRecycleBin: () => Promise<void>;
  /** Increments each time an undo/redo mutates DB — consumers reload on change */
  reloadTrigger: number;
}

const AdminHistoryContext = createContext<AdminHistoryContextType | null>(null);

export function useAdminHistory() {
  const ctx = useContext(AdminHistoryContext);
  if (!ctx)
    throw new Error("useAdminHistory must be inside AdminHistoryProvider");
  return ctx;
}

/* ── Provider ───────────────────────────────────────────────────── */
export function AdminHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isAdmin } = useAuth();
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [recycleBinCount, setRecycleBinCount] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const busy = useRef(false);

  /* ── load recent history on mount ─────────────────────────────── */
  useEffect(() => {
    if (!session || !isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("admin_history" as any)
        .select("*")
        .eq("admin_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) {
        setUndoStack(
          data.map((r: any) => ({
            id: r.id,
            action_type: r.action_type as any,
            entity_type: r.entity_type as any,
            entity_id: r.entity_id ?? undefined,
            before_state: r.before_state,
            after_state: r.after_state,
            label: r.label,
            created_at: r.created_at,
          })),
        );
      }
      refreshRecycleBin();
    })();
  }, [session?.user.id, isAdmin]);

  /* ── recycle bin count ─────────────────────────────────────────── */
  const refreshRecycleBin = useCallback(async () => {
    if (!session) return;
    const { count } = await supabase
      .from("recycle_bin")
      .select("*", { count: "exact", head: true })
      .gt("expires_at", new Date().toISOString());
    setRecycleBinCount(count ?? 0);
  }, [session]);



  /* ── record an action ──────────────────────────────────────────── */
  const recordAction = useCallback(
    async (entry: Omit<HistoryEntry, "id" | "created_at">) => {
      if (!session) return;
      const { data, error } = await supabase
        .from("admin_history")
        .insert({
          admin_id: session.user.id,
          action_type: entry.action_type,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id ?? null,
          before_state: entry.before_state,
          after_state: entry.after_state,
          label: entry.label,
        })
        .select()
        .single();
      if (!error && data) {
        const full: HistoryEntry = {
          ...entry,
          id: data.id,
          created_at: data.created_at,
        };
        setUndoStack((prev) => [full, ...prev].slice(0, 50));
        setRedoStack([]);
      }
    },
    [session],
  );

  /* ── soft delete ───────────────────────────────────────────────── */
  const softDelete = useCallback(
    async (
      tableName: string,
      recordId: string,
      recordData: any,
      label: string,
    ) => {
      if (!session) return;
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);

      const { error: rbErr } = await supabase.from("recycle_bin").insert({
        table_name: tableName,
        record_id: recordId,
        record_data: recordData,
        deleted_by: session.user.id,
        label,
        expires_at: expires.toISOString(),
      });
      if (rbErr) throw rbErr;

      const { error: delErr } = await supabase
        .from(tableName as any)
        .delete()
        .eq("id", recordId);
      if (delErr) {
        await supabase
          .from("recycle_bin")
          .delete()
          .eq("table_name", tableName)
          .eq("record_id", recordId);
        throw delErr;
      }

      await recordAction({
        action_type: "delete",
        entity_type: tableName,
        entity_id: recordId,
        before_state: recordData,
        after_state: null,
        label,
      });

      setRecycleBinCount((c) => c + 1);
    },
    [session, recordAction],
  );

  /* ── apply undo/redo to DB ─────────────────────────────────────── */
  async function applyToDb(
    action: HistoryEntry,
    direction: "undo" | "redo",
  ): Promise<void> {
    const targetState =
      direction === "undo" ? action.before_state : action.after_state;

    if (action.entity_type === "site_data") {
      const { error } = await supabase.from("site_data").upsert(
        {
          key: action.entity_id!,
          value: targetState,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (error) throw error;
    } else if (action.action_type === "delete") {
      if (direction === "undo") {
        // Restore record
        const { error } = await supabase
          .from(action.entity_type as any)
          .insert(action.before_state);
        if (error) throw error;
        // Remove from recycle bin
        await supabase
          .from("recycle_bin")
          .delete()
          .eq("table_name", action.entity_type)
          .eq("record_id", action.entity_id);
      } else {
        // Redo delete: soft delete again
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        await supabase.from("recycle_bin").insert({
          table_name: action.entity_type,
          record_id: action.entity_id,
          record_data: action.before_state,
          deleted_by: session?.user.id,
          label: action.label,
          expires_at: expires.toISOString(),
        });
        await supabase
          .from(action.entity_type as any)
          .delete()
          .eq("id", action.entity_id);
      }
    } else {
      // update / approve / revoke
      const { error } = await supabase
        .from(action.entity_type as any)
        .update(targetState)
        .eq("id", action.entity_id);
      if (error) throw error;
    }
  }

  /* ── undo ─────────────────────────────────────────────────────── */
  const performUndo = useCallback(
    async (action: HistoryEntry, stack: HistoryEntry[]) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await applyToDb(action, "undo");
        if (action.id) {
          await supabase.from("admin_history").delete().eq("id", action.id);
        }
        setUndoStack(stack.slice(1));
        setRedoStack((r) => [action, ...r].slice(0, 50));
        setReloadTrigger((n) => n + 1);
        await refreshRecycleBin();
        toast(`Undid: ${action.label}`, { icon: "↩️" });
      } catch (err: any) {
        toast("Undo failed: " + err?.message, { icon: "❌" });
      }
      busy.current = false;
    },
    [refreshRecycleBin, session],
  );

  const undo = useCallback(async () => {
    if (undoStack.length === 0 || busy.current) return;
    await performUndo(undoStack[0], undoStack);
  }, [undoStack, performUndo]);

  const revertAction = useCallback(async (action: HistoryEntry) => {
    if (busy.current) return;
    if (!confirm(`Are you sure you want to revert this specific action: "${action.label}"?\n\nCaution: If newer actions modified the same record, this may overwrite them.`)) return;
    
    busy.current = true;
    try {
      await applyToDb(action, "undo");
      if (action.id) {
        await supabase.from("admin_history").delete().eq("id", action.id);
      }
      setUndoStack(prev => prev.filter(a => a.id !== action.id));
      setRedoStack(prev => prev.filter(a => a.id !== action.id));
      setReloadTrigger(n => n + 1);
      await refreshRecycleBin();
      toast(`Reverted: ${action.label}`, { icon: "↩️" });
    } catch (err: any) {
      toast("Revert failed: " + err?.message, { icon: "❌" });
    }
    busy.current = false;
  }, [refreshRecycleBin]);

  /* ── redo ─────────────────────────────────────────────────────── */
  const performRedo = useCallback(
    async (action: HistoryEntry, stack: HistoryEntry[]) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await applyToDb(action, "redo");
        // Re-record in DB
        const { data } = await supabase
          .from("admin_history")
          .insert({
            admin_id: session?.user.id,
            action_type: action.action_type,
            entity_type: action.entity_type,
            entity_id: action.entity_id ?? null,
            before_state: action.before_state,
            after_state: action.after_state,
            label: action.label,
          })
          .select()
          .single();
        setRedoStack(stack.slice(1));
        setUndoStack((u) =>
          [
            { ...action, id: data?.id, created_at: data?.created_at },
            ...u,
          ].slice(0, 50),
        );
        setReloadTrigger((n) => n + 1);
        await refreshRecycleBin();
        toast(`Redid: ${action.label}`, { icon: "↪️" });
      } catch (err: any) {
        toast("Redo failed: " + err?.message, { icon: "❌" });
      }
      busy.current = false;
    },
    [session, refreshRecycleBin],
  );

  const redo = useCallback(async () => {
    if (redoStack.length === 0 || busy.current) return;
    await performRedo(redoStack[0], redoStack);
  }, [redoStack, performRedo]);

  /* ── keyboard shortcuts (only for admins) ──────────────────────── */
  useEffect(() => {
    if (!isAdmin) return;
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, undo, redo]);

  return (
    <AdminHistoryContext.Provider
      value={{
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        lastAction: undoStack[0] ?? null,
        nextRedoAction: redoStack[0] ?? null,
        undo,
        redo,
        revertAction,
        recordAction,
        softDelete,
        recycleBinCount,
        refreshRecycleBin,
        reloadTrigger,
      }}
    >
      {children}
    </AdminHistoryContext.Provider>
  );
}
