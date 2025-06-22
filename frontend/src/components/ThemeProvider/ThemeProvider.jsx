import React, { createContext, useState, useEffect, useCallback } from "react";

export const ThemeContext = createContext({
  dark: false,
  toggle: () => {},
});

const STORAGE_KEY = "nebula-theme";

export function ThemeProvider({ children }) {
  // Determine initial theme: prefer localStorage, then OS preference
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored === "dark";
    }
    // Fallback to media query
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Apply/remove the `dark` class and persist
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  const toggle = useCallback(() => setDark((prev) => !prev), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
} 