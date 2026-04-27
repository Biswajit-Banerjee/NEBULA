import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import GraphRenderer from "./GraphRendererCanvas";
import GenerationControls from "./GenerationControls";
import SettingsPanel from "./SettingsPanel";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";
import HelpOverlay from "./HelpOverlay";

const NetworkViewer2D = forwardRef(({ results, searchPairs = [], height = "600px" }, ref) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);

  // Help overlay
  const [showHelp, setShowHelp] = useState(false);
  // Overlay visibility state
  const [showOverlay, setShowOverlay] = useState(false);

  // User customization
  const [edgeOpacity, setEdgeOpacity] = useState(0.5);
  const [spacingScale, setSpacingScale] = useState(1.0);

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
    <div className="relative rounded-xl border border-gray-200/40 dark:border-slate-700/40 shadow-sm bg-white dark:bg-slate-800 overflow-hidden" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`relative flex flex-col bg-neutral-50 dark:bg-slate-900 transition-all duration-300 ${
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