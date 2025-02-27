import React from "react";
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
} from "lucide-react";

const ActionButtons = ({
  containerRef,
  wrapperRef,
  isFullscreen,
  toggleFullscreen,
  handleZoomIn,
  handleZoomOut,
  handleReset,
  handleDownloadSVG,
}) => {
  return (
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
      <button
        onClick={() => graphRendererRef.current?.resetSpiral()}
        className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
        title="Reset Layout"
      >
        <RefreshCcw className="w-5 h-5 text-gray-700" />
      </button>
      <button
        onClick={toggleFullscreen}
        className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5 text-gray-700" />
        ) : (
          <Maximize className="w-5 h-5 text-gray-700" />
        )}
      </button>
      <button
        onClick={handleDownloadSVG}
        className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
        title="Download as SVG"
      >
        <Download className="w-5 h-5 text-gray-700" />
      </button>
    </div>
  );
};

export default ActionButtons;
