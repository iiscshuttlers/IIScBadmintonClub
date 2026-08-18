import { useRef, useState } from "react";
import { Share2, Download, Trophy, Flame, Target, TrendingUp, Zap } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { toast } from "sonner";

interface Match {
  id: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  status?: string;
  created_at?: string;
  match_score?: string;
}

interface Props {
  playerName: string;
  avatarUrl?: string;
  elo: number;
  matches: Match[];
  playerId: string;
  year?: number;
}

export function WrappedCard({ playerName, avatarUrl, elo, matches, playerId, year = new Date().getFullYear() }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const yearMatches = matches.filter((m) => {
    if (!m.created_at) return false;
    return new Date(m.created_at).getFullYear() === year && m.status === "confirmed";
  });

  const wins = yearMatches.filter((m) => m.winner_id === playerId).length;
  const losses = yearMatches.length - wins;
  const winRate = yearMatches.length > 0 ? Math.round((wins / yearMatches.length) * 100) : 0;

  // Best streak
  let bestStreak = 0, currentStreak = 0;
  for (const m of yearMatches) {
    if (m.winner_id === playerId) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else currentStreak = 0;
  }

  // Most active month
  const monthCounts: Record<number, number> = {};
  for (const m of yearMatches) {
    const month = new Date(m.created_at!).getMonth();
    monthCounts[month] = (monthCounts[month] ?? 0) + 1;
  }
  const busyMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const busyMonthName = busyMonth ? MONTHS[Number(busyMonth[0])] : "—";

  const share = async () => {
    setSharing(true);
    try {
      const text = `🏸 My ${year} Badminton Wrapped at IISc Badminton Club!\n\n${wins}W / ${losses}L • ${winRate}% Win Rate\nBest Streak: ${bestStreak} 🔥\nELO: ${elo}\nBusiest Month: ${busyMonthName}\n\n#IIScShuttlers #Badminton`;

      if (Capacitor.isNativePlatform()) {
        await Share.share({ text, title: `${playerName}'s ${year} Wrapped` });
      } else if (navigator.share) {
        await navigator.share({ text, title: `${playerName}'s ${year} Wrapped` });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
      }
    } catch (e) {
      // user cancelled share
    } finally {
      setSharing(false);
    }
  };

  if (yearMatches.length < 3) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" /> {year} Wrapped
        </h3>
        <button onClick={share} disabled={sharing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>

      {/* Wrapped card visual */}
      <div ref={cardRef}
        className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-indigo-950 to-primary/90 p-6 text-on-accent">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.4),transparent)]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-12 h-12 rounded-full object-cover border-2 border-primary/50" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/30 border-2 border-primary/50 flex items-center justify-center text-lg font-black text-primary/70">
                {playerName[0]}
              </div>
            )}
            <div>
              <p className="font-black text-foreground text-lg leading-tight">{playerName}</p>
              <p className="text-primary text-xs font-bold uppercase tracking-wider">{year} Season</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-3xl font-black text-primary">{wins}</div>
              <div className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Wins</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="text-3xl font-black text-foreground/80">{losses}</div>
              <div className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Losses</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <Target className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <div className="text-base font-black text-foreground">{winRate}%</div>
              <div className="text-[10px] text-foreground/50 font-bold">Win Rate</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <div className="text-base font-black text-foreground">{bestStreak}</div>
              <div className="text-[10px] text-foreground/50 font-bold">Best Streak</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-base font-black text-foreground">{elo}</div>
              <div className="text-[10px] text-foreground/50 font-bold">ELO</div>
            </div>
          </div>

          {busyMonth && (
            <div className="mt-3 bg-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-foreground/60 font-bold">Busiest Month</span>
              <span className="text-xs font-black text-amber-400">{busyMonthName} ({busyMonth[1]} matches)</span>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-wider"><span className="normal-case">IISc</span> Badminton Club</p>
          </div>
        </div>
      </div>
    </div>
  );
}
