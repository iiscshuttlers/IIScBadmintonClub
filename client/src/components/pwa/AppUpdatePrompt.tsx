import { motion, AnimatePresence } from "framer-motion";
import { Download, Sparkles, X } from "lucide-react";
import type { AppUpdateInfo } from "@/hooks/useAppUpdate";

interface Props {
  updateInfo: AppUpdateInfo | null;
  onDismiss: () => void;
}

export function AppUpdatePrompt({ updateInfo, onDismiss }: Props) {
  const PACKAGE_ID = "com.iiscshuttlers.app";

  const handleUpdate = () => {
    // Try opening Play Store app directly; fall back to browser
    window.location.href = `market://details?id=${PACKAGE_ID}`;
    setTimeout(() => {
      window.open(
        `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`,
        "_blank",
      );
    }, 500);
  };

  return (
    <AnimatePresence>
      {updateInfo && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm bg-slate-900 border border-primary/40 rounded-2xl shadow-2xl shadow-primary/50/30 overflow-hidden">
              {/* Green accent header */}
              <div className="bg-gradient-to-r from-primary to-primary px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-base">
                    Update Available
                  </span>
                </div>
                <button
                  onClick={onDismiss}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-4">
                <p className="text-slate-200 text-sm mb-1">
                  Version{" "}
                  <span className="font-bold text-primary">
                    {updateInfo.versionName}
                  </span>{" "}
                  is now available.
                </p>



                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleUpdate}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary active:scale-95 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Update Now
                  </button>
                  <button
                    onClick={onDismiss}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
