import { motion } from "framer-motion";
import { Target, Dna, Activity, Footprints, Shirt, Star } from "lucide-react";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

interface EquipmentArsenalSectionProps {
  player: any;
}

export function EquipmentArsenalSection({ player }: EquipmentArsenalSectionProps) {
  if (!player.racketDetails?.length && !player.shoesList?.length && !player.shoes && !player.apparel) {
    return null;
  }

  return (
    <motion.section variants={itemVariants}>
      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
        <Target className="w-6 h-6 text-rose-500" />
        Equipment Arsenal
      </h2>

      <div className="space-y-4">
        {player.racketDetails.map((racket: any, idx: number) => {
          const isMain = racket.name === player.currentRacket;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 group
                ${isMain
                  ? 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                  : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30'}`}
            >
              {isMain && (
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">{racket.name}</h3>
                    {isMain && (
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-emerald-500 text-white rounded-lg shadow-sm">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><Dna className="w-4 h-4 text-blue-500" /> String: <span className="font-semibold text-slate-800 dark:text-slate-200">{racket.string}</span></span>
                    <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-rose-500" /> Tension: <span className="font-semibold text-slate-800 dark:text-slate-200">{racket.tension}</span></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Shoes & apparel */}
        {((player.shoesList && player.shoesList.length > 0) || player.shoes || player.apparel) && (
          <div className="space-y-4 mt-4">
            {player.shoesList && player.shoesList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {player.shoesList.map((shoe: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-4 relative overflow-hidden group">
                    {shoe.primary && (
                      <div className="absolute -right-10 -top-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Footprints className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold font-sans">Footwear</div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{shoe.name}</div>
                      </div>
                    </div>
                    {shoe.primary && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-emerald-500 text-white rounded z-10 shrink-0">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : player.shoes ? (
              <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <Footprints className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Footwear</div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{player.shoes}</div>
                </div>
              </div>
            ) : null}

            {player.apparel && (
              <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                  <Shirt className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Apparel</div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{player.apparel}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

export function CareerHighlightsSection({ player }: { player: any }) {
  if (!player.careerHighlights || player.careerHighlights.length === 0) {
    return null;
  }

  return (
    <motion.section variants={itemVariants}>
      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
        <Star className="w-6 h-6 text-amber-500" />
        Career Highlights
      </h2>
      <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
        <ol className="relative border-l-2 border-dashed border-emerald-500/30 ml-2 space-y-6">
          {player.careerHighlights.map((h: any, idx: number) => (
            <li key={idx} className="ml-6">
              <span className="absolute -left-[11px] w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 ring-4 ring-white dark:ring-slate-800 shadow shadow-emerald-500/30" />
              <div className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{h.year}</div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{h.title}</div>
              {h.description && <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{h.description}</div>}
            </li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}

