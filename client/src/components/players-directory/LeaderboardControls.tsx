import { Trophy, Crown, Flame, BarChart3, Download, Swords } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";

interface Props {
  activeTab: "elo" | "ironman";
  setActiveTab: (val: "elo" | "ironman") => void;
  categoryFilter: "ALL" | "MS" | "WS" | "MD" | "WD" | "XD";
  setCategoryFilter: (val: "ALL" | "MS" | "WS" | "MD" | "WD" | "XD") => void;
  ironmanFilter: "all" | "monthly";
  setIronmanFilter: (val: "all" | "monthly") => void;
  exportLeaderboard: () => void;
  eloMode: "club" | "tournament";
  setEloMode: (val: "club" | "tournament") => void;
}

export function LeaderboardControls({
  activeTab, setActiveTab, categoryFilter, setCategoryFilter,
  ironmanFilter, setIronmanFilter, exportLeaderboard,
  eloMode, setEloMode
}: Props) {
  return (
    <>
      <div className="flex justify-center mb-12">
        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-slate-200 dark:border-slate-700">
          <div
            onClick={() => setActiveTab("elo")}
            role="button"
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "elo" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            <div className="flex items-center"><Crown className="w-4 h-4 mr-1.5" />ELO Rankings</div>
            <InfoModal
              title="HOW ELO RANKING WORKS"
              mainIcon={<BarChart3 className="w-5 h-5" />}
              items={[
                { badge: "W/L", title: "Win or Loss", desc: "The system only cares if you win or lose. Point margins (e.g., 21-5 vs 22-20) or sets played do not affect Elo changes." },
                { badge: "MATH", title: "Expected Outcome", desc: "If you beat a higher-ranked player, you gain more points because you were mathematically expected to lose. Beating a lower-ranked player yields fewer points." },
                { badge: "CAL", title: "Calibration Phase", desc: "Your rank fluctuates heavily (±20-40 points per match) during your first 10 matches to quickly find your true baseline." },
                { badge: "STB", title: "Stabilization", desc: "After 10 matches, your Elo changes become more stable (max ±20 points per match)." },
                { badge: "GLB", title: "Global vs Format", desc: "You have separate Elos for MS, MD, and XD. Your 'Global Elo' (ALL tab) blends these but moves at 1/3 speed to maintain balance." }
              ]}
              footer={<p className="text-[10px] sm:text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400 mt-2 text-center overflow-x-auto hide-scrollbar whitespace-nowrap">Expected = 1 / (1 + 10^((OpponentElo - YourElo)/400))</p>}
            />
          </div>
          <div
            onClick={() => setActiveTab("ironman")}
            role="button"
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === "ironman" ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
          >
            <div className="flex items-center"><Flame className="w-4 h-4 mr-1.5" />Ironman Endurance</div>
            <InfoModal
              title="IRONMAN ENDURANCE"
              mainIcon={<Trophy className="w-5 h-5" />}
              items={[
                { badge: "PLAY", title: "Most Active", desc: "Ranked entirely by the total number of matches you have played, regardless of wins or losses." },
                { badge: "IRON", title: "The Ironman Badge", desc: "Playing 50+ matches in a single month might earn you the exclusive Ironman badge!" }
              ]}
              triggerClassName={activeTab === "ironman" ? "text-orange-100 hover:text-white" : ""}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-10 px-4">
        <div className="flex gap-2 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-full md:w-auto overflow-x-auto hide-scrollbar">
          {(["ALL", "MS", "WS", "MD", "WD", "XD"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {cat === "ALL" ? "Global" : cat}
            </button>
          ))}
        </div>
        {activeTab === "ironman" && (
          <div className="flex gap-2 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-full md:w-auto shrink-0">
            <button
              onClick={() => setIronmanFilter("all")}
              className={`flex-1 px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                ironmanFilter === "all"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              All-Time
            </button>
            <button
              onClick={() => setIronmanFilter("monthly")}
              className={`flex-1 px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                ironmanFilter === "monthly"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              This Month
            </button>
          </div>
        )}
        {activeTab === "elo" && (
          <div className="flex gap-1 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shrink-0">
            <button
              onClick={() => setEloMode("club")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${eloMode === "club" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <Crown className="w-3 h-3" /> Club
            </button>
            <button
              onClick={() => setEloMode("tournament")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${eloMode === "tournament" ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <Swords className="w-3 h-3" /> Tournament
            </button>
          </div>
        )}
        <button
           onClick={exportLeaderboard}
           className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs transition-all border border-slate-200 dark:border-slate-700 w-full md:w-auto justify-center md:absolute right-4"
        >
           <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
    </>
  );
}
