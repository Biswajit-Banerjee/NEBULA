import React, { useRef, useState } from "react";
import GraphRenderer from "./GraphRendererCanvas";
import ActionButtons from "./ActionButtons";
import GenerationControls from "./GenerationControls";
import Legend from "./Legend";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";
import PhysicsControls from "./PhysicsControls";

const NetworkViewer2D = ({ results, height = "600px" }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);

  // Tool mode: 'pan' (hand) or 'cursor' (move nodes)
  const [toolMode, setToolMode] = useState('pan');

  const [showPhysics, setShowPhysics] = useState(false);
  const [tension, setTension] = useState(120);
  const [repulsion, setRepulsion] = useState(400);

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
        className={`relative flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 transition-all duration-300 ${
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
          toolMode={toolMode}
          setToolMode={setToolMode}
          togglePhysics={()=>setShowPhysics(prev=>!prev)}
        />

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
            toolMode={toolMode}
            tension={tension}
            repulsion={repulsion}
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