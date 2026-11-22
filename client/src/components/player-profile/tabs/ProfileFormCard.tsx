import { useMemo } from "react";
import { Flame } from "lucide-react";
import { computeProfileForm, type FormRow } from "@/lib/profileForm";

/**
 * Form & clutch, at the top of the profile Stats tab: recent results, this
 * week, wins without dropping a game, and record in deciding games. Shown on
 * every profile (it was the owner-only Training › Home/Stats before).
 */
export function ProfileFormCard({ matches, playerId }: { matches: readonly FormRow[]; playerId: string }) {
  const form = useMemo(() => computeProfileForm(matches, playerId), [matches, playerId]);
  if (form.decided === 0) return null;

  const recentWins = form.recent.filter((r) => r === "W").length;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <section
      aria-labelledby="profile-form-heading"
      className="bg-foreground/5 shadow-sm dark:shadow-none rounded-3xl p-5 sm:p-6 border border-foreground/8 space-y-5"
    >
      <h2
        id="profile-form-heading"
        className="text-sm font-black uppercase tracking-widest text-foreground/60 flex items-center gap-2"
      >
        <Flame className="w-4 h-4 text-warning" aria-hidden /> Form &amp; clutch
      </h2>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-2">
          <span className="text-xs font-black text-foreground">
            Recent form <span className="font-bold text-muted-foreground">· latest on the right</span>
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            Won {recentWins} of the last {form.recent.length}
          </span>
        </div>
        {/* Ten columns on phones so all ten results stay on one row. */}
        <ol className="grid grid-cols-10 gap-1 sm:flex sm:gap-1.5" aria-label="Recent results, oldest first">
          {form.recent.map((r, i) => (
            <li
              key={i}
              className={`flex aspect-square sm:h-7 sm:w-7 items-center justify-center rounded-md text-[11px] sm:text-xs font-black ${
                r === "W" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <span aria-hidden>{r}</span>
              <span className="sr-only">{r === "W" ? "Won" : "Lost"}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormTile
          label="This week"
          value={form.thisWeek.played > 0 ? `${form.thisWeek.won}–${form.thisWeek.played - form.thisWeek.won}` : "—"}
          note={
            form.thisWeek.played > 0
              ? `${form.thisWeek.played} match${form.thisWeek.played === 1 ? "" : "es"} in the last 7 days`
              : "No matches in the last 7 days"
          }
        />
        <FormTile
          label="Straight-game wins"
          value={form.sweeps.of > 0 ? `${form.sweeps.won}` : "—"}
          note={form.sweeps.of > 0 ? `${pct(form.sweeps.won, form.sweeps.of)}% of wins without dropping a game` : "No scored wins yet"}
          bar={form.sweeps.of > 0 ? pct(form.sweeps.won, form.sweeps.of) : null}
        />
        <FormTile
          label="Deciding games"
          value={form.deciders.played > 0 ? `${form.deciders.won}–${form.deciders.played - form.deciders.won}` : "—"}
          note={
            form.deciders.played > 0
              ? `Won ${pct(form.deciders.won, form.deciders.played)}% of matches that went to a third game`
              : "No match has gone to a third game"
          }
          bar={form.deciders.played > 0 ? pct(form.deciders.won, form.deciders.played) : null}
        />
      </div>
    </section>
  );
}

function FormTile({ label, value, note, bar = null }: { label: string; value: string; note: string; bar?: number | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-foreground">{value}</div>
      {bar != null && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${bar}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground leading-snug">{note}</p>
    </div>
  );
}
