/**
 * The five app themes. Colour values live in styles/themes.css; this file is
 * the registry the picker and ThemeContext use (names, light/dark, fonts).
 *
 * Keep in sync with the boot script in client/index.html, which applies the
 * saved theme before React loads so there is no flash of the wrong colours.
 */

export type ThemeId = "floodlight" | "centre-court" | "smash" | "paper" | "heritage";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  /** One line shown under the name in the picker. */
  tagline: string;
  dark: boolean;
  /** Fonts shown in the picker, e.g. "Barlow Condensed + Inter". */
  fontsLabel: string;
  /** Google Fonts stylesheet with exactly the families/weights this theme uses. */
  fontsHref: string;
}

const GF = "https://fonts.googleapis.com/css2?";

export const THEMES: readonly ThemeMeta[] = [
  {
    id: "floodlight",
    name: "Floodlight",
    tagline: "Night-match navy, shuttle-yellow buttons",
    dark: true,
    fontsLabel: "Barlow Condensed + Inter",
    fontsHref: `${GF}family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap`,
  },
  {
    id: "centre-court",
    name: "Centre Court",
    tagline: "Light and fresh, court green with orange",
    dark: false,
    fontsLabel: "Plus Jakarta Sans",
    fontsHref: `${GF}family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap`,
  },
  {
    id: "smash",
    name: "Smash",
    tagline: "Electric violet with cyan, bold and wide",
    dark: true,
    fontsLabel: "Unbounded + Manrope",
    fontsHref: `${GF}family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap`,
  },
  {
    id: "paper",
    name: "Paper & Cobalt",
    tagline: "Paper white and ink with one cobalt blue",
    dark: false,
    fontsLabel: "Inter Tight + Inter",
    fontsHref: `${GF}family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap`,
  },
  {
    id: "heritage",
    name: "Heritage",
    tagline: "Club green, trophy gold, serif headlines",
    dark: true,
    fontsLabel: "Fraunces + Inter",
    fontsHref: `${GF}family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&display=swap`,
  },
] as const;

export const DEFAULT_THEME: ThemeId = "floodlight";
export const THEME_STORAGE_KEY = "app-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function getThemeMeta(id: ThemeId): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Load a theme's web fonts once (adds a <link> to <head>; no-op if already there). */
export function ensureThemeFonts(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const meta = getThemeMeta(id);
  if (document.querySelector(`link[data-theme-fonts="${meta.id}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = meta.fontsHref;
  link.crossOrigin = "anonymous";
  link.dataset.themeFonts = meta.id;
  document.head.appendChild(link);
}
