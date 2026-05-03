import React, { createContext, useState, useEffect, useCallback } from "react";
import { THEMES, THEME_IDS, DEFAULT_THEME } from "../../config/themes";

const STORAGE_KEY = "nebula-theme";

export const ThemeContext = createContext({
  dark: false,
  toggle: () => {},
  themeName: DEFAULT_THEME,
  setThemeName: () => {},
  themeIds: THEME_IDS,
  themes: THEMES,
});

/**
 * Apply a named theme: set CSS custom properties on <html>, toggle .dark class.
 */
function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  const root = document.documentElement;

  // Set every CSS custom property from the theme's color map
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  // Toggle Tailwind dark mode class
  root.classList.toggle("dark", theme.isDark);

  // Set data-theme for any CSS selectors that need it
  root.setAttribute("data-theme", name);
}

export function ThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
    // Migrate from old storage key
    const oldKey = localStorage.getItem("nebula-theme-mode");
    if (oldKey === "dark") return "nebula-dark";
    if (oldKey === "light") return "nebula-light";
    // System preference fallback
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "nebula-dark";
    }
    return DEFAULT_THEME;
  });

  const dark = THEMES[themeName]?.isDark ?? false;

  // Apply theme tokens whenever themeName changes
  useEffect(() => {
    applyTheme(themeName);
    localStorage.setItem(STORAGE_KEY, themeName);
    // Clean up old storage key
    localStorage.removeItem("nebula-theme-mode");
  }, [themeName]);

  const setThemeName = useCallback((name) => {
    if (THEMES[name]) setThemeNameState(name);
  }, []);

  // Legacy toggle: flip between the two nebula presets (or first light/dark pair)
  const toggle = useCallback(() => {
    setThemeNameState((prev) => {
      const current = THEMES[prev];
      if (!current) return DEFAULT_THEME;
      // Find a theme with the opposite isDark value
      if (current.isDark) {
        return prev === "nebula-dark" ? "nebula-light" : "nebula-light";
      }
      return prev === "nebula-light" ? "nebula-dark" : "nebula-dark";
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle, themeName, setThemeName, themeIds: THEME_IDS, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}