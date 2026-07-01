import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Target, Trophy, Zap, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Challenge {
  id: string;
  week_start: string;
  title: string;
  description: string;
  type: string;
  target: number;
  points: number;
}

interface Progress {
  challenge_id: string;
  progress: number;
  completed: boolean;
}

// Generate deterministic challenges for the current week without needing DB rows
function getThisWeekChallenges(): Omit<Challenge, "id" | "week_start">[] {
  return [
    { title: "Win 3 Matches", description: "Win any 3 matches this week", type: "wins", target: 3, points: 15 },
    { title: "Play 5 Matches", description: "Participate in 5 matches this week", type: "matches", target: 5, points: 10 },
    { title: "Singles Specialist", description: "Win 2 singles matches", type: "singles", target: 2, points: 20 },
    { title: "Doubles Dynamo", description: "Play 2 doubles matches", type: "doubles", target: 2, points: 15 },
    { title: "Win Streak", description: "Win 3 matches in a row (all-time)", type: "streak", target: 3, points: 25 },
  ];
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

export function WeeklyChallenges() {
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return; }

    const load = async () => {
      const weekStart = getWeekStart();

      // Fetch or create this week's challenges
      let { data: existing } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("week_start", weekStart);

      if (!existing || existing.length === 0) {
        const templates = getThisWeekChallenges();
        const { data: created } = await supabase
          .from("weekly_challenges")
          .insert(templates.map((t) => ({ ...t, week_start: weekStart })))
          .select();
        existing = created ?? [];
      }
      setChallenges((existing ?? []) as Challenge[]);

      // Fetch player's match stats for this week
      const since = new Date(weekStart).toISOString();
      const { data: weekMatches } = await supabase
        .from("matches")
        .select("id, winner_id, player1_id, player2_id, match_score, status, created_at")
        .eq("status", "confirmed")
        .gte("created_at", since)
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`);

      const matches = weekMatches ?? [];
      const myWins = matches.filter((m: any) => m.winner_id === profile.id).length;
      const myMatches = matches.length;
      const mySingles = matches.filter((m: any) => {
        const scoreStr: string = m.match_score ?? "";
        return m.winner_id === profile.id && !scoreStr.includes("[");
      }).length;
      const myDoubles = matches.filter((m: any) => {
        const scoreStr: string = m.match_score ?? "";
        return scoreStr.includes("[");
      }).length;

      // Streak: fetch recent confirmed matches all-time
      const { data: allRecent } = await supabase
        .from("matches")
        .select("winner_id")
        .eq("status", "confirmed")
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      let streak = 0;
      for (const m of allRecent ?? []) {
        if ((m as any).winner_id === profile.id) streak++;
        else break;
      }

      // Fetch existing progress records
      if (existing && existing.length > 0) {
        const { data: existingProgress } = await supabase
          .from("challenge_progress")
          .select("challenge_id, progress, completed")
          .eq("player_id", profile.id)
          .in("challenge_id", existing.map((c: any) => c.id));

        const progMap: Record<string, Progress> = {};
        for (const p of existingProgress ?? []) {
          progMap[(p as any).challenge_id] = p as Progress;
        }

        // Calculate current progress for each challenge
        const progressValues: Record<string, number> = {
          wins: myWins,
          matches: myMatches,
          singles: mySingles,
          doubles: myDoubles,
          streak,
        };

        // Upsert progress
        for (const c of existing as Challenge[]) {
          const currentProgress = progressValues[c.type] ?? 0;
          const completed = currentProgress >= c.target;
          const alreadyCompleted = progMap[c.id]?.completed;

          if (!alreadyCompleted || progMap[c.id]?.progress !== currentProgress) {
            await supabase.from("challenge_progress").upsert({
              challenge_id: c.id,
              player_id: profile.id,
              progress: currentProgress,
              completed,
              completed_at: completed ? new Date().toISOString() : null,
            }, { onConflict: "challenge_id,player_id" });

            if (completed && !alreadyCompleted) {
              toast.success(`Challenge complete: ${c.title} (+${c.points} pts)!`);
            }
          }

          progMap[c.id] = { challenge_id: c.id, progress: currentProgress, completed };
        }
        setProgress(progMap);
      }

      setLoading(false);
    };

    load();
  }, [profile?.id]);

  if (!profile?.id || (challenges.length === 0 && !loading)) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" />
        <h3 className="font-black text-slate-800 dark:text-foreground">This Week's Challenges</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {challenges.map((c) => {
            const prog = progress[c.id];
            const current = prog?.progress ?? 0;
            const completed = prog?.completed ?? false;
            const pct = Math.min(100, Math.round((current / c.target) * 100));

            return (
              <div key={c.id} className={`px-5 py-4 flex items-center gap-3 ${completed ? "bg-primary/10/50 dark:bg-primary/10" : ""}`}>
                <div className={`p-2 rounded-xl shrink-0 ${completed ? "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"}`}>
                  {completed ? <CheckCircle className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-black ${completed ? "text-primary dark:text-primary" : "text-slate-800 dark:text-foreground"}`}>{c.title}</p>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">+{c.points} pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">{c.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${completed ? "bg-primary" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground shrink-0">{current}/{c.target}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
