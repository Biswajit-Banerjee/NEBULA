import React from 'react';
import { Play, Pause, SkipForward, SkipBack } from 'lucide-react';

const GenerationControls = ({
  currentGeneration,
  setCurrentGeneration,
  maxGeneration,
  isPlaying,
  togglePlay,
  stepForward,
  stepBackward
}) => {
  return (
    <div className="p-6 bg-white/50 backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-4">
        {/* Generation display and controls */}
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
            {/* Play/Pause button */}
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

      {/* Generation slider */}
      <div className="relative h-12 flex items-center">
        {/* Slider implementation */}
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
        
        {/* Generation ticks */}
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
    </div>
  );
};

export default GenerationControls;