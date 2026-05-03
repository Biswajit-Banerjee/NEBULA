import React, { useContext, useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { ThemeContext } from "./ThemeProvider";

const ThemeSelector = () => {
  const { themeName, setThemeName, themeIds, themes } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 rounded-lg transition-all duration-200 hover:bg-surface-secondary/60 text-content-muted hover:text-brand"
        title="Change theme"
        aria-label="Change theme"
      >
        <Palette className="w-4 h-4" />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-brd/60 bg-surface-overlay/95 backdrop-blur-xl shadow-xl overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-brd/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-content-muted">Theme</span>
          </div>
          <div className="py-1">
            {themeIds.map((id) => {
              const t = themes[id];
              const isActive = id === themeName;
              return (
                <button
                  key={id}
                  onClick={() => { setThemeName(id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-brand/10 text-brand font-semibold"
                      : "text-content hover:bg-surface-inset/60"
                  }`}
                >
                  {/* Swatch trio */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-brd/40 shadow-sm"
                      style={{ backgroundColor: t.swatch.bg }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-brd/40 shadow-sm -ml-1"
                      style={{ backgroundColor: t.swatch.accent }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-brd/40 shadow-sm -ml-1"
                      style={{ backgroundColor: t.swatch.text }}
                    />
                  </div>
                  <span className="flex-1 truncate">{t.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0 text-brand" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
