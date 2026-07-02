import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface EditVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  initialUrl: string;
  onSuccess: (newUrl: string) => void;
}

export function EditVideoModal({ isOpen, onClose, matchId, initialUrl, onSuccess }: EditVideoModalProps) {
  const [url, setUrl] = useState(initialUrl || "");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ video_url: url.trim() })
        .eq("id", matchId);
      
      if (error) throw error;
      
      toast.success("Video link updated!");
      onSuccess(url.trim());
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update video link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-black flex items-center gap-2 text-foreground dark:text-foreground">
              <Video className="w-5 h-5 text-rose-500" />
              Edit Highlights Link
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-muted-foreground dark:text-slate-300 mb-2">
                YouTube or Drive URL
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-foreground dark:text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Leave blank to remove the highlights link. This link will be visible to everyone on the activity feed.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Save Link
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
