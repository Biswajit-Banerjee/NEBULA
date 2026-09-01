import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../config/api';

// Cache for storing compound data (bounded to prevent memory leaks)
const compoundCache = new Map();
const MAX_CACHE_SIZE = 500;

const CompoundTooltip = ({ compoundId }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!compoundId || !showTooltip || data || error) return;

    const abortCtrl = new AbortController();

    const fetchData = async () => {
      // Return cached data if available
      if (compoundCache.has(compoundId)) {
        setData(compoundCache.get(compoundId));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(getApiUrl(`compound/${compoundId}`), { signal: abortCtrl.signal });
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        const result = await response.json();
        
        // Cache the result (evict if too large)
        if (compoundCache.size >= MAX_CACHE_SIZE) compoundCache.clear();
        compoundCache.set(compoundId, result.data);
        setData(result.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => abortCtrl.abort();
  }, [compoundId, showTooltip, data, error]);

  // Check if compound ID is valid KEGG format
  const isValidKeggId = /^C\d{5}$/.test(compoundId);

  return (
    <div className="relative inline-block">
      <a
        href={`https://www.genome.jp/entry/${compoundId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-sm ${isValidKeggId ? 'text-nfo hover:text-brand' : 'text-content-muted cursor-not-allowed'}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => !isValidKeggId && e.preventDefault()}
      >
        {compoundId}
      </a>

      {showTooltip && (
        <div className="absolute z-50 w-64 p-4 mt-2 bg-surface-overlay/95 rounded-lg shadow-xl border border-brd/70 transform -translate-x-1/2 left-1/2">
          {!isValidKeggId ? (
            <div className="text-content-muted">Compound not available in KEGG database</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand/70 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-err">Error loading compound data</div>
          ) : data ? (
            <div className="space-y-2">
              <div className="font-medium text-content">{data.name}</div>
              <div className="text-sm text-content-secondary">
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