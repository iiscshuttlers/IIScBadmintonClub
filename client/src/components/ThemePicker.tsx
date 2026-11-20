import { useEffect } from "react";
import { Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ensureThemeFonts } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Theme chooser. Each card is rendered *in* its own theme (the `theme-<id>`
 * class scopes that theme's tokens to the card), so what you see is what the
 * app will look like.
 */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId, themes, switchable } = useTheme();

  // Previews show each theme's fonts, so load them while the picker is open.
  useEffect(() => {
    themes.forEach((t) => ensureThemeFonts(t.id));
  }, [themes]);

  if (!switchable) return null;

  return (
    <div
      role="radiogroup"
      aria-label="App theme"
      className={cn("grid gap-2.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}
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

            {!compact && (
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
            )}

            <div className="mt-2 text-[10px] text-faint">
              {t.dark ? "Dark" : "Light"} · {t.fontsLabel}
            </div>
          </button>
        );
      })}
    </div>
  );
}
