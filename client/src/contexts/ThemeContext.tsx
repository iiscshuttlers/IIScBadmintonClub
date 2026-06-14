import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

type Theme = "light" | "dark";
type Accent = "emerald" | "violet" | "rose" | "amber" | "blue" | "cyberpunk";

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  toggleTheme?: () => void;
  setAccent?: (a: Accent) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [accent, setAccentState] = useState<Accent>(() => {
    if (switchable) {
      const stored = localStorage.getItem("accent");
      return (stored as Accent) || "emerald";
    }
    return "emerald";
  });

  useEffect(() => {
    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (theme === "dark") {
      root.classList.add("dark");
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", "#020617"); // slate-950
      }
    } else {
      root.classList.remove("dark");
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", "#f8fafc"); // slate-50
      }
    }

    if (accent === "emerald") {
      root.removeAttribute("data-accent");
    } else {
      root.setAttribute("data-accent", accent);
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
      localStorage.setItem("accent", accent);
    }
  }, [theme, accent, switchable]);

  const toggleTheme = switchable
    ? async () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
        if (Capacitor.isNativePlatform()) {
          try {
            await Haptics.impact({ style: ImpactStyle.Light });
          } catch (e) {
            console.warn("Haptics failed", e);
          }
        }
      }
    : undefined;

  const setAccent = switchable ? setAccentState : undefined;

  return (
    <ThemeContext.Provider
      value={{ theme, accent, toggleTheme, setAccent, switchable }}
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
