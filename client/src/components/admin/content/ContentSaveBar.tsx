import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, Minus, Pencil, Plus, Save, Undo2, XCircle } from "lucide-react";
import { DOC_SPECS, summarizeChange, type ChangeLine, type ContentKey } from "./contentModel";
import { useContentStore } from "./contentStore";

const KIND_STYLE: Record<ChangeLine["kind"], { Icon: typeof Plus; cls: string; word: string }> = {
  added: { Icon: Plus, cls: "text-success", word: "Added" },
  removed: { Icon: Minus, cls: "text-danger", word: "Removed" },
  edited: { Icon: Pencil, cls: "text-info", word: "Edited" },
};

const MAX_LINES = 8;

/**
 * The one save bar for the whole Content hub. It lists which sections have
 * unsaved edits, and Review opens a plain-language summary (with the raw JSON
 * one click away) before anything goes live.
 */
export function ContentSaveBar() {
  const { dirtyKeys, saving, discard, saveAll, checkConflicts, originals, docs } = useContentStore();
  const [reviewing, setReviewing] = useState(false);
  const [conflicts, setConflicts] = useState<ContentKey[]>([]);

  const openReview = async () => {
    setReviewing(true);
    setConflicts(await checkConflicts());
  };

  const confirm = async () => {
    if (await saveAll()) setReviewing(false);
  };

  const labels = dirtyKeys.map((k) => DOC_SPECS[k].label);

  return (
    <>
      <AnimatePresence>
        {dirtyKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="region"
            aria-label="Unsaved content changes"
            className="fixed bottom-[88px] lg:bottom-6 left-0 right-0 mx-auto w-[calc(100%-2rem)] sm:w-max sm:max-w-[calc(100%-2rem)] z-[9998] flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-muted text-foreground shadow-2xl border border-border-strong"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-bold">Unsaved changes</p>
                <p className="text-xs text-muted-foreground truncate">{labels.join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:ml-2">
              <button
                type="button"
                onClick={() => discard()}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card text-sm font-bold transition disabled:opacity-50"
              >
                <Undo2 className="w-4 h-4" aria-hidden /> Undo all
              </button>
              <button
                type="button"
                onClick={openReview}
                disabled={saving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition disabled:opacity-50 shadow-md"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
                Review &amp; save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewing && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-media/60 backdrop-blur-sm p-4"
            onClick={() => !saving && setReviewing(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="content-review-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-border flex justify-between items-center shrink-0">
                <h2 id="content-review-title" className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Save className="w-5 h-5 text-primary" aria-hidden /> Review changes
                </h2>
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-soft transition"
                >
                  <XCircle className="w-6 h-6" aria-hidden />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
                <p className="text-sm text-muted-foreground">Everything below goes live as soon as you save.</p>
                {dirtyKeys.map((key) => {
                  const lines = summarizeChange(key, originals[key] as never, docs[key] as never);
                  const spec = DOC_SPECS[key];
                  return (
                    <section key={key} className="rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-foreground">{spec.label}</h3>
                        <button
                          type="button"
                          onClick={() => discard(key)}
                          disabled={saving}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          Undo this
                        </button>
                      </div>
                      {conflicts.includes(key) && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 border border-warning/30 px-2.5 py-1.5 text-xs text-warning">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                          {spec.keepsOutsideAdds
                            ? "Someone else changed this since you opened the page. Items they added are kept; items you both edited take your version."
                            : "Someone else changed this since you opened the page. Saving replaces their version with yours."}
                        </p>
                      )}
                      <ul className="space-y-1">
                        {lines.slice(0, MAX_LINES).map((line, i) => {
                          const { Icon, cls, word } = KIND_STYLE[line.kind];
                          return (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} aria-hidden />
                              <span className="sr-only">{word}: </span>
                              <span className="text-soft break-words min-w-0">{line.text}</span>
                            </li>
                          );
                        })}
                        {lines.length > MAX_LINES && (
                          <li className="text-xs text-muted-foreground pl-6">and {lines.length - MAX_LINES} more</li>
                        )}
                      </ul>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-bold">
                          Show raw data
                        </summary>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 font-mono">
                          <pre className="rounded-lg bg-danger/10 border border-danger/20 p-2 max-h-60 overflow-auto whitespace-pre text-soft">
                            {JSON.stringify(originals[key], null, 2)}
                          </pre>
                          <pre className="rounded-lg bg-primary/10 border border-primary/20 p-2 max-h-60 overflow-auto whitespace-pre text-soft">
                            {JSON.stringify(docs[key], null, 2)}
                          </pre>
                        </div>
                      </details>
                    </section>
                  );
                })}
                {dirtyKeys.length === 0 && <p className="text-sm text-muted-foreground">Nothing left to save.</p>}
              </div>

              <div className="p-4 sm:p-5 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  disabled={saving}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-soft hover:bg-muted transition disabled:opacity-50"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving || dirtyKeys.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Save className="w-5 h-5" aria-hidden />}
                  {saving ? "Saving…" : `Save ${dirtyKeys.length} section${dirtyKeys.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
