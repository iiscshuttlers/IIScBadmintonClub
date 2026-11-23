import { useEffect } from "react";
import { Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ensureThemeFonts } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Theme chooser. Each card is rendered *in* its own theme (the `theme-<id>`
 * class scopes that theme's tokens to the card), so what you see is what the
 * app will look like.
 *
 * `compact` renders one short row per theme (for the preferences dialog, where
 * all five must fit on a phone without scrolling); the full cards with the
 * live-score preview stay on the Settings page.
 */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId, themes, switchable } = useTheme();

  // Previews show each theme's fonts, so load them while the picker is open.
  useEffect(() => {
    themes.forEach((t) => ensureThemeFonts(t.id));
  }, [themes]);

  if (!switchable) return null;

  if (compact) {
    return (
      <div role="radiogroup" aria-label="App theme" className="grid grid-cols-1 gap-2">
        {themes.map((t) => {
          const active = t.id === themeId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${t.name}: ${t.tagline}`}
              onClick={() => setThemeId(t.id)}
              className={cn(
                `theme-${t.id}`,
                "w-full flex items-center gap-2.5 text-left rounded-xl border-2 bg-background text-foreground px-2.5 py-2 transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary" : "border-border hover:border-border-strong",
              )}
            >
              <span
                className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center"
                aria-hidden="true"
              >
                Aa
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-bold leading-tight truncate">{t.name}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground line-clamp-2">{t.tagline}</span>
              </span>
              <span className="shrink-0 flex -space-x-1" aria-hidden="true">
                <span className="w-3 h-3 rounded-full bg-success ring-2 ring-background" />
                <span className="w-3 h-3 rounded-full bg-warning ring-2 ring-background" />
                <span className="w-3 h-3 rounded-full bg-info ring-2 ring-background" />
              </span>
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  active ? "bg-primary border-primary text-primary-foreground" : "border-border-strong",
                )}
                aria-hidden="true"
              >
                {active && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="App theme"
      className="grid gap-2.5 grid-cols-1 sm:grid-cols-2"
    >
      {themes.map((t) => {
        const active = t.id === themeId;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemeId(t.id)}
            className={cn(
              `theme-${t.id}`,
              "relative w-full text-left rounded-2xl border-2 bg-background text-foreground p-3 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary shadow-lg" : "border-border hover:border-border-strong",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-base font-bold leading-tight">{t.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t.tagline}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  active ? "bg-primary border-primary text-primary-foreground" : "border-border-strong",
                )}
                aria-hidden="true"
              >
                {active && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </div>

            <div className="mt-3 rounded-xl bg-card border border-border p-2.5 space-y-2" aria-hidden="true">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-live px-1.5 py-0.5 text-[9px] font-black tracking-wider text-live-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-live-foreground" />
                  LIVE
                </span>
                <span className="font-stat text-lg font-bold leading-none">21–17</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-6 flex-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  Register
                </span>
                <span className="h-6 w-6 rounded-lg bg-success" />
                <span className="h-6 w-6 rounded-lg bg-warning" />
                <span className="h-6 w-6 rounded-lg bg-info" />
                <span className="h-6 w-6 rounded-lg bg-you" />
              </div>
            </div>

            <div className="mt-2 text-[10px] text-faint">
              {t.dark ? "Dark" : "Light"} · {t.fontsLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
}
