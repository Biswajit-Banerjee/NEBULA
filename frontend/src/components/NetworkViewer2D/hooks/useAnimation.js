import { useState, useEffect, useRef } from 'react';

function useAnimation(currentGeneration, setCurrentGeneration, maxGeneration) {
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentGeneration((prev) => {
          if (prev >= maxGeneration) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // Animation speed (1.5 seconds per step)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, maxGeneration, setCurrentGeneration]);

  const togglePlay = () => {
    if (currentGeneration >= maxGeneration && !isPlaying) {
      setCurrentGeneration(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const stepForward = () => {
    if (currentGeneration < maxGeneration) {
      setCurrentGeneration((prev) => prev + 1);
    }
  };

  const stepBackward = () => {
    if (currentGeneration > 0) {
      setCurrentGeneration((prev) => prev - 1);
    }
  };

  return {
    isPlaying,
    togglePlay,
    stepForward,
    stepBackward
  };
}

export default useAnimation;