import { useState, useEffect, useMemo } from 'react';

function useGraphData(results) {
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [minGeneration, setMinGeneration] = useState(0);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

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
    setMinGeneration(effectiveMin);
    setMaxGeneration(highestGen);
    setCurrentGeneration(effectiveMin);
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