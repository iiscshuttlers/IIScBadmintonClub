import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useAutoFeedTournaments } from "@/hooks/queries/useAutoFeedTournaments";
import { buildAutoAnnouncements, type AutoPostStage } from "@/lib/autoAnnouncements";
import { cardCls } from "./shared";

const STAGE_LABEL: Record<AutoPostStage, string> = {
  registration: "Before play",
  underway: "Under way",
  results: "Results",
};

/**
 * Admin list of the Feed posts made from tournament data, with a switch to
 * keep any of them off the Feed. Changes go into `hiddenAuto` and are saved
 * with the rest of the announcements.
 */
export function AutoPostsPanel({
  hidden,
  onChange,
}: {
  hidden: string[];
  onChange: (keys: string[]) => void;
}) {
  const { data, isLoading, error } = useAutoFeedTournaments();
  const posts = buildAutoAnnouncements(data, []);
  const hiddenSet = new Set(hidden);
  const toggle = (key: string) =>
    onChange(hiddenSet.has(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);

  return (
    <section className={`${cardCls} space-y-3`} aria-labelledby="auto-posts-heading">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/15 text-primary shrink-0">
          <Sparkles className="w-4 h-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 id="auto-posts-heading" className="text-sm font-black text-foreground">
            Automatic tournament posts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Every published tournament gets a Feed post that updates by itself: registration before play, a live link
            while it runs, and the Final winners afterwards. Hide one if you have written your own post about it, then
            press Save.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" aria-label="Loading" />
        </div>
      ) : error ? (
        <p className="text-xs font-semibold text-danger">Could not load tournaments. Reload the page to try again.</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No published tournaments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((p) => {
            const isHidden = hiddenSet.has(p.key);
            return (
              <li key={p.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className={`min-w-0 ${isHidden ? "opacity-60" : ""}`}>
                  <p className="text-sm font-bold text-foreground truncate">{p.title}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {STAGE_LABEL[p.stage]}
                    {p.date ? ` · ${p.date}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(p.key)}
                  aria-pressed={!isHidden}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                    isHidden
                      ? "bg-muted text-muted-foreground border border-border-strong hover:text-soft"
                      : "bg-success/15 text-success hover:bg-success/20"
                  }`}
                >
                  {isHidden ? <EyeOff className="w-3 h-3" aria-hidden /> : <Eye className="w-3 h-3" aria-hidden />}
                  {isHidden ? "Hidden" : "On Feed"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
