import { motion } from "framer-motion";
import { Crosshair, Zap, User, Sparkles, Activity } from "lucide-react";

export function PlayerAttributesWidget({ player, itemVariants }: { player: any, itemVariants: any }) {
  return (
                <motion.section variants={itemVariants}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
                      Player Attributes
                    </span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {(
                      [
                        {
                          Icon: Crosshair,
                          label: "Playing Style",
                          value: player.playingStyle,
                          accent: "from-amber-400 to-orange-500",
                          iconBg: "bg-amber-500/[0.12]",
                          iconColor: "text-amber-500",
                        },
                        {
                          Icon: Zap,
                          label: "Signature Shot",
                          value: player.favoriteShot,
                          accent: "from-rose-400 to-pink-500",
                          iconBg: "bg-rose-500/[0.12]",
                          iconColor: "text-rose-500",
                        },
                        {
                          Icon: User,
                          label: "Dominant Hand",
                          value: player.dominantHand,
                          accent: "from-blue-400 to-cyan-500",
                          iconBg: "bg-blue-500/[0.12]",
                          iconColor: "text-blue-500",
                        },
                        {
                          Icon: Sparkles,
                          label: "Badminton Idol",
                          value: player.favoriteIdol,
                          accent: "from-violet-400 to-purple-500",
                          iconBg: "bg-violet-500/[0.12]",
                          iconColor: "text-violet-500",
                        },
                        {
                          Icon: Activity,
                          label: "Favorite Format",
                          value: player.favoriteFormat,
                          accent: "from-emerald-400 to-teal-500",
                          iconBg: "bg-emerald-500/[0.12]",
                          iconColor: "text-emerald-500",
                        },
                      ] as const
                    ).map((attr) => (
                      <div
                        key={attr.label}
                        className="relative overflow-hidden bg-white/5 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/14 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 hover:-translate-y-0.5 transition-all duration-300 group"
                      >
                        <div
                          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${attr.accent}`}
                        />
                        <div
                          className={`w-9 h-9 rounded-xl ${attr.iconBg} flex items-center justify-center mb-4`}
                        >
                          <attr.Icon className={`w-4 h-4 ${attr.iconColor}`} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-white/35 mb-1.5 uppercase tracking-wider">
                          {attr.label}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-800 dark:text-white/90 leading-snug">
                          {attr.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
  );
}
