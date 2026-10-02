import React, { useState, useMemo, useCallback, useEffect, useRef, useContext} from "react";
import { Zap, HelpCircle, Compass, BookOpen, Lightbulb, Route, X } from "lucide-react";
import { getApiUrl } from './config/api';

import Logo from "./components/Logo";
import FloatingDock from "./components/FloatingDock";
import ViewSwitcher from "./components/ViewSwitcher";
import ViewPane from "./components/ViewPane";
import { filterCofactors } from "./components/utils/cofactorFilter";
import DocsViewer from "./components/DocsViewer";
import GuidedTour, { TOUR_SEEN_KEY } from "./components/GuidedTour";
import { getSolidColorForPairByIndex } from './config/themes';
import { ThemeContext } from './components/ThemeProvider/ThemeProvider';
import TextSizeControl from './components/TextSize/TextSizeControl';
import { DOCS_EVENT } from './lib/docsBus';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  
  const { themeName } = useContext(ThemeContext);
  const getSolidColorForPairByIndexApp = useCallback(
    (index) => getSolidColorForPairByIndex(index, themeName),
    [themeName]
  );


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

  // Pathway data — one entry per compound-mode search pair, so multi-target
  // searches can all be inspected (and overlaid) in Path Finder.
  const [treeTargets, setTreeTargets] = useState([]);
  // 'parallel' = all routes incl. parallel/lateral reactions (default),
  // 'earliest' = strictly generation-increasing routes only
  const [pathMode, setPathMode] = useState('parallel');
  const [pathMaxPaths, setPathMaxPaths] = useState(6000);
  const [treeLoading, setTreeLoading] = useState(false);

  // Focused path — when set, filters all viewers to only show reactions in this path
  const [focusedPath, setFocusedPath] = useState(null);

  // Reactions removed from the Table view. Tracked (rather than just
  // discarded) so other viewers can flag the paths/edges they broke.
  const [deletedRows, setDeletedRows] = useState([]);

  // Documentation viewer
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsSlug, setDocsSlug] = useState(null);
  const [docsNavKey, setDocsNavKey] = useState(0);
  const openDocsAt = useCallback((slug) => {
    setDocsSlug(slug || null);
    setDocsNavKey((k) => k + 1);
    setDocsOpen(true);
  }, []);
  useEffect(() => {
    const h = (e) => openDocsAt(e.detail?.slug);
    window.addEventListener(DOCS_EVENT, h);
    return () => window.removeEventListener(DOCS_EVENT, h);
  }, [openDocsAt]);

  // Guided tour
  const [tourActive, setTourActive] = useState(false);
  const [dockForceExpanded, setDockForceExpanded] = useState(false);
  const [viewTourActive, setViewTourActive] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const helpMenuRef = useRef(null);
  
  // Auto-show tour on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_SEEN_KEY)) {
        const timer = setTimeout(() => setTourActive(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  // Close help menu on outside click
  useEffect(() => {
    if (!helpMenuOpen) return;
    const handler = (e) => {
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target)) {
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [helpMenuOpen]);

  const handleStartTour = useCallback(() => setTourActive(true), []);
  const handleEndTour = useCallback(() => {
    setTourActive(false);
    setDockForceExpanded(false);
  }, []);
  const handleTourExpandDock = useCallback(() => setDockForceExpanded(true), []);
  const handleTourCollapseDock = useCallback(() => setDockForceExpanded(false), []);
  const handleViewTourClose = useCallback(() => setViewTourActive(false), []);

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
    setFocusedPath(null);
    setPathMaxPaths(6000);

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
        // Sessions don't carry Path Finder tree/solutions or deletion state —
        // reset them so a stale tree from a previous search isn't shown
        // against mismatched, newly-imported results (this was causing the
        // Path Finder tab to crash/freeze after importing on top of an
        // existing session instead of a fresh page load).
        setTreeTargets([]);
        setDeletedRows([]);
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
      if (m === 'compounds') return (p.compounds || []).length > 0;
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
      let newTreeTargets = [];

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
            qp.append('mode', pathMode);
            fetchUrl = getApiUrl(`backtrace/tree?${qp.toString()}`);
            pairLabel = pair.target.trim();
          }
        } else if (mode === 'reaction') {
          isValid = pair.reaction && pair.reaction.trim();
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('reaction', pair.reaction.trim());
            fetchUrl = getApiUrl(`reaction/backtrace?${qp.toString()}`);
            pairLabel = pair.reaction.trim();
          }
        } else if (mode === 'ec') {
          isValid = pair.ec && pair.ec.trim();
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('ec', pair.ec.trim());
            fetchUrl = getApiUrl(`ec/reactions?${qp.toString()}`);
            pairLabel = pair.ec.trim();
          }
        } else if (mode === 'compounds') {
          isValid = (pair.compounds || []).length > 0;
          if (isValid) {
            const qp = new URLSearchParams();
            qp.append('compounds', pair.compounds.join(','));
            qp.append('match', pair.matchMode || 'any');
            fetchUrl = getApiUrl(`compounds/reactions?${qp.toString()}`);
            pairLabel = pair.compounds.join('+');
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

          // Collect pathway graph/solutions for every compound pair so
          // multi-target searches can all be inspected in the Paths view.
          if (data.graph) {
            newTreeTargets.push({
              pairIndex: i,
              pairId: pair.id,
              color: pair.color,
              source: pair.source?.trim() || '',
              target: pair.target.trim(),
              graph: data.graph,
              stats: data.stats || null,
              solutions: data.solutions || [],
              clusters: data.clusters || [],
            });
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
      setDeletedRows([]);

      setTreeTargets(newTreeTargets);
    } catch (errorMsg) {
      setError(errorMsg.message || "An error occurred during search");
      setResults(null);
      setTreeTargets([]);
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
    setTreeTargets([]);
    setFocusedPath(null);
    setDeletedRows([]);
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

  // Focused-path filter: restrict all other viewers to the reactions of the
  // path (or set of paths) selected in the Paths view.
  const handleFocusPath = useCallback((selection) => {
    setFocusedPath(selection || null);
  }, []);

  // Changing the route mode (or asking for a deeper search) re-runs the
  // pathway search for every compound pair and refreshes that pair's rows,
  // so every reaction of every listed path is also present in other viewers.
  const handlePathModeChange = useCallback(async (mode, maxPaths = pathMaxPaths) => {
    if (mode === pathMode && maxPaths === pathMaxPaths) return;
    setPathMode(mode);
    setPathMaxPaths(maxPaths);
    if (treeTargets.length === 0) return;
    setTreeLoading(true);
    setFocusedPath(null);
    try {
      const updated = await Promise.all(treeTargets.map(async (t) => {
        const qp = new URLSearchParams({ target: t.target, mode, max_paths: String(maxPaths) });
        if (t.source) qp.append('source', t.source);
        const resp = await fetch(getApiUrl(`backtrace/tree?${qp.toString()}`));
        if (!resp.ok) throw new Error(`Pathway search failed for ${t.target}`);
        const data = await resp.json();
        return { t, data };
      }));
      setTreeTargets(updated.map(({ t, data }) => ({
        ...t, graph: data.graph, stats: data.stats || null, solutions: data.solutions || [], clusters: data.clusters || [],
      })));
      setResults(prev => {
        if (!prev) return prev;
        let next = prev;
        updated.forEach(({ t, data }) => {
          const existing = new Set(next.filter(r => r.pairIndex === t.pairIndex).map(r => r.reaction));
          const additions = (data.data || [])
            .filter(r => !existing.has(r.reaction))
            .map(r => ({ ...r, pairIndex: t.pairIndex, pairSource: t.source || 'any', pairTarget: t.target }));
          if (additions.length) next = [...next, ...additions];
        });
        return next;
      });
    } catch (e) {
      setError(e.message || 'Pathway search failed');
    } finally {
      setTreeLoading(false);
    }
  }, [pathMode, pathMaxPaths, treeTargets]);

  // Reaction deletion — tracked (not just discarded) so other viewers can
  // flag which paths/edges the deletion broke.
  const rowDeleteKey = (row) => `${row.reaction}::${row.source || ''}::${row.target || ''}::${row.equation || ''}`;

  const handleRemoveRows = useCallback((removedRows) => {
    if (!removedRows || removedRows.length === 0) return;
    setDeletedRows(prev => {
      const seen = new Set(prev.map(rowDeleteKey));
      const additions = removedRows.filter(r => !seen.has(rowDeleteKey(r)));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, []);

  const handleRestoreRows = useCallback((rowsToRestore) => {
    if (!rowsToRestore || rowsToRestore.length === 0) return;
    const restoreKeys = new Set(rowsToRestore.map(rowDeleteKey));
    setDeletedRows(prev => prev.filter(r => !restoreKeys.has(rowDeleteKey(r))));
    setResults(prev => {
      const base = prev || [];
      const existing = new Set(base.map(rowDeleteKey));
      const toAdd = rowsToRestore.filter(r => !existing.has(rowDeleteKey(r)));
      return [...base, ...toAdd];
    });
  }, []);

  const deletedReactionNames = useMemo(
    () => new Set(deletedRows.map(r => r.reaction)),
    [deletedRows]
  );

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

  // Apply focused-path filter after dedup
  const pathFilteredResults = useMemo(() => {
    if (!processedResults || !focusedPath) return processedResults;
    const focusedReactions = new Set(focusedPath.reactions.map(r => r.reaction));
    return processedResults.filter(row => focusedReactions.has(row.reaction));
  }, [processedResults, focusedPath]);

  const [viewFilteredResults, setViewFilteredResults] = useState(pathFilteredResults);
  useEffect(() => {
    setViewFilteredResults(pathFilteredResults);
  }, [pathFilteredResults]);

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
    treeTargets,
    pathMode,
    pathMaxPaths,
    onChangePathMode: handlePathModeChange,
    treeLoading,
    focusedPath,
    onFocusPath: handleFocusPath,
    deletedRows,
    deletedReactionNames,
    onRemoveRows: handleRemoveRows,
    onRestoreRows: handleRestoreRows,
    hideCofactors,
  };

  return (
    <div className="fixed inset-0 bg-surface text-content overflow-hidden">

      {/* ── Full-bleed results canvas ── */}
      {hasResults && (
        <div className="absolute inset-x-0 bottom-0 top-0 z-0 isolate">
          {isSplit ? (
            <div className="flex h-full w-full">
              <div className="flex-1 min-w-0 h-full border-r border-brd/60">
                <ViewPane viewType={activeView} {...sharedViewProps} viewTourActive={viewTourActive} onViewTourClose={handleViewTourClose} />
              </div>
              <div className="flex-1 min-w-0 h-full">
                <ViewPane viewType={secondaryView} {...sharedViewProps} />
              </div>
            </div>
          ) : (
            <ViewPane viewType={activeView} {...sharedViewProps} viewTourActive={viewTourActive} onViewTourClose={handleViewTourClose} />
          )}
        </div>
      )}

      {/* ── Atmospheric background (only when no results) ── */}
      {!hasResults && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand/15 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-nfo/15 blur-[100px]" />
          <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-ok/10 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
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
        forceExpanded={dockForceExpanded}
        onForceCollapse={handleTourCollapseDock}
      />

      {/* ── Error toast ── */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full animate-in">
          <div className="bg-surface-overlay/85 backdrop-blur-xl border border-err/30 rounded-2xl p-5 shadow-xl flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-err-subtle flex items-center justify-center">
              <Zap className="w-5 h-5 text-err" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-err mb-1">Search Error</p>
              <p className="text-xs text-err/70 leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="flex-shrink-0 text-content-muted hover:text-content-secondary transition-colors text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* ── Loading indicator ── */}
      {loading && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-surface-overlay/80 backdrop-blur-xl border border-brand/20 rounded-2xl px-5 py-3 shadow-lg">
            <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
            <span className="text-sm text-content-secondary font-medium">Tracing paths…</span>
          </div>
        </div>
      )}

      {/* ── Focused-pathway chip — tells users other views are filtered ── */}
      {hasResults && focusedPath && (isSplit || activeView !== 'tree') && (
        <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-2 rounded-full border border-brand/30 bg-surface-overlay/90 backdrop-blur-xl shadow-lg pl-3 pr-1 py-1 text-xs">
            <Route className="w-3.5 h-3.5 text-brand" />
            <span className="text-content-secondary">
              Showing <b className="text-content">{focusedPath.label || 'selected pathway'}</b>
              <span className="text-content-muted"> · {focusedPath.reactions?.length || 0} reactions</span>
            </span>
            {activeView !== 'tree' && (
              <button onClick={() => handleActiveViewChange('tree')} className="px-2 py-0.5 rounded-full text-brand hover:bg-brand/10 font-medium">
                Open in Path Finder
              </button>
            )}
            <button onClick={() => setFocusedPath(null)} className="p-1 rounded-full text-content-muted hover:text-content hover:bg-surface-inset" title="Show all reactions again">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Hero / Landing — only when no results ── */}
      {!hasResults && !loading && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-brand/10 blur-2xl scale-150" />
            <Logo className="w-24 h-24 sm:w-28 sm:h-28 relative z-10 drop-shadow-xl" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-clip-text text-transparent leading-tight mb-3" style={{ backgroundImage: `linear-gradient(to right, rgb(var(--brand-gradient-from)), rgb(var(--brand-gradient-via)), rgb(var(--brand-gradient-to)))` }}>
            NEBULA
          </h1>
          <p className="text-sm text-content-secondary font-medium mb-6 max-w-md">
            Network of Enzymatic Biochemical Units, Links, and Associations
          </p>
          <p className="text-content-secondary mb-8 max-w-lg text-base sm:text-lg leading-relaxed text-center">
            Explore the vast universe of metabolism. Map enzymes, trace reactions and unveil biochemical stories hidden within.
          </p>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={handleStartTour}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-lg shadow-brand/25 hover:shadow-brand-hover/30 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Compass className="w-4 h-4" />
              Take a quick tour
            </button>
          </div>
          <p className="text-xs text-content-muted">
            or click the search bar above to dive right in
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {[
              { label: 'Multi-target search', color: 'bg-brand' },
              { label: 'Path analysis', color: 'bg-ok' },
              { label: 'Split-screen views', color: 'bg-info' },
              { label: 'Session import/export', color: 'bg-warn' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-surface-overlay/50 backdrop-blur-sm border border-brd/30 rounded-full px-3 py-1.5 text-xs text-content-secondary">
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

      {/* ── Help button with popover (bottom-right) ── */}
      <div ref={helpMenuRef} className="fixed bottom-4 right-4 z-40" data-tour="help-btn">
        {/* Popover menu */}
        {helpMenuOpen && (
          <div className="absolute bottom-12 right-0 mb-1 w-60
            bg-surface-overlay/95 backdrop-blur-2xl border border-brd/50
            rounded-xl shadow-2xl shadow-black/20 overflow-hidden
            animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {hasResults && (
              <button
                onClick={() => {
                  setHelpMenuOpen(false);
                  setViewTourActive(true);
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[12px] font-medium
                  text-content-secondary hover:text-brand hover:bg-brand/5 transition-all"
              >
                <Lightbulb className="w-4 h-4" />
                Quick Help
              </button>
            )}
            <button
              onClick={() => {
                setHelpMenuOpen(false);
                openDocsAt(hasResults ? activeView : null);
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[12px] font-medium
                text-content-secondary hover:text-brand hover:bg-brand/5 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Documentation
            </button>
            <button
              onClick={() => { setHelpMenuOpen(false); setTourActive(true); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[12px] font-medium
                text-content-secondary hover:text-brand hover:bg-brand/5 transition-all"
            >
              <Compass className="w-4 h-4" />
              Guided tour
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-brd/40 px-3.5 py-2">
              <span className="text-[12px] font-medium text-content-secondary">Text size</span>
              <TextSizeControl label={false} />
            </div>
          </div>
        )}
        {/* Trigger button */}
        <button
          onClick={() => setHelpMenuOpen(prev => !prev)}
          className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-content-inverse shadow-lg shadow-brand/25 hover:shadow-brand-hover/30 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title="Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* ── Documentation Viewer ── */}
      <DocsViewer isOpen={docsOpen} onClose={() => setDocsOpen(false)} initialSlug={docsSlug} navKey={docsNavKey} />

      {/* ── Guided Tour ── */}
      <GuidedTour
        active={tourActive}
        onEnd={handleEndTour}
        isLoading={loading}
        hasResults={hasResults}
        expandDock={handleTourExpandDock}
        collapseDock={handleTourCollapseDock}
        onSearch={handleMultiSearch}
        onViewChange={handleActiveViewChange}
        onSetSplit={setIsSplit}
        onSetSecondaryView={setSecondaryView}
      />
    </div>
  );
}

export default App;