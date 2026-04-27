import React, { useState } from 'react';
import {
  ChevronRight, Settings2, Download, Maximize, Minimize,
  HelpCircle, Layers, RotateCcw, Palette, Circle, Hexagon, Activity, Scaling,
} from 'lucide-react';
import { SCHEME_NAMES, schemeGradientCSS } from './utils/colorSchemes';

/* ── Reusable primitives ── */

const Slider = ({ label, value, min, max, step, onChange, unit = '', displayValue }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
        {displayValue ?? value}{unit}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="settings-slider w-full"
    />
  </div>
);

const Toggle = ({ label, value, onChange, icon: Icon }) => (
  <button
    onClick={() => onChange(!value)}
    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
      value
        ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-700/40'
    }`}
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
    <span className="flex-1 text-left">{label}</span>
    <div className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${
      value ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'
    }`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
        value ? 'translate-x-3.5' : 'translate-x-0.5'
      }`} />
    </div>
  </button>
);

const ActionButton = ({ label, onClick, icon: Icon, ...rest }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-medium
      text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-all"
    {...rest}
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
    {label}
  </button>
);

const SectionTitle = ({ children }) => (
  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-1">
    {children}
  </h4>
);

const ColorInput = ({ label, value, onChange, defaultColor }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <div className="flex items-center gap-1.5">
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-[9px] text-slate-400 hover:text-red-400 transition-colors"
          title="Reset to default"
        >
          ✕
        </button>
      )}
      <label className="relative w-6 h-6 rounded-md border border-slate-300/60 dark:border-slate-600/40 cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: value || defaultColor }}
        />
        <input
          type="color"
          value={value || defaultColor}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  </div>
);

/* ── Color mode segmented control ── */
const COLOR_MODES = [
  { id: 'generation', label: 'Generation', icon: Hexagon },
  { id: 'type', label: 'Type', icon: Circle },
  { id: 'degree', label: 'Degree', icon: Activity },
];

const ColorModeSelector = ({ value, onChange }) => (
  <div className="flex rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-600/30">
    {COLOR_MODES.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-all ${
          value === id
            ? 'bg-violet-500 text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-700/40'
        }`}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    ))}
  </div>
);

/* ── Scheme swatch picker ── */
const SchemePicker = ({ value, onChange }) => (
  <div className="space-y-1">
    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Color Scheme</span>
    <div className="grid grid-cols-3 gap-1">
      {SCHEME_NAMES.map((name) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          className={`relative h-[18px] rounded overflow-hidden transition-all ${
            value === name
              ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-800'
              : 'ring-1 ring-slate-200/40 dark:ring-slate-600/30 hover:ring-slate-400 dark:hover:ring-slate-500'
          }`}
          title={name}
        >
          <div
            className="absolute inset-0"
            style={{ background: schemeGradientCSS(name) }}
          />
          <span className="relative text-[7px] font-bold uppercase tracking-wide text-white drop-shadow-md px-0.5">
            {name}
          </span>
        </button>
      ))}
    </div>
  </div>
);

/* ── Main panel ── */

const SettingsPanel = ({
  edgeOpacity, setEdgeOpacity,
  spacingScale, setSpacingScale,
  showOverlay, toggleOverlay,
  isFullscreen, toggleFullscreen,
  handleDownloadSVG,
  resetSpiral,
  tightenEdges,
  toggleHelp,
  colorMode, setColorMode,
  colorScheme, setColorScheme,
  bgColor, setBgColor,
  gridColor, setGridColor,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Toggle tab (always visible on right edge) ── */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="absolute z-30 flex items-center justify-center
          w-5 h-14 rounded-l-lg
          bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl
          border border-r-0 border-slate-200/50 dark:border-slate-600/30
          shadow-lg text-slate-400 hover:text-violet-500
          transition-all duration-300 ease-out"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          right: open ? '260px' : '0px',
        }}
        title="Settings"
      >
        {open
          ? <ChevronRight className="w-3.5 h-3.5" />
          : <Settings2 className="w-3.5 h-3.5" />
        }
      </button>

      {/* ── Slide-out panel ── */}
      <div
        className={`absolute top-0 right-0 bottom-0 z-30 w-[260px]
          bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl
          border-l border-slate-200/50 dark:border-slate-600/30
          shadow-2xl overflow-y-auto overflow-x-hidden
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-4 py-4 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-violet-500" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              Settings
            </h3>
          </div>

          {/* ── Display ── */}
          <div className="space-y-3">
            <SectionTitle>Display</SectionTitle>
            <Slider
              label="Edge Opacity"
              value={edgeOpacity} min={0} max={1} step={0.05}
              onChange={setEdgeOpacity}
              displayValue={Math.round(edgeOpacity * 100)} unit="%"
            />
            <Slider
              label="Graph Spread"
              value={spacingScale} min={0.3} max={3} step={0.1}
              onChange={setSpacingScale}
              displayValue={Math.round(spacingScale * 100)} unit="%"
            />
            <Toggle label="Path overlay" value={showOverlay} onChange={toggleOverlay} icon={Layers} />
          </div>

          <div className="h-px bg-slate-200/60 dark:bg-slate-700/30" />

          {/* ── Colors ── */}
          <div className="space-y-3">
            <SectionTitle>
              <span className="flex items-center gap-1.5"><Palette className="w-3 h-3" /> Colors</span>
            </SectionTitle>

            <ColorModeSelector value={colorMode} onChange={setColorMode} />

            {/* Scheme picker — only for generation/degree continuous modes */}
            {(colorMode === 'generation' || colorMode === 'degree') && (
              <SchemePicker value={colorScheme} onChange={setColorScheme} />
            )}

            {/* Type legend */}
            {colorMode === 'type' && (
              <div className="space-y-1 pl-1">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-teal-400 border border-teal-600 inline-block flex-shrink-0" />
                  Compound (circle)
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="w-3 h-3 rounded inline-block flex-shrink-0 bg-indigo-400 border border-indigo-600" />
                  Reaction (rect)
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="w-3 h-2 rounded-full inline-block flex-shrink-0 bg-amber-400 border border-amber-600" />
                  EC (ellipse)
                </div>
              </div>
            )}

            <div className="h-px bg-slate-200/60 dark:bg-slate-700/30 my-1" />

            <ColorInput label="Background" value={bgColor} onChange={setBgColor} defaultColor="#f8fafc" />
            <ColorInput label="Grid lines" value={gridColor} onChange={setGridColor} defaultColor="#e2e8f0" />
          </div>

          <div className="h-px bg-slate-200/60 dark:bg-slate-700/30" />

          {/* ── Actions ── */}
          <div className="space-y-1">
            <SectionTitle>Actions</SectionTitle>
            <ActionButton label="Reset layout" onClick={resetSpiral} icon={RotateCcw} />
            <ActionButton label="Minimize edge lengths" onClick={tightenEdges} icon={Scaling} />
            <ActionButton label="Download SVG" onClick={handleDownloadSVG} icon={Download} />
            <ActionButton
              label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={toggleFullscreen}
              icon={isFullscreen ? Minimize : Maximize}
            />
            <ActionButton label="Help & shortcuts" onClick={toggleHelp} icon={HelpCircle} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
