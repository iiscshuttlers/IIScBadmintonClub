import { useParams, Link } from "wouter";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy, Users, TrendingUp, Swords, ArrowLeft, Loader2 } from "lucide-react";

import type { PlayerRow as Player } from "@/types";

interface Match {
  id: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  match_score?: string;
  status?: string;
  created_at?: string;
}

function Avatar({ player, size = "md" }: { player: Player | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-20 h-20 text-2xl" : size === "sm" ? "w-10 h-10 text-sm" : "w-14 h-14 text-lg";
  if (!player) return <div className={`${sz} rounded-full bg-slate-200 dark:bg-slate-700`} />;
  if (player.avatar_url) return <img src={player.avatar_url} className={`${sz} rounded-full object-cover`} />;
  return <div className={`${sz} rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center font-black text-emerald-700 dark:text-emerald-400`}>{player.full_name[0]}</div>;
}

export default function DoublesPairProfile() {
  const { p1, p2 } = useParams<{ p1: string; p2: string }>();
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [pairMatches, setPairMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({ title: "Doubles Pair Profile", description: "Head-to-head doubles stats" });

  useEffect(() => {
    if (!p1 || !p2) return;
    const load = async () => {
      setLoading(true);
      const [r1, r2, matchRes] = await Promise.all([
        supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p1).single(),
        supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p2).single(),
        supabase
          .from("matches")
          .select("id,winner_id,player1_id,player2_id,team1_partner_id,team2_partner_id,match_score,status,created_at")
          .eq("status", "confirmed")
          .or(
            `and(player1_id.eq.${p1},team1_partner_id.eq.${p2}),and(player1_id.eq.${p2},team1_partner_id.eq.${p1}),and(player2_id.eq.${p1},team2_partner_id.eq.${p2}),and(player2_id.eq.${p2},team2_partner_id.eq.${p1})`
          )
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (r1.data) setPlayer1(r1.data as any);
      if (r2.data) setPlayer2(r2.data as any);
      if (matchRes.data) setPairMatches(matchRes.data);
      setLoading(false);
    };
    load();
  }, [p1, p2]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  if (!player1 || !player2) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-slate-500">Players not found</p>
      <Link href="/players" className="text-emerald-600 font-bold">Browse Players</Link>
    </div>
  );

  const totalMatches = pairMatches.length;
  // A win for the pair = winner is either p1 or p2 (since they're on the same team)
  const wins = pairMatches.filter((m) => m.winner_id === p1 || m.winner_id === p2).length;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  let bestStreak = 0, currentStreak = 0;
  for (const m of [...pairMatches].reverse()) {
    if (m.winner_id === p1 || m.winner_id === p2) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else currentStreak = 0;
  }

  const stats = [
    { label: "Matches Together", value: totalMatches, icon: Swords, color: "text-blue-600" },
    { label: "Wins", value: wins, icon: Trophy, color: "text-emerald-600" },
    { label: "Losses", value: losses, icon: TrendingUp, color: "text-rose-500" },
    { label: "Win Rate", value: `${winRate}%`, icon: TrendingUp, color: "text-amber-600" },
    { label: "Best Streak", value: bestStreak, icon: TrendingUp, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-linear-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.5),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <Link href="/players" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-bold mb-6 transition">
            <ArrowLeft className="w-4 h-4" /> Back to Players
          </Link>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Link href={`/player/${p1}`}><Avatar player={player1} size="lg" /></Link>
              <div className="flex flex-col items-center gap-1">
                <Users className="w-6 h-6 text-blue-400" />
                <span className="text-xs font-black text-white/50 uppercase tracking-widest">Pair</span>
              </div>
              <Link href={`/player/${p2}`}><Avatar player={player2} size="lg" /></Link>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">{player1.full_name} & {player2.full_name}</h1>
              <p className="text-blue-300 text-sm mt-1">Doubles Pair Profile · {totalMatches} matches together</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center shadow-sm">
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Match history */}
        {pairMatches.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="font-black text-slate-800 dark:text-white mb-4">Recent Matches Together</h3>
            <div className="space-y-2">
              {pairMatches.slice(0, 10).map((m) => {
                const won = m.winner_id === p1 || m.winner_id === p2;
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${won ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
                      {won ? "W" : "L"}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 font-mono">
                      {m.match_score?.split("[")[0]?.trim() ?? "—"}
                    </span>
                    <span className="text-[10px] text-slate-400">{new Date(m.created_at!).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pairMatches.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-slate-600 dark:text-slate-300">No confirmed doubles matches found together yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
