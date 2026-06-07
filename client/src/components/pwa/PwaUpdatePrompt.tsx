import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r)
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 w-80 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl shadow-emerald-900/20 rounded-2xl p-5 overflow-hidden"
        >
          {/* Decorative glowing orb */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl rounded-full -mr-16 -mt-16 pointer-events-none" />

          <div className="relative">
            <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              Update Available!
            </h3>
            <p className="text-slate-300 text-sm mb-5 leading-relaxed">
              A new version of the app is ready. Reload to get the latest features and bug fixes.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => updateServiceWorker(true)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                Reload & Update
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
