import React, { useState, useEffect } from 'react';

// Cache for storing compound data
const compoundCache = new Map();

const CompoundTooltip = ({ compoundId }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!compoundId) return;

    const fetchData = async () => {
      // Return cached data if available
      if (compoundCache.has(compoundId)) {
        setData(compoundCache.get(compoundId));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/compound/${compoundId}`);
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        const result = await response.json();
        
        // Cache the result
        compoundCache.set(compoundId, result.data);
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (showTooltip && !data && !error) {
      fetchData();
    }
  }, [compoundId, showTooltip]);

  // Check if compound ID is valid KEGG format
  const isValidKeggId = /^C\d{5}$/.test(compoundId);

  return (
    <div className="relative inline-block">
      <a
        href={`https://www.genome.jp/entry/${compoundId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-sm ${isValidKeggId ? 'text-blue-500 dark:text-blue-400/80 hover:text-blue-600 dark:hover:text-blue-300' : 'text-gray-500 dark:text-slate-400 cursor-not-allowed'}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => !isValidKeggId && e.preventDefault()}
      >
        {compoundId}
      </a>

      {showTooltip && (
        <div className="absolute z-50 w-64 p-4 mt-2 bg-white/95 dark:bg-slate-800/95 rounded-lg shadow-xl border border-gray-200/70 dark:border-slate-600/40 transform -translate-x-1/2 left-1/2">
          {!isValidKeggId ? (
            <div className="text-gray-500 dark:text-slate-400">Compound not available in KEGG database</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 dark:border-blue-400/70 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 dark:text-red-400/80">Error loading compound data</div>
          ) : data ? (
            <div className="space-y-2">
              <div className="font-medium dark:text-slate-200">{data.name}</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">
                <div>Formula: {data.formula}</div>
                <div>Exact Mass: {data.exact_mass}</div>
                <div>Molecular Weight: {data.mol_weight}</div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CompoundTooltip;