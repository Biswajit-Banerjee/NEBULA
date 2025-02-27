import React, { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Clock } from 'lucide-react';

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
  isFullscreen
}) => {
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  
  // Calculate hue colors for the gradient based on generations
  const generateGradient = () => {
    if (maxGeneration === 0) return 'bg-blue-500';
    
    return `linear-gradient(to right, ${Array.from({ length: maxGeneration + 1 })
      .map((_, i) => {
        const hue = (i / (maxGeneration + 1)) * 360;
        return `hsl(${hue}, 70%, 50%) ${(i / maxGeneration) * 100}%`;
      })
      .join(", ")})`;
  };

  return (
    <div className={`p-3 ${isFullscreen ? 'bg-white/30' : 'bg-white/50'} backdrop-blur-sm transition-all duration-300`}>
      <div className="flex items-center justify-between mb-1">
        {/* Left side: Speed control */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedControl(!showSpeedControl)}
            className="p-1.5 text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1 text-xs"
            title="Animation Speed"
          >
            <Clock className="w-4 h-4" />
            <span>{transitionSpeed}s</span>
          </button>
          
          {showSpeedControl && (
            <div className="absolute right-0 top-8 bg-white shadow-lg rounded-lg p-2 z-10 w-32">
              <p className="text-xs text-gray-500 mb-1">Transition Speed</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={transitionSpeed}
                  onChange={(e) => setTransitionSpeed(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>
          )}
        </div>
        {/* Left side: Generation info and controls */}
        <div className="flex items-center gap-2">
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
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Gen: <span className="text-blue-600">{currentGeneration}</span>/{maxGeneration}
          </span>
        </div>
        
      </div>

      {/* Slider */}
      <div className="relative h-6">
        <input
          type="range"
          min="0"
          max={maxGeneration}
          value={currentGeneration}
          onChange={(e) => setCurrentGeneration(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: generateGradient(),
          }}
        />
        
        {/* Show compact ticks for generations */}
        {maxGeneration <= 10 && (
          <div className="absolute w-full flex justify-between top-2 px-2 mt-1">
            {Array.from({ length: maxGeneration + 1 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => setCurrentGeneration(i)}
              >
                <div
                  className={`w-1 h-2 ${
                    currentGeneration >= i ? "bg-blue-500" : "bg-gray-300"
                  }`}
                ></div>
                <span
                  className={`text-xs mt-0.5 ${
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
        )}
      </div>
    </div>
  );
};

export default GenerationControls;