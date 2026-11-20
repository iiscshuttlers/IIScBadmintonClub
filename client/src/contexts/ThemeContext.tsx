import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  ensureThemeFonts,
  getThemeMeta,
  isThemeId,
  type ThemeId,
  type ThemeMeta,
} from "@/lib/themes";
import { THEME_CHANGE_EVENT, themeColor } from "@/lib/themeColors";

type Mode = "light" | "dark";

interface ThemeContextType {
  /** The selected theme (one of the five in lib/themes.ts). */
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  themes: readonly ThemeMeta[];
  /** Whether the selected theme is light or dark (for the few places that need to know). */
  theme: Mode;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  switchable?: boolean;
}

function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* storage blocked — fall back to the default */
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children, switchable = false }: ThemeProviderProps) {
  const [themeId, setThemeState] = useState<ThemeId>(() => (switchable ? readStoredTheme() : DEFAULT_THEME));
  const meta = getThemeMeta(themeId);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", themeId);
    root.classList.toggle("dark", meta.dark);
    root.style.colorScheme = meta.dark ? "dark" : "light";
    // The pre-React boot colours are no longer needed once the stylesheet applies the theme.
    root.style.removeProperty("--boot-bg");
    root.style.removeProperty("--boot-accent");
    ensureThemeFonts(themeId);

    if (switchable) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, themeId);
        // Old preferences from the accent picker and the light/dark toggle.
        localStorage.removeItem("accent");
        localStorage.removeItem("theme");
      } catch {
        /* ignore */
      }
    }
    root.removeAttribute("data-accent");

    const background = themeColor("background");
    if (background) {
      document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute("content", background));
    }
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: meta.dark ? Style.Dark : Style.Light }).catch(() => {});
      if (background) StatusBar.setBackgroundColor({ color: background }).catch(() => {});
    }
    root.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { themeId } }));
  }, [themeId, meta.dark, switchable]);

  const setThemeId = useCallback(
    (id: ThemeId) => {
      if (!switchable || !isThemeId(id)) return;
      setThemeState(id);
      if (Capacitor.isNativePlatform()) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    },
    [switchable],
  );

  return (
    <ThemeContext.Provider
      value={{ themeId, setThemeId, themes: THEMES, theme: meta.dark ? "dark" : "light", switchable }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
