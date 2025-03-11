import React, { useState, useMemo } from "react";
import { Filter, Download } from "lucide-react";
import Logo from "./components/Logo";
import FilterMenu from "./components/FilterMenu";
import TabView from "./components/TabView";
import SearchPanel from "./components/SearchPanel";

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [searchPairs, setSearchPairs] = useState([
    { source: '', target: '', color: '#60A5FA', visible: true }
  ]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [combinedMode, setCombinedMode] = useState(false);

  const handleMultiSearch = async (searchPairsInput) => {
    if (searchPairsInput.length === 0) {
      setError("Please enter at least one target compound ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSelectedRows(new Set()); // Clear selections when new search starts
      
      // Store all results with their corresponding pair info
      let allResults = [];
      let pairIndex = 0;
      
      // Create new search pairs with results info
      const updatedPairs = [...searchPairsInput];
      
      // Process each pair sequentially to avoid overwhelming the API
      for (const pair of searchPairsInput) {
        if (!pair.target.trim()) continue;
        
        const queryParams = new URLSearchParams();
        queryParams.append('target', pair.target.trim());
        
        if (pair.source.trim()) {
          queryParams.append('source', pair.source.trim());
        }
        
        const response = await fetch(`/api/backtrace?${queryParams.toString()}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        // Add pair info and color to each result
        if (data.data && data.data.length > 0) {
          // Update search pair with results info
          updatedPairs[pairIndex] = { 
            ...updatedPairs[pairIndex], 
            hasResults: true, 
            visible: true, 
            resultCount: data.data.length 
          };
          
          const pairResults = data.data.map(item => ({
            ...item,
            pairIndex,
            pairSource: pair.source.trim() || 'any',
            pairTarget: pair.target.trim(),
            pairColor: pair.color
          }));
          
          allResults = [...allResults, ...pairResults];
          pairIndex++;
        } else {
          updatedPairs[pairIndex] = { 
            ...updatedPairs[pairIndex], 
            hasResults: false, 
            visible: true, 
            resultCount: 0 
          };
        }
      }
      
      // Update search pairs with results info
      setSearchPairs(updatedPairs);
      
      // Set the combined results
      setResults(allResults);
    } catch (error) {
      setError(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch("/api/download/csv");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nebula-results.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError("Failed to download results");
    }
  };

  const handleToggleVisibility = (pairIndex) => {
    const updatedPairs = [...searchPairs];
    updatedPairs[pairIndex].visible = !updatedPairs[pairIndex].visible;
    setSearchPairs(updatedPairs);
  };
  
  const toggleCombinedMode = () => {
    setCombinedMode(!combinedMode);
  };

  // Filter results based on visible pairs
  const filteredResults = useMemo(() => {
    if (!results) return null;
    
    // Get indices of visible pairs
    const visiblePairIndices = searchPairs
      .map((pair, index) => pair.visible ? index : null)
      .filter(index => index !== null);
    
    // Filter results by visible pairs
    return results.filter(result => visiblePairIndices.includes(result.pairIndex));
  }, [results, searchPairs]);
  
  // Process results for combined mode
  const processedResults = useMemo(() => {
    if (!filteredResults) return null;
    
    if (!combinedMode) {
      // In normal mode, just return filtered results
      return filteredResults;
    }
    
    // In combined mode, group by unique rows and combine pair colors
    const uniqueRows = {};
    const combinedResults = [];
    
    filteredResults.forEach(result => {
      // Create a key that uniquely identifies this row (excluding pair info)
      const key = `${result.reaction}-${result.source}-${result.target}-${result.equation}`;
      
      if (!uniqueRows[key]) {
        // First time seeing this row, initialize it
        uniqueRows[key] = {
          ...result,
          pairColors: [result.pairColor],
          pairIndices: [result.pairIndex]
        };
        combinedResults.push(uniqueRows[key]);
      } else {
        // Row already exists, add this pair's color if not already present
        if (!uniqueRows[key].pairColors.includes(result.pairColor)) {
          uniqueRows[key].pairColors.push(result.pairColor);
        }
        if (!uniqueRows[key].pairIndices.includes(result.pairIndex)) {
          uniqueRows[key].pairIndices.push(result.pairIndex);
        }
      }
    });
    
    return combinedResults;
  }, [filteredResults, combinedMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800">
      {/* Header & Search Section */}
      <div className="pt-8 pb-6 px-6 sm:px-10 md:px-16 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          {/* Logo and Title */}
          <div className="flex items-center gap-4 mb-8">
            <Logo />
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                NEBULA
              </h1>
              <p className="text-slate-600 font-medium mt-1">
                Metabolic Network Explorer
              </p>
            </div>
          </div>

          {/* Search Panel */}
          <div className="flex flex-col md:items-center">
            <SearchPanel 
              onSearch={handleMultiSearch} 
              isLoading={loading}
              onToggleVisibility={handleToggleVisibility}
              searchPairs={searchPairs}
              setSearchPairs={setSearchPairs}
              combinedMode={combinedMode}
              toggleCombinedMode={toggleCombinedMode}
            />
            
            {results && (
              <div className="w-full max-w-5xl mt-2 flex justify-end">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-pulse">
          <div className="animate-bounce w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
          <p className="text-lg text-slate-600 font-medium">
            Processing your request...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="max-w-4xl mx-auto mb-8 p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-4 animate-fade-in">
          <svg
            className="w-6 h-6 mt-1 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium mb-1">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {results && (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 relative animate-fade-in mb-12">
          {/* Filter Menu */}
          {isFilterOpen && (
            <div className="absolute right-6 top-0 mt-2 z-50">
              <FilterMenu
                results={processedResults}
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
                onClose={() => setIsFilterOpen(false)}
              />
            </div>
          )}

          {/* Results Header */}
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              Results
              <span className="ml-3 text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {processedResults?.length || 0} items
              </span>
            </h2>
            
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isFilterOpen
                  ? "bg-blue-100 text-blue-700"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter</span>
            </button>
          </div>

          {/* Tab View with Table and Network visualization */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <TabView
              results={processedResults}
              setResults={setResults}
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
              combinedMode={combinedMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;