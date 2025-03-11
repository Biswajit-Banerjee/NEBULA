import React, { useState } from 'react';
import { Plus, X, Search, ArrowRight, Eye, EyeOff } from 'lucide-react';

// Colors that are distinct and visually pleasing (moved outside component)
const COLORS = [
  '#34D399', // emerald-400
  '#60A5FA', // blue-400
  '#F472B6', // pink-400
  '#FBBF24', // amber-400
  '#A78BFA', // violet-400
  '#4ADE80', // green-400
  '#F87171', // red-400
  '#38BDF8', // sky-400
  '#FB923C', // orange-400
  '#818CF8', // indigo-400
];

// Helper function to get random color (moved outside component)
function getRandomColor(lastColor = null) {
  let newColor;  
  do {
    newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  } while (newColor === lastColor && COLORS.length > 1);
  
  return newColor;
}

const SearchPair = ({ index, pair, onChange, onRemove, onToggleVisibility, disabled }) => {
  return (
    <div className="relative flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md animate-fade-in">
      {/* Color indicator */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl transition-colors" 
        style={{ backgroundColor: pair.color }}
      />
      
      {/* Source field */}
      <div className="flex-1">
        <label htmlFor={`source-${index}`} className="block text-xs font-medium text-slate-500 mb-1">
          Source (optional)
        </label>
        <input
          id={`source-${index}`}
          type="text"
          placeholder="Any source"
          value={pair.source}
          onChange={(e) => onChange(index, { ...pair, source: e.target.value })}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow text-sm"
          disabled={disabled}
        />
      </div>
      
      {/* Direction indicator */}
      <div className="flex-none">
        <ArrowRight className="w-5 h-5 text-slate-400" />
      </div>
      
      {/* Target field */}
      <div className="flex-1">
        <label htmlFor={`target-${index}`} className="block text-xs font-medium text-slate-500 mb-1">
          Target (required)
        </label>
        <input
          id={`target-${index}`}
          type="text"
          placeholder="Target compound"
          value={pair.target}
          onChange={(e) => onChange(index, { ...pair, target: e.target.value })}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow text-sm"
          disabled={disabled}
        />
      </div>

      {/* Visibility toggle - only appears after search */}
      {pair.hasResults && (
        <button
          onClick={() => onToggleVisibility(index)}
          className={`flex-none p-2 rounded-lg transition-colors ${
            pair.visible 
              ? 'text-blue-600 hover:bg-blue-50' 
              : 'text-slate-400 hover:bg-slate-50'
          }`}
          title={pair.visible ? "Hide results" : "Show results"}
          disabled={disabled}
        >
          {pair.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      )}
      
      {/* Remove button - only show for non-first pairs */}
      {index > 0 && (
        <button
          onClick={() => onRemove(index)}
          className="flex-none p-2 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-50 transition-colors"
          disabled={disabled}
          aria-label="Remove search pair"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

const SearchPanel = ({ onSearch, isLoading, onToggleVisibility, activeFilters, searchPairs: externalPairs = null, setSearchPairs: setExternalPairs = null, combinedMode, toggleCombinedMode }) => {
  // Use internal state if no external state is provided
  const [internalPairs, setInternalPairs] = useState([
    { source: '', target: '', color: getRandomColor(), visible: true }
  ]);
  
  // Use either external or internal state
  const searchPairs = externalPairs || internalPairs;
  const setSearchPairs = setExternalPairs || setInternalPairs;

  const addSearchPair = () => {
    // Get the last color to avoid repetition
    const lastColor = searchPairs.length > 0 
      ? searchPairs[searchPairs.length - 1].color 
      : null;
      
    setSearchPairs([
      ...searchPairs, 
      { source: '', target: '', color: getRandomColor(lastColor), visible: true }
    ]);
  };

  const updateSearchPair = (index, updatedPair) => {
    const newPairs = [...searchPairs];
    newPairs[index] = updatedPair;
    setSearchPairs(newPairs);
  };

  const removeSearchPair = (index) => {
    const newPairs = [...searchPairs];
    newPairs.splice(index, 1);
    setSearchPairs(newPairs);
  };

  const handleSearch = () => {
    // Validate that at least one pair has a target
    const validPairs = searchPairs.filter(pair => pair.target.trim() !== '');
    if (validPairs.length === 0) {
      alert('Please enter at least one target compound ID');
      return;
    }
    
    onSearch(validPairs);
  };

  return (
    <div className="w-full max-w-5xl mb-2">
      <div className="space-y-3 mb-4">
        {searchPairs.map((pair, index) => (
          <SearchPair
            key={index}
            index={index}
            pair={pair}
            onChange={updateSearchPair}
            onRemove={removeSearchPair}
            onToggleVisibility={onToggleVisibility}
            disabled={isLoading}
          />
        ))}
      </div>
      
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={addSearchPair}
          className="flex-none px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4" />
          <span>Add Path</span>
        </button>
        
        {externalPairs && externalPairs.some(p => p.hasResults) && (
          <button
            onClick={toggleCombinedMode}
            className={`flex-none px-4 py-2.5 border rounded-xl transition-colors flex items-center gap-2 shadow-sm ${
              combinedMode 
                ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' 
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 16h.01" />
              <path d="M10 16h8" />
            </svg>
            <span>Combine Results</span>
          </button>
        )}
        
        <div className="flex-1">
          <button
            onClick={handleSearch}
            className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Explore Network</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;