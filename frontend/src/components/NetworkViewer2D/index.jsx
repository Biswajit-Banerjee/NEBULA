import React, { useRef } from "react";
import GraphRenderer from "./GraphRenderer";
import ActionButtons from "./ActionButtons";
import GenerationControls from "./GenerationControls";
import Legend from "./Legend";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";

const NetworkViewer2D = ({ results, height = "600px" }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);

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

  return (
    <div className="relative rounded-xl border border-gray-200 shadow" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Floating Visualization Controls */}
        <ActionButtons 
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          resetSpiral={resetSpiral}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
          handleDownloadSVG={handleDownloadSVG}
        />

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
        />

        {/* Legend and Help Text */}
        <Legend />
      </div>
    </div>
  );
};

export default NetworkViewer2D;