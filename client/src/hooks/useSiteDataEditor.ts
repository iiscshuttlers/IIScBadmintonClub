import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { toast } from "sonner";

export interface SiteDataEditorReturn<T> {
  data: T | null;
  setData: (newData: T) => void;
  originalData: T | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  save: (transformer?: (d: T) => any) => Promise<boolean>;
  discard: () => void;
  reload: () => Promise<void>;
}

export function useSiteDataEditor<T>(
  dbKey: string,
  emptyState: T
): SiteDataEditorReturn<T> {
  const [data, setDataRaw] = useState<T | null>(null);
  const [originalData, setOriginalData] = useState<T | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { recordAction, reloadTrigger } = useAdminHistory();
  const mounted = useRef(true);
  // Stabilize emptyState so that callers passing object/array literals
  // (e.g., `useSiteDataEditor("key", [])`) don't cause infinite re-renders.
  const emptyStateRef = useRef(emptyState);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    if (!mounted.current) return;
    setIsLoading(true);
    try {
      const { data: row, error } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", dbKey)
        .maybeSingle();

      if (error) throw error;
      
      let fetchedValue = (row?.value as T) ?? emptyStateRef.current;

      if (mounted.current) {
        setDataRaw(fetchedValue);
        // Deep copy for original to prevent reference mutation
        setOriginalData(JSON.parse(JSON.stringify(fetchedValue)));
        setIsDirty(false);
      }
    } catch (err: any) {
      console.error(`Load ${dbKey}:`, err);
      toast.error(`Failed to load ${dbKey}`);
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [dbKey]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadTrigger]);

  const setData = useCallback((newData: T) => {
    setDataRaw(newData);
    setIsDirty(true);
  }, []);

  const discard = useCallback(() => {
    if (originalData) {
      setDataRaw(JSON.parse(JSON.stringify(originalData)));
      setIsDirty(false);
      toast("Changes discarded", { icon: "↩️" });
    }
  }, [originalData]);

  const save = useCallback(async (writeTransformer?: (d: T) => any): Promise<boolean> => {
    if (!data) return false;
    setIsSaving(true);
    try {
      const payloadToSave = writeTransformer ? writeTransformer(data) : data;
      const originalPayload = writeTransformer && originalData ? writeTransformer(originalData) : originalData;

      const { error } = await supabase
        .from("site_data")
        .upsert(
          { key: dbKey, value: payloadToSave, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );

      if (error) throw error;

      await recordAction({
        action_type: "update",
        entity_type: "site_data",
        entity_id: dbKey,
        before_state: originalPayload,
        after_state: payloadToSave,
        label: `Updated ${dbKey}`,
      });

      if (mounted.current) {
        // Deep copy new original
        setOriginalData(JSON.parse(JSON.stringify(data)));
        setIsDirty(false);
      }
      toast.success(`${dbKey} updated — live instantly.`);
      return true;
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
      return false;
    } finally {
      if (mounted.current) setIsSaving(false);
    }
  }, [data, dbKey, originalData, recordAction]);

  return {
    data,
    setData,
    originalData,
    isDirty,
    isLoading,
    isSaving,
    save,
    discard,
    reload: loadData,
  };
}
