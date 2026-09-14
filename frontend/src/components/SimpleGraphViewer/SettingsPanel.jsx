import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ChevronRight, Settings2, Download, Image, Maximize, Minimize,
  HelpCircle, Layers, RotateCcw, Palette, Scaling,
  Spline, GitCommitHorizontal, Hexagon, Map, Tag, Globe2, Network, Signpost,
  Search, SearchX,
} from 'lucide-react';
import { RAINBOW_PALETTE } from '../NetworkViewer2D/utils/colorSchemes';
import AutocompleteInput from '../SearchPanel/AutocompleteInput';
import EmbeddedColorPicker from '../NetworkViewer2D/utils/EmbeddedColorPicker';
import compoundDataJson from '../SearchPanel/compound_map.json';

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
            <div className="absolute inset-0" style={{ backgroundColor: value || defaultColor }} />
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

const SchemePicker = () => (
  <div className="space-y-1">
    <span className="text-[11px] font-medium text-content-secondary">Color Scheme</span>
    <div className="flex h-[18px] overflow-hidden rounded ring-1 ring-brd/40" title="Rainbow by generation">
      {RAINBOW_PALETTE.light.map((color) => (
        <span key={color} className="flex-1" style={{ backgroundColor: color }} />
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

const EDGE_MODES = [
  { id: 'all', label: 'All' },
  { id: 'pruned', label: 'Pruned' },
  { id: 'none', label: 'None' },
];

/* ── Edges: All / Pruned / None — a single tri-state control replacing the
   old separate "Prune edges" + "Hide edges" toggles. Derived from the two
   underlying booleans (pruneEdges affects the graph DATA, hideEdges just
   skips drawing) so nothing about the actual rendering pipeline changes. */
const EdgeModeSelector = ({ value, onChange }) => (
  <div>
    <span className="text-[11px] font-medium text-content-secondary mb-1.5 block">Edges</span>
    <div className="flex rounded-lg overflow-hidden border border-brd/60">
      {EDGE_MODES.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center px-2 py-1.5 text-[10px] font-semibold transition-all ${
            value === id
              ? 'bg-brand/15 text-brand'
              : 'text-content-muted hover:text-content-secondary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
);

/* ── Mode tabs: "KEGG Layout" vs "Custom" — this directly drives the
   `keggLayout` boolean, since that's the actual render-mode switch in
   GraphCanvas. Selecting a tab IS switching the mode, not just a view filter. */
const MODE_TABS = [
  { id: 'kegg', label: 'KEGG Layout', icon: Map },
  { id: 'custom', label: 'Custom', icon: Hexagon },
];

const ModeTabs = ({ value, onChange }) => (
  <div className="flex rounded-lg overflow-hidden border border-brd/60 bg-surface-inset/40 p-0.5">
    {MODE_TABS.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
          value === id
            ? 'bg-brand text-content-inverse shadow-sm'
            : 'text-content-secondary hover:bg-surface-inset/60'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    ))}
  </div>
);

const SettingsPanel = ({
  edgeOpacity, setEdgeOpacity,
  spacingScale, setSpacingScale,
  nodeSizeScale, setNodeSizeScale,
  showOverlay, toggleOverlay,
  isFullscreen, toggleFullscreen,
  handleDownloadSVG,
  handleDownloadPNG,
  resetLayout,
  tightenEdges,
  toggleHelp,
  colorMode,
  colorScheme,
  bgColor, setBgColor,
  gridColor, setGridColor,
  edgeStyle, setEdgeStyle,
  pruneEdges, setPruneEdges,
  nodeDisplay, setNodeDisplay,
  showNames, setShowNames,
  keggLayout, setKeggLayout,
  showAllKegg, setShowAllKegg,
  showKeggLines, setShowKeggLines,
  hideEdges, setHideEdges,
  showPathways, setShowPathways,
  keggBgOpacity, setKeggBgOpacity,
  onSelectCompound,
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchStatus, setSearchStatus] = useState(null); // null | 'found' | 'not-found'

  // ── Resizing logic ──
  const [panelWidth, setPanelWidth] = useState(260);
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

  const handleSearchSelect = (id) => {
    setSearchValue(id);
    if (!id) { setSearchStatus(null); return; }
    const found = onSelectCompound ? onSelectCompound(id) : false;
    setSearchStatus(found ? 'found' : 'not-found');
  };

  return (
    <>
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

        <div className="px-4 py-4 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-brand" />
            <h3 className="text-xs font-bold text-content uppercase tracking-wide">
              Map Settings
            </h3>
          </div>

          {/* Locate compound */}
          <div className="space-y-2">
            <SectionTitle>
              <span className="flex items-center gap-1.5"><Search className="w-3 h-3" /> Find Compound</span>
            </SectionTitle>
            <AutocompleteInput
              value={searchValue}
              onValueSelect={handleSearchSelect}
              placeholder="Search compound name or ID..."
              compoundData={compoundDataJson}
              idPrefix="settings-compound-search"
              className="w-full px-2.5 py-1.5 bg-input-bg/70 border border-brd/70 rounded-lg text-content placeholder-content-muted focus:ring-2 focus:ring-brand/20 focus:border-brand-hover transition-shadow text-[11px]"
            />
            {searchStatus === 'not-found' && (
              <div className="flex items-center gap-1.5 text-[10px] text-err">
                <SearchX className="w-3 h-3 flex-shrink-0" />
                Not present in current map
              </div>
            )}
          </div>

          <div className="h-px bg-brd/60" />

          {/* Common display controls — apply no matter which layout mode is active */}
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
            <Slider
              label="Node & font size"
              value={nodeSizeScale} min={0.5} max={4} step={0.1}
              onChange={setNodeSizeScale}
              displayValue={Math.round(nodeSizeScale * 100)} unit="%"
            />
            <Toggle label="Path overlay" value={showOverlay} onChange={toggleOverlay} icon={Layers} />
            <EdgeModeSelector
              value={hideEdges ? 'none' : (pruneEdges ? 'pruned' : 'all')}
              onChange={(id) => {
                if (id === 'none') { setHideEdges(true); return; }
                setHideEdges(false);
                setPruneEdges(id === 'pruned');
              }}
            />
            <LayoutSelector value={edgeStyle} onChange={setEdgeStyle} />
            <Toggle label="Structures" value={nodeDisplay === 'structure'} onChange={(v) => setNodeDisplay(v ? 'structure' : 'circle')} icon={Hexagon} />
            <Toggle label="Compound names" value={showNames} onChange={setShowNames} icon={Tag} />
          </div>

          <div className="h-px bg-brd/60" />

          {/* Layout mode — tabs directly switch `keggLayout` */}
          <div className="space-y-3">
            <SectionTitle>Layout Mode</SectionTitle>
            <ModeTabs
              value={keggLayout ? 'kegg' : 'custom'}
              onChange={(id) => setKeggLayout(id === 'kegg')}
            />

            {keggLayout && (
              <div className="space-y-3 pt-1">
                <Toggle label="Show all map compounds" value={showAllKegg} onChange={setShowAllKegg} icon={Globe2} />
                <Toggle label="Show map lines" value={showKeggLines} onChange={setShowKeggLines} icon={Network} />
                <Toggle label="Pathway regions" value={showPathways} onChange={setShowPathways} icon={Signpost} />
                {(showAllKegg || showKeggLines) && (
                  <Slider
                    label="Map lines opacity"
                    value={keggBgOpacity} min={0.05} max={1} step={0.05}
                    onChange={setKeggBgOpacity}
                    displayValue={Math.round(keggBgOpacity * 100)} unit="%"
                  />
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-brd/60" />

          {/* Colors */}
          <div className="space-y-3">
            <SectionTitle>
              <span className="flex items-center gap-1.5"><Palette className="w-3 h-3" /> Colors</span>
            </SectionTitle>
            <SchemePicker />
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
