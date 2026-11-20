import { useParams, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { fetchDoublesPairData } from "@/services/playerService";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Trophy, Users, TrendingUp, Swords, ArrowLeft, Loader2 } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { TeaserOverlay } from "@/components/TeaserOverlay";
import { useAuth } from "@/contexts/AuthContext";

import type { PlayerRow as Player } from "@/types";
import { eligibilityOf } from "@/lib/comparison";

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
  if (!player) return <div className={`${sz} rounded-full bg-muted-strong`} />;
  if (player.avatar_url) return <img src={player.avatar_url} className={`${sz} rounded-full object-cover`} />;
  return <div className={`${sz} rounded-full bg-primary/40 flex items-center justify-center font-black text-primary`}>{player.full_name[0]}</div>;
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
      try {
        const { player1: r1, player2: r2, rows } = await fetchDoublesPairData(p1, p2);
        if (r1) setPlayer1(r1 as any);
        if (r2) setPlayer2(r2 as any);

      // Keep only matches where p1 & p2 are on the SAME team
      // Team 1 = player1_id + player3_id, Team 2 = player2_id + player4_id
      const sameTeam = (rows ?? []).filter((m: any) => {
        const t1 = [m.player1_id, m.player3_id];
        const t2 = [m.player2_id, m.player4_id];
        const together = (t1.includes(p1) && t1.includes(p2)) || (t2.includes(p1) && t2.includes(p2));
        // Shared WP8 policy: only finished results with a recorded winner count
        // (no unfinished match is shown as a loss).
        return together && eligibilityOf({
          id: m.id, source: "tournament", status: m.status,
          winnerSide: m.winner_side === 1 || m.winner_side === 2 ? m.winner_side : null,
          winnerId: m.winner_id ?? null, side1: t1.filter(Boolean), side2: t2.filter(Boolean),
          category: m.category ?? null, date: null, score: null, round: null, event: null,
        }).eligibility === "counted";
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
      } catch (err) {
        console.error("DoublesPairProfile query error:", err);
        setLoading(false);
      }
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
    { label: "Matches Together", value: totalMatches, icon: Swords, color: "text-info" },
    { label: "Wins", value: wins, icon: Trophy, color: "text-primary" },
    { label: "Losses", value: losses, icon: TrendingUp, color: "text-danger" },
    { label: "Win Rate", value: `${winRate}%`, icon: TrendingUp, color: "text-warning" },
    { label: "Best Streak", value: bestStreak, icon: TrendingUp, color: "text-secondary" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-team/20 via-success to-team/20 text-on-accent py-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--success)_50%,transparent),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <button onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = `${import.meta.env.BASE_URL}pulse`} className="inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground text-sm font-bold mb-6 transition">
            <ArrowLeft className="w-4 h-4" /> Back to H2H
          </button>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Link href={`/player/${p1}`}><Avatar player={player1} size="lg" /></Link>
              <div className="flex flex-col items-center gap-1">
                <Users className="w-6 h-6 text-primary" />
                <span className="text-xs font-black text-foreground/70 uppercase tracking-widest">Pair</span>
              </div>
              <Link href={`/player/${p2}`}><Avatar player={player2} size="lg" /></Link>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-black text-foreground">{player1.full_name} & {player2.full_name}</h1>
                <InfoModal
                  title="DOUBLES PAIR"
                  items={[
                    { badge: "STATS", title: "Combined Stats", desc: "This page shows statistics specifically for when these two players play together as a team on the same side of the court." },
                    { badge: "ELO", title: "Pair record, not a rating", desc: "A pair has a won–lost record only. Elo ratings are individual: each partner's own doubles or mixed (XD) rating changes after every rated match. Walkovers and unfinished matches are not counted here." }
                  ]}
                  triggerClassName="text-success hover:text-foreground"
                />
              </div>
              <p className="text-info text-sm mt-1">Doubles Pair Profile · {totalMatches} counted matches together</p>
              <Link href={`/h2h?mode=pairs&a=${p1},${p2}`} className="inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-foreground underline">
                Compare this pair with another pair
              </Link>
            </div>
          </div>
        </div>
      </div>

      <TeaserOverlay isLocked={!session}>
        <div className="container mx-auto px-4 max-w-3xl mt-8 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-card rounded-2xl border border-border p-4 text-center shadow-sm">
                <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Match history */}
          {pairMatches.length > 0 && (
            <div className="bg-card rounded-3xl border border-border p-5 shadow-sm">
              <h3 className="font-black text-foreground mb-4">Recent Matches Together</h3>
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
                  
                  if (opponents && (opponents.toUpperCase() === "BYE" || opponents.toUpperCase().includes(" BYE "))) {
                    opponents = "BYE";
                  } else if (!opponents) {
                    opponents = "TBD";
                  }

                  let scoreDisplay = m.score || "";
                  if (!scoreDisplay && m.status === "walkover") scoreDisplay = "Walkover (W/O)";
                  if (!scoreDisplay) scoreDisplay = "No score recorded";

                  return (
                    <div key={m.id} className="flex flex-col gap-1 py-3 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${won ? "bg-primary/40 text-primary" : "bg-danger/15 text-danger"}`}>
                          {won ? "W" : "L"}
                        </span>
                        <div className="flex-1 flex flex-col">
                          <span className="text-sm font-bold text-foreground leading-tight">
                            {opponents === "BYE" ? "BYE" : `vs ${opponents || "Unknown Opponents"}`}
                          </span>
                          <span className="text-xs text-soft font-mono mt-1">
                            {scoreDisplay}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md max-w-[200px] truncate">
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
            <div className="text-center py-16 bg-card rounded-3xl border border-border">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-bold text-soft">No tournament matches found together yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Play a tournament match together to establish a pair profile!</p>
            </div>
          )}
        </div>
      </TeaserOverlay>
    </div>
  );
}
