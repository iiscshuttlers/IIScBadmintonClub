import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { clearConvenerCache } from "@/lib/conveners";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { CONTENT_KEYS, DOC_SPECS, type ContentDocs, type ContentKey } from "./contentModel";

/**
 * One draft for every piece of site content, shared by all Content hub tabs.
 * Editing anywhere (a section, an Overview quick fix, the Home preview) changes
 * the same draft, and one bar saves everything that changed.
 */

type Updater<T> = T | ((prev: T) => T);

interface DocMeta {
  /** JSON of the value as loaded, to tell whether the draft differs. */
  originalJson: string;
  /** site_data.updated_at as loaded; null when the row doesn't exist yet. */
  updatedAt: string | null;
}

interface ContentStoreValue {
  docs: ContentDocs;
  originals: ContentDocs;
  meta: Record<ContentKey, DocMeta>;
  dirtyKeys: ContentKey[];
  saving: boolean;
  setDoc: <K extends ContentKey>(key: K, next: Updater<ContentDocs[K]>) => void;
  /** Throw away unsaved edits for one row, or all rows. */
  discard: (key?: ContentKey) => void;
  /** Re-read one row from the database (drops its unsaved edits). */
  reloadDoc: (key: ContentKey) => Promise<void>;
  /** Rows changed by someone else since this page loaded them. */
  checkConflicts: () => Promise<ContentKey[]>;
  saveAll: () => Promise<boolean>;
}

const ContentStoreContext = createContext<ContentStoreValue | null>(null);

export function useContentStore(): ContentStoreValue {
  const ctx = useContext(ContentStoreContext);
  if (!ctx) throw new Error("useContentStore must be inside ContentStoreProvider");
  return ctx;
}

/** One row's draft plus helpers, for a single editor section. */
export function useContentDoc<K extends ContentKey>(key: K) {
  const store = useContentStore();
  const set = useCallback((next: Updater<ContentDocs[K]>) => store.setDoc(key, next), [store, key]);
  return {
    value: store.docs[key],
    set,
    dirty: store.dirtyKeys.includes(key),
    updatedAt: store.meta[key].updatedAt,
    discard: () => store.discard(key),
    reload: () => store.reloadDoc(key),
  };
}

type Rows = Partial<Record<ContentKey, { value: unknown; updated_at: string | null }>>;

function buildState(rows: Rows) {
  const docs = {} as ContentDocs;
  const meta = {} as Record<ContentKey, DocMeta>;
  for (const key of CONTENT_KEYS) {
    const value = DOC_SPECS[key].read(rows[key]?.value) as never;
    (docs as Record<ContentKey, unknown>)[key] = value;
    meta[key] = { originalJson: JSON.stringify(value), updatedAt: rows[key]?.updated_at ?? null };
  }
  return { docs, meta };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function ContentStoreProvider({ children }: { children: ReactNode }) {
  const { recordAction, reloadTrigger } = useAdminHistory();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docs, setDocs] = useState<ContentDocs | null>(null);
  const [originals, setOriginals] = useState<ContentDocs | null>(null);
  const [meta, setMeta] = useState<Record<ContentKey, DocMeta> | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadAll = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("site_data")
        .select("key, value, updated_at")
        .in("key", [...CONTENT_KEYS]);
      if (error) throw error;
      const rows: Rows = {};
      for (const row of data ?? []) rows[row.key as ContentKey] = { value: row.value, updated_at: row.updated_at };
      const next = buildState(rows);
      if (!mounted.current) return;
      setDocs(next.docs);
      setOriginals(clone(next.docs));
      setMeta(next.meta);
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      setStatus("error");
      // When content is already on screen it stays; say the refresh failed.
      toast.error(`Couldn't load site content: ${msg}`);
    }
  }, []);

  // Load on mount, and again after an admin undo/redo rewrites site_data.
  useEffect(() => {
    loadAll();
  }, [loadAll, reloadTrigger]);

  const dirtyKeys = useMemo(() => {
    if (!docs || !meta) return [];
    return CONTENT_KEYS.filter((k) => JSON.stringify(docs[k]) !== meta[k].originalJson);
  }, [docs, meta]);

  // Unsaved content edits survive tab switches inside the hub, but not a reload.
  useEffect(() => {
    if (dirtyKeys.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyKeys.length]);

  const setDoc = useCallback(<K extends ContentKey>(key: K, next: Updater<ContentDocs[K]>) => {
    setDocs((prev) => {
      if (!prev) return prev;
      const value = typeof next === "function" ? (next as (p: ContentDocs[K]) => ContentDocs[K])(prev[key]) : next;
      return { ...prev, [key]: value };
    });
  }, []);

  const discard = useCallback(
    (key?: ContentKey) => {
      if (!originals) return;
      setDocs((prev) => {
        if (!prev) return prev;
        if (!key) return clone(originals);
        return { ...prev, [key]: clone(originals[key]) };
      });
    },
    [originals],
  );

  const applySaved = useCallback((key: ContentKey, stored: unknown, updatedAt: string | null) => {
    const value = DOC_SPECS[key].read(stored);
    setDocs((prev) => (prev ? { ...prev, [key]: value } : prev));
    setOriginals((prev) => (prev ? { ...prev, [key]: clone(value) } : prev));
    setMeta((prev) => (prev ? { ...prev, [key]: { originalJson: JSON.stringify(value), updatedAt } } : prev));
  }, []);

  const reloadDoc = useCallback(
    async (key: ContentKey) => {
      const { data, error } = await supabase
        .from("site_data")
        .select("value, updated_at")
        .eq("key", key)
        .maybeSingle();
      if (error) {
        toast.error(`Couldn't reload ${DOC_SPECS[key].label}: ${error.message}`);
        return;
      }
      if (mounted.current) applySaved(key, data?.value, data?.updated_at ?? null);
    },
    [applySaved],
  );

  const checkConflicts = useCallback(async (): Promise<ContentKey[]> => {
    if (!meta || dirtyKeys.length === 0) return [];
    const { data, error } = await supabase.from("site_data").select("key, updated_at").in("key", dirtyKeys);
    if (error) return [];
    const now = new Map((data ?? []).map((r) => [r.key, r.updated_at]));
    return dirtyKeys.filter((k) => (now.get(k) ?? null) !== meta[k].updatedAt);
  }, [meta, dirtyKeys]);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!docs || !originals || dirtyKeys.length === 0) return true;
    setSaving(true);
    const saved: string[] = [];
    try {
      for (const key of dirtyKeys) {
        const spec = DOC_SPECS[key];
        // Read the row as it is now so merges keep other people's changes.
        const { data: row, error: readErr } = await supabase
          .from("site_data")
          .select("value")
          .eq("key", key)
          .maybeSingle();
        if (readErr) throw new Error(`${spec.label}: ${readErr.message}`);
        const payload = (spec.write as (d: unknown, c: { fresh: unknown; original: unknown }) => unknown)(docs[key], {
          fresh: row?.value,
          original: originals[key],
        });
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from("site_data")
          .upsert({ key, value: payload as never, updated_at: updatedAt }, { onConflict: "key" });
        if (error) throw new Error(`${spec.label}: ${error.message}`);
        if (key === "convener_photos") clearConvenerCache();
        await recordAction({
          action_type: "update",
          entity_type: "site_data",
          entity_id: key,
          before_state: row?.value ?? null,
          after_state: payload,
          label: `Updated ${spec.label}`,
        });
        if (mounted.current) applySaved(key, payload, updatedAt);
        saved.push(spec.label);
      }
      toast.success(`Saved ${saved.join(", ")} — live now.`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(saved.length ? `Saved ${saved.join(", ")}, then failed. ${msg}` : `Save failed. ${msg}`);
      return false;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [docs, originals, dirtyKeys, recordAction, applySaved]);

  const value = useMemo<ContentStoreValue | null>(
    () =>
      docs && originals && meta
        ? { docs, originals, meta, dirtyKeys, saving, setDoc, discard, reloadDoc, checkConflicts, saveAll }
        : null,
    [docs, originals, meta, dirtyKeys, saving, setDoc, discard, reloadDoc, checkConflicts, saveAll],
  );

  if (status === "error" && !value) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-danger" aria-hidden />
        <p className="font-bold text-foreground">Couldn't load site content</p>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <button
          type="button"
          onClick={loadAll}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading content">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return <ContentStoreContext.Provider value={value}>{children}</ContentStoreContext.Provider>;
}
