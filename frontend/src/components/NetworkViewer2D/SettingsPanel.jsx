import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Settings2, Download, Maximize, Minimize,
  HelpCircle, Layers, RotateCcw, Palette, Scaling, Tag, Atom, Spline,
  Upload, Paintbrush, Trash2, ZoomIn, ZoomOut, Maximize2,
  Move, Eye, Minus, Plus, X
} from 'lucide-react';
import { RAINBOW_PALETTE, adjustHsv } from './utils/colorSchemes';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';
import EmbeddedColorPicker from './utils/EmbeddedColorPicker';

/* ── Reusable primitives ── */

const Slider = ({ label, value, min, max, step, onChange, unit = '', displayValue }) => (
  <div className="space-y-1">
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

/* Compact stepper: [−] editable_value [+] — no hard max, click to type */
const Stepper = ({ label, value, min = 0, step, onChange, unit = '', displayValue, fromDisplay }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(+(value + step).toFixed(2));
  const shown = displayValue ?? value;
  const startEdit = () => { setDraft(String(shown)); setEditing(true); };
  const commitEdit = () => {
    setEditing(false);
    const raw = parseFloat(draft);
    if (isNaN(raw)) return;
    // If the caller provides fromDisplay (e.g. percent→decimal), use it
    const next = fromDisplay ? fromDisplay(raw) : raw;
    onChange(Math.max(min, next));
  };
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[11px] font-medium text-content-secondary flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-0 flex-shrink-0">
        <button
          onClick={dec}
          disabled={value <= min}
          className="w-6 h-6 flex items-center justify-center rounded-l-md border border-brd/50
            text-content-secondary hover:bg-surface-inset/60 disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3 h-3" />
        </button>
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
            className="h-6 w-[52px] px-1 border-y border-brd/50 bg-surface-inset/30 text-[11px]
              font-semibold text-content tabular-nums text-center outline-none focus:ring-1 focus:ring-brand/50"
          />
        ) : (
          <button
            onClick={startEdit}
            className="h-6 px-1.5 flex items-center justify-center border-y border-brd/50
              bg-surface-inset/30 text-[11px] font-semibold text-content tabular-nums min-w-[52px]
              hover:bg-surface-inset/50 cursor-text transition-colors"
            title="Click to type a value"
          >
            {shown}{unit}
          </button>
        )}
        <button
          onClick={inc}
          className="w-6 h-6 flex items-center justify-center rounded-r-md border border-brd/50
            text-content-secondary hover:bg-surface-inset/60 transition-colors"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const Toggle = ({ label, value, onChange, icon: Icon }) => (
  <button
    onClick={() => onChange(!value)}
    className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
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
    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium
      text-content-secondary hover:bg-surface-inset/60 transition-all"
    {...rest}
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
    {label}
  </button>
);

const ColorInput = ({ label, value, onChange, defaultColor }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [initialColor, setInitialColor] = useState(null);

  const startEditing = () => {
    setInitialColor(value || '');
    setShowPicker(true);
  };

  const handleCancel = () => {
    onChange(initialColor);
    setShowPicker(false);
  };

  return (
    <div className="space-y-1">
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
          <button
            onClick={() => showPicker ? setShowPicker(false) : startEditing()}
            className={`w-6 h-6 rounded-md border shadow-sm hover:shadow-md transition-all relative overflow-hidden ${showPicker ? 'ring-2 ring-brand border-brand' : 'border-brd/60'}`}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: value || defaultColor }}
            />
          </button>
        </div>
      </div>
      {showPicker && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <EmbeddedColorPicker
            color={value || defaultColor}
            onChange={onChange}
            onOk={() => setShowPicker(false)}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
};

/* ── Color mode selector ── */
const COLOR_MODES = [
  { value: 'generation', label: 'Generation', desc: 'Color by generation depth' },
  { value: 'type',       label: 'Node Type',  desc: 'Color by compound / reaction / EC' },
  { value: 'degree',     label: 'Degree',      desc: 'Color by connection count' },
];

const ColorModeSelector = ({ colorMode, setColorMode, hueShift = 0, satScale = 1, valScale = 1, customPalette, setCustomPalette }) => {
  const { dark } = useContext(ThemeContext);
  const hasAdj = hueShift !== 0 || satScale !== 1 || valScale !== 1;
  const palette = customPalette || RAINBOW_PALETTE;
  const activePalette = dark ? palette.dark : palette.light;
  const [editingIndex, setEditingIndex] = useState(null);
  const [initialPalette, setInitialPalette] = useState(null);

  const startEditing = (index) => {
    setInitialPalette(palette);
    setEditingIndex(index);
  };

  const handleLiveChange = (index, newColor) => {
    const key = dark ? 'dark' : 'light';
    const next = {
      ...palette,
      [key]: palette[key].map((c, i) => i === index ? newColor : c)
    };
    setCustomPalette(next);
  };

  const handleCancel = () => {
    if (initialPalette) {
      setCustomPalette(initialPalette);
    }
    setEditingIndex(null);
    setInitialPalette(null);
  };

  const handleOk = () => {
    setEditingIndex(null);
    setInitialPalette(null);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-content-secondary">Node Coloring</span>
      <div className="flex flex-col gap-0.5">
        {COLOR_MODES.map(m => (
          <button
            key={m.value}
            onClick={() => setColorMode(m.value)}
            className={`text-left px-2 py-1 rounded-md text-[11px] transition-colors ${
              colorMode === m.value
                ? 'bg-brand/15 text-brand font-semibold'
                : 'text-content-secondary hover:bg-surface-inset/60'
            }`}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>
      {(colorMode === 'generation' || colorMode === 'degree') && (
        <div className="space-y-2">
          <div className="flex h-[18px] overflow-hidden rounded ring-1 ring-brd/40 shadow-sm" title="Click a segment to customize its color">
            {activePalette.map((color, i) => {
              const adjusted = hasAdj ? adjustHsv(color, hueShift, satScale, valScale) : color;
              return (
                <button
                  key={i}
                  className="flex-1 cursor-pointer relative group border-none outline-none transition-transform hover:scale-[1.05] hover:z-10"
                  onClick={() => editingIndex === i ? handleOk() : startEditing(i)}
                >
                  <span className="absolute inset-0" style={{ backgroundColor: adjusted }} />
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {editingIndex === i && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-brand ring-offset-1 ring-offset-surface z-10" />
                  )}
                </button>
              );
            })}
          </div>
          {editingIndex !== null && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <EmbeddedColorPicker
                color={activePalette[editingIndex]}
                onChange={(c) => handleLiveChange(editingIndex, c)}
                onOk={handleOk}
                onCancel={handleCancel}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Collapsible section ── */
const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 w-full pb-1 group"
      >
        {Icon && <Icon className="w-3 h-3 text-content-muted" />}
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-content-muted flex-1 text-left">
          {title}
        </h4>
        <ChevronDown className={`w-3 h-3 text-content-muted transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-2 pt-1">{children}</div>}
    </div>
  );
};

/* ── Main panel ── */

const SettingsPanel = ({
  edgeOpacity, setEdgeOpacity,
  edgeThickness, setEdgeThickness,
  spacingScale, setSpacingScale,
  nodeScale, setNodeScale,
  fontScale, setFontScale,
  nodeAvoidance, setNodeAvoidance,
  showOverlay, toggleOverlay,
  showNodeNames, setShowNodeNames,
  showStructures, setShowStructures,
  curvedEdges, setCurvedEdges,
  isFullscreen, toggleFullscreen,
  handleZoomIn, handleZoomOut, handleReset,
  handleDownloadSVG,
  handleImportSVG,
  brushMode, setBrushMode,
  brushColor, setBrushColor,
  clearEdgeColors,
  importPositionsOnly, setImportPositionsOnly,
  resetSpiral,
  tightenEdges,
  toggleHelp,
  colorMode, setColorMode,
  colorScheme,
  customPalette,
  setCustomPalette,
  hueShift, setHueShift,
  satScale, setSatScale,
  valScale, setValScale,
  bgColor, setBgColor,
  gridColor, setGridColor,
}) => {
  const [open, setOpen] = useState(false);
  const [showBrushPicker, setShowBrushPicker] = useState(false);
  const [initialBrushColor, setInitialBrushColor] = useState(brushColor);

  // ── Resizing logic ──
  const [panelWidth, setPanelWidth] = useState(290);
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const resize = useCallback((e) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 200 && newWidth < 600) setPanelWidth(newWidth);
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
  }, [resize]);

  const startResizing = useCallback((e) => {
    isResizingRef.current = true;
    setIsResizing(true);
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    e.preventDefault();
  }, [resize, stopResizing]);

  return (
    <>
      {/* ── Toggle tab (always visible on right edge) ── */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`absolute z-30 flex items-center justify-center
          w-5 h-14 rounded-l-lg
          bg-surface-overlay/80 backdrop-blur-xl
          border border-r-0 border-brd/50
          shadow-lg text-content-muted hover:text-brand
          ${isResizing ? '' : 'transition-all duration-300 ease-out'}`}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          right: open ? `${panelWidth}px` : '0px',
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
        className={`absolute top-0 right-0 bottom-0 z-30
          bg-surface-overlay/95 backdrop-blur-2xl
          border-l border-brd/50
          shadow-2xl overflow-y-auto overflow-x-hidden
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-brand/30 transition-colors z-40"
        />

        <div className="px-3 py-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand" />
            <h3 className="text-xs font-bold text-content uppercase tracking-wide">
              Settings
            </h3>
          </div>

          {/* ── View Controls ── */}
          <Section title="View" icon={Eye}>
            {/* Zoom buttons — compact row */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomIn}
                className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium
                  text-content-secondary hover:bg-surface-inset/60 border border-brd/40 transition-all"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium
                  text-content-secondary hover:bg-surface-inset/60 border border-brd/40 transition-all"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium
                  text-content-secondary hover:bg-surface-inset/60 border border-brd/40 transition-all"
                title="Fit to view"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Node / Font / Edge thickness — compact steppers, no hard max */}
            <Stepper
              label="Node size"
              value={nodeScale} min={0.1} step={0.25}
              onChange={setNodeScale}
              displayValue={Math.round(nodeScale * 100)} unit="%"
              fromDisplay={v => v / 100}
            />
            <Stepper
              label="Font size"
              value={fontScale} min={0.1} step={0.25}
              onChange={setFontScale}
              displayValue={Math.round(fontScale * 100)} unit="%"
              fromDisplay={v => v / 100}
            />
            <Stepper
              label="Edge width"
              value={edgeThickness} min={0.1} step={0.5}
              onChange={setEdgeThickness}
              displayValue={edgeThickness.toFixed(1)} unit="x"
              fromDisplay={v => v}
            />
          </Section>

          <div className="h-px bg-brd/40" />

          {/* ── Display ── */}
          <Section title="Display" icon={Layers}>
            <Slider
              label="Edge opacity"
              value={edgeOpacity} min={0} max={1} step={0.05}
              onChange={setEdgeOpacity}
              displayValue={Math.round(edgeOpacity * 100)} unit="%"
            />
            <Slider
              label="Graph spread"
              value={spacingScale} min={0.3} max={3} step={0.1}
              onChange={setSpacingScale}
              displayValue={Math.round(spacingScale * 100)} unit="%"
            />
            {/* Toggles — compact 2-column grid */}
            <div className="grid grid-cols-2 gap-1">
              <Toggle label="Overlay" value={showOverlay} onChange={toggleOverlay} icon={Layers} />
              <Toggle label="Names" value={showNodeNames} onChange={setShowNodeNames} icon={Tag} />
              <Toggle label="Structures" value={showStructures} onChange={setShowStructures} icon={Atom} />
              <Toggle label="Curved" value={curvedEdges} onChange={setCurvedEdges} icon={Spline} />
            </div>
            <Toggle label="Node avoidance" value={nodeAvoidance} onChange={setNodeAvoidance} icon={Move} />
          </Section>

          <div className="h-px bg-brd/40" />

          {/* ── Colors ── */}
          <Section title="Colors" icon={Palette} defaultOpen={false}>
            <ColorModeSelector
              colorMode={colorMode}
              setColorMode={setColorMode}
              hueShift={hueShift}
              satScale={satScale}
              valScale={valScale}
              customPalette={customPalette}
              setCustomPalette={setCustomPalette}
            />
            {/* HSV global adjustment sliders */}
            {(colorMode === 'generation' || colorMode === 'degree') && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Color Tuning</span>
                  {(hueShift !== 0 || satScale !== 1 || valScale !== 1) && (
                    <button
                      onClick={() => { setHueShift(0); setSatScale(1); setValScale(1); }}
                      className="text-[9px] text-content-muted hover:text-brand transition-colors"
                      title="Reset to defaults"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <Slider
                  label="Hue shift"
                  value={hueShift} min={-180} max={180} step={5}
                  onChange={setHueShift}
                  displayValue={`${hueShift > 0 ? '+' : ''}${hueShift}`} unit="°"
                />
                <Slider
                  label="Saturation"
                  value={satScale} min={0} max={2} step={0.05}
                  onChange={setSatScale}
                  displayValue={Math.round(satScale * 100)} unit="%"
                />
                <Slider
                  label="Brightness"
                  value={valScale} min={0} max={2} step={0.05}
                  onChange={setValScale}
                  displayValue={Math.round(valScale * 100)} unit="%"
                />
              </div>
            )}
            <ColorInput label="Background" value={bgColor} onChange={setBgColor} defaultColor="rgb(var(--surface-primary))" />
            <ColorInput label="Grid lines" value={gridColor} onChange={setGridColor} defaultColor="rgb(var(--border-primary))" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBrushMode(m => !m)}
                  className={`flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    brushMode
                      ? 'bg-brand/20 text-brand border border-brand/40'
                      : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary border border-brd/40'
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  {brushMode ? 'On' : 'Paint'}
                </button>
                <button
                  onClick={() => {
                    if (!showBrushPicker) {
                      setInitialBrushColor(brushColor);
                    }
                    setShowBrushPicker(!showBrushPicker);
                  }}
                  className={`w-7 h-7 rounded border bg-transparent p-0.5 relative transition-all ${showBrushPicker ? 'ring-2 ring-brand border-brand' : 'border-brd/40'}`}
                  title="Brush color"
                >
                  <div className="absolute inset-0.5 rounded-sm shadow-sm" style={{ backgroundColor: brushColor }} />
                </button>
                <button
                  onClick={clearEdgeColors}
                  className="p-1.5 rounded-md text-content-secondary hover:text-content hover:bg-surface-tertiary border border-brd/40 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {showBrushPicker && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <EmbeddedColorPicker
                    color={brushColor}
                    onChange={(c) => setBrushColor(c)}
                    onOk={() => setShowBrushPicker(false)}
                    onCancel={() => {
                      setBrushColor(initialBrushColor);
                      setShowBrushPicker(false);
                    }}
                  />
                </div>
              )}
            </div>
          </Section>

          <div className="h-px bg-brd/40" />

          {/* ── Edge brush ── */}
          {/* <Section title="Edge Brush" icon={Paintbrush} defaultOpen={false}>
            <p className="text-[10px] text-content-muted leading-relaxed">
              Click a node to paint all its edges, or click near an edge for one.
            </p>
            
          </Section> */}

          <div className="h-px bg-brd/40" />

          {/* ── Actions ── */}
          <Section title="Actions" icon={RotateCcw}>
            {/* Compact action buttons in 2-column grid */}
            <div className="grid grid-cols-2 gap-1">
              <ActionButton label="Reset" onClick={resetSpiral} icon={RotateCcw} />
              <ActionButton label="Tighten" onClick={tightenEdges} icon={Scaling} />
              <ActionButton label="SVG ↓" onClick={handleDownloadSVG} icon={Download} />
              <ActionButton label="SVG ↑" onClick={handleImportSVG} icon={Upload} />
              <ActionButton
                label={isFullscreen ? 'Exit FS' : 'Fullscreen'}
                onClick={toggleFullscreen}
                icon={isFullscreen ? Minimize : Maximize}
              />
              <ActionButton label="Help" onClick={toggleHelp} icon={HelpCircle} />
            </div>
            {/* Import mode toggle */}
            <Toggle
              label="Import positions only"
              value={importPositionsOnly}
              onChange={setImportPositionsOnly}
              icon={Upload}
            />
            <p className="text-[9px] text-content-muted leading-tight px-1 -mt-0.5">
              When on, SVG import uses only node positions, ignoring colors/labels from the file. Use this to import an older layout without overriding the current color scheme.
            </p>
          </Section>
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
