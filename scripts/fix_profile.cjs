const fs = require("fs");

const targetFilePath = "client/src/pages/PlayerProfile.tsx";
let content = fs.readFileSync(targetFilePath, "utf8");

const brokenBlockStart = `              {validAchievements.length > 0 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                      <Medal className="w-4 h-4 text-emerald-500" /> Achievements Timeline
                    </h3>`;

const brokenBlockEnd = `              )}`;

const newBlock = `              {validAchievements.length > 0 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                      <Medal className="w-4 h-4 text-emerald-500" /> Achievements Timeline
                    </h3>
                    <div className="relative ml-5">
                      {/* Vertical connecting line */}
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-300 via-blue-300 via-purple-300 to-amber-300 dark:from-emerald-700 dark:via-blue-700 dark:to-amber-700 rounded-full" />

                      <div className="space-y-5">
                        {validAchievements.map((ach, idx) => {
                          const lower = ach.toLowerCase();
                          const isGold = lower.includes("winner") || lower.includes("champion") || lower.includes("1st") || lower.includes("gold");
                          const isSilver = lower.includes("runner-up") || lower.includes("2nd") || lower.includes("silver");
                          const isBronze = lower.includes("semifinalist") || lower.includes("bronze") || lower.includes("3rd");

                          const dotColors = isGold
                            ? { ring: 'ring-amber-200 dark:ring-amber-900/50', bg: 'bg-amber-50 dark:bg-amber-950/30', icon: '🥇' }
                            : isSilver
                            ? { ring: 'ring-slate-200 dark:ring-slate-700', bg: 'bg-slate-50 dark:bg-slate-800', icon: '🥈' }
                            : isBronze
                            ? { ring: 'ring-orange-200 dark:ring-orange-900/50', bg: 'bg-orange-50 dark:bg-orange-950/30', icon: '🥉' }
                            : { ring: 'ring-emerald-200 dark:ring-emerald-900/50', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: '⭐' };

                          return (
                            <div key={idx} className="relative flex gap-4 items-start group">
                              {/* Dot on timeline */}
                              <div className={\`relative -ml-[18px] mt-0.5 shrink-0 w-9 h-9 rounded-full \${dotColors.ring} ring-[3px] \${dotColors.bg} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300\`}>
                                <span className="text-sm">{dotColors.icon}</span>
                              </div>
                              {/* Achievement card */}
                              <div className="flex-1 py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">{ach}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}`;

const startIndex = content.indexOf(
  '              {validAchievements.length > 0 && (\r\n                <div className="space-y-6">\r\n                  <div>\r\n                    <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">\r\n                      <Medal className="w-4 h-4 text-emerald-500" /> Achievements Timeline\r\n                    </h3>',
);

if (startIndex !== -1) {
  const endIndex = content.indexOf("              )}", startIndex) + 16;
  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);

  fs.writeFileSync(targetFilePath, before + newBlock + after);
  console.log("Successfully replaced achievements block.");
} else {
  console.error("Could not find start index.");
}
