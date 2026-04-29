import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Zap, HelpCircle } from "lucide-react";

import Logo from "./components/Logo";
import FloatingDock from "./components/FloatingDock";
import ViewSwitcher from "./components/ViewSwitcher";
import ViewPane from "./components/ViewPane";
import { filterCofactors } from "./components/utils/cofactorFilter";
import DocsViewer from "./components/DocsViewer";

const SOLID_COLORS_PALETTE_APP = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#059669', '#D97706', '#DC2626', '#7C3AED'];

function getSolidColorForPairByIndexApp(index) {
  return SOLID_COLORS_PALETTE_APP[index % SOLID_COLORS_PALETTE_APP.length];
}

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const initialPairId = `init-${Date.now()}`;
  const [searchPairs, setSearchPairs] = useState([
    { id: initialPairId, mode: 'compound', source: '', target: '', reaction: '', ec: '', color: getSolidColorForPairByIndexApp(0), visible: true, sourceDisplay:'', targetDisplay:'' }
  ]);

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [combinedMode, setCombinedMode] = useState(false);
  const [hideCofactors, setHideCofactors] = useState(false);

  // Layout state
  const [activeView, setActiveView] = useState('table');
  const [isSplit, setIsSplit] = useState(false);
  const [secondaryView, setSecondaryView] = useState('network2d');

  // Refs to access imperative APIs of network viewers
  const network2dRef = useRef(null);
  const network3dRef = useRef(null);

  // Pending positions loaded from imported session
  const [pendingPositions2D, setPendingPositions2D] = useState(null);
  const [pendingPositions3D, setPendingPositions3D] = useState(null);

  // AND-OR hypergraph tree data
  const [treeData, setTreeData] = useState(null);
  const [treeStats, setTreeStats] = useState(null);
  const [treeSolutions, setTreeSolutions] = useState([]);

  // Documentation viewer
  const [docsOpen, setDocsOpen] = useState(false);

  const ensureIdAndColorForPair = useCallback((pair, index) => {
    return {
      ...pair,
      id: pair.id || `pair-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
      mode: pair.mode || 'compound',
      color: pair.color || getSolidColorForPairByIndexApp(index),
      source: pair.source || '',
      target: pair.target || '',
      reaction: pair.reaction || '',
      ec: pair.ec || '',
      sourceDisplay: pair.sourceDisplay || '',
      targetDisplay: pair.targetDisplay || '',
      visible: pair.visible !== undefined ? pair.visible : true,
    };
  }, []);

  const handleSetSearchPairs = useCallback((newPairsOrFn) => {
    const process = (pairs) => {
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return [ensureIdAndColorForPair({ mode: 'compound', source: '', target: '', reaction: '', ec: '', visible: true }, 0)];
      }
      return pairs.map((p, idx) => ensureIdAndColorForPair(p, idx));
    };
    if (typeof newPairsOrFn === 'function') {
      setSearchPairs(currentPairs => process(newPairsOrFn(currentPairs)));
    } else {
      setSearchPairs(process(newPairsOrFn));
    }
  }, [ensureIdAndColorForPair]);

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
        setPendingPositions2D(importedSessionData.positions2D || null);
        setPendingPositions3D(importedSessionData.positions3D || null);
      } catch (e) {
        setError(e.message || "Error processing imported data");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Check that at least one pair has a valid required field for its mode
    const hasValidPair = processedPairsInput.some(p => {
      const m = p.mode || 'compound';
      if (m === 'compound') return p.target && p.target.trim();
      if (m === 'reaction') return p.reaction && p.reaction.trim();
      if (m === 'ec') return p.ec && p.ec.trim();
      return false;
    });

    if (!hasValidPair) {
      setError("Please fill in at least one query.");
      setLoading(false);
      setResults(null);
      handleSetSearchPairs(prev => prev.map(p => ({ ...p, hasResults: false, resultCount: 0 })));
      return;
    }

    try {
      let allResults = [];
      let workingPairs = [...processedPairsInput];
      let treeDataSet = false;

      for (let i = 0; i < workingPairs.length; i++) {
        const pair = workingPairs[i];
        const mode = pair.mode || 'compound';

        // Determine if this pair has a valid query
        let isValid = false;
        let fetchUrl = '';
        let pairLabel = '';

        if (mode === 'compound') {
          isValid = pair.target && pair.target.trim();
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('target', pair.target.trim());
            if (pair.source && pair.source.trim()) qp.append('source', pair.source.trim());
            fetchUrl = `/api/backtrace/tree?${qp.toString()}`;
            pairLabel = pair.target.trim();
          }
        } else if (mode === 'reaction') {
          isValid = pair.reaction && pair.reaction.trim();
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('reaction', pair.reaction.trim());
            fetchUrl = `/api/reaction/backtrace?${qp.toString()}`;
            pairLabel = pair.reaction.trim();
          }
        } else if (mode === 'ec') {
          isValid = pair.ec && pair.ec.trim();
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('ec', pair.ec.trim());
            fetchUrl = `/api/ec/reactions?${qp.toString()}`;
            pairLabel = pair.ec.trim();
          }
        }

        if (!isValid) {
          workingPairs[i] = { ...pair, hasResults: false, resultCount: 0 };
          continue;
        }

        const t0 = performance.now();
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: `Request failed: ${response.status}`}));
            throw new Error(errorData.error || `API error for ${pairLabel}`);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

        // For compound mode, the unified /api/backtrace/tree returns
        // data (flat reactions) + tree + stats + solutions in one call
        if (mode === 'compound') {
          const flatCount = data.data?.length ?? 0;
          const solCount = data.solutions?.length ?? 0;
          console.log(`[NEBULA] "${pairLabel}": ${flatCount} reactions, ${data.stats?.total_compounds ?? 0} compounds, ${solCount} solutions in ${elapsed}s`);

          // Set tree/solutions from first compound pair
          if (i === 0 || !treeDataSet) {
            if (data.tree) {
              setTreeData(data.tree);
              setTreeStats(data.stats || null);
              setTreeSolutions(data.solutions || []);
              treeDataSet = true;
            }
          }
        } else {
          console.log(`[NEBULA] ${mode} search "${pairLabel}": ${data.data?.length ?? 0} results in ${elapsed}s`);
        }

        if (data.data && data.data.length > 0) {
          workingPairs[i] = { ...pair, hasResults: true, resultCount: data.data.length };
          const pairResults = data.data.map(item => ({
            ...item,
            pairIndex: i,
            pairSource: (mode === 'compound' ? (pair.source?.trim() || 'any') : mode),
            pairTarget: pairLabel,
          }));
          allResults = [...allResults, ...pairResults];
        } else {
          workingPairs[i] = { ...pair, hasResults: false, resultCount: 0 };
        }
      }
      handleSetSearchPairs(workingPairs);
      setResults(allResults.length > 0 ? allResults : []);

      // Clear tree data if no compound search produced tree results
      if (!treeDataSet) {
        setTreeData(null);
        setTreeStats(null);
        setTreeSolutions([]);
      }
    } catch (errorMsg) {
      setError(errorMsg.message || "An error occurred during search");
      setResults(null);
      setTreeData(null);
      setTreeStats(null);
      setTreeSolutions([]);
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

  const handleClearResults = useCallback(() => {
    setResults(null);
    setTreeData(null);
    setTreeStats(null);
    setTreeSolutions([]);
    setSelectedRows(new Set());
    setError(null);
    // Reset search pairs to initial state
    const initialPairId = `init-${Date.now()}`;
    handleSetSearchPairs([
      { id: initialPairId, mode: 'compound', source: '', target: '', reaction: '', ec: '', color: getSolidColorForPairByIndexApp(0), visible: true, sourceDisplay:'', targetDisplay:'' }
    ]);
  }, [handleSetSearchPairs]);

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const visiblePairIndices = searchPairs
      .map((pair, index) => pair.visible ? index : -1)
      .filter(index => index !== -1);
    return results.filter(result => result.pairIndex !== undefined && visiblePairIndices.includes(result.pairIndex));
  }, [results, searchPairs]);

  // Apply cofactor filter before combined-mode dedup
  const cofactorFiltered = useMemo(() => {
    if (!filteredResults) return null;
    return hideCofactors ? filterCofactors(filteredResults) : filteredResults;
  }, [filteredResults, hideCofactors]);

  const processedResults = useMemo(() => {
    if (!cofactorFiltered) return null;
    if (!combinedMode) return cofactorFiltered;
    const uniqueRows = {}; const combined = [];
    cofactorFiltered.forEach(result => {
      const key = `${result.reaction}-${result.source}-${result.target}-${result.equation}`;
      if (!uniqueRows[key]) {
        uniqueRows[key] = { ...result, pairIndices: [result.pairIndex].filter(idx => idx !== undefined) };
        combined.push(uniqueRows[key]);
      } else {
        if (result.pairIndex !== undefined && !uniqueRows[key].pairIndices.includes(result.pairIndex)) uniqueRows[key].pairIndices.push(result.pairIndex);
      }
    });
    return combined;
  }, [cofactorFiltered, combinedMode]);

  const [viewFilteredResults, setViewFilteredResults] = useState(processedResults);
  useEffect(() => {
    setViewFilteredResults(processedResults);
  }, [processedResults]);

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
  /* Session Export                                                      */
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
      setTimeout(() => URL.revokeObjectURL(sessionUrl), 1000);
    } catch (error) {
      console.error('Error exporting session data:', error);
      alert('Failed to export session data.');
    }
  }, [searchPairs, results, combinedMode]);

  /* ------------------------------------------------------------------ */
  /* Session Import                                                      */
  /* ------------------------------------------------------------------ */

  const handleImportSession = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const sessionData = JSON.parse(e.target.result);
        if (sessionData && sessionData.searchPairs) {
          handleMultiSearch(sessionData.searchPairs, sessionData);
        } else {
          throw new Error('Invalid session file.');
        }
      } catch (err) {
        console.error('Error parsing session file:', err);
        alert(`Failed to parse session: ${err.message}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, []);


  /* ------------------------------------------------------------------ */
  /* Split view helpers                                                  */
  /* ------------------------------------------------------------------ */

  const handleToggleSplit = useCallback(() => {
    setIsSplit(prev => {
      if (!prev && activeView === secondaryView) {
        const alt = ['table', 'network2d', 'network3d', 'map', 'tree'].find(v => v !== activeView);
        if (alt) setSecondaryView(alt);
      }
      return !prev;
    });
  }, [activeView, secondaryView]);

  const handleActiveViewChange = useCallback((v) => {
    setActiveView(v);
    if (isSplit && v === secondaryView) {
      const alt = ['table', 'network2d', 'network3d', 'map', 'tree'].find(o => o !== v);
      if (alt) setSecondaryView(alt);
    }
  }, [isSplit, secondaryView]);

  const handleSecondaryViewChange = useCallback((v) => {
    setSecondaryView(v);
    if (isSplit && v === activeView) {
      const alt = ['table', 'network2d', 'network3d', 'map', 'tree'].find(o => o !== v);
      if (alt) setActiveView(alt);
    }
  }, [isSplit, activeView]);

  // Fire resize when split changes
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
    return () => clearTimeout(t);
  }, [isSplit]);

  const canExport = (results && results.length > 0) || searchPairs.some(p => {
    const m = p.mode || 'compound';
    if (m === 'compound') return (p.source && p.source.trim()) || (p.target && p.target.trim());
    if (m === 'reaction') return p.reaction && p.reaction.trim();
    if (m === 'ec') return p.ec && p.ec.trim();
    return false;
  });
  const hasResults = results && results.length > 0;

  const sharedViewProps = {
    results: processedResults,
    setResults,
    filteredResults: viewFilteredResults,
    setFilteredResults: setViewFilteredResults,
    selectedRows,
    setSelectedRows,
    searchPairs,
    network2dRef,
    network3dRef,
    treeData,
    treeStats,
    treeSolutions,
  };

  return (
    <div className="fixed inset-0 bg-stone-50 dark:bg-[#1a1c2a] text-slate-700 dark:text-slate-300 overflow-hidden">

      {/* ── Full-bleed results canvas ── */}
      {hasResults && (
        <div className="absolute inset-0 z-0 isolate">
          {isSplit ? (
            <div className="flex h-full w-full">
              <div className="flex-1 min-w-0 h-full border-r border-slate-200/60 dark:border-slate-700/40">
                <ViewPane viewType={activeView} {...sharedViewProps} />
              </div>
              <div className="flex-1 min-w-0 h-full">
                <ViewPane viewType={secondaryView} {...sharedViewProps} />
              </div>
            </div>
          ) : (
            <ViewPane viewType={activeView} {...sharedViewProps} />
          )}
        </div>
      )}

      {/* ── Atmospheric background (only when no results) ── */}
      {!hasResults && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/15 dark:bg-violet-900/8 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/15 dark:bg-blue-900/8 blur-[100px]" />
          <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-emerald-200/10 dark:bg-emerald-900/5 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>
      )}

      {/* ── Floating Dock (top bar with inline search) ── */}
      <FloatingDock
        onSearch={handleMultiSearch}
        onExportSession={handleExportSession}
        onImportSession={handleImportSession}
        canExport={canExport}
        isLoading={loading}
        resultCount={processedResults?.length || 0}
        combinedMode={combinedMode}
        toggleCombinedMode={toggleCombinedMode}
        hasResults={hasResults}
        searchPairs={searchPairs}
        setSearchPairs={handleSetSearchPairs}
        onToggleVisibility={handleToggleVisibility}
        hideCofactors={hideCofactors}
        toggleHideCofactors={() => setHideCofactors(prev => !prev)}
        onClearResults={handleClearResults}
      />

      {/* ── Error toast ── */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full animate-in">
          <div className="bg-white/85 dark:bg-slate-800/90 backdrop-blur-xl border border-red-200/60 dark:border-red-700/30 rounded-2xl p-5 shadow-xl flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-red-500 dark:text-red-400/80" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600 dark:text-red-300/90 mb-1">Search Error</p>
              <p className="text-xs text-red-500/70 dark:text-red-400/70 leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="flex-shrink-0 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* ── Loading indicator ── */}
      {loading && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-violet-200/40 dark:border-violet-700/20 rounded-2xl px-5 py-3 shadow-lg">
            <div className="w-5 h-5 border-2 border-violet-200 dark:border-violet-700/50 border-t-violet-400 rounded-full animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tracing pathways…</span>
          </div>
        </div>
      )}

      {/* ── Hero / Landing — only when no results ── */}
      {!hasResults && !loading && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-violet-400/10 dark:bg-violet-500/5 blur-2xl scale-150" />
            <Logo className="w-24 h-24 sm:w-28 sm:h-28 relative z-10 drop-shadow-xl" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 dark:from-violet-400/80 dark:via-purple-400/80 dark:to-indigo-400/80 bg-clip-text text-transparent leading-tight mb-3">
            NEBULA
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 max-w-md">
            Network of Enzymatic Biochemical Units, Links, and Associations
          </p>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg text-base sm:text-lg leading-relaxed text-center">
            Explore the vast universe of metabolism. Map enzymes, trace reactions and unveil biochemical stories hidden within.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">
            Click the search bar above to begin
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {[
              { label: 'Multi-target search', color: 'bg-violet-400' },
              { label: 'Pathway analysis', color: 'bg-emerald-400' },
              { label: 'Split-screen views', color: 'bg-blue-400' },
              { label: 'Session import/export', color: 'bg-amber-400' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm border border-slate-200/30 dark:border-slate-600/20 rounded-full px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className={`w-1.5 h-1.5 rounded-full ${f.color}`} />
                {f.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── View Switcher (bottom center pill) — only when results exist ── */}
      {hasResults && (
        <ViewSwitcher
          activeView={activeView}
          onViewChange={handleActiveViewChange}
          isSplit={isSplit}
          onToggleSplit={handleToggleSplit}
          secondaryView={secondaryView}
          onSecondaryViewChange={handleSecondaryViewChange}
        />
      )}

      {/* ── Help button (bottom-right) ── */}
      <button
        onClick={() => setDocsOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-400/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        title="Help & Documentation"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* ── Documentation Viewer ── */}
      <DocsViewer isOpen={docsOpen} onClose={() => setDocsOpen(false)} initialSlug={hasResults ? activeView : null} />
    </div>
  );
}

export default App;