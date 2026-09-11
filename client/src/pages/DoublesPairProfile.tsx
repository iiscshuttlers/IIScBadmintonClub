import { useParams, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy, Users, TrendingUp, Swords, ArrowLeft, Loader2 } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { TeaserOverlay } from "@/components/TeaserOverlay";
import { useAuth } from "@/contexts/AuthContext";

import type { PlayerRow as Player } from "@/types";

interface Match {
  id: string;
  winner_id?: string;
  winner_side?: number;
  player1_id?: string;
  player2_id?: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  match_code?: string;
  score?: string;
  team1_label?: string;
  team2_label?: string;
  status?: string;
  created_at?: string;
  scheduled_at?: string;
  tname?: string;
  p1_name?: string;
  p2_name?: string;
  p3_name?: string;
  p4_name?: string;
  _isWin?: boolean;
}

function Avatar({ player, size = "md" }: { player: Player | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-20 h-20 text-2xl" : size === "sm" ? "w-10 h-10 text-sm" : "w-14 h-14 text-lg";
  if (!player) return <div className={`${sz} rounded-full bg-slate-200 dark:bg-slate-700`} />;
  if (player.avatar_url) return <img src={player.avatar_url} className={`${sz} rounded-full object-cover`} />;
  return <div className={`${sz} rounded-full bg-primary/15 dark:bg-primary/40 flex items-center justify-center font-black text-primary dark:text-primary`}>{player.full_name[0]}</div>;
}

export default function DoublesPairProfile() {
  const { p1, p2 } = useParams<{ p1: string; p2: string }>();
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [pairMatches, setPairMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  usePageMeta({ title: "Doubles Pair Profile", description: "Head-to-head doubles stats" });

  useEffect(() => {
    if (!p1 || !p2) return;
    const load = async () => {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p1).single(),
        supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p2).single(),
      ]);
      
      if (r1.data) setPlayer1(r1.data as any);
      if (r2.data) setPlayer2(r2.data as any);

      // Fetch all completed matches where p1 OR p2 appear in any player slot
      // Then filter client-side for matches where they are on the SAME team:
      //   Team 1 = player1_id + player3_id
      //   Team 2 = player2_id + player4_id
      const { data: rows, error } = await supabase
        .from("tournament_matches")
        .select("id,winner_id,winner_side,player1_id,player2_id,player3_id,player4_id,match_code,score,team1_label,team2_label,status,created_at,scheduled_at,tournaments(name),player1:players!player1_id(full_name),player2:players!player2_id(full_name),player3:players!player3_id(full_name),player4:players!player4_id(full_name)")
        .in("status", ["completed", "walkover"])
        .or(`player1_id.eq.${p1},player3_id.eq.${p1},player2_id.eq.${p1},player4_id.eq.${p1},player1_id.eq.${p2},player3_id.eq.${p2},player2_id.eq.${p2},player4_id.eq.${p2}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) console.error("DoublesPairProfile query error:", error);
      console.log("[DoublesPair] p1:", p1, "p2:", p2);
      console.log("[DoublesPair] broad query rows:", rows?.length ?? 0, rows);

      // Keep only matches where p1 & p2 are on the SAME team
      // Team 1 = player1_id + player3_id, Team 2 = player2_id + player4_id
      const sameTeam = (rows ?? []).filter((m: any) => {
        const t1 = [m.player1_id, m.player3_id];
        const t2 = [m.player2_id, m.player4_id];
        return (t1.includes(p1) && t1.includes(p2)) || (t2.includes(p1) && t2.includes(p2));
      });

      console.log("[DoublesPair] same-team filtered:", sameTeam.length);

      const mapped = sameTeam.map((tm: any) => {
        // Determine if our pair was on team1 or team2
        const t1 = [tm.player1_id, tm.player3_id];
        const onTeam1 = t1.includes(p1) && t1.includes(p2);
        // A win = winner_side matches our team side (1 or 2)
        const isWin = onTeam1 ? tm.winner_side === 1 : tm.winner_side === 2;
        return {
          ...tm,
          _isWin: isWin,
          team1_partner_id: tm.player3_id,
          team2_partner_id: tm.player4_id,
          tname: tm.tournaments?.name,
          p1_name: tm.player1?.full_name,
          p2_name: tm.player2?.full_name,
          p3_name: tm.player3?.full_name,
          p4_name: tm.player4?.full_name,
          score: tm.score,
          team1_label: tm.team1_label,
          team2_label: tm.team2_label,
        };
      });
      setPairMatches(mapped);
      setLoading(false);
    };
    load();
  }, [p1, p2]);




  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!player1 || !player2) return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Pair not found</h1>
        <p className="text-muted-foreground">Players not found</p>
        <Link href="/pulse#h2h" className="text-primary font-bold">Browse H2H</Link>
      </div>
  );

  const totalMatches = pairMatches.length;
  // Use pre-computed _isWin flag (based on winner_side)
  const wins = pairMatches.filter((m: any) => m._isWin).length;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  let bestStreak = 0, currentStreak = 0;
  for (const m of [...pairMatches].reverse()) {
    if ((m as any)._isWin) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else currentStreak = 0;
  }

  const stats = [
    { label: "Matches Together", value: totalMatches, icon: Swords, color: "text-blue-600" },
    { label: "Wins", value: wins, icon: Trophy, color: "text-primary" },
    { label: "Losses", value: losses, icon: TrendingUp, color: "text-rose-500" },
    { label: "Win Rate", value: `${winRate}%`, icon: TrendingUp, color: "text-amber-600" },
    { label: "Best Streak", value: bestStreak, icon: TrendingUp, color: "text-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-800 via-emerald-700 to-teal-800 text-on-accent py-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.5),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <Link href="/pulse#h2h" className="inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground text-sm font-bold mb-6 transition">
            <ArrowLeft className="w-4 h-4" /> Back to H2H
          </Link>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Link href={`/player/${p1}`}><Avatar player={player1} size="lg" /></Link>
              <div className="flex flex-col items-center gap-1">
                <Users className="w-6 h-6 text-lime-300" />
                <span className="text-xs font-black text-white/70 uppercase tracking-widest">Pair</span>
              </div>
              <Link href={`/player/${p2}`}><Avatar player={player2} size="lg" /></Link>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-black text-white">{player1.full_name} & {player2.full_name}</h1>
                <InfoModal
                  title="DOUBLES PAIR"
                  items={[
                    { badge: "STATS", title: "Combined Stats", desc: "This page shows statistics specifically for when these two players play together as a team on the same side of the court." }
                  ]}
                  triggerClassName="text-emerald-200 hover:text-white"
                />
              </div>
              <p className="text-blue-300 text-sm mt-1">Doubles Pair Profile · {totalMatches} matches together</p>
            </div>
          </div>
        </div>
      </div>

      <TeaserOverlay isLocked={!session}>
        <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-center shadow-sm">
                <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Match history */}
          {pairMatches.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="font-black text-slate-800 dark:text-foreground mb-4">Recent Matches Together</h3>
              <div className="space-y-2">
                {pairMatches.slice(0, 10).map((m) => {
                  let won = false;
                  if (m.winner_id) won = m.winner_id === p1 || m.winner_id === p2;
                  else if (m.winner_side) {
                    const p1Team = (m.player1_id === p1 || m.team1_partner_id === p1) ? 1 : 2;
                    won = m.winner_side === p1Team;
                  }
                  
                  const p1TeamNum = (m.player1_id === p1 || m.team1_partner_id === p1) ? 1 : 2;
                  let opponents = "";
                  
                  if (p1TeamNum === 1) {
                    opponents = m.team2_label || [m.p2_name, m.p4_name].filter(Boolean).join(" & ");
                  } else {
                    opponents = m.team1_label || [m.p1_name, m.p3_name].filter(Boolean).join(" & ");
                  }
                  
                  if (!opponents || opponents.toUpperCase() === "BYE") {
                    opponents = "BYE";
                  }

                  let scoreDisplay = m.score || "";
                  if (!scoreDisplay && m.status === "walkover") scoreDisplay = "Walkover (W/O)";
                  if (!scoreDisplay) scoreDisplay = "No score recorded";

                  return (
                    <div key={m.id} className="flex flex-col gap-1 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${won ? "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
                          {won ? "W" : "L"}
                        </span>
                        <div className="flex-1 flex flex-col">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                            {opponents === "BYE" ? "BYE" : `vs ${opponents || "Unknown Opponents"}`}
                          </span>
                          <span className="text-xs text-muted-foreground dark:text-slate-300 font-mono mt-1">
                            {scoreDisplay}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md max-w-[200px] truncate">
                          {m.tname || new Date(m.created_at!).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pairMatches.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Users className="w-12 h-12 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <p className="font-bold text-muted-foreground dark:text-slate-300">No tournament matches found together yet.</p>
              <p className="text-sm text-slate-400 mt-2">Play a tournament match together to establish a pair profile!</p>
            </div>
          )}
        </div>
      </TeaserOverlay>
    </div>
  );
}
