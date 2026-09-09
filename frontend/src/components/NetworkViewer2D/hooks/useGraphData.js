import { useState, useEffect, useMemo, useRef } from 'react';

function useGraphData(results) {
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [minGeneration, setMinGeneration] = useState(0);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  // Track data identity to distinguish new searches from re-filters (cofactor toggle)
  const dataIdRef = useRef(null);

  // Extract min/max generation and process data
  useEffect(() => {
    if (!results || results.length === 0) return;

    let highestGen = 0;
    let lowestGen = Infinity;

    // Find the highest and lowest generation
    results.forEach((item) => {
      if (item.compound_generation) {
        Object.values(item.compound_generation).forEach((gen) => {
          const g = parseInt(gen);
          highestGen = Math.max(highestGen, g);
          lowestGen = Math.min(lowestGen, g);
        });
      }
    });

    const effectiveMin = Math.max(0, lowestGen === Infinity ? 0 : lowestGen);

    // Compute a simple identity based on unique reactions to detect genuinely new data
    const newId = results.map(r => r.reaction || '').sort().join(',');
    const isNewData = newId !== dataIdRef.current;
    dataIdRef.current = newId;

    setMinGeneration(effectiveMin);
    setMaxGeneration(highestGen);
    // Only reset generation for genuinely new search data, not re-filters
    if (isNewData) {
      setCurrentGeneration(effectiveMin);
    } else {
      // Clamp current generation to new bounds
      setCurrentGeneration(prev => Math.min(Math.max(prev, effectiveMin), highestGen));
    }
    setGraphData(results);
  }, [results]);

  // Compute sorted array of generations that actually have compounds
  const populatedGens = useMemo(() => {
    if (!results || !Array.isArray(results) || results.length === 0) return [0];
    const genSet = new Set();
    results.forEach((item) => {
      if (item.compound_generation) {
        Object.values(item.compound_generation).forEach((gen) => {
          genSet.add(parseInt(gen));
        });
      }
    });
    const sorted = [...genSet].sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [0];
  }, [results]);

  return {
    graphData,
    currentGeneration,
    setCurrentGeneration,
    maxGeneration,
    minGeneration,
    populatedGens
  };
}

export default useGraphData;