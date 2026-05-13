import React, { useState } from 'react';
import {
  ChevronRight, Settings2, Download, Image, Maximize, Minimize,
  HelpCircle, Layers, RotateCcw, Palette, Circle, Activity, Scaling,
  Spline, GitCommitHorizontal, Hexagon, Map, Route, Tag,
} from 'lucide-react';
import { SCHEME_NAMES, schemeGradientCSS } from '../NetworkViewer2D/utils/colorSchemes';

/* ── Reusable primitives (same as NetworkViewer2D) ── */

const Slider = ({ label, value, min, max, step, onChange, unit = '', displayValue }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-content-secondary">{label}</span>
      <span className="text-[11px] font-semibold text-content tabular-nums">
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
        ? 'bg-brand/10 text-brand'
        : 'text-content-secondary hover:bg-surface-inset/60'
    }`}
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
    <span className="flex-1 text-left">{label}</span>
    <div className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${
      value ? 'bg-brand' : 'bg-brd'
    }`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-content-inverse shadow-sm transition-transform ${
        value ? 'translate-x-3.5' : 'translate-x-0.5'
      }`} />
    </div>
  </button>
);

const ActionButton = ({ label, onClick, icon: Icon, ...rest }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-medium
      text-content-secondary hover:bg-surface-inset/60 transition-all"
    {...rest}
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
    {label}
  </button>
);

const SectionTitle = ({ children }) => (
  <h4 className="text-[10px] font-bold uppercase tracking-wider text-content-muted pb-1">
    {children}
  </h4>
);

const ColorInput = ({ label, value, onChange, defaultColor }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-medium text-content-secondary">{label}</span>
    <div className="flex items-center gap-1.5">
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-[9px] text-content-muted hover:text-err transition-colors"
          title="Reset to default"
        >
          ✕
        </button>
      )}
      <label className="relative w-6 h-6 rounded-md border border-brd/60 cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute inset-0" style={{ backgroundColor: value || defaultColor }} />
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

const COLOR_MODES = [
  { id: 'generation', label: 'Generation', icon: Circle },
  { id: 'type', label: 'Type', icon: Circle },
  { id: 'degree', label: 'Degree', icon: Activity },
];

const ColorModeSelector = ({ value, onChange }) => (
  <div className="flex rounded-lg overflow-hidden border border-brd/60">
    {COLOR_MODES.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-all ${
          value === id
            ? 'bg-brand text-content-inverse shadow-sm'
            : 'text-content-secondary hover:bg-surface-inset/60'
        }`}
      >
        <Icon className="w-3 h-3" />
        {label}
      </button>
    ))}
  </div>
);

const SchemePicker = ({ value, onChange }) => (
  <div className="space-y-1">
    <span className="text-[11px] font-medium text-content-secondary">Color Scheme</span>
    <div className="grid grid-cols-3 gap-1">
      {SCHEME_NAMES.map((name) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          className={`relative h-[18px] rounded overflow-hidden transition-all ${
            value === name
              ? 'ring-2 ring-brand ring-offset-1 ring-offset-surface'
              : 'ring-1 ring-brd/40 hover:ring-brd'
          }`}
          title={name}
        >
          <div className="absolute inset-0" style={{ background: schemeGradientCSS(name) }} />
          <span className="relative text-[7px] font-bold uppercase tracking-wide text-content-inverse drop-shadow-md px-0.5">
            {name}
          </span>
        </button>
      ))}
    </div>
  </div>
);

const LAYOUT_MODES = [
  { id: 'curved', label: 'Curved', icon: Spline },
  { id: 'orthogonal', label: 'Grid', icon: GitCommitHorizontal },
];

const LayoutSelector = ({ value, onChange }) => (
  <div>
    <span className="text-[11px] font-medium text-content-secondary mb-1.5 block">Layout</span>
    <div className="flex rounded-lg overflow-hidden border border-brd/60">
      {LAYOUT_MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold transition-all ${
            value === id
              ? 'bg-brand/15 text-brand'
              : 'text-content-muted hover:text-content-secondary'
          }`}
        >
          <Icon className="w-3 h-3" />
          {label}
        </button>
      ))}
    </div>
  </div>
);

const SettingsPanel = ({
  edgeOpacity, setEdgeOpacity,
  spacingScale, setSpacingScale,
  showOverlay, toggleOverlay,
  isFullscreen, toggleFullscreen,
  handleDownloadSVG,
  handleDownloadPNG,
  resetLayout,
  tightenEdges,
  toggleHelp,
  colorMode, setColorMode,
  colorScheme, setColorScheme,
  bgColor, setBgColor,
  gridColor, setGridColor,
  edgeStyle, setEdgeStyle,
  pruneEdges, setPruneEdges,
  nodeDisplay, setNodeDisplay,
  showNames, setShowNames,
  keggLayout, setKeggLayout,
  keggOrthoEdges, setKeggOrthoEdges,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="absolute z-30 flex items-center justify-center
          w-5 h-14 rounded-l-lg
          bg-surface-overlay/80 backdrop-blur-xl
          border border-r-0 border-brd/50
          shadow-lg text-content-muted hover:text-brand
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

      <div
        className={`absolute top-0 right-0 bottom-0 z-30 w-[260px]
          bg-surface-overlay/95 backdrop-blur-2xl
          border-l border-brd/50
          shadow-2xl overflow-y-auto overflow-x-hidden
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="px-4 py-4 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand" />
            <h3 className="text-xs font-bold text-content uppercase tracking-wide">
              Map Settings
            </h3>
          </div>

          {/* Display */}
          <div className="space-y-3">
            <SectionTitle>Display</SectionTitle>
            <Slider
              label="Edge Opacity"
              value={edgeOpacity} min={0} max={1} step={0.05}
              onChange={setEdgeOpacity}
              displayValue={Math.round(edgeOpacity * 100)} unit="%"
            />
            <Slider
              label="Spacing"
              value={spacingScale} min={0.3} max={3} step={0.1}
              onChange={setSpacingScale}
              displayValue={Math.round(spacingScale * 100)} unit="%"
            />
            <Toggle label="Path overlay" value={showOverlay} onChange={toggleOverlay} icon={Layers} />
            <Toggle label="Prune edges" value={pruneEdges} onChange={setPruneEdges} icon={Scaling} />
            <Toggle label="Structures" value={nodeDisplay === 'structure'} onChange={(v) => setNodeDisplay(v ? 'structure' : 'circle')} icon={Hexagon} />
            <Toggle label="Compound names" value={showNames} onChange={setShowNames} icon={Tag} />
            <Toggle label="KEGG layout" value={keggLayout} onChange={setKeggLayout} icon={Map} />
            <Toggle label="KEGG ortho edges" value={keggOrthoEdges} onChange={setKeggOrthoEdges} icon={Route} />
            <LayoutSelector value={edgeStyle} onChange={setEdgeStyle} />
          </div>

          <div className="h-px bg-brd/60" />

          {/* Colors */}
          <div className="space-y-3">
            <SectionTitle>
              <span className="flex items-center gap-1.5"><Palette className="w-3 h-3" /> Colors</span>
            </SectionTitle>
            <ColorModeSelector value={colorMode} onChange={setColorMode} />
            {(colorMode === 'generation' || colorMode === 'degree') && (
              <SchemePicker value={colorScheme} onChange={setColorScheme} />
            )}
            {colorMode === 'type' && (
              <div className="space-y-1 pl-1">
                <div className="flex items-center gap-2 text-[10px] text-content-secondary">
                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: 'rgb(var(--node-compound-fill))', border: '1px solid rgb(var(--node-compound-stroke))' }} />
                  Compound (circle)
                </div>
              </div>
            )}
            <div className="h-px bg-brd/60 my-1" />
            <ColorInput label="Background" value={bgColor} onChange={setBgColor} defaultColor="#f8fafc" />
            <ColorInput label="Grid lines" value={gridColor} onChange={setGridColor} defaultColor="#e2e8f0" />
          </div>

          <div className="h-px bg-brd/60" />

          {/* Actions */}
          <div className="space-y-1">
            <SectionTitle>Actions</SectionTitle>
            <ActionButton label="Reset layout" onClick={resetLayout} icon={RotateCcw} />
            <ActionButton label="Minimize edge lengths" onClick={tightenEdges} icon={Scaling} />
            <ActionButton label="Download SVG" onClick={handleDownloadSVG} icon={Download} />
            <ActionButton label="Download PNG" onClick={handleDownloadPNG} icon={Image} />
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
