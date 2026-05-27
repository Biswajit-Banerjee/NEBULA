import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import GraphRenderer from "./GraphRendererCanvas";
import GenerationControls from "./GenerationControls";
import SettingsPanel from "./SettingsPanel";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";
import HelpOverlay from "./HelpOverlay";

// Parse node positions and edge colors out of an exported SVG.
// Returns { posMap: { label: [{x,y}] }, edgeColors: { edgeKey: color } }
const parseSVGLayout = (svgText) => {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root) return { posMap: {}, edgeColors: {} };
  const posMap = {};
  const edgeColors = {};
  const push = (label, pos) => {
    if (!label) return;
    if (!posMap[label]) posMap[label] = [];
    posMap[label].push(pos);
  };
  let pendingPos = null;
  for (const el of root.children) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'circle') {
      pendingPos = { x: parseFloat(el.getAttribute('cx')), y: parseFloat(el.getAttribute('cy')) };
    } else if (tag === 'ellipse') {
      pendingPos = { x: parseFloat(el.getAttribute('cx')), y: parseFloat(el.getAttribute('cy')) };
    } else if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x'));
      const y = parseFloat(el.getAttribute('y'));
      const w = parseFloat(el.getAttribute('width')) || 0;
      const h = parseFloat(el.getAttribute('height')) || 0;
      pendingPos = { x: x + w / 2, y: y + h / 2 };
    } else if (tag === 'image') {
      const x = parseFloat(el.getAttribute('x'));
      const y = parseFloat(el.getAttribute('y'));
      const w = parseFloat(el.getAttribute('width')) || 0;
      const h = parseFloat(el.getAttribute('height')) || 0;
      pendingPos = { x: x + w / 2, y: y + h / 2 };
    } else if (tag === 'path') {
      pendingPos = null; // edge — reset
      const edgeKey = el.getAttribute('data-edge-key');
      const customColor = el.getAttribute('data-custom-color');
      if (edgeKey && customColor) edgeColors[edgeKey] = customColor;
    } else if (tag === 'text' && pendingPos) {
      const label = el.textContent.trim();
      if (label) push(label, pendingPos);
      pendingPos = null;
    }
  }
  return { posMap, edgeColors };
};

const NetworkViewer2D = forwardRef(({ results, searchPairs = [], height = "600px" }, ref) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);
  const importFileRef = useRef(null);

  // Help overlay
  const [showHelp, setShowHelp] = useState(false);
  // Overlay visibility state
  const [showOverlay, setShowOverlay] = useState(false);

  // User customization
  const [edgeOpacity, setEdgeOpacity] = useState(0.5);
  const [spacingScale, setSpacingScale] = useState(1.0);

  // Label settings
  const [showNodeNames, setShowNodeNames] = useState(false);
  const [showStructures, setShowStructures] = useState(false);
  const [curvedEdges, setCurvedEdges] = useState(true);

  // Edge brush tool
  const [brushMode, setBrushMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#e11d48');

  const handleClearEdgeColors = () => {
    if (graphRendererRef.current) graphRendererRef.current.clearEdgeColors();
  };

  // Color settings
  const [colorMode, setColorMode] = useState('generation'); // 'generation' | 'type' | 'degree'
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [bgColor, setBgColor] = useState(''); // empty = default theme bg
  const [gridColor, setGridColor] = useState(''); // empty = default theme grid

  // Mask slider: lower bound of visible generation range
  const [minVisibleGeneration, setMinVisibleGeneration] = useState(0);

  // Use custom hooks for state management
  const { 
    graphData, 
    currentGeneration, 
    setCurrentGeneration, 
    maxGeneration,
    minGeneration,
    populatedGens
  } = useGraphData(results);

  // Reset mask slider when data changes
  React.useEffect(() => {
    setMinVisibleGeneration(minGeneration);
  }, [minGeneration]);
  
  const { 
    isPlaying, 
    togglePlay, 
    stepForward: rawStepForward, 
    stepBackward: rawStepBackward,
    transitionSpeed,
    setTransitionSpeed
  } = useAnimation(currentGeneration, setCurrentGeneration, maxGeneration, minGeneration, populatedGens);

  // Wrapped step callbacks that maintain minVisibleGeneration <= currentGeneration
  const stepBackward = React.useCallback(() => {
    rawStepBackward();
    // After stepping back, ensure minVisibleGeneration doesn't exceed currentGeneration
    setCurrentGeneration((prev) => {
      if (minVisibleGeneration > prev) setMinVisibleGeneration(prev);
      return prev;
    });
  }, [rawStepBackward, minVisibleGeneration, setCurrentGeneration, setMinVisibleGeneration]);

  const stepForward = React.useCallback(() => {
    rawStepForward();
  }, [rawStepForward]);
  
  const { 
    isFullscreen, 
    toggleFullscreen 
  } = useFullscreen(wrapperRef);

  // Handle visualization controls
  const handleZoomIn = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.zoomOut();
    }
  };

  const handleReset = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.resetView();
    }
  };

  const handleDownloadSVG = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.downloadSVG();
    }
  };

  const handleImportSVG = () => {
    importFileRef.current?.click();
  };

  const onImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { posMap, edgeColors } = parseSVGLayout(ev.target.result);
      if (graphRendererRef.current) {
        graphRendererRef.current.importLayout(posMap);
        if (Object.keys(edgeColors).length > 0)
          graphRendererRef.current.importEdgeColors(edgeColors);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSpiral = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.resetSpiral();
    }
  };

  const tightenEdges = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.tightenEdges();
    }
  };

  const startRotate = () => {
    if (!graphRendererRef.current) return;
    rotateIntervalRef.current = setInterval(() => {
      graphRendererRef.current.rotateGraph(-Math.PI / 90); // 2° per frame
    }, 30);
  };

  const stopRotate = () => {
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
  };

  const rotateIntervalRef = useRef(null);

  // Make sure we have array data to pass to the GraphRenderer
  const safeResults = Array.isArray(results) ? results : [];

  // Map pair index to rgba color string
  const pairColorMap = React.useMemo(() => {
    const map = {};
    searchPairs.forEach((p, idx) => {
      const hex = p.color || '#94a3b8';
      const alpha = p.alpha !== undefined ? p.alpha : 1;
      const aHex = Math.round(alpha*255).toString(16).padStart(2,'0');
      map[idx] = `${hex}${aHex}`;
    });
    return map;
  }, [searchPairs]);

  // Keyboard shortcuts for common actions
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      // Don't intercept browser shortcuts (Ctrl+F, Cmd+F, etc.)
      if (e.ctrlKey || e.metaKey) return;
      
      switch (e.key) {
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          stepForward();
          break;
        case 'ArrowLeft':
          stepBackward();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          setShowHelp((prev) => !prev);
          break;
        case 'r':
        case 'R':
          resetSpiral();
          break;
        case '0':
          handleReset();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, stepForward, stepBackward, toggleFullscreen, setShowHelp, resetSpiral, handleReset, handleZoomIn, handleZoomOut]);

  // Expose imperative handlers for exporting/importing positions
  useImperativeHandle(ref, () => ({
    getNodePositions: () => graphRendererRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => graphRendererRef.current?.setNodePositions?.(positions),
  }));

  const toggleOverlay = () => {
    setShowOverlay(prev => !prev);
  };

  return (
    <div className="relative rounded-xl border border-brd/40 shadow-sm bg-surface-secondary overflow-hidden" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`relative flex flex-col bg-surface transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Help overlay */}
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

        {/* Main Visualization Area */}
        <div className="flex-1 relative">
          <GraphRenderer
            ref={graphRendererRef}
            data={safeResults}
            currentGeneration={currentGeneration}
            minVisibleGeneration={minVisibleGeneration}
            maxGeneration={maxGeneration}
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
            showNodeNames={showNodeNames}
            showStructures={showStructures}
            curvedEdges={curvedEdges}
            brushMode={brushMode}
            brushColor={brushColor}
          />

          {/* Right-side settings panel (arrow toggle) */}
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
            handleImportSVG={handleImportSVG}
            brushMode={brushMode}
            setBrushMode={setBrushMode}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            clearEdgeColors={handleClearEdgeColors}
            resetSpiral={resetSpiral}
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
            showNodeNames={showNodeNames}
            setShowNodeNames={setShowNodeNames}
            showStructures={showStructures}
            setShowStructures={setShowStructures}
            curvedEdges={curvedEdges}
            setCurvedEdges={setCurvedEdges}
          />
          {/* Hidden file input for SVG layout import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={onImportFileChange}
          />
        </div>

        {/* Slim generation timeline (collapsible) */}
        <GenerationControls
          currentGeneration={currentGeneration}
          setCurrentGeneration={setCurrentGeneration}
          maxGeneration={maxGeneration}
          minGeneration={minGeneration}
          minVisibleGeneration={minVisibleGeneration}
          setMinVisibleGeneration={setMinVisibleGeneration}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          stepForward={stepForward}
          stepBackward={stepBackward}
          transitionSpeed={transitionSpeed}
          setTransitionSpeed={setTransitionSpeed}
          populatedGens={populatedGens}
        />
      </div>
    </div>
  );
});

export default NetworkViewer2D;