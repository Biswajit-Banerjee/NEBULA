import { useState, useEffect } from 'react';

function useGraphData(results) {
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  // Extract max generation and process data
  useEffect(() => {
    if (!results || results.length === 0) return;

    let highestGen = 0;

    // Find the highest generation
    results.forEach((item) => {
      if (item.compound_generation) {
        Object.values(item.compound_generation).forEach((gen) => {
          highestGen = Math.max(highestGen, parseInt(gen));
        });
      }
    });

    setMaxGeneration(highestGen);
    setGraphData(results);
  }, [results]);

  return {
    graphData,
    currentGeneration,
    setCurrentGeneration,
    maxGeneration
  };
}

export default useGraphData;