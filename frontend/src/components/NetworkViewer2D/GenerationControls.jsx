import React, { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Clock, ZoomIn, ZoomOut, RotateCcw, Download, SlidersHorizontal, Maximize, Minimize, HelpCircle, Lock, Unlock } from 'lucide-react';

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
}) => {
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  
  // Unified button style
  const btnBase =
    'p-2 rounded-md text-gray-700 dark:text-slate-200 transition hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600 disabled:opacity-40';

  const clusterGap = 'flex items-center gap-2';

  return (
    <div className={`absolute bottom-0 left-0 w-full z-30 bg-white/70 dark:bg-slate-800/80 backdrop-blur-md shadow-inner`}>    
      <div className="w-full px-3 py-2 flex items-center justify-between flex-wrap gap-y-2">

        {/* Left cluster – view tools */}
        <div className={clusterGap}>
          <button onClick={handleZoomIn} className={btnBase} title="Zoom in" aria-label="Zoom in"><ZoomIn className="w-4 h-4"/></button>
          <button onClick={handleZoomOut} className={btnBase} title="Zoom out" aria-label="Zoom out"><ZoomOut className="w-4 h-4"/></button>
          <button
            onClick={resetSpiral}
            onMouseDown={startRotate}
            onMouseUp={stopRotate}
            onMouseLeave={stopRotate}
            className={btnBase}
            title="Rotate layout"
            aria-label="Rotate layout"
          >
            <RotateCcw className="w-4 h-4"/>
          </button>
          <button
            onClick={togglePhysicsSim}
            className={btnBase}
            title={physicsOff ? "Unlock physics" : "Lock physics"}
            aria-label="Toggle physics simulation"
          >
            {physicsOff ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}
          </button>
        </div>

        {/* Centre cluster – generation navigation & slider */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-center gap-2">
            {/* Speed control button */}
            <div className="relative">
              <button onClick={()=>setShowSpeedControl(prev=>!prev)} className={btnBase} title="Animation speed" aria-label="Animation speed"><Clock className="w-4 h-4"/></button>
              {showSpeedControl && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-slate-800 shadow-lg rounded-lg p-3 w-40 z-50">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Transition Speed</p>
                  <input type="range" min="1" max="10" step="1" value={transitionSpeed} onChange={(e)=>setTransitionSpeed(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                </div>
              )}
            </div>

            <button onClick={stepBackward} disabled={currentGeneration===0} className={btnBase} aria-label="Previous generation"><SkipBack className="w-4 h-4"/></button>
            <button onClick={togglePlay} className={btnBase} aria-label={isPlaying? 'Pause':'Play'}>{isPlaying? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}</button>
            <button onClick={stepForward} disabled={currentGeneration===maxGeneration} className={btnBase} aria-label="Next generation"><SkipForward className="w-4 h-4"/></button>

            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 select-none">Gen <span className="text-indigo-600 dark:text-indigo-400">{currentGeneration}</span>/<span>{maxGeneration}</span></span>
          </div>
          <input type="range" min="0" max={maxGeneration} value={currentGeneration} onChange={(e)=>setCurrentGeneration(parseInt(e.target.value))} className="w-full accent-indigo-600" />
        </div>

        {/* Right cluster – misc tools */}
        <div className={`${clusterGap} justify-end`}>
          <button onClick={togglePhysics} className={btnBase} title="Physics controls" aria-label="Physics"><SlidersHorizontal className="w-4 h-4"/></button>
          <button onClick={handleDownloadSVG} className={btnBase} title="Download SVG" aria-label="Download"><Download className="w-4 h-4"/></button>
          <button onClick={toggleFullscreen} className={btnBase} title={isFullscreen? 'Exit fullscreen':'Enter fullscreen'} aria-label="Fullscreen">{isFullscreen? <Minimize className="w-4 h-4"/> : <Maximize className="w-4 h-4"/>}</button>
          <button onClick={toggleHelp} className={btnBase} title="Help" aria-label="Help"><HelpCircle className="w-4 h-4"/></button>
        </div>

      </div>
    </div>
  );
};

export default GenerationControls;