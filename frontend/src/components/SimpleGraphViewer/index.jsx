import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Search, X, Loader2, Atom } from 'lucide-react';
import GraphCanvas from "./GraphCanvas";
import SettingsPanel from "./SettingsPanel";
import useFullscreen from "../NetworkViewer2D/hooks/useFullscreen";
import HelpOverlay from "../NetworkViewer2D/HelpOverlay";

const SimpleGraphViewer = forwardRef(({ results, searchPairs = [], height = "600px" }, ref) => {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphCanvasRef = useRef(null);

  const [showHelp, setShowHelp] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // User customization
  const [edgeOpacity, setEdgeOpacity] = useState(0.5);
  const [spacingScale, setSpacingScale] = useState(1.0);

  // Color settings
  const [colorMode, setColorMode] = useState('generation');
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [bgColor, setBgColor] = useState('');
  const [gridColor, setGridColor] = useState('');
  const [edgeStyle, setEdgeStyle] = useState('orthogonal');
  const [pruneEdges, setPruneEdges] = useState(true);
  const [nodeDisplay, setNodeDisplay] = useState('circle');
  const [keggLayout, setKeggLayout] = useState(false);
  const [keggOrthoEdges, setKeggOrthoEdges] = useState(false);

  const safeResults = Array.isArray(results) ? results : [];

  // Backbone (substructure) search
  const [backboneQuery, setBackboneQuery] = useState('');
  const [backboneMatchIds, setBackboneMatchIds] = useState(null); // null = no search active, Set = active
  const [backboneLoading, setBackboneLoading] = useState(false);
  const [backboneError, setBackboneError] = useState('');
  const [backboneCount, setBackboneCount] = useState(0);
  const [showBackboneBar, setShowBackboneBar] = useState(false);

  const runBackboneSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setBackboneMatchIds(null);
      setBackboneError('');
      setBackboneCount(0);
      return;
    }
    const compoundIds = safeResults
      .map(r => {
        const ids = [];
        if (r.compound_generation) Object.keys(r.compound_generation).forEach(c => ids.push(c));
        return ids;
      })
      .flat()
      .filter((c, i, a) => /^C\d{5}$/.test(c) && a.indexOf(c) === i);

    if (compoundIds.length === 0) {
      setBackboneError('No compounds in current view');
      return;
    }

    setBackboneLoading(true);
    setBackboneError('');
    try {
      const resp = await fetch('/api/substructure-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smarts: query.trim(), compound_ids: compoundIds }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setBackboneError(err.detail || 'Search failed');
        setBackboneMatchIds(null);
        setBackboneCount(0);
      } else {
        const data = await resp.json();
        setBackboneMatchIds(new Set(data.matches || []));
        setBackboneCount(data.total || 0);
        setBackboneError('');
        console.log(`[NEBULA] Backbone search "${query}": ${data.total} matches`);
      }
    } catch (e) {
      setBackboneError('Network error');
      setBackboneMatchIds(null);
      setBackboneCount(0);
    } finally {
      setBackboneLoading(false);
    }
  }, [safeResults]);

  const clearBackboneSearch = useCallback(() => {
    setBackboneQuery('');
    setBackboneMatchIds(null);
    setBackboneError('');
    setBackboneCount(0);
  }, []);

  const { isFullscreen, toggleFullscreen } = useFullscreen(wrapperRef);

  const handleZoomIn = () => graphCanvasRef.current?.zoomIn();
  const handleZoomOut = () => graphCanvasRef.current?.zoomOut();
  const handleReset = () => graphCanvasRef.current?.resetView();
  const handleDownloadSVG = () => graphCanvasRef.current?.downloadSVG();
  const resetLayout = () => graphCanvasRef.current?.resetLayout();
  const tightenEdges = () => graphCanvasRef.current?.tightenEdges();

  // Clear backbone search when results change
  useEffect(() => { clearBackboneSearch(); }, [results]);

  // Map pair index to rgba color string
  const pairColorMap = React.useMemo(() => {
    const map = {};
    searchPairs.forEach((p, idx) => {
      const hex = p.color || '#94a3b8';
      const alpha = p.alpha !== undefined ? p.alpha : 1;
      const aHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
      map[idx] = `${hex}${aHex}`;
    });
    return map;
  }, [searchPairs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      // Don't intercept browser shortcuts (Ctrl+F, Cmd+F, etc.)
      if (e.ctrlKey || e.metaKey) return;
      
      switch (e.key) {
        case '+': case '=': handleZoomIn(); break;
        case '-': case '_': handleZoomOut(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'h': case 'H': setShowHelp(prev => !prev); break;
        case 'r': case 'R': resetLayout(); break;
        case '0': handleReset(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen]);

  // Expose imperative handlers
  useImperativeHandle(ref, () => ({
    getNodePositions: () => graphCanvasRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => graphCanvasRef.current?.setNodePositions?.(positions),
  }));

  const toggleOverlay = () => setShowOverlay(prev => !prev);

  return (
    <div className="relative rounded-xl border border-gray-200/40 dark:border-slate-700/40 shadow-sm bg-white dark:bg-slate-800 overflow-hidden" ref={containerRef}>
      <div
        ref={wrapperRef}
        className={`relative flex flex-col bg-neutral-50 dark:bg-slate-900 transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

        {/* ── Backbone SMILES search bar ── */}
        <div className={`absolute top-3 left-3 z-40 transition-all duration-200 ${
          showBackboneBar ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl
            rounded-xl border border-slate-200/60 dark:border-slate-600/30 shadow-lg px-3 py-1.5">
            <Atom className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <input
              type="text"
              value={backboneQuery}
              onChange={e => setBackboneQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runBackboneSearch(backboneQuery); if (e.key === 'Escape') { clearBackboneSearch(); setShowBackboneBar(false); } }}
              placeholder="SMILES backbone e.g. C(=O)O"
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400
                dark:placeholder-slate-500 outline-none w-48 font-mono"
            />
            {backboneLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin flex-shrink-0" />
            ) : (
              <button
                onClick={() => runBackboneSearch(backboneQuery)}
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Search backbone"
              >
                <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </button>
            )}
            {backboneMatchIds !== null && (
              <button
                onClick={clearBackboneSearch}
                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
              </button>
            )}
          </div>
          {backboneError && (
            <div className="mt-1 px-3 py-1 text-[10px] text-red-500 dark:text-red-400 bg-red-50/80
              dark:bg-red-900/20 rounded-lg border border-red-200/40 dark:border-red-800/30">
              {backboneError}
            </div>
          )}
          {backboneMatchIds !== null && !backboneError && (
            <div className="mt-1 px-3 py-1 text-[10px] text-violet-600 dark:text-violet-300
              bg-violet-50/80 dark:bg-violet-900/20 rounded-lg border border-violet-200/40 dark:border-violet-800/30">
              {backboneCount} molecule{backboneCount !== 1 ? 's' : ''} matched
            </div>
          )}
        </div>

        {/* Toggle button when bar is hidden */}
        {!showBackboneBar && (
          <button
            onClick={() => setShowBackboneBar(true)}
            className="absolute top-3 left-3 z-40 p-2 rounded-lg
              bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl
              border border-slate-200/50 dark:border-slate-600/30
              shadow-md text-slate-400 hover:text-violet-500 transition-all"
            title="Search backbone (SMILES substructure)"
          >
            <Atom className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 relative">
          <GraphCanvas
            ref={graphCanvasRef}
            data={safeResults}
            containerRef={containerRef}
            height={height}
            isFullscreen={isFullscreen}
            pairColorMap={pairColorMap}
            showOverlay={showOverlay}
            edgeOpacity={edgeOpacity}
            spacingScale={spacingScale}
            colorMode={colorMode}
            colorScheme={colorScheme}
            bgColor={bgColor}
            gridColor={gridColor}
            edgeStyle={edgeStyle}
            pruneEdges={pruneEdges}
            nodeDisplay={nodeDisplay}
            keggLayout={keggLayout}
            keggOrthoEdges={keggOrthoEdges}
            backboneMatchIds={backboneMatchIds}
          />

          <SettingsPanel
            edgeOpacity={edgeOpacity}
            setEdgeOpacity={setEdgeOpacity}
            spacingScale={spacingScale}
            setSpacingScale={setSpacingScale}
            showOverlay={showOverlay}
            toggleOverlay={toggleOverlay}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            handleDownloadSVG={handleDownloadSVG}
            resetLayout={resetLayout}
            tightenEdges={tightenEdges}
            toggleHelp={() => setShowHelp(prev => !prev)}
            colorMode={colorMode}
            setColorMode={setColorMode}
            colorScheme={colorScheme}
            setColorScheme={setColorScheme}
            bgColor={bgColor}
            setBgColor={setBgColor}
            gridColor={gridColor}
            setGridColor={setGridColor}
            edgeStyle={edgeStyle}
            setEdgeStyle={setEdgeStyle}
            pruneEdges={pruneEdges}
            setPruneEdges={setPruneEdges}
            nodeDisplay={nodeDisplay}
            setNodeDisplay={setNodeDisplay}
            keggLayout={keggLayout}
            setKeggLayout={setKeggLayout}
            keggOrthoEdges={keggOrthoEdges}
            setKeggOrthoEdges={setKeggOrthoEdges}
          />
        </div>
      </div>
    </div>
  );
});

export default SimpleGraphViewer;
