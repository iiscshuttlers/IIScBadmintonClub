import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Trophy, Flame, MapPinned, Medal, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { computeUmpireRecord, type UmpiredMatch } from "@/lib/umpireRecord";

const BADGE_ICON: Record<string, typeof Flag> = {
  ump_first_whistle: Flag,
  ump_regular: Flag,
  ump_seasoned: Medal,
  ump_chief: Medal,
  ump_big_stage: Trophy,
  ump_marathon: Flame,
  ump_circuit: MapPinned,
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

/**
 * Umpire track record on a player profile. Renders nothing for players who
 * have never umpired a tournament match.
 */
export function OfficiatingRecord({ playerId }: { playerId: string }) {
  const { data } = useQuery({
    queryKey: ["umpired-matches", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, tournament_id, category, round_name, team1_label, team2_label, score, status, started_at, ended_at, scheduled_at, tournaments(name)")
        .eq("umpired_by", playerId)
        .in("status", ["completed", "walkover"])
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as UmpiredMatch[];
    },
    staleTime: 5 * 60_000,
  });

  const record = useMemo(() => computeUmpireRecord(data ?? []), [data]);
  if (!data || record.matches === 0) return null;

  const stats = [
    { label: "Matches", value: record.matches },
    { label: "Tournaments", value: record.tournaments },
    { label: "Finals", value: record.finals },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-labelledby="officiating-heading">
      <h3 id="officiating-heading" className="flex items-center gap-2 text-sm font-black text-foreground">
        <Flag className="w-4 h-4 text-emerald-500" /> Officiating record
      </h3>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/60 p-2.5 text-center">
            <div className="text-xl font-black tabular-nums text-foreground">{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2">
        {record.badges.map((b) => {
          const Icon = b.earned ? BADGE_ICON[b.id] ?? Medal : Lock;
          return (
            <li
              key={b.id}
              title={b.description}
              className={`rounded-xl border p-2.5 ${
                b.earned ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/30 opacity-70"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${b.earned ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                <span className="text-xs font-black text-foreground truncate">{b.label}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                {b.earned ? `Earned ${fmtDate(b.earnedAt)}` : `${b.current}/${b.target} · ${b.description}`}
              </div>
            </li>
          );
        })}
      </ul>

      {record.recent.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[11px] font-black uppercase tracking-wide text-muted-foreground mb-1.5">Recently umpired</h4>
          <ul className="divide-y divide-border">
            {record.recent.map((m) => (
              <li key={m.id} className="py-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-foreground truncate">
                    {m.team1_label} vs {m.team2_label}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{m.status === "walkover" ? "W/O" : m.score}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {[m.tournaments?.name, m.category, m.round_name, fmtDate(m.ended_at || m.started_at || m.scheduled_at || undefined)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
