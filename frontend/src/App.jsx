import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
    ChevronDown, ChevronUp, Sparkles, 
    FlaskConical as FlaskConicalLucide, Hexagon as HexagonLucide, Zap, 
    ChevronRight
} from "lucide-react"; 

import Logo from "./components/Logo"; 
import TabView from "./components/TabView";
import SearchPanel from "./components/SearchPanel";
import ThemeToggle from "./components/ThemeProvider/ThemeToggle";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Refs to access imperative APIs of network viewers
  const network2dRef = useRef(null);
  const network3dRef = useRef(null);

  // Pending positions loaded from imported session
  const [pendingPositions2D, setPendingPositions2D] = useState(null);
  const [pendingPositions3D, setPendingPositions3D] = useState(null);

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


  const handleMultiSearch = async (pairsFromPanel, importedSessionData = null) => {
    setLoading(true);
    setError(null);
    setSelectedRows(new Set());
    
    const processedPairsInput = pairsFromPanel.map((p, idx) => ensureIdAndColorForPair(p, idx));
    
    if (!importedSessionData) {
        handleSetSearchPairs(processedPairsInput);
    }

    if (importedSessionData) {
      try {
        // importedData expected to include results, combinedMode, positions2D, positions3D
        const importedResults = importedSessionData.results || [];
        const updatedPairsWithResults = processedPairsInput.map(pair => ({
          ...pair,
          hasResults: importedResults.some(res => {
            const resPairSource = res.pairSource === 'any' ? '' : (res.pairSource || '');
            const pairSource = pair.source || '';
            return res.pairTarget === pair.target && resPairSource === pairSource;
          }),
          resultCount: importedResults.filter(res => {
            const resPairSource = res.pairSource === 'any' ? '' : (res.pairSource || '');
            const pairSource = pair.source || '';
            return res.pairTarget === pair.target && resPairSource === pairSource;
          }).length,
        }));
        handleSetSearchPairs(updatedPairsWithResults);
        if (importedSessionData.combinedMode !== undefined) {
          setCombinedMode(importedSessionData.combinedMode);
        }
        setResults(importedResults);

        // Store positions to be applied after viewers mount
        setPendingPositions2D(importedSessionData.positions2D || null);
        setPendingPositions3D(importedSessionData.positions3D || null);
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
        uniqueRows[key] = { ...result, pairIndices: [result.pairIndex].filter(idx => idx !== undefined) };
        combined.push(uniqueRows[key]);
      } else {
        if (result.pairIndex !== undefined && !uniqueRows[key].pairIndices.includes(result.pairIndex)) uniqueRows[key].pairIndices.push(result.pairIndex);
      }
    });
    return combined;
  }, [filteredResults, combinedMode]);

  /* ------------------------------------------------------------------ */
  /* Apply imported positions once results are rendered                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (pendingPositions2D && network2dRef.current) {
      network2dRef.current.setNodePositions(pendingPositions2D);
      setPendingPositions2D(null);
    }
  }, [pendingPositions2D, network2dRef, results]);

  useEffect(() => {
    if (pendingPositions3D && network3dRef.current) {
      network3dRef.current.setNodePositions(pendingPositions3D);
      setPendingPositions3D(null);
    }
  }, [pendingPositions3D, network3dRef, results]);

  /* ------------------------------------------------------------------ */
  /* Session Export – include node positions                             */
  /* ------------------------------------------------------------------ */

  const handleExportSession = useCallback(() => {
    try {
      const positions2D = network2dRef.current?.getNodePositions?.() || {};
      const positions3D = network3dRef.current?.getNodePositions?.() || {};

      const sessionData = {
        searchPairs: searchPairs.map(({ sourceDisplay, targetDisplay, ...rest }) => rest),
        results: results || [],
        combinedMode,
        positions2D,
        positions3D,
      };

      const sessionBlob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
      const sessionUrl = URL.createObjectURL(sessionBlob);
      const link = document.createElement('a');
      link.href = sessionUrl;
      link.download = `nebula-session-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(sessionUrl);
    } catch (error) {
      console.error('Error exporting session data:', error);
      alert('Failed to export session data.');
    }
  }, [searchPairs, results, combinedMode]);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-[#282a36] text-slate-800 dark:text-[#f8f8f2] flex flex-col relative overflow-x-hidden">
      {/* Theme Toggle */}
      <ThemeToggle className="absolute top-4 right-4 z-50" />
      {/* Background decorations removed for flat design */}

      <div className="flex flex-1 relative z-10">
        {/* Left Sidebar for Search Panel */}
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-80 xl:w-96'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm fixed lg:static inset-y-0 left-0 z-30 lg:z-auto overflow-hidden`}>
          {!sidebarCollapsed ? (
            <div className="p-4 lg:p-6 w-full h-full overflow-y-auto flex flex-col">
              <SearchPanel
                  onSearch={handleMultiSearch}
                  isLoading={loading}
                  onToggleVisibility={handleToggleVisibility}
                  searchPairs={searchPairs}
                  setSearchPairs={handleSetSearchPairs}
                  combinedMode={combinedMode}
                  toggleCombinedMode={toggleCombinedMode}
                  results={results}
                  onCollapseSidebar={() => setSidebarCollapsed(true)}
                  onExportSession={handleExportSession}
              />
            </div>
          ) : (
            /* Collapsed State */
            <div className="flex flex-col items-center justify-start h-full pt-6 px-2 space-y-6">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2.5 w-10 h-10 flex items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-600/30 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-600/40 transition-all duration-200 shadow-sm hover:shadow-md"
                title="Expand Search Panel"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {/* <div className="transform -rotate-90 origin-center text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">
                Search Panel
              </div> */}
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-0' : ''} px-4 sm:px-6 lg:px-8 py-8`}>
          <div className="max-w-full mx-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <HexagonLucide className="w-10 h-10 text-violet-600 mb-4" />
                <p className="text-base text-slate-600 dark:text-slate-400">Loading…</p>
              </div>
            )}
            {error && (
              <div className="max-w-2xl mx-auto my-12">
                <div className="bg-gradient-to-r from-red-50/80 to-rose-50/80 dark:from-red-800/30 dark:to-rose-800/30 border-2 border-red-200 dark:border-red-600/40 rounded-2xl p-8 text-center shadow-xl">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/30 mb-4">
                    <Zap className="w-8 h-8 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Analysis Failed</h3>
                  <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className={`bg-red-600 text-white hover:bg-red-700 font-medium ${textButtonClassesApp}`}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {results && !loading && !error && (
              <div>
                 <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <Logo className="w-10 h-10" />
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">NEBULA</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Metabolic Network Explorer</p>
                      </div>
                    </div>
                    <span className="text-sm sm:text-base font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                      {processedResults?.length || 0} items
                    </span>
                  </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <TabView 
                    results={processedResults}
                    setResults={setResults}
                    selectedRows={selectedRows} 
                    setSelectedRows={setSelectedRows} 
                    combinedMode={combinedMode}
                    network2dRef={network2dRef}
                    network3dRef={network3dRef}
                    searchPairs={searchPairs}
                  />
                </div>
              </div>
            )}
            {!results && !loading && !error && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="relative mb-8 group">
                      <div className="absolute inset-0 rounded-full bg-slate-300/20 dark:bg-slate-600/20"></div>
                      <Logo className="w-28 h-28 relative z-10 drop-shadow-xl" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-violet-600 dark:text-violet-400 leading-tight mb-4">
                        NEBULA
                    </h1>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium mb-6 max-w-lg">
                        Network&nbsp;of&nbsp;Enzymatic&nbsp;Biochemical&nbsp;Units, Links, and Associations
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-xl text-lg sm:text-xl">
                        Explore the vast universe of metabolism <br/> 
                        Map enzymes, trace reactions and unveil biochemical <br/> 
                        Stories hidden within the universe.
                    </p>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-4">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 4a1 1 0 01.894.553l4 8A1 1 0 0114 14H6a1 1 0 01-.894-1.447l4-8A1 1 0 0110 4z" /></svg>
                      <span className="text-sm">Start by adding a target compound</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-violet-500 rounded-full"></div>Multi-target search</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div>Pathway analysis</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div>Interactive views</div>
                    </div>
                </div>
            )}
          </div>
        </main>
      </div>

      <footer className="relative z-10 mt-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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