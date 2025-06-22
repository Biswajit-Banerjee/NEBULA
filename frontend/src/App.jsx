import React, { useState, useMemo, useCallback, useEffect } from "react";
import { 
    ChevronDown, ChevronUp, Sparkles, 
    FlaskConical as FlaskConicalLucide, Hexagon as HexagonLucide, Zap 
} from "lucide-react"; 

import Logo from "./components/Logo"; 
import TabView from "./components/TabView";
import SearchPanel from "./components/SearchPanel";

const GRADIENT_COLORS_PALETTE = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500', 
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-600',
  'from-green-500 to-emerald-600', 'from-yellow-500 to-amber-500',
  'from-red-500 to-rose-600', 'from-purple-500 to-violet-600'
];
const SOLID_COLORS_PALETTE_APP = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#059669', '#D97706', '#DC2626', '#7C3AED'];

function getSolidColorForPairByIndexApp(index) {
  return SOLID_COLORS_PALETTE_APP[index % SOLID_COLORS_PALETTE_APP.length];
}

// Consistent button sizing (example, adjust as needed) - also used in SearchPanel
const textButtonClassesApp = "px-4 py-2 text-xs sm:text-sm font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"; // Slightly smaller for app-level general buttons

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  
  const initialPairId = `init-${Date.now()}`;
  const [searchPairs, setSearchPairs] = useState([
    { id: initialPairId, source: '', target: '', color: getSolidColorForPairByIndexApp(0), visible: true, sourceDisplay:'', targetDisplay:'' }
  ]);

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [combinedMode, setCombinedMode] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const ensureIdAndColorForPair = useCallback((pair, index) => {
    return {
      ...pair,
      id: pair.id || `pair-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
      color: pair.color || getSolidColorForPairByIndexApp(index),
      sourceDisplay: pair.sourceDisplay || '',
      targetDisplay: pair.targetDisplay || '',
      visible: pair.visible !== undefined ? pair.visible : true,
    };
  }, []);
  
  const handleSetSearchPairs = useCallback((newPairsOrFn) => {
    const process = (pairs) => {
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return [ensureIdAndColorForPair({ source: '', target: '', visible: true }, 0)];
      }
      return pairs.map((p, idx) => ensureIdAndColorForPair(p, idx));
    };

    if (typeof newPairsOrFn === 'function') {
      setSearchPairs(currentPairs => process(newPairsOrFn(currentPairs)));
    } else {
      setSearchPairs(process(newPairsOrFn));
    }
  }, [ensureIdAndColorForPair]);

  useEffect(() => {
    handleSetSearchPairs(currentPairs => [...currentPairs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleMultiSearch = async (pairsFromPanel, importedData = null) => {
    setLoading(true);
    setError(null);
    setSelectedRows(new Set());
    
    const processedPairsInput = pairsFromPanel.map((p, idx) => ensureIdAndColorForPair(p, idx));
    
    if (!importedData) {
        handleSetSearchPairs(processedPairsInput);
    }

    if (importedData) {
      try {
        const updatedPairsWithResults = processedPairsInput.map(pair => ({
          ...pair,
          hasResults: importedData.some(res => {
            const resPairSource = res.pairSource === 'any' ? '' : (res.pairSource || '');
            const pairSource = pair.source || '';
            return res.pairTarget === pair.target && resPairSource === pairSource;
          }),
          resultCount: importedData.filter(res => {
            const resPairSource = res.pairSource === 'any' ? '' : (res.pairSource || '');
            const pairSource = pair.source || '';
            return res.pairTarget === pair.target && resPairSource === pairSource;
          }).length,
        }));
        handleSetSearchPairs(updatedPairsWithResults);
        setResults(importedData);
      } catch (e) {
        setError(e.message || "Error processing imported data");
      } finally {
        setLoading(false);
      }
      return;
    }

    const validPairsForAPI = processedPairsInput.filter(p => p.target && p.target.trim());

    if (validPairsForAPI.length === 0) {
      setError("Please enter at least one target compound ID in a query.");
      setLoading(false);
      setResults(null);
      handleSetSearchPairs(prev => prev.map(p => ({ ...p, hasResults: false, resultCount: 0 })));
      return;
    }

    try {
      let allResults = [];
      let workingPairs = [...processedPairsInput]; 

      for (let i = 0; i < workingPairs.length; i++) {
        const pair = workingPairs[i];
        if (!pair.target || !pair.target.trim()) {
          workingPairs[i] = { ...pair, hasResults: false, resultCount: 0 };
          continue;
        }

        const queryParams = new URLSearchParams();
        queryParams.append('target', pair.target.trim());
        if (pair.source && pair.source.trim()) {
          queryParams.append('source', pair.source.trim());
        }

        const response = await fetch(`/api/backtrace?${queryParams.toString()}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: `Request failed: ${response.status}`}));
            throw new Error(errorData.error || `API error for ${pair.target}`);
        }
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        if (data.data && data.data.length > 0) {
          workingPairs[i] = { ...pair, hasResults: true, resultCount: data.data.length };
          const pairResults = data.data.map(item => ({
            ...item,
            pairIndex: i, 
            pairSource: pair.source.trim() || 'any',
            pairTarget: pair.target.trim(),
            pairColor: pair.color 
          }));
          allResults = [...allResults, ...pairResults];
        } else {
          workingPairs[i] = { ...pair, hasResults: false, resultCount: 0 };
        }
      }
      handleSetSearchPairs(workingPairs); 
      setResults(allResults.length > 0 ? allResults : []);
    } catch (errorMsg) {
      setError(errorMsg.message || "An error occurred during search");
      setResults(null);
      handleSetSearchPairs(prev => prev.map(p => ({ ...p, hasResults: false, resultCount: 0 })));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = useCallback((pairIndex) => {
    handleSetSearchPairs(prevPairs =>
      prevPairs.map((pair, index) =>
        index === pairIndex ? { ...pair, visible: !pair.visible } : pair
      )
    );
  }, [handleSetSearchPairs]);

  const toggleCombinedMode = useCallback(() => {
    setCombinedMode(prev => !prev);
  }, []);

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const visiblePairIndices = searchPairs
      .map((pair, index) => pair.visible ? index : -1)
      .filter(index => index !== -1);
    return results.filter(result => result.pairIndex !== undefined && visiblePairIndices.includes(result.pairIndex));
  }, [results, searchPairs]);

  const processedResults = useMemo(() => {
    if (!filteredResults) return null;
    if (!combinedMode) return filteredResults;
    const uniqueRows = {}; const combined = [];
    filteredResults.forEach(result => {
      const key = `${result.reaction}-${result.source}-${result.target}-${result.equation}`;
      if (!uniqueRows[key]) {
        uniqueRows[key] = { ...result, pairColors: [result.pairColor].filter(Boolean), pairIndices: [result.pairIndex].filter(idx => idx !== undefined) };
        combined.push(uniqueRows[key]);
      } else {
        if (result.pairColor && !uniqueRows[key].pairColors.includes(result.pairColor)) uniqueRows[key].pairColors.push(result.pairColor);
        if (result.pairIndex !== undefined && !uniqueRows[key].pairIndices.includes(result.pairIndex)) uniqueRows[key].pairIndices.push(result.pairIndex);
      }
    });
    return combined;
  }, [filteredResults, combinedMode]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 text-slate-800 dark:text-slate-200 flex flex-col relative overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-violet-200/30 to-purple-200/30 dark:from-violet-800/30 dark:to-purple-800/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-200/30 to-cyan-200/30 dark:from-blue-800/30 dark:to-cyan-800/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <header className={`sticky top-0 z-40 transition-all duration-300 ease-in-out`}>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-700/50 shadow-sm">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-3">
                        <Logo /> 
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
                                NEBULA
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block"> 
                                Metabolic Network Explorer
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-300 shadow-sm hover:shadow-md border border-slate-200/50 dark:border-slate-600/50"
                        title={isHeaderCollapsed ? "Expand Search Panel" : "Collapse Search Panel"}
                    >
                        {isHeaderCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Collapsible Content - Max height fix */}
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden ${
                isHeaderCollapsed ? 'max-h-0 opacity-0 invisible' : 'max-h-[85vh] opacity-100 visible' // Using 85vh, adjust as needed
              }`}
            >
              <div className="pt-4 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                  {/* Removed "Pathway Discovery Engine" title and Stats Section for minimalism */}
                  <div className="flex justify-center">
                    <SearchPanel
                        onSearch={handleMultiSearch}
                        isLoading={loading}
                        onToggleVisibility={handleToggleVisibility}
                        searchPairs={searchPairs}
                        setSearchPairs={handleSetSearchPairs}
                        combinedMode={combinedMode}
                        toggleCombinedMode={toggleCombinedMode}
                        results={results}
                    />
                  </div>
                </div>
              </div>
            </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10 relative">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/25">
                <HexagonLucide className="w-10 h-10 text-white animate-[spin_3s_linear_infinite]" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-violet-200/80 dark:border-violet-600/50 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-70"></div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Analyzing Pathways</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Processing your metabolic network queries...</p>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-bounce"></div>
              <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
        {error && (
          <div className="max-w-2xl mx-auto my-12 animate-fade-in">
            <div className="bg-gradient-to-r from-red-50/80 to-rose-50/80 dark:from-red-800/30 dark:to-rose-800/30 border-2 border-red-200 dark:border-red-600/40 rounded-2xl p-8 text-center shadow-xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/30 mb-4">
                <Zap className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Analysis Failed</h3>
              <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
              <button 
                onClick={() => setError(null)}
                className={`bg-red-600 text-white hover:bg-red-700 font-medium ${textButtonClassesApp}`} // Consistent button size
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {results && !loading && !error && (
          <div className="animate-fade-in">
             <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div className="flex items-center gap-3 sm:gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Results</h2>
                  <span className="text-sm sm:text-base font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                    {processedResults?.length || 0} items
                  </span>
                </div>
                {/* Filter button moved into ResultTable */}
              </div>
            {/* Filter menu now shows inside ResultTable dropdown */}
            <div className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
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
        {!results && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-lg">
                    <FlaskConicalLucide className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Ready to Explore</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                Configure your search parameters in the panel above and discover metabolic pathways.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-violet-500 rounded-full"></div>Multi-target search</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div>Pathway analysis</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div>Interactive views</div>
                </div>
            </div>
        )}
      </main>

      <footer className="relative z-10 mt-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="text-xs sm:text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">NEBULA</span>
                <p className="text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} Metabolic Network Explorer.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <button className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Documentation</button>
            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
            <button className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">API</button>
            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
            <button className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;