/**
 * Read the active theme's colours from JavaScript.
 *
 * Tailwind classes (bg-card, text-live, …) cover almost everything. Use these
 * helpers only where a class can't reach: <canvas> drawing, chart libraries,
 * inline SVG attributes and generated images. All values come from the CSS
 * variables in styles/themes.css, so they follow the user's theme.
 */
import { useEffect, useState } from "react";

export type ThemeColorToken =
  | "background" | "foreground" | "card" | "card-foreground" | "popover" | "popover-foreground"
  | "muted" | "muted-strong" | "muted-foreground" | "soft" | "faint"
  | "border" | "border-strong" | "input" | "ring" | "scrim"
  | "primary" | "primary-foreground" | "secondary" | "secondary-foreground"
  | "accent" | "accent-foreground" | "success" | "success-foreground"
  | "warning" | "warning-foreground" | "danger" | "danger-foreground"
  | "destructive" | "destructive-foreground" | "live" | "live-foreground"
  | "info" | "info-foreground" | "you" | "you-foreground"
  | "gold" | "gold-foreground" | "silver" | "silver-foreground" | "bronze" | "bronze-foreground" | "winner"
  | "individual" | "individual-foreground" | "team" | "team-foreground"
  | "cat-ms" | "cat-ws" | "cat-md" | "cat-wd" | "cat-xd"
  | "team-1" | "team-2" | "series-a" | "series-b"
  | "status-available" | "status-playing" | "status-resting" | "status-injured"
  | "on-accent" | "hero" | "hero-foreground" | "hero-muted" | "hero-accent" | "hero-accent-foreground"
  | "grad-from" | "grad-to" | "grad-warm-from" | "grad-warm-to"
  | "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5" | "chart-6";

/** `var(--token)` — for inline styles and SVG fill/stroke, which resolve CSS variables live. */
export const cssVar = (token: ThemeColorToken): string => `var(--${token})`;

/** `color-mix(...)` — a token at a given opacity (0–1), for inline styles. */
export const cssVarAlpha = (token: ThemeColorToken, alpha: number): string =>
  `color-mix(in srgb, var(--${token}) ${Math.round(alpha * 100)}%, transparent)`;

/**
 * The resolved colour string (e.g. "#ffc83d") of a token, read from `el`
 * (default: <html>, i.e. the user's theme). Use for <canvas> and image export,
 * where CSS variables don't apply. Read it at draw time, not at module load.
 */
export function themeColor(token: ThemeColorToken, el?: Element | null): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  const target = el ?? document.documentElement;
  return getComputedStyle(target).getPropertyValue(`--${token}`).trim();
}

/**
 * Resolve a token for a specific theme regardless of the user's choice — e.g.
 * `themeColorFor("paper", "foreground")` for print/PDF output on white paper.
 */
export function themeColorFor(themeId: string, token: ThemeColorToken): string {
  if (typeof document === "undefined") return "";
  const probe = document.createElement("div");
  probe.className = `theme-${themeId}`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const value = themeColor(token, probe);
  probe.remove();
  return value;
}

/** The active theme's font stack for canvas text: `ctx.font = \`700 24px ${themeFont("display")}\``. */
export function themeFont(role: "display" | "body" | "stat", el?: Element | null): string {
  if (typeof document === "undefined") return "sans-serif";
  const target = el ?? document.documentElement;
  return getComputedStyle(target).getPropertyValue(`--theme-font-${role}`).trim() || "sans-serif";
}

/** A resolved token colour with alpha applied, as an `rgb(r g b / a)` string for canvas. */
export function themeColorAlpha(token: ThemeColorToken, alpha: number, el?: Element | null): string {
  return withAlpha(themeColor(token, el), alpha);
}

/** Apply alpha (0–1) to a resolved `#rrggbb` / `#rgb` colour. Other formats are returned as-is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgb(${[r, g, b].join(" ")} / ${alpha})`;
}

/** Fired on <html> whenever ThemeContext switches theme. */
export const THEME_CHANGE_EVENT = "app-theme-change";

/**
 * Re-render when the theme changes and hand back a resolver. Use in components
 * that draw to canvas or pass colours to a chart library.
 *
 *   const color = useThemeColors();
 *   ctx.fillStyle = color("primary");
 */
export function useThemeColors(): (token: ThemeColorToken) => string {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    document.documentElement.addEventListener(THEME_CHANGE_EVENT, bump);
    return () => document.documentElement.removeEventListener(THEME_CHANGE_EVENT, bump);
  }, []);
  return (token) => themeColor(token);
}
