import { useQuery } from "@tanstack/react-query";
import { Loader2, Route, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { computePath, type PathMatch } from "@/lib/pathToFinal";

/** Round-by-round likely opponents from a player's current match to the final. */
export function PathToFinalDialog({
  open,
  onClose,
  tournamentId,
  category,
  playerId,
}: {
  open: boolean;
  onClose: () => void;
  tournamentId: string;
  category: string;
  playerId: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["path-to-final", tournamentId, category, playerId],
    enabled: open,
    queryFn: async () => {
      const { data: matches, error } = await supabase
        .from("tournament_matches")
        .select("id, match_code, round, round_name, status, winner_side, advances_to_match, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, tie_id")
        .eq("tournament_id", tournamentId)
        .eq("category", category)
        .is("tie_id", null);
      if (error) throw error;
      const ids = Array.from(
        new Set((matches ?? []).flatMap((m: any) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id]).filter(Boolean)),
      );
      const { data: players } = ids.length
        ? await supabase.from("players").select("id, tournament_elo, elo_rating").in("id", ids)
        : { data: [] as any[] };
      const elo = new Map((players ?? []).map((p: any) => [p.id, p.elo_rating ?? p.tournament_elo ?? undefined]));
      return computePath((matches ?? []) as PathMatch[], playerId, (id) => elo.get(id));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" /> Path to the final
          </DialogTitle>
          <DialogDescription>
            {category} · likely opponents, based on results so far and Elo. Predictions, not guarantees.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Loading path" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4">Couldn't load the bracket.</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-4">No path to show — the bracket isn't drawn yet or this run has ended.</p>
        ) : (
          <ol className="relative border-l-2 border-primary/30 ml-2 space-y-4 py-1">
            {data.map((s, i) => {
              const pct = s.winProb != null ? Math.round(s.winProb * 100) : null;
              const last = i === data.length - 1;
              return (
                <li key={s.matchId} className="ml-4">
                  <span className={`absolute -left-[9px] mt-1 w-4 h-4 rounded-full border-2 ${last ? "bg-amber-400 border-amber-400" : "bg-background border-primary"}`} />
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                    {last && <Trophy className="w-3.5 h-3.5 text-amber-500" />} {s.roundName}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground truncate">
                      {s.opponent ? s.opponent.label : "Opponent to be decided"}
                      {s.predicted && s.opponent && <span className="ml-1 text-[10px] font-bold text-muted-foreground">(likely)</span>}
                    </span>
                    {pct != null && (
                      <span
                        className={`shrink-0 text-[11px] font-black tabular-nums ${pct >= 50 ? "text-emerald-500" : "text-rose-500"}`}
                        title="Your win chance by Elo"
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                  {s.opponent?.rating != null && (
                    <div className="text-[10px] text-muted-foreground">Elo {Math.round(s.opponent.rating)}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
