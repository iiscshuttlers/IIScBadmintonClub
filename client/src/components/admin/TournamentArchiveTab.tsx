import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useConfirm } from "@/contexts/ConfirmContext";
import { Loader2, Archive, RotateCcw } from "lucide-react";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";

interface Tournament {
  id: string;
  name: string;
  status: string;
  archived_at: string | null;
}

interface TournamentMatch {
  id: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  winner_side: 1 | 2 | null;
  status: string;
  sets_history: string[] | null;
  team1_label: string | null;
  team2_label: string | null;
}

const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

export function TournamentArchiveTab({
  tournament,
  isMasterAdmin,
  onArchived,
}: {
  tournament: Tournament;
  isMasterAdmin: boolean;
  onArchived: () => void;
}) {
  const { confirm } = useConfirm();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("round")
      .order("match_number")
      .then(({ data }) => {
        setMatches((data as TournamentMatch[]) ?? []);
        setLoading(false);
      });
  }, [tournament.id]);

  const archive = async () => {
    const ok = await confirm({
      title: "Archive Tournament",
      description: `Archive "${tournament.name}"? This cannot be undone.`,
      confirmLabel: "Archive",
      confirmVariant: "danger",
    });
    if (!ok) return;
    setArchiving(true);
    const { error } = await supabase.rpc("archive_tournament", { p_tournament_id: tournament.id });
    if (error) {
      toast.error(error.message);
      setArchiving(false);
      return;
    }
    toast.success("Tournament archived");
    onArchived();
    setArchiving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const categories = [...new Set(matches.map((m) => m.category))];

  return (
    <div className="space-y-5">
      {tournament.status === "completed" && (
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 dark:text-foreground">Archive Tournament</h3>
              <p className="text-sm text-muted-foreground mt-1">Freeze all results and make this a historical record. Cannot be undone.</p>
            </div>
            <button
              onClick={archive}
              disabled={archiving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--warning)] hover:bg-[var(--warning)] text-foreground font-black transition disabled:opacity-50"
            >
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archive
            </button>
          </div>
        </div>
      )}

      {tournament.status === "archived" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-xs font-black text-[var(--warning)] uppercase tracking-widest px-3 py-1.5 bg-[var(--warning)] dark:bg-[var(--warning)]/40 rounded-full">
            Archived {tournament.archived_at ? new Date(tournament.archived_at).toLocaleDateString() : ""}
          </span>
          {isMasterAdmin && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Unarchive Tournament",
                  description: `Unarchive "${tournament.name}"?`,
                  confirmLabel: "Unarchive",
                  confirmVariant: "primary",
                });
                if (!ok) return;
                setArchiving(true);
                const { error } = await supabase
                  .from("tournaments")
                  .update({ status: "completed", archived_at: null })
                  .eq("id", tournament.id);
                if (error) {
                  toast.error(error.message);
                  setArchiving(false);
                  return;
                }
                toast.success("Tournament unarchived");
                onArchived();
              }}
              disabled={archiving}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Unarchive
            </button>
          )}
        </div>
      )}

      {/* Full fixture list */}
      {categories.map((cat) => {
        const catMatches = matches.filter((m) => m.category === cat);
        const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
        return (
          <div key={cat} className={cardCls}>
            <h3 className="font-black text-slate-800 dark:text-foreground mb-4">{cat} — Full Fixtures</h3>
            <div className="space-y-4">
              {rounds.map((round) => {
                const roundMatches = catMatches.filter((m) => m.round === round);
                return (
                  <div key={round}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      {roundMatches[0]?.round_name}
                    </p>
                    <div className="space-y-2">
                      {roundMatches.map((m) => (
                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-muted-foreground">{m.match_code}</span>
                            {/* MatchStatusChip placeholder or custom */}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {m.status}
                            </span>
                          </div>
                          <MatchScoreDisplay
                            sets_history={m.sets_history}
                            team1_label={m.team1_label ?? "TBD"}
                            team2_label={m.team2_label ?? "TBD"}
                            winner_side={m.winner_side}
                            status={m.status}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!matches.length && (
        <div className={`${cardCls} text-center py-10`}>
          <p className="text-muted-foreground">No matches recorded yet.</p>
        </div>
      )}
    </div>
  );
}
