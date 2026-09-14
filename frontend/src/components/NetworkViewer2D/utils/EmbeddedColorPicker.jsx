import React, { useState, useEffect } from 'react';

const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#d946ef', '#000000', '#ffffff',
];

const EmbeddedColorPicker = ({ color, alpha, onChange, onCancel, onOk, showAlpha = false }) => {
  const [tempColor, setTempColor] = useState(color || '#ffffff');
  const [tempAlpha, setTempAlpha] = useState(alpha !== undefined ? alpha : 1);

  useEffect(() => { if (color) setTempColor(color); }, [color]);
  useEffect(() => { if (alpha !== undefined) setTempAlpha(alpha); }, [alpha]);

  const handleChange = (newColor, newAlpha) => {
    setTempColor(newColor);
    const a = newAlpha !== undefined ? newAlpha : tempAlpha;
    setTempAlpha(a);
    if (onChange) onChange(newColor, a);
  };

  return (
    <div className="p-2.5 border border-brd/40 rounded-lg bg-surface-overlay shadow-lg space-y-2 mt-1 z-50 relative">
      {/* Color input + hex */}
      <div className="flex items-center gap-2">
        <label className="w-8 h-8 rounded-md border border-brd/40 cursor-pointer overflow-hidden relative block flex-shrink-0 hover:border-brand/50 transition-colors">
          <input
            type="color"
            value={tempColor.startsWith('#') ? tempColor : '#ffffff'}
            onChange={(e) => handleChange(e.target.value)}
            className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer border-none"
          />
        </label>
        <input
          type="text"
          value={tempColor}
          onChange={e => handleChange(e.target.value)}
          placeholder="#HEX"
          className="flex-1 min-w-0 bg-surface-inset border border-brd/40 rounded-md px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-brand/30 focus:border-brand/50 transition-all"
        />
      </div>

      {/* Compact preset row */}
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            className={`w-5 h-5 rounded-full border transition-all hover:scale-110 flex-shrink-0 ${
              tempColor.toLowerCase() === p.toLowerCase()
                ? 'border-brand ring-1 ring-brand/30 scale-110'
                : 'border-brd/30'
            }`}
            style={{ backgroundColor: p }}
            onClick={() => handleChange(p)}
            title={p}
          />
        ))}
      </div>

      {/* Alpha slider */}
      {showAlpha && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-content-muted w-8 flex-shrink-0">
            {Math.round(tempAlpha * 100)}%
          </span>
          <input
            type="range"
            min="0" max="100"
            value={Math.round(tempAlpha * 100)}
            onChange={e => handleChange(tempColor, parseInt(e.target.value) / 100)}
            className="flex-1 h-1.5 rounded-full appearance-none bg-brd/40 cursor-pointer accent-brand"
          />
        </div>
      )}

      {/* Apply / Cancel */}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md bg-surface-inset text-content-secondary hover:text-content transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onOk(tempColor, tempAlpha)}
          className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md bg-brand text-content-inverse hover:bg-brand-hover transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default EmbeddedColorPicker;
