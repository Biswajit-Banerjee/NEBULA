import React, { useState } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Clock,
  ChevronUp, ChevronDown,
} from 'lucide-react';

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
  populatedGens = [],
}) => {
  const [expanded, setExpanded] = useState(true);

  // Use populated gens for slider positions (index-based)
  const gens = populatedGens.length > 0 ? populatedGens : [minGeneration];
  const lastIdx = gens.length - 1;

  // Find closest index for a generation value
  const genToIdx = (g) => {
    let best = 0;
    for (let i = 0; i < gens.length; i++) {
      if (gens[i] <= g) best = i;
      else break;
    }
    return best;
  };

  const lo = minVisibleGeneration !== undefined ? minVisibleGeneration : minGeneration;
  const hi = currentGeneration;
  const loIdx = genToIdx(lo);
  const hiIdx = genToIdx(hi);
  const loPercent = lastIdx > 0 ? (loIdx / lastIdx) * 100 : 0;
  const hiPercent = lastIdx > 0 ? (hiIdx / lastIdx) * 100 : 100;
  const overlapping = loIdx === hiIdx;

  const handleOverlapChange = (idx) => {
    const val = gens[idx];
    if (val > hi) setCurrentGeneration(val);
    else if (val < lo && setMinVisibleGeneration) setMinVisibleGeneration(val);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-14 px-4">
      <div className="pointer-events-auto w-full max-w-xl">

        {/* ── Collapsed pill ── */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 mx-auto px-4 py-1.5 rounded-full
              bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl
              border border-slate-200/40 dark:border-slate-600/30
              shadow-lg text-xs font-semibold text-slate-600 dark:text-slate-300
              hover:shadow-xl hover:bg-white/95 dark:hover:bg-slate-800/95 transition-all"
          >
            <span className="tabular-nums">
              Gen{' '}
              <span className="text-violet-500 dark:text-violet-400">
                {lo !== hi ? `${lo}–` : ''}{hi}
              </span>
              /{maxGeneration}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}

        {/* ── Expanded bar ── */}
        {expanded && (
          <div className="rounded-2xl bg-white/88 dark:bg-slate-800/88 backdrop-blur-xl
            border border-slate-200/40 dark:border-slate-600/30 shadow-xl">

            {/* Controls row */}
            <div className="flex items-center gap-2 px-3 py-2">

              {/* Transport */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={stepBackward}
                  disabled={currentGeneration === minGeneration}
                  className="p-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-700/40
                    disabled:opacity-30 transition-all"
                  title="Previous generation"
                >
                  <SkipBack className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>

                <button
                  onClick={togglePlay}
                  className="p-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white
                    shadow-sm shadow-violet-500/20 transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying
                    ? <Pause className="w-4 h-4" />
                    : <Play className="w-4 h-4" />
                  }
                </button>

                <button
                  onClick={stepForward}
                  disabled={currentGeneration === maxGeneration}
                  className="p-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-700/40
                    disabled:opacity-30 transition-all"
                  title="Next generation"
                >
                  <SkipForward className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              {/* Gen label */}
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300
                tabular-nums select-none min-w-[56px] text-center flex-shrink-0"
              >
                Gen{' '}
                <span className="text-violet-500 dark:text-violet-400">
                  {lo !== hi ? `${lo}–` : ''}{hi}
                </span>
                /{maxGeneration}
              </span>

              {/* Seekbar */}
              <div className="flex-1 relative h-5 flex items-center min-w-[80px]">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-200/80 dark:bg-slate-600/50" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-violet-400 dark:bg-violet-500/80"
                  style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
                />

                {overlapping ? (
                  <input
                    type="range"
                    min={0} max={lastIdx} value={loIdx}
                    onChange={(e) => handleOverlapChange(parseInt(e.target.value))}
                    className="dual-thumb-range absolute inset-0 w-full"
                    style={{ zIndex: 3 }}
                  />
                ) : (
                  <>
                    <input
                      type="range"
                      min={0} max={lastIdx} value={loIdx}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        const val = gens[idx];
                        if (setMinVisibleGeneration) setMinVisibleGeneration(Math.min(val, hi));
                      }}
                      className="dual-thumb-range absolute inset-0 w-full"
                      style={{ zIndex: 1 }}
                    />
                    <input
                      type="range"
                      min={0} max={lastIdx} value={hiIdx}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value);
                        const val = gens[idx];
                        setCurrentGeneration(Math.max(val, lo));
                        if (setMinVisibleGeneration && lo > val) setMinVisibleGeneration(val);
                      }}
                      className="dual-thumb-range absolute inset-0 w-full"
                      style={{ zIndex: 2 }}
                    />
                  </>
                )}
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3 text-slate-400" />
                <select
                  value={transitionSpeed}
                  onChange={(e) => setTransitionSpeed(parseInt(e.target.value))}
                  className="text-[10px] font-semibold bg-transparent border-none
                    text-slate-500 dark:text-slate-400 cursor-pointer outline-none
                    appearance-none pr-0.5"
                >
                  {[1,2,3,5,8,10].map(s => (
                    <option key={s} value={s}>{s}×</option>
                  ))}
                </select>
              </div>

              {/* Collapse arrow */}
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-md hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-all flex-shrink-0"
                title="Minimize"
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationControls;