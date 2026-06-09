import { motion } from "framer-motion";
import { Target, Dna, Activity, Footprints, Shirt, Star } from "lucide-react";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

interface EquipmentArsenalSectionProps {
  player: any;
}

export function EquipmentArsenalSection({
  player,
}: EquipmentArsenalSectionProps) {
  if (
    !player.racketDetails?.length &&
    !player.shoesList?.length &&
    !player.shoes &&
    !player.apparel
  ) {
    return null;
  }

  return (
    <motion.section variants={itemVariants}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 shrink-0">
          Equipment Arsenal
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="space-y-3">
        {player.racketDetails.map((racket: any, idx: number) => {
          const isMain = racket.name === player.currentRacket;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-300 group
                ${
                  isMain
                    ? "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/40 shadow-sm hover:shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md"
                }`}
            >
              {/* Accent bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 ${isMain ? "bg-linear-to-r from-emerald-400 to-teal-500" : "bg-linear-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600"}`}
              />

              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Target
                          className={`w-4 h-4 ${isMain ? "text-emerald-500" : "text-slate-400"}`}
                        />
                      </div>
                      <h3 className="font-black text-base text-slate-900 dark:text-white">
                        {racket.name}
                      </h3>
                      {isMain && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-500 text-white rounded-lg">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 ml-10 sm:ml-0 pl-10 sm:pl-0">
                      <span className="flex items-center gap-1.5">
                        <Dna className="w-3.5 h-3.5 text-blue-400" />
                        String:{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200 ml-0.5">
                          {racket.string}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-rose-400" />
                        Tension:{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200 ml-0.5">
                          {racket.tension}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Shoes & Apparel */}
        {((player.shoesList && player.shoesList.length > 0) ||
          player.shoes ||
          player.apparel) && (
          <div className="space-y-3 mt-1">
            {player.shoesList && player.shoesList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {player.shoesList.map((shoe: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative group"
                  >
                    <div
                      className={`absolute top-0 left-0 right-0 h-0.5 ${shoe.primary ? "bg-linear-to-r from-blue-400 to-cyan-500" : "bg-linear-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600"}`}
                    />
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                          <Footprints className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-black mb-0.5">
                            Footwear
                          </div>
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {shoe.name}
                          </div>
                        </div>
                      </div>
                      {shoe.primary && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-500 text-white rounded-lg shrink-0">
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : player.shoes ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-blue-400 to-cyan-500" />
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                    <Footprints className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-black mb-0.5">
                      Footwear
                    </div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {player.shoes}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {player.apparel && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-violet-400 to-purple-500" />
                <div className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                    <Shirt className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 font-black mb-0.5">
                      Apparel
                    </div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {player.apparel}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

const TIMELINE_COLORS = [
  {
    ring: "ring-emerald-200 dark:ring-emerald-900/40",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "text-emerald-500 dark:text-emerald-400",
  },
  {
    ring: "ring-blue-200 dark:ring-blue-900/40",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "text-blue-500 dark:text-blue-400",
  },
  {
    ring: "ring-purple-200 dark:ring-purple-900/40",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "text-purple-500 dark:text-purple-400",
  },
  {
    ring: "ring-amber-200 dark:ring-amber-900/40",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    icon: "text-amber-500 dark:text-amber-400",
  },
  {
    ring: "ring-rose-200 dark:ring-rose-900/40",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    icon: "text-rose-500 dark:text-rose-400",
  },
];

export function CareerHighlightsSection({ player }: { player: any }) {
  if (!player.careerHighlights || player.careerHighlights.length === 0) {
    return null;
  }

  return (
    <motion.section variants={itemVariants}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 shrink-0">
          Career Highlights
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="relative ml-6">
        {/* Vertical timeline line */}
        <div className="absolute left-0 top-3 bottom-3 w-px bg-linear-to-b from-emerald-300 via-blue-300 to-purple-300 dark:from-emerald-700 dark:via-blue-700 dark:to-purple-700 rounded-full" />

        <div className="space-y-5">
          {[...player.careerHighlights]
            .sort(
              (a: any, b: any) =>
                parseInt(b.year || "0", 10) - parseInt(a.year || "0", 10),
            )
            .map((h: any, idx: number) => {
              const color = TIMELINE_COLORS[idx % TIMELINE_COLORS.length];
              return (
                <div
                  key={idx}
                  className="relative flex gap-4 items-start group"
                >
                  {/* Timeline dot */}
                  <div
                    className={`relative -ml-4.5 mt-1 shrink-0 w-9 h-9 rounded-full ${color.ring} ring-2 ${color.bg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Star className={`w-3.5 h-3.5 ${color.icon}`} />
                  </div>
                  {/* Card */}
                  <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-1">
                      {h.year}
                    </div>
                    <div className="text-sm font-black text-slate-800 dark:text-white leading-snug">
                      {h.title}
                    </div>
                    {h.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        {h.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </motion.section>
  );
}
