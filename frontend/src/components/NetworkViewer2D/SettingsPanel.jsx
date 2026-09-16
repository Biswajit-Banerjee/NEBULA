import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Settings2, Download, Maximize, Minimize,
  HelpCircle, Layers, RotateCcw, Palette, Scaling, Tag, Atom, Spline,
  Upload, Paintbrush, Trash2, ZoomIn, ZoomOut, Maximize2,
  Move, Eye, Minus, Plus, X, Grid3x3, Magnet, Type, Image,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, PlusCircle,
} from 'lucide-react';
import { RAINBOW_PALETTE, adjustHsv } from './utils/colorSchemes';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';
import EmbeddedColorPicker from './utils/EmbeddedColorPicker';

/* ─────────────────────────────────────────
   Reusable primitives
───────────────────────────────────────── */

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

/* Compact stepper: [−] editable_value [+] */
const Stepper = ({ label, value, min = 0, step, onChange, unit = '', displayValue, fromDisplay }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(+(value + step).toFixed(2));
  const shown = displayValue ?? value;
  const startEdit = () => { setRaw(String(shown)); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const n = parseFloat(raw);
    if (isNaN(n)) return;
    onChange(Math.max(min, fromDisplay ? fromDisplay(n) : n));
  };
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-content-secondary">{label}</span>
      <div className="flex flex-shrink-0 items-center gap-0">
        <button onClick={dec} disabled={value <= min}
          className="flex h-6 w-6 items-center justify-center rounded-l-md border border-brd/50 text-content-secondary transition-colors hover:bg-surface-inset/60 disabled:opacity-30">
          <Minus className="h-3 w-3" />
        </button>
        {editing ? (
          <input autoFocus type="text" value={raw}
            onChange={e => setRaw(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="h-6 w-[52px] border-y border-brd/50 bg-surface-inset/30 px-1 text-center text-[11px] font-semibold tabular-nums text-content outline-none focus:ring-1 focus:ring-brand/50" />
        ) : (
          <button onClick={startEdit} title="Click to type"
            className="flex h-6 min-w-[52px] cursor-text items-center justify-center border-y border-brd/50 bg-surface-inset/30 px-1.5 text-[11px] font-semibold tabular-nums text-content transition-colors hover:bg-surface-inset/50">
            {shown}{unit}
          </button>
        )}
        <button onClick={inc}
          className="flex h-6 w-6 items-center justify-center rounded-r-md border border-brd/50 text-content-secondary transition-colors hover:bg-surface-inset/60">
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

/* Full-width toggle with inline switch */
const Toggle = ({ label, value, onChange, icon: Icon }) => (
  <button onClick={() => onChange(!value)}
    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
      value ? 'bg-brand/10 text-brand' : 'text-content-secondary hover:bg-surface-inset/60'
    }`}>
    {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
    <span className="flex-1 text-left">{label}</span>
    <div className={`relative h-4 w-7 flex-shrink-0 rounded-full transition-colors ${value ? 'bg-brand' : 'bg-brd'}`}>
      <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-content-inverse shadow-sm transition-transform ${value ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </div>
  </button>
);

/* Thin labelled divider for sub-groups within a section */
const SubLabel = ({ label }) => (
  <div className="flex items-center gap-2">
    <div className="h-px flex-1 bg-brd/25" />
    {label && <span className="whitespace-nowrap text-[9px] font-bold uppercase tracking-widest text-content-muted/60">{label}</span>}
    <div className="h-px flex-1 bg-brd/25" />
  </div>
);

/* Compact color input with embedded picker */
const ColorInput = ({ label, value, onChange, defaultColor }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [initial, setInitial] = useState(null);
  const open = () => { setInitial(value || ''); setShowPicker(true); };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-content-secondary">{label}</span>
        <div className="flex items-center gap-1.5">
          {value && (
            <button onClick={() => onChange('')} title="Reset"
              className="text-[9px] text-content-muted transition-colors hover:text-err">✕</button>
          )}
          <button
            onClick={() => showPicker ? setShowPicker(false) : open()}
            className={`relative h-6 w-6 overflow-hidden rounded-md border shadow-sm transition-all hover:shadow-md ${
              showPicker ? 'border-brand ring-2 ring-brand' : 'border-brd/60'
            }`}>
            <div className="absolute inset-0" style={{ backgroundColor: value || defaultColor }} />
          </button>
        </div>
      </div>
      {showPicker && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <EmbeddedColorPicker color={value || defaultColor} onChange={onChange}
            onOk={() => setShowPicker(false)}
            onCancel={() => { onChange(initial); setShowPicker(false); }} />
        </div>
      )}
    </div>
  );
};

/* Color mode pill-tab selector + palette editor */
const ColorModeSelector = ({ colorMode, setColorMode, hueShift, satScale, valScale, customPalette, setCustomPalette }) => {
  const { dark } = useContext(ThemeContext);
  const hasAdj = hueShift !== 0 || satScale !== 1 || valScale !== 1;
  const palette = customPalette || RAINBOW_PALETTE;
  const activePalette = dark ? palette.dark : palette.light;
  const [editingIndex, setEditingIndex] = useState(null);
  const [initialPalette, setInitialPalette] = useState(null);

  const startEditing = (i) => { setInitialPalette(palette); setEditingIndex(i); };
  const handleLiveChange = (i, c) => {
    const key = dark ? 'dark' : 'light';
    setCustomPalette({ ...palette, [key]: palette[key].map((x, idx) => idx === i ? c : x) });
  };
  const handleOk = () => { setEditingIndex(null); setInitialPalette(null); };
  const handleCancel = () => { if (initialPalette) setCustomPalette(initialPalette); setEditingIndex(null); setInitialPalette(null); };

  return (
    <div className="space-y-2">
      {/* Pill tabs */}
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-brd/50 text-[11px]">
        {[{ v: 'generation', l: 'Generation' }, { v: 'type', l: 'Node Type' }, { v: 'degree', l: 'Degree' }].map(({ v, l }) => (
          <button key={v} onClick={() => setColorMode(v)} title={l}
            className={`border-l border-brd/50 py-1.5 text-[10px] font-semibold transition-colors first:border-l-0 ${
              colorMode === v ? 'bg-brand text-white' : 'text-content-secondary hover:bg-surface-inset'
            }`}>
            {v === 'generation' ? 'Gen' : v === 'type' ? 'Type' : 'Degree'}
          </button>
        ))}
      </div>

      {/* Palette bar (generation / degree only) */}
      {(colorMode === 'generation' || colorMode === 'degree') && (
        <div className="space-y-1.5">
          <p className="text-[9px] text-content-muted">Click a segment to customise</p>
          <div className="flex h-5 overflow-hidden rounded-lg shadow-sm ring-1 ring-brd/40">
            {activePalette.map((color, i) => {
              const adj = hasAdj ? adjustHsv(color, hueShift, satScale, valScale) : color;
              return (
                <button key={i}
                  className="group relative flex-1 border-none outline-none transition-transform hover:z-10 hover:scale-y-110"
                  onClick={() => editingIndex === i ? handleOk() : startEditing(i)}>
                  <span className="absolute inset-0" style={{ backgroundColor: adj }} />
                  <div className="absolute inset-0 bg-white/25 opacity-0 transition-opacity group-hover:opacity-100" />
                  {editingIndex === i && <div className="absolute inset-0 z-10 ring-2 ring-inset ring-brand" />}
                </button>
              );
            })}
          </div>
          {editingIndex !== null && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <EmbeddedColorPicker color={activePalette[editingIndex]}
                onChange={(c) => handleLiveChange(editingIndex, c)}
                onOk={handleOk} onCancel={handleCancel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* Collapsible section */
const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-1.5 pb-1.5 group">
        {Icon && <Icon className="h-3 w-3 text-content-muted" />}
        <h4 className="flex-1 text-left text-[10px] font-bold uppercase tracking-widest text-content-muted">
          {title}
        </h4>
        <ChevronDown className={`h-3 w-3 text-content-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="space-y-2 pt-0.5">{children}</div>}
    </div>
  );
};

/* ─────────────────────────────────────────
   Main SettingsPanel
───────────────────────────────────────── */

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
  handleDownloadSVG, handleDownloadPNG, handleImportSVG,
  brushMode, setBrushMode,
  brushColor, setBrushColor,
  clearEdgeColors,
  importPositionsOnly, setImportPositionsOnly,
  resetSpiral,
  tightenEdges,
  toggleHelp,
  colorMode, setColorMode,
  colorScheme,
  customPalette, setCustomPalette,
  hueShift, setHueShift,
  satScale, setSatScale,
  valScale, setValScale,
  bgColor, setBgColor,
  gridColor, setGridColor,
  textMode, setTextMode,
  showGrid, setShowGrid,
  gridSize, setGridSize,
  snapToGrid, setSnapToGrid,
  nodeOpacity, setNodeOpacity,
  showNodeLabels, setShowNodeLabels,
  selectedText,
  onUpdateText, onPreviewText, onSaveText, onCancelText, onDeleteText, onAddText,
}) => {
  const [open, setOpen] = useState(false);

  /* Text editor draft — resets when a new element is selected (id changes) */
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    setDraft(selectedText ? { ...selectedText } : null);
  }, [selectedText?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = useCallback((patch) => {
    if (!draft) return;
    onPreviewText?.(draft.id, patch);
    setDraft(prev => prev ? { ...prev, ...patch } : null);
  }, [draft, onPreviewText]);

  /* Brush color picker state */
  const [showBrushPicker, setShowBrushPicker] = useState(false);
  const [initialBrushColor, setInitialBrushColor] = useState(brushColor);

  /* Panel resize */
  const [panelWidth, setPanelWidth] = useState(300);
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  const resize = useCallback((e) => {
    if (!isResizingRef.current) return;
    const w = window.innerWidth - e.clientX;
    if (w > 220 && w < 640) setPanelWidth(w);
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

  const hasColorAdj = hueShift !== 0 || satScale !== 1 || valScale !== 1;

  return (
    <>
      {/* ── Toggle tab (always visible on the right edge) ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`absolute z-30 flex h-14 w-5 items-center justify-center rounded-l-lg
          border border-r-0 border-brd/50 bg-surface-overlay/80 backdrop-blur-xl
          text-content-muted shadow-lg hover:text-brand
          ${isResizing ? '' : 'transition-all duration-300 ease-out'}`}
        style={{ top: '50%', transform: 'translateY(-50%)', right: open ? `${panelWidth}px` : '0px' }}
        title="Settings">
        {open ? <ChevronRight className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
      </button>

      {/* ── Slide-out panel ── */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-30 overflow-x-hidden overflow-y-auto
          border-l border-brd/50 bg-surface-overlay/95 shadow-2xl backdrop-blur-2xl
          ${isResizing ? '' : 'transition-transform duration-300 ease-out'}
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: `${panelWidth}px` }}>

        {/* Resize handle */}
        <div onMouseDown={startResizing}
          className="absolute bottom-0 left-0 top-0 z-40 w-1 cursor-ew-resize transition-colors hover:bg-brand/30" />

        <div className="space-y-4 px-3 py-3">

          {/* ── Header + Quick Actions ── */}
          <div className="flex items-center gap-2 border-b border-brd/30 pb-3">
            <Settings2 className="h-3.5 w-3.5 flex-shrink-0 text-brand" />
            <h3 className="flex-1 text-[11px] font-bold uppercase tracking-widest text-content">
              Settings
            </h3>
            <div className="flex items-center gap-0.5">
              {[
                { Icon: ZoomIn,                     fn: handleZoomIn,     tip: 'Zoom in' },
                { Icon: ZoomOut,                    fn: handleZoomOut,    tip: 'Zoom out' },
                { Icon: Maximize2,                  fn: handleReset,      tip: 'Fit to view' },
                { Icon: isFullscreen ? Minimize : Maximize, fn: toggleFullscreen, tip: isFullscreen ? 'Exit fullscreen' : 'Fullscreen' },
                { Icon: HelpCircle,                 fn: toggleHelp,       tip: 'Help & shortcuts' },
              ].map(({ Icon, fn, tip }) => (
                <button key={tip} onClick={fn} title={tip}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-content-muted transition-all hover:bg-surface-inset hover:text-brand">
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════
              Section 1 · Graph
          ════════════════════════════════ */}
          <Section title="Graph" icon={Atom}>

            {/* Layout */}
            <Slider label="Graph spread"
              value={spacingScale} min={0.3} max={3} step={0.1} onChange={setSpacingScale}
              displayValue={Math.round(spacingScale * 100)} unit="%" />

            <SubLabel label="Nodes" />
            <Stepper label="Node size"
              value={nodeScale} min={0.1} step={0.25} onChange={setNodeScale}
              displayValue={Math.round(nodeScale * 100)} unit="%" fromDisplay={v => v / 100} />
            <Stepper label="Font scale"
              value={fontScale} min={0.1} step={0.25} onChange={setFontScale}
              displayValue={Math.round(fontScale * 100)} unit="%" fromDisplay={v => v / 100} />
            <Slider label="Node opacity"
              value={nodeOpacity} min={0} max={1} step={0.05} onChange={setNodeOpacity}
              displayValue={Math.round(nodeOpacity * 100)} unit="%" />

            <SubLabel label="Edges" />
            <Stepper label="Edge width"
              value={edgeThickness} min={0.1} step={0.5} onChange={setEdgeThickness}
              displayValue={edgeThickness.toFixed(1)} unit="×" fromDisplay={v => v} />
            <Slider label="Edge opacity"
              value={edgeOpacity} min={0} max={1} step={0.05} onChange={setEdgeOpacity}
              displayValue={Math.round(edgeOpacity * 100)} unit="%" />

            <SubLabel />

            <div className="grid grid-cols-2 gap-1">
              <Toggle label="Overlay"     value={showOverlay}    onChange={toggleOverlay}          icon={Layers} />
              <Toggle label="Structures"  value={showStructures}  onChange={setShowStructures}       icon={Atom} />
              <Toggle label="Curved"      value={curvedEdges}     onChange={setCurvedEdges}          icon={Spline} />
              <Toggle label="Avoid overlap" value={nodeAvoidance} onChange={setNodeAvoidance}       icon={Move} />
            </div>
          </Section>

          {/* ════════════════════════════════
              Section 2 · Colors
          ════════════════════════════════ */}
          <Section title="Colors" icon={Palette} defaultOpen={false}>

            {/* Mode selector (pill tabs) + Palette editor */}
            <ColorModeSelector
              colorMode={colorMode} setColorMode={setColorMode}
              hueShift={hueShift} satScale={satScale} valScale={valScale}
              customPalette={customPalette} setCustomPalette={setCustomPalette} />

            {/* HSV tuning (gen / degree only) */}
            {(colorMode === 'generation' || colorMode === 'degree') && (
              <div className="space-y-1.5 rounded-lg bg-surface-inset/40 px-2.5 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Colour tuning</span>
                  {hasColorAdj && (
                    <button onClick={() => { setHueShift(0); setSatScale(1); setValScale(1); }}
                      className="text-[9px] text-content-muted transition-colors hover:text-brand">
                      Reset
                    </button>
                  )}
                </div>
                <Slider label="Hue shift"
                  value={hueShift} min={-180} max={180} step={5} onChange={setHueShift}
                  displayValue={`${hueShift > 0 ? '+' : ''}${hueShift}`} unit="°" />
                <Slider label="Saturation"
                  value={satScale} min={0} max={2} step={0.05} onChange={setSatScale}
                  displayValue={Math.round(satScale * 100)} unit="%" />
                <Slider label="Brightness"
                  value={valScale} min={0} max={2} step={0.05} onChange={setValScale}
                  displayValue={Math.round(valScale * 100)} unit="%" />
              </div>
            )}

            <SubLabel label="Edge paint" />

            {/* Brush controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setBrushMode(m => !m)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-medium transition-all ${
                  brushMode
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-brd/50 text-content-secondary hover:bg-surface-inset'
                }`}>
                <Paintbrush className="h-3.5 w-3.5" />
                {brushMode ? 'Painting…' : 'Paint edges'}
              </button>
              <button
                onClick={() => { if (!showBrushPicker) setInitialBrushColor(brushColor); setShowBrushPicker(v => !v); }}
                className={`relative h-8 w-8 overflow-hidden rounded-lg border shadow-sm transition-all ${
                  showBrushPicker ? 'border-brand ring-2 ring-brand' : 'border-brd/50'
                }`}
                title="Brush colour">
                <div className="absolute inset-0" style={{ backgroundColor: brushColor }} />
              </button>
              <button onClick={clearEdgeColors}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-brd/50 text-content-muted transition-all hover:border-err/40 hover:bg-err/10 hover:text-err"
                title="Clear all edge colours">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {showBrushPicker && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <EmbeddedColorPicker color={brushColor} onChange={setBrushColor}
                  onOk={() => setShowBrushPicker(false)}
                  onCancel={() => { setBrushColor(initialBrushColor); setShowBrushPicker(false); }} />
              </div>
            )}
          </Section>

          {/* ════════════════════════════════
              Section 3 · Canvas
          ════════════════════════════════ */}
          <Section title="Canvas" icon={Grid3x3} defaultOpen={false}>
            {/* Grid + Snap pill toggles */}
            <div className="flex gap-1.5">
              {[
                { label: 'Grid', value: showGrid, onChange: setShowGrid, Icon: Grid3x3 },
                { label: 'Snap to grid', value: snapToGrid, onChange: setSnapToGrid, Icon: Magnet },
              ].map(({ label, value, onChange, Icon }) => (
                <button key={label} onClick={() => onChange(v => !v)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-medium transition-all ${
                    value
                      ? 'border-brand/30 bg-brand/10 text-brand'
                      : 'border-brd/50 text-content-secondary hover:bg-surface-inset'
                  }`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <Stepper label="Grid size"
              value={gridSize} min={16} step={8} onChange={setGridSize}
              displayValue={gridSize} unit="px" />
            <ColorInput label="Grid lines"  value={gridColor} onChange={setGridColor} defaultColor="rgb(var(--border-primary))" />
            <ColorInput label="Background"  value={bgColor}   onChange={setBgColor}   defaultColor="rgb(var(--surface-primary))" />
          </Section>

          {/* ════════════════════════════════
              Section 4 · Text
          ════════════════════════════════ */}
          <Section title="Text" icon={Type}>

            {/* Mode toggle + Add button */}
            <div className="flex gap-1.5">
              <button
                onClick={() => { const next = !textMode; setTextMode(next); if (next) setBrushMode(false); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  textMode
                    ? 'bg-brand text-white shadow-sm shadow-brand/20'
                    : 'border border-brd/50 text-content-secondary hover:bg-surface-inset hover:text-content'
                }`}>
                <Type className="h-3.5 w-3.5" />
                Text mode
              </button>
              <button
                onClick={() => { setBrushMode(false); setTextMode(true); onAddText?.(); }}
                className="flex items-center gap-1 rounded-lg border border-brd/50 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-all hover:bg-surface-inset hover:text-content"
                title="Place a new free text box at the centre of the view">
                <PlusCircle className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {/* Visibility toggles */}
            <div className="grid grid-cols-2 gap-1">
              <Toggle label="Labels"    value={showNodeLabels} onChange={setShowNodeLabels} icon={Tag} />
              <Toggle label="Subtitles" value={showNodeNames}  onChange={setShowNodeNames}  icon={Type} />
            </div>

            {/* ── Inline editor (only when text is selected) ── */}
            {draft ? (
              <>
                <SubLabel />

                {/* Kind badge + anchor pill */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                    {draft.kind === 'node-label' ? 'Node label' : draft.kind === 'node-subtitle' ? 'Node subtitle' : 'Text box'}
                  </span>
                  {draft.anchor && (
                    <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[9px] font-medium text-content-muted">
                      anchored
                    </span>
                  )}
                </div>

                {/* Content — textarea mirrors selected text alignment */}
                <textarea
                  value={draft.content ?? ''}
                  onChange={e => updateDraft({ content: e.target.value })}
                  rows={Math.max(2, Math.min(5, (draft.content ?? '').split('\n').length))}
                  style={{ textAlign: draft.textAlign || 'left' }}
                  className="w-full resize-none rounded-lg border border-brd/50 bg-surface-secondary px-2.5 py-1.5 text-[11px] leading-relaxed text-content outline-none transition-colors placeholder:text-content-muted focus:border-brand focus:ring-1 focus:ring-brand/20"
                  placeholder="Text content…" />

                {/* Font family (full width) */}
                <select
                  value={draft.fontFamily ?? 'Inter, Arial, sans-serif'}
                  onChange={e => updateDraft({ fontFamily: e.target.value })}
                  className="w-full rounded-lg border border-brd/50 bg-surface-secondary px-2.5 py-1.5 text-[11px] text-content outline-none transition-colors focus:border-brand">
                  <option value="Inter, Arial, sans-serif">Inter</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Courier New, monospace">Courier New</option>
                </select>

                {/* Font size stepper (full width) */}
                <Stepper
                  label="Font size"
                  value={draft.fontSize ?? 12} min={4} step={1}
                  onChange={fs => updateDraft({ fontSize: fs })}
                  displayValue={draft.fontSize ?? 12} unit="px" />

                {/* Style (B I U) ‖ Alignment (L C R) — visually separated */}
                <div className="flex gap-1">
                  {/* Style group */}
                  <div className="flex flex-1 gap-0.5">
                    {[
                      { key: 'bold',    Icon: Bold,      active: draft.fontWeight === '700' || draft.fontWeight === 'bold', patch: { fontWeight: (draft.fontWeight === '700' || draft.fontWeight === 'bold') ? '400' : '700' }, title: 'Bold (B)' },
                      { key: 'italic',  Icon: Italic,    active: draft.fontStyle === 'italic',  patch: { fontStyle: draft.fontStyle === 'italic' ? 'normal' : 'italic' }, title: 'Italic (I)' },
                      { key: 'under',   Icon: Underline, active: !!draft.underline,             patch: { underline: !draft.underline },                                   title: 'Underline (U)' },
                    ].map(({ key, Icon, active, patch, title }) => (
                      <button key={key} onClick={() => updateDraft(patch)} title={title}
                        className={`flex flex-1 h-7 items-center justify-center rounded-md border text-[11px] transition-colors ${
                          active ? 'border-brand/50 bg-brand/10 text-brand' : 'border-brd/40 text-content-secondary hover:bg-surface-inset hover:text-content'
                        }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>

                  {/* Separator */}
                  <div className="my-1 w-px bg-brd/35" />

                  {/* Alignment group */}
                  <div className="flex flex-1 gap-0.5">
                    {[
                      { key: 'left',   Icon: AlignLeft,   active: draft.textAlign === 'left',   patch: { textAlign: 'left' },   title: 'Align left' },
                      { key: 'center', Icon: AlignCenter, active: draft.textAlign === 'center', patch: { textAlign: 'center' }, title: 'Align centre' },
                      { key: 'right',  Icon: AlignRight,  active: draft.textAlign === 'right',  patch: { textAlign: 'right' },  title: 'Align right' },
                    ].map(({ key, Icon, active, patch, title }) => (
                      <button key={key} onClick={() => updateDraft(patch)} title={title}
                        className={`flex flex-1 h-7 items-center justify-center rounded-md border text-[11px] transition-colors ${
                          active ? 'border-brand/50 bg-brand/10 text-brand' : 'border-brd/40 text-content-secondary hover:bg-surface-inset hover:text-content'
                        }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color + Opacity */}
                <ColorInput label="Colour"
                  value={draft.fill ?? ''} onChange={fill => updateDraft({ fill: fill || null })}
                  defaultColor="#374151" />
                <Slider label="Opacity"
                  value={draft.opacity ?? 1} min={0.1} max={1} step={0.05}
                  onChange={opacity => updateDraft({ opacity })}
                  displayValue={Math.round((draft.opacity ?? 1) * 100)} unit="%" />

                {/* Save · Cancel · Delete */}
                <div className="flex gap-1 border-t border-brd/30 pt-2">
                  <button onClick={() => onSaveText?.(draft.id)}
                    className="flex-1 rounded-lg bg-brand py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.97]">
                    Save
                  </button>
                  <button onClick={() => onCancelText?.(draft.id)}
                    className="flex-1 rounded-lg border border-brd/50 py-1.5 text-[11px] font-medium text-content-secondary transition-all hover:bg-surface-inset hover:text-content">
                    Cancel
                  </button>
                  <button onClick={() => onDeleteText?.(draft.id)}
                    className="flex items-center justify-center rounded-lg border border-err/30 px-2.5 py-1.5 text-err transition-all hover:bg-err/10"
                    title="Delete text">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <p className="py-1.5 text-center text-[10px] italic text-content-muted">
                {textMode
                  ? 'Click any label or text box to select it.'
                  : 'Enable text mode to select and edit text.'}
              </p>
            )}
          </Section>

          {/* ════════════════════════════════
              Section 5 · Export & Import
          ════════════════════════════════ */}
          <Section title="Export & Import" icon={Download} defaultOpen={false}>

            {/* File actions */}
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'SVG', Icon: Download, fn: handleDownloadSVG, tip: 'Export SVG' },
                { label: 'PNG', Icon: Image,    fn: handleDownloadPNG, tip: 'Export PNG' },
                { label: 'Import',  Icon: Upload,    fn: handleImportSVG,  tip: 'Import SVG layout' },
              ].map(({ label, Icon, fn, tip }) => (
                <button key={label} onClick={fn} title={tip}
                  className="flex flex-col items-center gap-1 rounded-lg border border-brd/50 py-2 text-[10px] font-medium text-content-secondary transition-all hover:bg-surface-inset hover:text-content">
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <Toggle label="Import positions only" value={importPositionsOnly} onChange={setImportPositionsOnly} icon={Upload} />
            <p className="px-1 text-[9px] leading-tight text-content-muted">
              When on, SVG import uses only node positions — ignoring colours and labels.
            </p>

            <SubLabel label="Layout" />

            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Reset layout', Icon: RotateCcw, fn: resetSpiral },
                { label: 'Tighten',      Icon: Scaling,   fn: tightenEdges },
              ].map(({ label, Icon, fn }) => (
                <button key={label} onClick={fn}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-brd/50 py-1.5 text-[11px] font-medium text-content-secondary transition-all hover:bg-surface-inset hover:text-content">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
