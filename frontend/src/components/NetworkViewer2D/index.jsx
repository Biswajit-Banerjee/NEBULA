// Import React and hooks explicitly
import React from "react";
import { useRef, useState, useEffect } from "react";
import GraphRenderer from "./GraphRenderer";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize, 
  Minimize, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RefreshCcw, 
  Lock, 
  Unlock 
} from "lucide-react";

const NetworkViewer2D = ({ results, height = "600px" }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  console.log("Results in NetworkViewer2D:", results);

  // Extract max generation from the data
  useEffect(() => {
    if (!results || !Array.isArray(results) || results.length === 0) {
      setMaxGeneration(0);
      return;
    }

    let highestGen = 0;

    // Check through all compounds in compound_generation fields
    results.forEach((item) => {
      if (item.compound_generation) {
        Object.values(item.compound_generation).forEach((gen) => {
          const genValue = parseInt(gen);
          if (!isNaN(genValue)) {
            highestGen = Math.max(highestGen, genValue);
          }
        });
      }
    });

    console.log("Setting max gen:", highestGen);
    setMaxGeneration(highestGen);
  }, [results]);

  // Don't automatically lock nodes when changing generations
  // We'll leave this commented out as per user's request
  /*
  useEffect(() => {
    if (graphRendererRef.current && !graphRendererRef.current.isLocked) {
      // When changing generations, it's often helpful to lock nodes temporarily
      // This stabilizes the view as new nodes appear
      graphRendererRef.current.toggleLock();
      
      // Set a timeout to unlock after the new generation has settled
      const timer = setTimeout(() => {
        if (graphRendererRef.current) {
          // Uncomment this to auto-unlock after a delay
          // graphRendererRef.current.toggleLock();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [currentGeneration]);
  */

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentGeneration((prev) => {
          if (prev >= maxGeneration) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // Animation speed (1.5 seconds per step)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, maxGeneration]);

  // Handle play/pause
  const togglePlay = () => {
    if (currentGeneration >= maxGeneration && !isPlaying) {
      setCurrentGeneration(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Handle step navigation
  const stepForward = () => {
    if (currentGeneration < maxGeneration) {
      setCurrentGeneration((prev) => prev + 1);
    }
  };

  const stepBackward = () => {
    if (currentGeneration > 0) {
      setCurrentGeneration((prev) => prev - 1);
    }
  };

  // Handle zoom controls
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

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;

    if (!isFullscreen) {
      if (wrapperRef.current.requestFullscreen) {
        wrapperRef.current.requestFullscreen();
      } else if (wrapperRef.current.mozRequestFullScreen) {
        wrapperRef.current.mozRequestFullScreen();
      } else if (wrapperRef.current.webkitRequestFullscreen) {
        wrapperRef.current.webkitRequestFullscreen();
      } else if (wrapperRef.current.msRequestFullscreen) {
        wrapperRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ||
          document.mozFullScreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Handle SVG download
  const handleDownloadSVG = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.downloadSVG();
    }
  };

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
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5 text-gray-700" />
          </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => graphRendererRef.current?.resetSpiral()}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Reset Current Generation Layout"
          >
            <RefreshCcw className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={() => {
              setCurrentGeneration(0);
              setTimeout(() => graphRendererRef.current?.resetToGenZero(), 100);
            }}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Reset to Generation Zero"
          >
            <RotateCcw className="w-5 h-5 text-gray-700" />
          </button>
        </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? 
              <Minimize className="w-5 h-5 text-gray-700" /> : 
              <Maximize className="w-5 h-5 text-gray-700" />
            }
          </button>
          <button
            onClick={handleDownloadSVG}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Download as SVG"
          >
            <Download className="w-5 h-5 text-gray-700" />
          </button>
        </div>

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
        <div className="p-6 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            {/* Generation info and controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Generation: <span className="text-blue-600">{currentGeneration}</span> / {maxGeneration}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={stepBackward}
                  disabled={currentGeneration === 0}
                  className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className={`p-1.5 rounded-md ${
                    isPlaying ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={stepForward}
                  disabled={currentGeneration === maxGeneration}
                  className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Generation slider controls */}
          <div className="relative h-12 flex items-center">
            <input
              type="range"
              min="0"
              max={maxGeneration}
              value={currentGeneration}
              onChange={(e) => setCurrentGeneration(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${Array.from({ length: maxGeneration + 1 })
                  .map((_, i) => {
                    const hue = (i / (maxGeneration + 1)) * 360;
                    return `hsl(${hue}, 70%, 50%) ${(i / maxGeneration) * 100}%`;
                  })
                  .join(", ")})`,
              }}
            />

            {/* Generation Ticks */}
            <div className="absolute w-full flex justify-between top-5 px-2">
              {Array.from({ length: maxGeneration + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center cursor-pointer"
                  onClick={() => setCurrentGeneration(i)}
                >
                  <div
                    className={`w-1 h-3 ${
                      currentGeneration >= i ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  ></div>
                  <span
                    className={`text-xs mt-1 ${
                      currentGeneration === i
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {i}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend and Help Text */}
          <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-200 border border-blue-500 mr-1"></div>
                <span>Compound</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-200 border border-purple-500 rounded-sm mr-1"></div>
                <span>Reaction</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 rounded-md bg-white border border-purple-500 mr-1"></div>
                <span>EC Number</span>
              </div>
              <div className="border-l border-gray-300 h-4 mx-1"></div>
              <div className="flex items-center">
                <div className="w-5 h-5 flex items-center justify-center bg-blue-600 rounded-full mr-1 text-white">
                  <Lock className="w-3 h-3" />
                </div>
                <span>Locked Nodes</span>
              </div>
            </div>
            <div className="italic">
              Drag to move nodes • Scroll to zoom • Use lock button to fix positions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkViewer2D;