import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Clock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  SlidersHorizontal,
  Maximize,
  Minimize,
  HelpCircle,
  Lock,
  Unlock,
  Layers,
} from 'lucide-react';

// ✨ NEW: extracted reusable IconButton to ensure consistent styling & built-in tooltip
const tooltipBase =
  'absolute z-20 -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-medium pointer-events-none transition opacity-0 group-hover:opacity-100 whitespace-nowrap';

const IconButton = ({ title, disabled, children, ...rest }) => (
  <button
    type="button"
    className="group relative p-2 rounded-md hover:bg-indigo-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-40 disabled:pointer-events-none"
    disabled={disabled}
    aria-label={title}
    {...rest}
  >
    {children}
    {/* Tooltip */}
    <span
      className={`${tooltipBase} bg-gray-900 text-white dark:bg-gray-800`}
      role="tooltip"
    >
      {title}
    </span>
  </button>
);

const GenerationControls = ({
  currentGeneration,
  setCurrentGeneration,
  maxGeneration,
  isPlaying,
  togglePlay,
  stepForward,
  stepBackward,
  transitionSpeed = 2,
  setTransitionSpeed,
  isFullscreen,
  handleZoomIn,
  handleZoomOut,
  resetSpiral,
  toggleFullscreen,
  handleDownloadSVG,
  togglePhysics,
  toggleHelp,
  startRotate,
  stopRotate,
  togglePhysicsSim,
  physicsOff,
  toggleOverlay,
  overlayOn,
}) => {
  const [showSpeedControl, setShowSpeedControl] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 p-3 sm:p-4">
      {/* Top toolbar */}
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 py-2 shadow-lg border border-gray-200 dark:border-slate-700">
        {/* View cluster */}
        <div className="flex items-center gap-2">
          <IconButton title="Zoom in" onClick={handleZoomIn}><ZoomIn className="w-5 h-5" /></IconButton>
          <IconButton title="Zoom out" onClick={handleZoomOut}><ZoomOut className="w-5 h-5" /></IconButton>
          <IconButton title={overlayOn ? 'Hide path overlay' : 'Show path overlay'} onClick={toggleOverlay}>
            <Layers className="w-5 h-5" />
          </IconButton>
          {/* Rotate / reset view.  Click resets, hold rotates (implemented upstream) */}
          <IconButton
            title="Rotate layout (hold to spin)"
            onClick={resetSpiral}
            onMouseDown={startRotate}
            onMouseUp={stopRotate}
            onMouseLeave={stopRotate}
          >
            <RotateCcw className="w-5 h-5" />
          </IconButton>
          <IconButton
            title={physicsOff ? 'Unlock physics' : 'Lock physics'}
            onClick={togglePhysicsSim}
          >
            {physicsOff ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </IconButton>
        </div>

        {/* Generation controls */}
        <div className="flex items-center gap-2">
          {/* Speed popover */}
          <div className="relative">
            <IconButton title="Animation speed" onClick={() => setShowSpeedControl((p) => !p)}>
              <Clock className="w-5 h-5" />
            </IconButton>
            {showSpeedControl && (
              <div className="absolute bottom-full left-1/2 z-40 mb-3 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Transition Speed</p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={transitionSpeed}
                  onChange={(e) => setTransitionSpeed(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>
            )}
          </div>

          <IconButton title="Previous generation" onClick={stepBackward} disabled={currentGeneration === 0}>
            <SkipBack className="w-5 h-5" />
          </IconButton>

          <IconButton title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </IconButton>

          <IconButton title="Next generation" onClick={stepForward} disabled={currentGeneration === maxGeneration}>
            <SkipForward className="w-5 h-5" />
          </IconButton>

          <span className="select-none text-sm font-medium text-gray-700 dark:text-gray-200">
            Gen <span className="text-indigo-600 dark:text-indigo-400">{currentGeneration}</span>/{maxGeneration}
          </span>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          <IconButton title="Physics controls" onClick={togglePhysics}><SlidersHorizontal className="w-5 h-5" /></IconButton>
          <IconButton title="Download SVG" onClick={handleDownloadSVG}><Download className="w-5 h-5" /></IconButton>
          <IconButton title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </IconButton>
          <IconButton title="Help" onClick={toggleHelp}><HelpCircle className="w-5 h-5" /></IconButton>
        </div>
      </div>

      {/* Generation slider – full width under toolbar */}
      <div className="pointer-events-auto rounded-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-md px-4 py-2 shadow-inner border border-gray-200 dark:border-slate-700">
        <input
          type="range"
          min="0"
          max={maxGeneration}
          value={currentGeneration}
          onChange={(e) => setCurrentGeneration(parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
      </div>
    </div>
  );
};

export default GenerationControls;