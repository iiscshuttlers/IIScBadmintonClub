import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Swords, MapPin, Clock, Settings2, ChevronRight,
  ChevronLeft, Trophy, Users, Play,
} from "lucide-react";
import { toast } from "sonner";

export interface TournamentMatchForUmpire {
  id: string;
  tournament_id: string;
  tournament_name: string;
  category: string;
  match_code: string;
  round_name: string;
  player1_id: string | null;
  player3_id: string | null;
  team1_label: string | null;
  player2_id: string | null;
  player4_id: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  locked: boolean;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}

interface Props {
  onStartMatch: (match: TournamentMatchForUmpire) => void;
}

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

const CAT_COLORS: Record<string, { bg: string; active: string; dot: string }> = {
  MS: { bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300", active: "bg-blue-600 text-foreground border-blue-600", dot: "bg-blue-500" },
  WS: { bg: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300", active: "bg-pink-600 text-foreground border-pink-600", dot: "bg-pink-500" },
  MD: { bg: "bg-primary/10 dark:bg-primary/30 border-primary/40 dark:border-primary/80 text-primary dark:text-primary/70", active: "bg-primary text-primary-foreground border-primary", dot: "bg-primary" },
  WD: { bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300", active: "bg-purple-600 text-foreground border-purple-600", dot: "bg-purple-500" },
  XD: { bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300", active: "bg-orange-600 text-foreground border-orange-600", dot: "bg-orange-500" },
};

const DEFAULT_COLORS = { bg: "bg-slate-700 border-slate-600 text-slate-300", active: "bg-slate-600 text-foreground border-slate-600", dot: "bg-slate-400" };

export function UmpireTournamentTab({ onStartMatch }: Props) {
  const [allMatches, setAllMatches] = useState<TournamentMatchForUmpire[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"format" | "match" | "confirm">("format");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatchForUmpire | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("status", "active");

    if (!tournaments?.length) { setLoading(false); return; }

    const tournamentIds = tournaments.map((t) => t.id);

    const { data: matchData, error } = await supabase
      .from("tournament_matches")
      .select("*")
      .in("tournament_id", tournamentIds)
      .in("status", ["scheduled", "in_progress"])
      .order("round")
      .order("match_number");

    if (error) { toast.error(error.message); setLoading(false); return; }

    const { data: rules } = await supabase
      .from("tournament_round_rules")
      .select("*")
      .in("tournament_id", tournamentIds);

    const enriched: TournamentMatchForUmpire[] = (matchData ?? []).map((m: any) => {
      const tournament = tournaments.find((t) => t.id === m.tournament_id);
      const rule = rules?.find(
        (r) => r.tournament_id === m.tournament_id && r.category === m.category && r.round === m.round
      );
      return {
        ...m,
        tournament_name: tournament?.name ?? "Tournament",
        points_to_win: rule?.points_to_win ?? m.points_to_win ?? 21,
        best_of_sets: rule?.best_of_sets ?? m.best_of_sets ?? 3,
        golden_point: rule?.golden_point ?? m.golden_point ?? 30,
      };
    });

    setAllMatches(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(allMatches.map((m) => m.category))];
  const matchesForCategory = allMatches.filter((m) => m.category === selectedCategory);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  if (!allMatches.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Swords className="w-12 h-12 text-muted-foreground" />
      <p className="text-muted-foreground font-bold">No tournament matches need umpiring right now.</p>
      <p className="text-muted-foreground text-sm">Matches appear here when an active tournament has scheduled or in-progress matches.</p>
    </div>
  );

  // ── Step 1: Format selection ─────────────────────────────────────────────────
  if (step === "format") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-black text-foreground">Select Format</h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {categories.map((cat) => {
            const colors = CAT_COLORS[cat] ?? DEFAULT_COLORS;
            const catMatches = allMatches.filter((m) => m.category === cat);
            const inProgress = catMatches.filter((m) => m.status === "in_progress").length;

            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setStep("match"); }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-primary hover:bg-slate-750 transition-all group text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${colors.active} shrink-0`}>
                  {cat}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground">{CAT_LABELS[cat] ?? cat}</p>
                  <p className="text-sm text-muted-foreground">
                    {catMatches.length} match{catMatches.length !== 1 ? "es" : ""} pending
                    {inProgress > 0 && <span className="ml-2 text-amber-400 font-bold">· {inProgress} live</span>}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 2: Match selection ──────────────────────────────────────────────────
  if (step === "match" && selectedCategory) {
    const colors = CAT_COLORS[selectedCategory] ?? DEFAULT_COLORS;

    // Group by round
    const rounds = [...new Set(matchesForCategory.map((m) => m.round_name))];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep("format"); setSelectedCategory(null); }}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className={`px-3 py-1.5 rounded-xl font-black text-sm border ${colors.active}`}>{selectedCategory}</div>
          <span className="text-muted-foreground text-sm">{CAT_LABELS[selectedCategory] ?? selectedCategory}</span>
        </div>

        <div className="space-y-4">
          {rounds.map((roundName) => {
            const roundMatches = matchesForCategory.filter((m) => m.round_name === roundName);
            return (
              <div key={roundName}>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{roundName}</p>
                <div className="space-y-2">
                  {roundMatches.map((m) => {
                    const isLive = m.status === "in_progress";
                    const noPlayers = !m.team1_label || !m.team2_label || m.team1_label === "TBD" || m.team2_label === "TBD";

                    return (
                      <button
                        key={m.id}
                        disabled={noPlayers}
                        onClick={() => { setSelectedMatch(m); setStep("confirm"); }}
                        className={`w-full p-4 rounded-2xl border text-left transition-all group ${
                          isLive
                            ? "bg-amber-950/20 border-amber-700 hover:border-amber-500"
                            : noPlayers
                              ? "bg-slate-800/50 border-slate-800 opacity-50 cursor-not-allowed"
                              : "bg-slate-800 border-slate-700 hover:border-primary"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{m.match_code}</span>
                          {isLive && <span className="text-[10px] font-black text-amber-400 animate-pulse">● IN PROGRESS</span>}
                          {m.court_number && (
                            <span className="flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                              <MapPin className="w-2.5 h-2.5" /> Court {m.court_number}
                            </span>
                          )}
                          {m.scheduled_at && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-foreground font-bold text-sm flex-1 truncate">
                            {m.team1_label ?? "TBD"}
                          </span>
                          <span className="text-[10px] font-black text-rose-400 shrink-0">VS</span>
                          <span className="text-foreground font-bold text-sm flex-1 truncate text-right">
                            {m.team2_label ?? "TBD"}
                          </span>
                          {!noPlayers && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-1" />
                          )}
                        </div>
                        {noPlayers && (
                          <p className="text-[10px] text-muted-foreground mt-1">Waiting for previous round results</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 3: Confirm & start ──────────────────────────────────────────────────
  if (step === "confirm" && selectedMatch) {
    const colors = CAT_COLORS[selectedMatch.category] ?? DEFAULT_COLORS;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStep("match"); setSelectedMatch(null); }}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-muted-foreground text-sm">Match Details</span>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Category + round banner */}
          <div className={`px-5 py-3 flex items-center gap-3 ${colors.active}`}>
            <span className="font-black text-sm">{selectedMatch.category}</span>
            <span className="text-sm font-bold opacity-80">·</span>
            <span className="text-sm font-bold opacity-90">{selectedMatch.round_name}</span>
            <span className="ml-auto text-[10px] font-black opacity-70 tracking-wider">{selectedMatch.match_code}</span>
          </div>

          <div className="p-5 space-y-5">
            {/* Players */}
            <div className="space-y-3">
              {[
                { label: selectedMatch.team1_label, side: "Team 1" },
                { label: selectedMatch.team2_label, side: "Team 2" },
              ].map(({ label, side }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{side}</p>
                    <p className="text-foreground font-black text-sm">{label ?? "TBD"}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Scoring config */}
            <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-primary">{selectedMatch.points_to_win}</span>
                <span>pts to win</span>
              </div>
              <div className="text-muted-foreground">·</div>
              <div className="text-[11px] text-muted-foreground">
                Best of <span className="font-bold text-foreground">{selectedMatch.best_of_sets}</span> sets
              </div>
              <div className="text-muted-foreground">·</div>
              <div className="text-[11px] text-muted-foreground">
                Golden point @ <span className="font-bold text-foreground">{selectedMatch.golden_point}</span>
              </div>
            </div>

            {/* Court / time */}
            {(selectedMatch.court_number || selectedMatch.scheduled_at) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {selectedMatch.court_number && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-blue-300">Court {selectedMatch.court_number}</span>
                  </span>
                )}
                {selectedMatch.scheduled_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedMatch.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            )}

            {/* Tournament name */}
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {selectedMatch.tournament_name}
            </p>

            {/* Start button */}
            <button
              onClick={async () => {
                // If user is admin/umpire, allow by default? The prompt says "they should have the right to umpire those matches and also time bounded umpiring".
                // If they have admin/umpire role globally, we can let them bypass, or we force the assignment check. 
                // Let's check assignments anyway if they are not an admin.
                const sessionResponse = await supabase.auth.getSession();
                const userId = sessionResponse.data.session?.user?.id;
                
                if (!userId) {
                  toast.error("Session expired. Please sign in again.");
                  return;
                }

                const { data: assignments } = await supabase
                  .from("umpire_assignments")
                  .select("*")
                  .eq("user_id", userId);

                const hasAdmin = (await supabase.from("players").select("role").eq("id", userId).single()).data?.role === 'admin';
                
                if (hasAdmin) {
                  onStartMatch(selectedMatch);
                  return;
                }

                const now = new Date();
                const isValid = assignments?.some(a => {
                  if (a.tournament_match_id === selectedMatch.id) return true;
                  if (a.start_time && a.end_time) {
                    const start = new Date(a.start_time);
                    const end = new Date(a.end_time);
                    return now >= start && now <= end;
                  }
                  return false;
                });

                if (!isValid) {
                  toast.error("You don't have an active umpire assignment for this match or time block.");
                  return;
                }

                onStartMatch(selectedMatch);
              }}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-black text-base transition flex items-center justify-center gap-2 shadow-lg shadow-primary/50/30"
            >
              <Play className="w-5 h-5 fill-white" />
              {selectedMatch.status === "in_progress" ? "Resume Match" : "Start Umpiring"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
