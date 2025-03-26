import React, { useState } from 'react';
import { Plus, X, Search, ArrowRight, Eye, EyeOff, Download, Upload } from 'lucide-react';

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

  // Function to export CSV from frontend data
  const handleExportCSV = () => {
    if (!results || results.length === 0) return;
    
    try {
      // First collect all the session data we need to restore
      const sessionData = {
        searchPairs: searchPairs,
        results: results
      };
      
      // Create a blob with the session data in JSON format
      const sessionBlob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
      
      // Create and download the file
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
        
        // Try to parse as JSON first (for session files)
        try {
          const sessionData = JSON.parse(content);
          
          if (sessionData && sessionData.searchPairs && sessionData.results) {
            // We have a valid session file, restore the state
            setSearchPairs(sessionData.searchPairs);
            
            // Send the data to the parent component to restore the full session
            onSearch(sessionData.searchPairs, sessionData.results);
            
            // Reset file input value so the same file can be uploaded again if needed
            event.target.value = '';
            return;
          }
        } catch (jsonError) {
          // Not a valid JSON file, try to parse as CSV
          console.log("Not a JSON file, trying CSV format...");
        }
        
        // If we get here, it's not a JSON session file, try CSV
        // Split lines and handle different line endings
        const lines = content.split(/\r?\n/);
        
        if (lines.length < 2) {
          throw new Error('Invalid file format. Please upload a valid Nebula session file.');
        }
        
        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Parse data rows
        const parsedData = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines
          
          // CSV parsing with support for quoted values containing commas
          let values = [];
          let inQuote = false;
          let currentValue = '';
          
          for (let char of lines[i]) {
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
              values.push(currentValue);
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue); // Push the last value
          
          const rowData = {};
          
          headers.forEach((header, index) => {
            if (values[index] !== undefined) {
              if (header === 'compound_generation' && values[index].startsWith('{')) {
                // Try to parse compound_generation as JSON
                try {
                  rowData[header] = JSON.parse(values[index]);
                } catch (e) {
                  console.warn('Could not parse compound_generation JSON:', values[index]);
                  rowData[header] = {};
                }
              } else {
                rowData[header] = values[index];
              }
            }
          });
          
          parsedData.push(rowData);
        }
        
        // Process rows to properly assign pairIndices and colors
        const uniquePairs = new Map();
        parsedData.forEach(row => {
          const pairKey = `${row.source || ''}:${row.target || ''}`;
          
          if (!uniquePairs.has(pairKey) && row.target) {
            const pairIndex = uniquePairs.size;
            const color = getRandomColor();
            
            uniquePairs.set(pairKey, {
              index: pairIndex,
              source: row.source || '',
              target: row.target || '',
              color: color,
              visible: true,
              hasResults: true
            });
            
            // Update row with correct pairIndex and color
            row.pairIndex = pairIndex;
            row.pairColor = color;
          } else if (uniquePairs.has(pairKey)) {
            // Use existing pair data for this row
            const pair = uniquePairs.get(pairKey);
            row.pairIndex = pair.index;
            row.pairColor = pair.color;
          }
        });
        
        const detectedPairs = Array.from(uniquePairs.values());
        
        // Update the application state
        if (detectedPairs.length > 0) {
          setSearchPairs(detectedPairs.map(({ index, ...pairData }) => pairData));
        }
        
        // Send the data to the parent component
        onSearch(detectedPairs.map(({ index, ...pairData }) => pairData), parsedData);
        
      } catch (error) {
        console.error('Error parsing uploaded file:', error);
        alert('Failed to parse the uploaded file. Please ensure it is a valid Nebula session file.');
      }
      
      // Reset file input value so the same file can be uploaded again if needed
      event.target.value = '';
    };
    
    reader.readAsText(file);
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
        
        <div className="flex flex-1 gap-3 justify-end">
          {/* Upload CSV button */}
          <label
            className="flex-none px-4 py-2.5 border border-blue-200 bg-blue-50 rounded-xl text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
            disabled={isLoading}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Session</span>
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleUploadCSV}
              className="hidden"
              disabled={isLoading}
            />
          </label>
          
          {/* Export CSV button */}
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
          
          {/* Search button - now smaller */}
          <button
            onClick={handleSearch}
            className="flex-none w-36 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            disabled={isLoading}
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