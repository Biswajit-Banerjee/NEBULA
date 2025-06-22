import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import GraphRenderer from "./GraphRendererCanvas";
import GenerationControls from "./GenerationControls";
import Legend from "./Legend";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";
import PhysicsControls from "./PhysicsControls";
import HelpOverlay from "./HelpOverlay";

const NetworkViewer2D = forwardRef(({ results, height = "600px" }, ref) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);

  const [showPhysics, setShowPhysics] = useState(false);
  const [tension, setTension] = useState(120);
  const [repulsion, setRepulsion] = useState(400);

  // New: help overlay visibility state
  const [showHelp, setShowHelp] = useState(false);
  // New: color by generation toggle
  const [colorByGeneration, setColorByGeneration] = useState(true);

  // Use custom hooks for state management
  const { 
    graphData, 
    currentGeneration, 
    setCurrentGeneration, 
    maxGeneration 
  } = useGraphData(results);
  
  const { 
    isPlaying, 
    togglePlay, 
    stepForward, 
    stepBackward,
    transitionSpeed,
    setTransitionSpeed
  } = useAnimation(currentGeneration, setCurrentGeneration, maxGeneration);
  
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

  // Removed resetToGenZero function as it's not needed

  // Make sure we have array data to pass to the GraphRenderer
  const safeResults = Array.isArray(results) ? results : [];

  // Keyboard shortcuts for common actions
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // ignore when typing
      switch (e.key) {
        case '+':
        case '=': // laptop keyboards
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case ' ': // Space toggles play
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
        case 'c':
        case 'C':
          setColorByGeneration(prev => !prev);
          break;
        case 'p':
        case 'P':
          setShowPhysics(prev => !prev);
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
  }, [togglePlay, stepForward, stepBackward, toggleFullscreen, setShowHelp, setColorByGeneration, setShowPhysics, resetSpiral, handleReset, handleZoomIn, handleZoomOut]);

  // Expose imperative handlers for exporting/importing positions
  useImperativeHandle(ref, () => ({
    getNodePositions: () => graphRendererRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => graphRendererRef.current?.setNodePositions?.(positions),
  }));

  return (
    <div className="relative rounded-xl border border-gray-200 shadow" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`relative flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Help overlay */}
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

        {showPhysics && (
          <PhysicsControls
            tension={tension}
            setTension={setTension}
            repulsion={repulsion}
            setRepulsion={setRepulsion}
            onClose={()=>setShowPhysics(false)}
          />
        )}

        {/* Main Visualization Area */}
        <div className="flex-1 relative">
          <GraphRenderer
            ref={graphRendererRef}
            data={safeResults}
            currentGeneration={currentGeneration}
            maxGeneration={maxGeneration}
            containerRef={containerRef}
            height={height}
            isFullscreen={isFullscreen}
            tension={tension}
            repulsion={repulsion}
            colorByGeneration={colorByGeneration}
          />
        </div>

        {/* Generation Controls and Slider */}
        <GenerationControls
          currentGeneration={currentGeneration}
          setCurrentGeneration={setCurrentGeneration}
          maxGeneration={maxGeneration}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          stepForward={stepForward}
          stepBackward={stepBackward}
          transitionSpeed={transitionSpeed}
          setTransitionSpeed={setTransitionSpeed}
          isFullscreen={isFullscreen}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          resetSpiral={resetSpiral}
          toggleFullscreen={toggleFullscreen}
          handleDownloadSVG={handleDownloadSVG}
          togglePhysics={() => setShowPhysics(prev => !prev)}
          toggleHelp={() => setShowHelp(prev => !prev)}
          colorByGeneration={colorByGeneration}
          toggleColorByGen={() => setColorByGeneration(prev => !prev)}
        />

        {/* Legend and Help Text */}
        <Legend />
      </div>
    </div>
  );
});

export default NetworkViewer2D;