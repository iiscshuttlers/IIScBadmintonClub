import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, X } from "lucide-react";
import { updateMatchVideoUrl } from "@/services/matchService";
import { toast } from "sonner";

interface EditVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  tableName: string;
  initialUrl: string;
  onSuccess: (newUrl: string) => void;
}

export function EditVideoModal({ isOpen, onClose, matchId, tableName, initialUrl, onSuccess }: EditVideoModalProps) {
  const [url, setUrl] = useState(initialUrl || "");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMatchVideoUrl(matchId, tableName, url.trim());
      
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-media/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-black flex items-center gap-2 text-foreground">
              <Video className="w-5 h-5 text-danger" />
              Edit Highlights Link
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-soft mb-2">
                YouTube or Drive URL
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className="w-full px-4 py-3 rounded-xl border border-border-strong bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Leave blank to remove the highlights link. This link will be visible to everyone on the activity feed.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/50">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-soft hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <span className="w-4 h-4 border-2 border-border/20 border-t-border/80 rounded-full animate-spin" />}
              Save Link
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
