import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { useState } from "react";

export interface InfoModalItem {
  icon?: React.ReactNode;
  badge?: string; // e.g. "PTS", "GW"
  title: string;
  desc: string;
}

export interface InfoModalProps {
  title: string;
  items: InfoModalItem[];
  footer?: React.ReactNode;
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
  mainIcon?: React.ReactNode;
}

export function InfoModal({ title, items, footer, triggerIcon, triggerClassName = "", mainIcon }: InfoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className={`inline-flex items-center justify-center p-1 rounded-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors focus:outline-none ${triggerClassName}`}
        aria-label={`More info about ${title}`}
      >
        {triggerIcon || <HelpCircle className="w-4 h-4 fill-cyan-400 text-foreground" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-3xl flex flex-col shadow-2xl max-h-[60vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky Header */}
              <div className="flex items-center justify-between p-6 sm:p-6 pb-4 shrink-0 bg-slate-900 z-10">
                <div className="flex items-center gap-3">
                  {mainIcon && <div className="text-cyan-400">{mainIcon}</div>}
                  <h2 className="text-lg font-black text-cyan-400 tracking-wider uppercase">
                    {title}
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-slate-800 rounded-full transition-colors focus:outline-none shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 sm:p-6 pt-0 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      {item.badge ? (
                        <div className="flex-shrink-0 mt-0.5">
                          <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase">
                            {item.badge}
                          </span>
                        </div>
                      ) : item.icon ? (
                        <div className="flex-shrink-0 mt-0.5 text-cyan-500">
                          {item.icon}
                        </div>
                      ) : null}
                      
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-foreground leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {footer && (
                  <div className="mt-6 pt-5 border-t border-slate-800">
                    {footer}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
