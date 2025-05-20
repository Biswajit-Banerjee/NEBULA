import React, { useState, useEffect } from 'react';
import { Plus, X, Search, ArrowRight, Eye, EyeOff, Download, Upload } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import compoundDataJson from './compound_map.json';

// Helper function to get random pastel color 
const getRandomColor = (lastColor = null) => {
  let newColor;
  do {
    // mix each channel with white (255) to get a pastel tone
    const r = Math.floor((Math.random() * 256 + 255) / 2);
    const g = Math.floor((Math.random() * 256 + 255) / 2);
    const b = Math.floor((Math.random() * 256 + 255) / 2);
    // convert to hex and pad to two digits
    newColor = `#${r.toString(16).padStart(2, '0')}`
             + `${g.toString(16).padStart(2, '0')}`
             + `${b.toString(16).padStart(2, '0')}`;
  } while (newColor === lastColor);
  return newColor;
};

const SearchPair = ({ index, pair, onChange, onRemove, onToggleVisibility, disabled, compoundData }) => {
  return (
    <div className="relative flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md animate-fade-in">
      <div
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl transition-colors"
        style={{ backgroundColor: pair.color }}
      />

      <AutocompleteInput
        idPrefix={`source-${index}`}
        label="Source (optional)"
        placeholder="Any source (name or ID)"
        value={pair.source} // This should be the compound_id
        onValueSelect={(compoundId) => onChange(index, { ...pair, source: compoundId })}
        compoundData={compoundData}
        disabled={disabled}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow text-sm"
      />

      <div className="flex-none">
        <ArrowRight className="w-5 h-5 text-slate-400" />
      </div>

      <AutocompleteInput
        idPrefix={`target-${index}`}
        label="Target (required)"
        placeholder="Target compound (name or ID)"
        value={pair.target} // This should be the compound_id
        onValueSelect={(compoundId) => onChange(index, { ...pair, target: compoundId })}
        compoundData={compoundData}
        disabled={disabled}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow text-sm"
      />

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

const SearchPanel = ({ 
  onSearch, 
  isLoading, 
  onToggleVisibility, 
  activeFilters, 
  searchPairs: externalPairs = null, 
  setSearchPairs: setExternalPairs = null, 
  combinedMode, 
  toggleCombinedMode,
  results
}) => {
  // Use internal state if no external state is provided
  const [internalPairs, setInternalPairs] = useState([
    { source: '', target: '', color: getRandomColor(), visible: true }
  ]);
  
  // Use either external or internal state
  const searchPairs = externalPairs || internalPairs;
  const setSearchPairs = setExternalPairs || setInternalPairs;

  const [compoundData, setCompoundData] = useState([]);

  useEffect(() => {
    setCompoundData(compoundDataJson);
  }, []);

  const addSearchPair = () => {
    const lastColor = searchPairs.length > 0
      ? searchPairs[searchPairs.length - 1].color
      : null;
    setSearchPairs([
      ...searchPairs,
      { source: '', target: '', color: getRandomColor(lastColor), visible: true, hasResults: false }
    ]);
  };

  const updateSearchPair = (index, updatedPair) => {
    const newPairs = [...searchPairs];
    // When a selection is made, AutocompleteInput returns the compound_id.
    // The name display is handled within AutocompleteInput itself.
    // So, updatedPair.source and updatedPair.target will be compound_ids.
    newPairs[index] = { ...newPairs[index], ...updatedPair, hasResults: false }; // Reset hasResults on change
    setSearchPairs(newPairs);
  };

  const removeSearchPair = (index) => {
    const newPairs = [...searchPairs];
    newPairs.splice(index, 1);
    setSearchPairs(newPairs);
  };

  const handleSearch = () => {
    // Validate that at least one pair has a target compound_id
    const validPairs = searchPairs.filter(pair => pair.target && pair.target.trim() !== '');
    if (validPairs.length === 0) {
      alert('Please enter at least one target compound ID');
      return;
    }
    // onSearch expects pairs with source/target as compound_ids
    onSearch(validPairs);
  };

  // Function to export CSV from frontend data
  const handleExportCSV = () => {
    if (!results || results.length === 0) return;
    try {
      const sessionData = {
        // Ensure searchPairs saved have IDs, not names, if they were resolved
        searchPairs: searchPairs.map(pair => ({
            ...pair,
            // source and target are already IDs from AutocompleteInput
        })),
        results: results
      };
      const sessionBlob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
      const sessionUrl = URL.createObjectURL(sessionBlob);
      const sessionLink = document.createElement('a');
      sessionLink.setAttribute('href', sessionUrl);
      sessionLink.setAttribute('download', 'nebula-session.json');
      document.body.appendChild(sessionLink);
      sessionLink.click();
      document.body.removeChild(sessionLink);
      URL.revokeObjectURL(sessionUrl);
    } catch (error) {
      console.error('Error exporting session data:', error);
      alert('Failed to export session data');
    }
  };

  // Function to handle session upload
  const handleUploadCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let sessionRestored = false;

        // Try to parse as JSON first (for session files)
        try {
          const sessionData = JSON.parse(content);
          if (sessionData && sessionData.searchPairs && sessionData.results) {
            // Restore search pairs making sure they have all necessary fields
            const restoredPairs = sessionData.searchPairs.map(p => ({
                source: p.source || '', // compound_id
                target: p.target || '', // compound_id
                color: p.color || getRandomColor(),
                visible: p.visible !== undefined ? p.visible : true,
                hasResults: p.hasResults !== undefined ? p.hasResults : true // Assume results if restoring
            }));
            setSearchPairs(restoredPairs);
            onSearch(restoredPairs, sessionData.results); // Pass results to parent
            sessionRestored = true;
          }
        } catch (jsonError) {
          console.log("Not a JSON session file, trying CSV format...");
        }

        if (sessionRestored) {
          event.target.value = '';
          return;
        }

        // If we get here, it's not a JSON session file, or JSON parsing failed for session structure
        // Attempt to parse as CSV (legacy or other format)
        const lines = content.split(/\r?\n/);
        if (lines.length < 1) { // Allow empty CSV or just headers
          throw new Error('Invalid file format. Please upload a valid Nebula session file or CSV.');
        }

        // For CSV, we'd need a more complex logic to map CSV rows back to search pairs
        // if the CSV doesn't directly map to compound_ids for source/target.
        // The current CSV parsing logic seems to create `parsedData` which might be `results`.
        // And then it tries to infer `searchPairs` from this `parsedData`.

        // The original CSV parsing logic to create `searchPairs` from `results` data:
        const headers = lines[0].split(',').map(h => h.trim());
        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          let values = [];
          let inQuote = false;
          let currentValue = '';
          for (let char of lines[i]) {
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) { values.push(currentValue); currentValue = ''; }
            else currentValue += char;
          }
          values.push(currentValue);
          const rowData = {};
          headers.forEach((header, index) => {
            if (values[index] !== undefined) {
              if (header === 'compound_generation' && values[index].startsWith('{')) {
                try { rowData[header] = JSON.parse(values[index]); }
                catch (e) { rowData[header] = {}; }
              } else { rowData[header] = values[index]; }
            }
          });
          parsedData.push(rowData);
        }

        if (parsedData.length === 0 && lines.length > 1) {
             alert('CSV parsing resulted in no data. Check file format.');
             event.target.value = '';
             return;
        }


        // Process rows to properly assign pairIndices and colors from parsedData
        // This logic assumes 'source' and 'target' in CSV rows are compound_ids or can be resolved.
        // If they are names, you'd need to resolve them to IDs using `compoundData`.
        const uniquePairsMap = new Map();
        parsedData.forEach(row => {
            // Assuming row.source and row.target from CSV are compound IDs or names
            // For this integration, they should ideally be IDs. If they are names,
            // you'd need a lookup function here.
            const sourceId = row.source || ''; // Assume it's an ID for now
            const targetId = row.target || ''; // Assume it's an ID

            if (targetId) { // Only create a pair if there's a target
                const pairKey = `${sourceId}:${targetId}`;
                if (!uniquePairsMap.has(pairKey)) {
                    uniquePairsMap.set(pairKey, {
                        source: sourceId,
                        target: targetId,
                        color: getRandomColor(uniquePairsMap.size > 0 ? Array.from(uniquePairsMap.values()).pop().color : null),
                        visible: true,
                        hasResults: true // Assume results if data is present
                    });
                }
            }
        });

        const detectedPairs = Array.from(uniquePairsMap.values());

        if (detectedPairs.length > 0) {
          setSearchPairs(detectedPairs);
          // The onSearch function should handle how to process these pairs and potentially the parsedData as results.
          onSearch(detectedPairs, parsedData); // Pass detected pairs and the full parsed CSV data as results
        } else if (parsedData.length > 0) {
            // No specific pairs detected, but there's data.
            // This might happen if CSV is just a list of results without clear source/target for pairing.
            // Decide how to handle this: maybe treat as a single "all results" view?
            // For now, we'll just call onSearch with empty pairs and the results.
            onSearch([], parsedData);
            alert("CSV data loaded. Could not determine distinct search pairs from CSV structure. Displaying all results.");
        } else {
            alert('No valid search pairs or data could be extracted from the CSV.');
        }

      } catch (error) {
        console.error('Error parsing uploaded file:', error);
        alert(`Failed to parse the uploaded file: ${error.message}. Please ensure it is a valid Nebula session JSON or a supported CSV format.`);
      } finally {
        event.target.value = ''; // Reset file input
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-5xl mb-2">
      <div className="space-y-3 mb-4">
        {searchPairs.map((pair, index) => (
          <SearchPair
            key={index} // Consider using a more stable key if pairs can be reordered significantly
            index={index}
            pair={pair}
            onChange={updateSearchPair}
            onRemove={removeSearchPair}
            onToggleVisibility={onToggleVisibility}
            disabled={isLoading || compoundData.length === 0} // Disable if compound data not loaded
            compoundData={compoundData}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={addSearchPair}
          className="flex-none px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          disabled={isLoading || compoundData.length === 0}
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
            {/* SVG for Combine Results */}
            <span>Combine Results</span>
          </button>
        )}

        <div className="flex flex-1 gap-3 justify-end">
          <label
            className={`flex-none px-4 py-2.5 border rounded-xl transition-colors flex items-center gap-2 shadow-sm cursor-pointer ${isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Session</span>
            <input
              type="file"
              accept=".json,.csv" // Accept both JSON (session) and CSV
              onChange={handleUploadCSV}
              className="hidden"
              disabled={isLoading}
            />
          </label>

          {results && results.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex-none px-4 py-2.5 border border-emerald-200 bg-emerald-50 rounded-xl text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-2 shadow-sm"
              disabled={isLoading}
            >
              <Download className="w-4 h-4" />
              <span>Export Session</span>
            </button>
          )}

          <button
            onClick={handleSearch}
            className="flex-none w-36 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            disabled={isLoading || compoundData.length === 0 || searchPairs.every(p => !p.target)}
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Explore</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;