import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Swords, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  targetPlayer: any;
}

export function ChallengeModal({ isOpen, onClose, currentUser, targetPlayer }: ChallengeModalProps) {
  const [format, setFormat] = useState("MS");
  const [scheduledTime, setScheduledTime] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !targetPlayer) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("challenges").insert({
        challenger_id: currentUser.id,
        challenged_id: targetPlayer.id,
        format,
        scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
        message: message.trim() || null
      });

      if (error) throw error;
      toast.success("Challenge issued successfully!");
      onClose();
    } catch (error: any) {
      toast.error("Failed to issue challenge: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-[101] overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-orange-500/10 to-rose-500/10">
              <h2 className="text-xl font-black text-foreground dark:text-foreground flex items-center gap-2">
                <Swords className="w-6 h-6 text-orange-500" /> Challenge Player
              </h2>
              <button
                onClick={onClose}
                className="p-2 bg-white/50 dark:bg-black/20 rounded-full text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6 custom-scrollbar">
              <form id="challenge-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-muted-foreground dark:text-slate-300 mb-2">Opponent</label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <img src={targetPlayer.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <div className="font-bold text-foreground dark:text-foreground">{targetPlayer.fullName}</div>
                      <div className="text-xs text-muted-foreground font-medium">ELO: {targetPlayer.elo_rating}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-muted-foreground dark:text-slate-300 mb-2">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-foreground dark:text-foreground focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  >
                    <option value="MS">Men's Singles</option>
                    <option value="WS">Women's Singles</option>
                    <option value="MD">Men's Doubles</option>
                    <option value="WD">Women's Doubles</option>
                    <option value="XD">Mixed Doubles</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-muted-foreground dark:text-slate-300 mb-2">Proposed Time <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-foreground dark:text-foreground focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-muted-foreground dark:text-slate-300 mb-2">Message <span className="text-muted-foreground font-normal">(Optional)</span></label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="E.g., Let's play tomorrow evening!"
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-foreground dark:text-foreground focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                  />
                </div>
              </form>
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                form="challenge-form"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-on-accent rounded-xl font-black text-sm uppercase tracking-widest shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Swords className="w-5 h-5" /> Send Challenge</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
