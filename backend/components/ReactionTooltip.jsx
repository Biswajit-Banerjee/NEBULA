import React, { useState, useEffect } from 'react';

const reactionCache = new Map();

const ReactionTooltip = ({ equation }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extract reaction ID if present (improved regex)
  const match = equation ? equation.match(/R\d{5}/) : null;
  const reactionId = match ? match[0] : null;
  const isValidReactionId = Boolean(reactionId);

  useEffect(() => {
    if (!reactionId || !showTooltip) return;

    const fetchData = async () => {
      // Check cache first
      if (reactionCache.has(reactionId)) {
        setData(reactionCache.get(reactionId));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/reaction/${encodeURIComponent(reactionId)}`);
        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        // Cache the result using reactionId instead of equation
        reactionCache.set(reactionId, result.data);
        setData(result.data);
      } catch (err) {
        console.error('Error fetching reaction data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!data && !error) {
      fetchData();
    }
  }, [reactionId, showTooltip]);

  return (
    <div className="relative inline-block">
      <div
        className="text-sm text-gray-700 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {equation || 'No equation available'}
      </div>

      {showTooltip && (
        <div className="absolute z-50 w-96 p-4 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 -translate-x-1/2 left-1/2">
          {!isValidReactionId ? (
            <div className="text-gray-600">
              No KEGG reaction ID found in equation
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-red-500">Error loading reaction data</div>
          ) : data ? (
            <div className="space-y-3">
              <div className="font-medium border-b pb-2">
                <span className="text-gray-500 text-sm">Definition: </span>
                <span>{data.definition}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Equation: </span>
                <span className="font-mono">{data.equation}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ReactionTooltip;