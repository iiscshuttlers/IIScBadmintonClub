import { AnimatePresence, motion } from "framer-motion";
import { useMatchNotification } from "@/hooks/useMatchNotification";

/**
 * Full-screen overlay that shows a blinking shuttlecock + message
 * when a match involving the user is logged. Auto-dismisses after 4s.
 */
export default function MatchAlert() {
  const notification = useMatchNotification();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center"
        >
          {/* Subtle dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative flex flex-col items-center gap-4 pointer-events-auto"
          >
            {/* Blinking shuttle */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [1, 0.5, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: 4,
                ease: "easeInOut",
              }}
              className="text-8xl drop-shadow-[0_0_30px_rgba(16,185,129,0.6)]"
            >
              🏸
            </motion.div>

            {/* Radial pulse ring */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0.8 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: 2, ease: "easeOut" }}
              className="absolute w-32 h-32 rounded-full border-4 border-primary/60"
            />

            {/* Message */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg rounded-2xl px-8 py-4 shadow-2xl border border-primary/40 dark:border-primary/80 text-center max-w-xs"
            >
              <p className="text-lg font-black text-slate-900 dark:text-white mb-1">
                New Match Alert!
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {notification.opponentName
                  ? `${notification.opponentName} logged a match with you`
                  : "A match was just logged involving you"}
              </p>
              <p className="text-xs text-primary dark:text-primary font-bold mt-2">
                Check your profile to confirm 🏸
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
