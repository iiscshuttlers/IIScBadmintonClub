import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Save, Loader2, XCircle } from "lucide-react";
import { useSiteDataEditor } from "@/hooks/useSiteDataEditor";

interface ContentEditorWrapperProps<T> {
  dbKey: string;
  emptyState: T;
  editorName: string;
  EditorComponent: React.ComponentType<{ data: T; onChange: (d: T) => void }>;
  writeTransformer?: (data: T) => any;
  setTabCount?: (count: number) => void;
  countExtractor?: (data: T) => number;
}

export function ContentEditorWrapper<T>({
  dbKey,
  emptyState,
  editorName,
  EditorComponent,
  writeTransformer,
  setTabCount,
  countExtractor
}: ContentEditorWrapperProps<T>) {
  const {
    data,
    setData,
    originalData,
    isDirty,
    isLoading,
    isSaving,
    save,
    discard,
  } = useSiteDataEditor<T>(dbKey, emptyState);

  const [showConfirm, setShowConfirm] = useState(false);

  // Update parent tab counts if needed
  React.useEffect(() => {
    if (setTabCount && data) {
      if (countExtractor) {
        setTabCount(countExtractor(data));
      } else if (Array.isArray(data)) {
        setTabCount(data.length);
      }
    }
  }, [data, setTabCount, countExtractor]);

  if (isLoading || data === null) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSaveClick = async () => {
    const success = await save(writeTransformer);
    if (success) setShowConfirm(false);
  };

  return (
    <>
      <div className="pb-16">
        <EditorComponent data={data} onChange={setData} />
      </div>

      {/* Unsaved changes bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[88px] lg:bottom-6 left-0 right-0 mx-auto w-[90%] sm:w-max z-[9998] flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 sm:gap-4 px-4 sm:px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm font-bold whitespace-nowrap">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <button
                onClick={discard}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-sm font-bold transition disabled:opacity-50"
              >
                Undo
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition disabled:opacity-50 shadow-md w-full sm:w-auto min-w-[140px]"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Save Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
                <h2 className="text-xl font-bold text-foreground dark:text-foreground flex items-center gap-2 capitalize">
                  <Save className="w-5 h-5 text-primary" /> Review Changes: {editorName}
                </h2>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-200 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 min-h-0">
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-2">
                  Please double check your changes before confirming. The left side is what is currently live, and the right side is what will be saved.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-mono">
                  <div className="flex flex-col">
                    <div className="bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 font-bold px-3 py-2 rounded-t-lg border-b border-rose-200 dark:border-rose-800/50">
                      Current Live Version
                    </div>
                    <div className="bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-b-lg text-muted-foreground dark:text-slate-300 whitespace-pre overflow-x-auto border border-rose-100 dark:border-rose-900/30 border-t-0 h-[400px] overflow-y-auto shadow-inner">
                      {JSON.stringify(originalData, null, 2)}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary/70 font-bold px-3 py-2 rounded-t-lg border-b border-primary/40 dark:border-primary/50">
                      Your New Changes
                    </div>
                    <div className="bg-primary/10/50 dark:bg-primary/20 p-4 rounded-b-lg text-muted-foreground dark:text-slate-300 whitespace-pre overflow-x-auto border border-primary/30 dark:border-primary/30 border-t-0 h-[400px] overflow-y-auto shadow-inner">
                      {JSON.stringify(data, null, 2)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                >
                  Keep Editing
                </button>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  ) : (
                    <Save className="w-5 h-5 shrink-0" />
                  )}
                  {isSaving ? "Saving..." : "Confirm & Save"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
