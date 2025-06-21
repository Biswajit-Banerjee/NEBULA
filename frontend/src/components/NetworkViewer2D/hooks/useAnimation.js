import { useState, useEffect, useRef } from 'react';

function useAnimation(currentGeneration, setCurrentGeneration, maxGeneration) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionSpeed, setTransitionSpeed] = useState(2); // Default 2 seconds
  const playIntervalRef = useRef(null);
  const transitionInProgressRef = useRef(false);

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
          // If we've reached the max, stop playing
          if (prev >= maxGeneration) {
            setIsPlaying(false);
            return prev;
          }
          
          // Only advance if we're not already in transition
          if (!transitionInProgressRef.current) {
            transitionInProgressRef.current = true;
            
            // Set a timeout to mark the transition as complete
            // This gives the simulation time to stabilize
            setTimeout(() => {
              transitionInProgressRef.current = false;
            }, Math.min(1000, transitionSpeed * 500)); // At least 50% of transition time
            
            return prev + 1;
          }
          return prev;
        });
      }, transitionSpeed * 1000); // Convert to milliseconds
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
      // Currently playing – pause
      setIsPlaying(false);
      return;
    }

    // About to start playing
    if (currentGeneration >= maxGeneration) {
      setCurrentGeneration(0);
    } else {
      // Immediate advance for instant feedback
      setCurrentGeneration((prev) => Math.min(prev + 1, maxGeneration));
    }

    // Reset transition flag and start the interval
    transitionInProgressRef.current = false;
    setIsPlaying(true);
  };

  const stepForward = () => {
    if (currentGeneration < maxGeneration) {
      // Set the transition flag to prevent rapid stepping
      transitionInProgressRef.current = true;
      
      setCurrentGeneration((prev) => prev + 1);
      
      // Clear the transition flag after a delay
      setTimeout(() => {
        transitionInProgressRef.current = false;
      }, 500); // Give simulation 500ms to adjust
    }
  };

  const stepBackward = () => {
    if (currentGeneration > 0) {
      // Set the transition flag to prevent rapid stepping
      transitionInProgressRef.current = true;
      
      setCurrentGeneration((prev) => prev - 1);
      
      // Clear the transition flag after a delay
      setTimeout(() => {
        transitionInProgressRef.current = false;
      }, 500); // Give simulation 500ms to adjust
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