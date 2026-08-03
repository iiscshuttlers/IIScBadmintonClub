import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
import { TrendingUp, Trophy, Info } from "lucide-react";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ProfileRankingTabProps {
  player: any;
  authSession: any;
  liveMatches: any[];
  HeadToHeadWidget: any;
  Badges: any;
  id: string;
  eloRank?: any;
  eloHistoryData?: any[];
}

export function ProfileRankingTab({
  player,
  authSession,
  liveMatches,
  HeadToHeadWidget,
  Badges,
  id,
  eloRank,
  eloHistoryData = [],
}: ProfileRankingTabProps) {

  const genderPrefix = eloRank?.targetGender === "female" ? "W" : (eloRank?.targetGender === "male" ? "M" : "");
  const singlesLabel = genderPrefix ? `${genderPrefix}S Rank` : "Singles Rank";
  const doublesLabel = genderPrefix ? `${genderPrefix}D Rank` : "Doubles Rank";

  return (
    <motion.section variants={itemVariants} className="space-y-6 md:space-y-6">
      {authSession?.user?.id && player.userId && authSession.user.id !== player.userId && (
        <HeadToHeadWidget
          currentUserId={authSession.user.id}
          targetUserId={player.userId}
          targetUserName={player.fullName || ""}
          matches={liveMatches.filter((m) => m.status === "confirmed")}
        />
      )}

      <Badges
        matches={liveMatches.filter((m) => m.status === "confirmed")}
        playerId={id}
      />

      {/* Format Rankings */}
      <div className="flex flex-wrap gap-3 md:gap-4">
        <div className="flex-1 min-w-[140px] bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 flex flex-col shadow-lg shadow-amber-500/20 text-foreground relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <Trophy className="w-20 h-20" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 mb-1 relative z-10">Overall Rank</span>
          <span className="text-3xl font-black relative z-10">{eloRank?.overall ? `#${eloRank.overall}` : "N/A"}</span>
        </div>

        <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">{singlesLabel}</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.singles ? `#${eloRank.singles}` : "N/A"}</span>
        </div>

        <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">{doublesLabel}</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.doubles ? `#${eloRank.doubles}` : "N/A"}</span>
        </div>

        <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">Mixed Rank</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.mixed ? `#${eloRank.mixed}` : "N/A"}</span>
        </div>
      </div>


      {(!authSession?.user?.id || player.userId === authSession.user.id) &&
        eloHistoryData.length <= 1 &&
        liveMatches.length < 5 && (
          <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 text-center">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-foreground/10 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-muted-foreground dark:text-foreground/40">
              Not Enough Data
            </h3>
            <p className="text-xs text-muted-foreground dark:text-foreground/20 mt-1">
              Play more matches to unlock ranking analytics.
            </p>
          </div>
        )}
    </motion.section>
  );
}
