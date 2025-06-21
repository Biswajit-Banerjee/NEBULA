import React from "react";
import {
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  Maximize,
  Minimize,
  Hand,
  MousePointer,
  SlidersHorizontal,
} from "lucide-react";

const ActionButtons = ({
  handleZoomIn,
  handleZoomOut,
  resetSpiral,
  isFullscreen,
  toggleFullscreen,
  handleDownloadSVG,
  toolMode,
  setToolMode,
  togglePhysics,
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
      <button
        onClick={() => setToolMode(toolMode === 'pan' ? 'cursor' : 'pan')}
        className={`p-2 rounded-lg shadow transition-colors ${
          toolMode === 'pan' ? 'bg-indigo-50 text-indigo-600' : 'bg-white hover:bg-gray-50 text-gray-700'
        }`}
        title={toolMode === 'pan' ? 'Switch to Browse/Hand tool' : 'Switch to Pan tool'}
      >
        {toolMode === 'pan' ? <MousePointer className="w-5 h-5" /> : <Hand className="w-5 h-5" /> }
      </button>
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
        onClick={resetSpiral}
        className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
        title="Reset Current Generation Layout"
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
      <button
        onClick={togglePhysics}
        className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
        title="Physics controls"
      >
        <SlidersHorizontal className="w-5 h-5 text-gray-700" />
      </button>
    </div>
  );
};

export default ActionButtons;