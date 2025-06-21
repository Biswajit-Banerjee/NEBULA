import React from "react";
import {
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCcw,
  Maximize,
  Minimize,
  SlidersHorizontal,
  HelpCircle,
  Palette,
} from "lucide-react";

const ActionButtons = ({
  handleZoomIn,
  handleZoomOut,
  resetSpiral,
  isFullscreen,
  toggleFullscreen,
  handleDownloadSVG,
  togglePhysics,
  toggleHelp,
  colorByGeneration,
  toggleColorByGen,
  inline = false,
}) => {
  return (
    <div className={`${inline ? 'flex items-center gap-2' : 'absolute top-4 right-4 z-10 flex flex-col sm:flex-row items-center gap-2 bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-2'}`}>
      <button
        onClick={handleZoomIn}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <button
        onClick={resetSpiral}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Reset Current Generation Layout"
        aria-label="Reset generation layout"
      >
        <RefreshCcw className="w-5 h-5" />
      </button>
      <button
        onClick={toggleFullscreen}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        aria-label="Toggle fullscreen"
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5" />
        ) : (
          <Maximize className="w-5 h-5" />
        )}
      </button>
      <button
        onClick={handleDownloadSVG}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Download as SVG"
        aria-label="Download SVG"
      >
        <Download className="w-5 h-5" />
      </button>
      <button
        onClick={togglePhysics}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Physics controls"
        aria-label="Physics controls"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </button>
      <button
        onClick={toggleColorByGen}
        className={`p-2 rounded-md transition focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
          colorByGeneration ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="Toggle generation colours"
        aria-label="Toggle generation colours"
      >
        <Palette className="w-5 h-5" />
      </button>
      <button
        onClick={toggleHelp}
        className="p-2 rounded-md text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        title="Help & Shortcuts"
        aria-label="Help and shortcuts"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ActionButtons;