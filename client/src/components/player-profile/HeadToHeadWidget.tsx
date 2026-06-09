import { useMemo } from "react";
import { Swords, Trophy, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface HeadToHeadProps {
  currentUserId: string;
  targetUserId: string;
  targetUserName: string;
  matches: any[];
}

export function HeadToHeadWidget({ currentUserId, targetUserId, targetUserName, matches }: HeadToHeadProps) {
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let streak = 0;
    let isWinStreak = true;
    let pointDiff = 0;

    // Filter matches between these two specific players
    const h2hMatches = matches.filter(m => {
      const isP1 = m.player1_id === currentUserId || m.player2_id === currentUserId;
      const isP2 = m.player1_id === targetUserId || m.player2_id === targetUserId;
      // For doubles, also check partners
      const isTeam1 = isP1 || m.team1_partner_id === currentUserId || m.team2_partner_id === currentUserId;
      const isTeam2 = isP2 || m.team1_partner_id === targetUserId || m.team2_partner_id === targetUserId;
      
      return isTeam1 && isTeam2;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    h2hMatches.forEach(m => {
      let myTeamWon = false;
      if (m.match_winner_id === currentUserId) myTeamWon = true;
      if (m.team1_partner_id === currentUserId && m.match_winner_id === m.player1_id) myTeamWon = true;
      if (m.team2_partner_id === currentUserId && m.match_winner_id === m.player2_id) myTeamWon = true;

      if (myTeamWon) wins++;
      else losses++;

      // Calculate Point Differential
      if (m.match_score && Array.isArray(m.match_score)) {
        const isMyTeam1 = m.player1_id === currentUserId || m.team1_partner_id === currentUserId;
        m.match_score.forEach((set: any) => {
          if (isMyTeam1) {
            pointDiff += (set.p1_score || 0) - (set.p2_score || 0);
          } else {
            pointDiff += (set.p2_score || 0) - (set.p1_score || 0);
          }
        });
      }

    });

    // Calculate Streak
    for (let i = 0; i < h2hMatches.length; i++) {
      const m = h2hMatches[i];
      let myTeamWon = false;
      if (m.match_winner_id === currentUserId) myTeamWon = true;
      if (m.team1_partner_id === currentUserId && m.match_winner_id === m.player1_id) myTeamWon = true;
      if (m.team2_partner_id === currentUserId && m.match_winner_id === m.player2_id) myTeamWon = true;

      if (i === 0) {
        isWinStreak = myTeamWon;
        streak = 1;
      } else {
        if (myTeamWon === isWinStreak) streak++;
        else break;
      }
    }

    return { wins, losses, streak, isWinStreak, total: wins + losses, pointDiff };
  }, [currentUserId, targetUserId, matches]);

  
  // Generate Rivalry Milestone text
  const milestoneText = useMemo(() => {
    if (stats.wins === stats.losses - 1) return "You are 1 win away from tying the series!";
    if (stats.wins === stats.losses && stats.total > 0) return "The series is perfectly tied!";
    if (stats.wins === stats.losses + 1) return "They are 1 win away from tying you!";
    if (stats.isWinStreak && stats.streak >= 3) return `You are on fire! ${stats.streak}-game win streak against them.`;
    if (!stats.isWinStreak && stats.streak >= 3) return `On a ${stats.streak}-game losing streak... time for revenge?`;
    if (stats.wins > stats.losses + 3) return "You are dominating this rivalry.";
    if (stats.losses > stats.wins + 3) return "They have your number right now.";
    return null;
  }, [stats]);

  if (stats.total === 0) return null; // No history

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-3xl p-5 border border-indigo-100 dark:border-indigo-800/50 shadow-sm relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Swords className="w-24 h-24 text-indigo-500" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
          <Swords className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-900 dark:text-indigo-300">Head-to-Head</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div>
          <div className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase mb-1">Win Rate</div>
          <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 flex items-end gap-1">
            {Math.round((stats.wins / stats.total) * 100)}%
            <span className="text-sm font-bold text-indigo-500/50 mb-1">({stats.wins}-{stats.losses})</span>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase mb-1">Current Streak</div>
          <div className="flex items-center gap-1.5 text-lg font-black">
            {stats.isWinStreak ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-5 h-5" /> W{stats.streak}
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <TrendingDown className="w-5 h-5" /> L{stats.streak}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 relative z-10 mt-4">
        <div>
          <div className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase mb-1">Point Differential</div>
          <div className={`text-2xl font-black flex items-end gap-1 ${stats.pointDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : stats.pointDiff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
          </div>
        </div>
      </div>

      
      {milestoneText && (
        <div className="mt-3 py-2 px-3 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          {milestoneText}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50 flex justify-between items-center text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70">
        <span>You vs {targetUserName.split(' ')[0]}</span>
        <span>{stats.total} Matches Played</span>
      </div>
    </motion.div>
  );
}
