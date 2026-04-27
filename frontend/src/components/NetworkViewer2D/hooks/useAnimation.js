import { useState, useEffect, useRef } from 'react';

// Helper: find next populated gen after `cur` in sorted array
const nextPopulated = (gens, cur) => {
  for (let i = 0; i < gens.length; i++) {
    if (gens[i] > cur) return gens[i];
  }
  return null; // already at or past last
};

// Helper: find previous populated gen before `cur` in sorted array
const prevPopulated = (gens, cur) => {
  for (let i = gens.length - 1; i >= 0; i--) {
    if (gens[i] < cur) return gens[i];
  }
  return null; // already at or before first
};

function useAnimation(currentGeneration, setCurrentGeneration, maxGeneration, minGeneration = 0, populatedGens = []) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionSpeed, setTransitionSpeed] = useState(2); // Default 2 seconds
  const playIntervalRef = useRef(null);
  const transitionInProgressRef = useRef(false);
  // Keep a ref to populatedGens so the interval closure sees the latest value
  const populatedGensRef = useRef(populatedGens);
  populatedGensRef.current = populatedGens;

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      // Clear any existing interval
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
      
      // Set new interval based on transition speed
      playIntervalRef.current = setInterval(() => {
        setCurrentGeneration((prev) => {
          const next = nextPopulated(populatedGensRef.current, prev);
          // If no next populated gen, stop playing
          if (next === null) {
            setIsPlaying(false);
            return prev;
          }
          
          // Only advance if we're not already in transition
          if (!transitionInProgressRef.current) {
            transitionInProgressRef.current = true;
            
            // Set a timeout to mark the transition as complete
            setTimeout(() => {
              transitionInProgressRef.current = false;
            }, Math.min(1000, transitionSpeed * 500));
            
            return next;
          }
          return prev;
        });
      }, transitionSpeed * 1000);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, maxGeneration, setCurrentGeneration, transitionSpeed]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    // About to start playing
    if (currentGeneration >= maxGeneration) {
      // Restart from first populated gen
      setCurrentGeneration(populatedGens.length > 0 ? populatedGens[0] : minGeneration);
    } else {
      // Immediate advance to next populated gen
      const next = nextPopulated(populatedGens, currentGeneration);
      if (next !== null) setCurrentGeneration(next);
    }

    transitionInProgressRef.current = false;
    setIsPlaying(true);
  };

  const stepForward = () => {
    const next = nextPopulated(populatedGens, currentGeneration);
    if (next !== null) {
      transitionInProgressRef.current = true;
      setCurrentGeneration(next);
      setTimeout(() => { transitionInProgressRef.current = false; }, 500);
    }
  };

  const stepBackward = () => {
    const prev = prevPopulated(populatedGens, currentGeneration);
    if (prev !== null) {
      transitionInProgressRef.current = true;
      setCurrentGeneration(prev);
      setTimeout(() => { transitionInProgressRef.current = false; }, 500);
    }
  };

  return {
    isPlaying,
    togglePlay,
    stepForward,
    stepBackward,
    transitionSpeed,
    setTransitionSpeed
  };
}

export default useAnimation;