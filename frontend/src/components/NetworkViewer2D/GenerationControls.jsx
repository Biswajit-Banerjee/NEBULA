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
    className="group relative p-2 rounded-md hover:bg-indigo-50/60 dark:hover:bg-slate-600/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400/50 dark:focus:ring-indigo-400/30 disabled:opacity-40 disabled:pointer-events-none"
    disabled={disabled}
    aria-label={title}
    {...rest}
  >
    {children}
    {/* Tooltip */}
    <span
      className={`${tooltipBase} bg-gray-800/90 text-white dark:bg-slate-700/90`}
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
  minGeneration = 0,
  minVisibleGeneration,
  setMinVisibleGeneration,
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
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 p-3 pb-12 sm:p-4 sm:pb-14">
      {/* Unified toolbar */}
      <div className="pointer-events-auto flex flex-col rounded-xl bg-white/75 dark:bg-slate-800/75 backdrop-blur-md shadow-lg border border-gray-200/60 dark:border-slate-600/35 overflow-hidden">
        {/* Controls row */}
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          {/* View cluster */}
          <div className="flex items-center gap-1">
            <IconButton title="Zoom in" onClick={handleZoomIn}><ZoomIn className="w-5 h-5" /></IconButton>
            <IconButton title="Zoom out" onClick={handleZoomOut}><ZoomOut className="w-5 h-5" /></IconButton>
            <IconButton title={overlayOn ? 'Hide path overlay' : 'Show path overlay'} onClick={toggleOverlay}>
              <Layers className="w-5 h-5" />
            </IconButton>
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
          <div className="flex items-center gap-1">
            <div className="relative">
              <IconButton title="Animation speed" onClick={() => setShowSpeedControl((p) => !p)}>
                <Clock className="w-5 h-5" />
              </IconButton>
              {showSpeedControl && (
                <div className="absolute bottom-full left-1/2 z-40 mb-3 w-44 -translate-x-1/2 rounded-lg border border-gray-200/60 dark:border-slate-600/35 bg-white/95 dark:bg-slate-800/95 p-3 shadow-xl">
                  <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Transition Speed</p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={transitionSpeed}
                    onChange={(e) => setTransitionSpeed(parseInt(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              )}
            </div>

            <IconButton title="Previous generation" onClick={stepBackward} disabled={currentGeneration === minGeneration}>
              <SkipBack className="w-5 h-5" />
            </IconButton>

            <IconButton title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </IconButton>

            <IconButton title="Next generation" onClick={stepForward} disabled={currentGeneration === maxGeneration}>
              <SkipForward className="w-5 h-5" />
            </IconButton>

            <span className="select-none text-sm font-medium text-gray-700 dark:text-gray-200 ml-1">
              Gen <span className="text-indigo-500 dark:text-indigo-400/80">{minVisibleGeneration !== undefined && minVisibleGeneration !== currentGeneration ? `${minVisibleGeneration}-` : ''}{currentGeneration}</span>/{maxGeneration}
            </span>
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-1">
            <IconButton title="Physics controls" onClick={togglePhysics}><SlidersHorizontal className="w-5 h-5" /></IconButton>
            <IconButton title="Download SVG" onClick={handleDownloadSVG}><Download className="w-5 h-5" /></IconButton>
            <IconButton title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </IconButton>
            <IconButton title="Help" onClick={toggleHelp}><HelpCircle className="w-5 h-5" /></IconButton>
          </div>
        </div>

        {/* Dual-thumb generation seekbar */}
        <div className="px-4 pb-3 pt-1">
          {(() => {
            const lo = minVisibleGeneration !== undefined ? minVisibleGeneration : minGeneration;
            const hi = currentGeneration;
            const range = maxGeneration - minGeneration || 1;
            const loPercent = ((lo - minGeneration) / range) * 100;
            const hiPercent = ((hi - minGeneration) / range) * 100;
            const overlapping = lo === hi;

            // When thumbs overlap, one smart input handles both directions
            const handleOverlapChange = (val) => {
              if (val > hi) {
                setCurrentGeneration(val);
              } else if (val < lo) {
                if (setMinVisibleGeneration) setMinVisibleGeneration(val);
              }
            };

            return (
              <div className="relative h-3 flex items-center">
                {/* Track background */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gray-200/80 dark:bg-slate-600/50" />
                {/* Active range fill */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-indigo-400 dark:bg-indigo-500/80"
                  style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
                />

                {overlapping ? (
                  /* Single input when both thumbs overlap — direction determines which value moves */
                  <input
                    type="range"
                    min={minGeneration}
                    max={maxGeneration}
                    value={lo}
                    onChange={(e) => handleOverlapChange(parseInt(e.target.value))}
                    className="dual-thumb-range absolute inset-0 w-full"
                    style={{ zIndex: 3 }}
                  />
                ) : (
                  <>
                    {/* Left thumb (min visible) */}
                    <input
                      type="range"
                      min={minGeneration}
                      max={maxGeneration}
                      value={lo}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (setMinVisibleGeneration) setMinVisibleGeneration(Math.min(val, hi));
                      }}
                      className="dual-thumb-range absolute inset-0 w-full"
                      style={{ zIndex: 1 }}
                    />
                    {/* Right thumb (current gen) */}
                    <input
                      type="range"
                      min={minGeneration}
                      max={maxGeneration}
                      value={hi}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setCurrentGeneration(Math.max(val, lo));
                        if (setMinVisibleGeneration && lo > val) setMinVisibleGeneration(val);
                      }}
                      className="dual-thumb-range absolute inset-0 w-full"
                      style={{ zIndex: 2 }}
                    />
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default GenerationControls;