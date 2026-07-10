import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CareerMatch {
  id: string;
  tournament_id: string;
  tournament_name: string;
  tournament_year: number | null;
  category: string; // MS | WS | MD | WD | XD
  group: "Singles" | "Doubles" | "Mixed Doubles";
  round_name: string;
  score: string | null;
  won: boolean | null;
  status: string;
  partner_name: string | null;
  opponent_names: string[];
  scored_at: string | null;
}

export interface MotionSummary {
  matchCount: number;
  totalSamples: number;
  avgMagnitude: number;
  peakMagnitude: number;
  idlePct: number;
  walkingPct: number;
  runningPct: number;
  smashSprintPct: number;
}

export interface MotionMatch {
  matchId: string;
  tournamentName: string;
  scoredAt: string | null;
  won: boolean | null;
  group: CareerMatch["group"];
  sampleCount: number;
  avgMagnitude: number;
  maxMagnitude: number;
  idlePct: number;
  walkingPct: number;
  runningPct: number;
  smashSprintPct: number;
  workRate: number; // running_pct + smash_sprint_pct*2, a single "intensity" score
}

export interface SensorAnalytics {
  matchId: string;
  totalSwings: number;
  smashCount: number;
  clearCount: number;
  driveCount: number;
  netShotCount: number;
  avgSwingSpeed: number;
  maxSwingSpeed: number;
  lateralPct: number;
  forwardBackPct: number;
  verticalPct: number;
  fatigueIndex: number;
  firstHalfIntensity: number;
  secondHalfIntensity: number;
}

function categoryGroup(category: string): CareerMatch["group"] {
  if (category === "MS" || category === "WS") return "Singles";
  if (category === "MD" || category === "WD") return "Doubles";
  return "Mixed Doubles";
}

export function usePlayerCareer(playerId: string | undefined) {
  return useQuery({
    queryKey: ["playerCareer", playerId],
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<{ matches: CareerMatch[]; motion: MotionSummary | null; motionMatches: MotionMatch[]; sensorAnalytics: SensorAnalytics[] }> => {
      if (!playerId) return { matches: [], motion: null, motionMatches: [], sensorAnalytics: [] };

      const { data, error } = await supabase
        .from("tournament_matches")
        .select(
          "id, tournament_id, category, round_name, score, status, winner_side, scored_at, " +
          "player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, " +
          "player1:player1_id(full_name), player2:player2_id(full_name), player3:player3_id(full_name), player4:player4_id(full_name), " +
          "tournaments(name, start_date)"
        )
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`)
        .order("scored_at", { ascending: false });

      if (error) throw error;
      const rows = (data as any[]) || [];

      const matches: CareerMatch[] = rows.map((m) => {
        const isTeam1 = m.player1_id === playerId || m.player3_id === playerId;
        const won = m.status === "completed" ? (isTeam1 ? m.winner_side === 1 : m.winner_side === 2) : null;

        const partner = isTeam1
          ? (m.player1_id === playerId ? m.player3 : m.player1)
          : (m.player2_id === playerId ? m.player4 : m.player2);

        const opponents = (isTeam1 ? [m.player2, m.player4] : [m.player1, m.player3])
          .filter(Boolean)
          .map((p: any) => p.full_name)
          .filter(Boolean);

        const startDate = m.tournaments?.start_date;

        return {
          id: m.id,
          tournament_id: m.tournament_id,
          tournament_name: m.tournaments?.name ?? "Tournament",
          tournament_year: startDate ? new Date(startDate).getFullYear() : null,
          category: m.category,
          group: categoryGroup(m.category),
          round_name: m.round_name,
          score: m.score,
          won,
          status: m.status,
          partner_name: partner?.full_name ?? null,
          opponent_names: opponents,
          scored_at: m.scored_at,
        };
      });

      const matchIds = matches.map((m) => m.id);
      let motion: MotionSummary | null = null;
      let motionMatches: MotionMatch[] = [];
      let sensorAnalytics: SensorAnalytics[] = [];
      
      if (matchIds.length > 0) {
        const [{ data: motionRows }, { data: sensorRows }] = await Promise.all([
          supabase
            .from("match_motion_stats")
            .select("match_id, sample_count, avg_magnitude, max_magnitude, idle_pct, walking_pct, running_pct, smash_sprint_pct")
            .eq("match_source", "tournament")
            .in("match_id", matchIds),
          supabase
            .from("match_sensor_analytics")
            .select("*")
            .eq("match_source", "tournament")
            .in("match_id", matchIds)
        ]);

        if (motionRows && motionRows.length > 0) {
          const n = motionRows.length;
          const totalSamples = motionRows.reduce((s, r) => s + (r.sample_count || 0), 0);
          motion = {
            matchCount: n,
            totalSamples,
            avgMagnitude: motionRows.reduce((s, r) => s + (r.avg_magnitude || 0), 0) / n,
            peakMagnitude: Math.max(...motionRows.map((r) => r.max_magnitude || 0)),
            idlePct: motionRows.reduce((s, r) => s + (r.idle_pct || 0), 0) / n,
            walkingPct: motionRows.reduce((s, r) => s + (r.walking_pct || 0), 0) / n,
            runningPct: motionRows.reduce((s, r) => s + (r.running_pct || 0), 0) / n,
            smashSprintPct: motionRows.reduce((s, r) => s + (r.smash_sprint_pct || 0), 0) / n,
          };

          const byId = new Map(matches.map((m) => [m.id, m]));
          motionMatches = motionRows
            .map((r) => {
              const match = byId.get(r.match_id);
              if (!match) return null;
              const runningPct = r.running_pct || 0;
              const smashSprintPct = r.smash_sprint_pct || 0;
              return {
                matchId: r.match_id,
                tournamentName: match.tournament_name,
                scoredAt: match.scored_at,
                won: match.won,
                group: match.group,
                sampleCount: r.sample_count || 0,
                avgMagnitude: r.avg_magnitude || 0,
                maxMagnitude: r.max_magnitude || 0,
                idlePct: r.idle_pct || 0,
                walkingPct: r.walking_pct || 0,
                runningPct,
                smashSprintPct,
                workRate: runningPct + smashSprintPct * 2,
              } as MotionMatch;
            })
            .filter((m): m is MotionMatch => m !== null)
            .sort((a, b) => new Date(a.scoredAt || 0).getTime() - new Date(b.scoredAt || 0).getTime());
        }
        
        if (sensorRows && sensorRows.length > 0) {
           sensorAnalytics = sensorRows.map(r => ({
             matchId: r.match_id,
             totalSwings: r.total_swings || 0,
             smashCount: r.smash_count || 0,
             clearCount: r.clear_count || 0,
             driveCount: r.drive_count || 0,
             netShotCount: r.net_shot_count || 0,
             avgSwingSpeed: r.avg_swing_speed || 0,
             maxSwingSpeed: r.max_swing_speed || 0,
             lateralPct: r.lateral_pct || 0,
             forwardBackPct: r.forward_back_pct || 0,
             verticalPct: r.vertical_pct || 0,
             fatigueIndex: r.fatigue_index || 0,
             firstHalfIntensity: r.first_half_intensity || 0,
             secondHalfIntensity: r.second_half_intensity || 0,
           }));
        }
      }

      return { matches, motion, motionMatches, sensorAnalytics };
    },
  });
}
