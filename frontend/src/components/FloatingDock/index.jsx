import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Download, Upload, Layers, Loader2,
  Plus, X, Eye, EyeOff, Sparkles, ChevronUp,
} from 'lucide-react';
import Logo from '../Logo';
import ThemeToggle from '../ThemeProvider/ThemeToggle';
import AutocompleteInput from '../SearchPanel/AutocompleteInput';
import compoundDataJson from '../SearchPanel/compound_map.json';
import reactionDataJson from '../SearchPanel/reaction_map.json';
import ecDataJson from '../SearchPanel/ec_map.json';

const SEARCH_MODES = [
  { value: 'compound', label: 'Cmpd' },
  { value: 'reaction', label: 'Rxn' },
  { value: 'ec', label: 'EC' },
];

const PAIR_COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#D97706','#7C3AED'];

const FloatingDock = ({
  onSearch,
  onExportSession,
  onImportSession,
  canExport,
  isLoading,
  resultCount,
  combinedMode,
  toggleCombinedMode,
  hasResults,
  searchPairs,
  setSearchPairs,
  onToggleVisibility,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [compoundData, setCompoundData] = useState([]);
  const [reactionData, setReactionData] = useState([]);
  const [ecData, setEcData] = useState([]);
  const dockRef = useRef(null);
  const pendingSearchRef = useRef(false);

  useEffect(() => {
    if (compoundDataJson) setCompoundData(compoundDataJson);
    if (reactionDataJson) setReactionData(reactionDataJson);
    if (ecDataJson) setEcData(ecDataJson);
  }, []);

  // Only close on outside click — NOT on mouse leave
  useEffect(() => {
    const onClickOutside = (e) => {
      if (expanded && dockRef.current && !dockRef.current.contains(e.target)) {
        // Don't close if clicking inside an autocomplete dropdown
        const dropdown = e.target.closest('ul');
        if (dropdown) return;
        setExpanded(false);
      }
    };
    const onEscape = (e) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [expanded]);

  // Ctrl/Cmd+K toggle
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setExpanded(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const updatePair = useCallback((index, data) => {
    setSearchPairs(prev => prev.map((p, i) => i === index ? { ...p, ...data } : p));
  }, [setSearchPairs]);

  // Auto-search: when a required value is selected, trigger search after a short debounce
  const triggerAutoSearch = useCallback(() => {
    pendingSearchRef.current = true;
    setTimeout(() => {
      if (pendingSearchRef.current) {
        pendingSearchRef.current = false;
        setSearchPairs(currentPairs => {
          const hasValid = currentPairs.some(p => {
            const m = p.mode || 'compound';
            if (m === 'compound') return p.target && p.target.trim();
            if (m === 'reaction') return p.reaction && p.reaction.trim();
            if (m === 'ec') return p.ec && p.ec.trim();
            return false;
          });
          if (hasValid) onSearch(currentPairs);
          return currentPairs;
        });
      }
    }, 300);
  }, [onSearch, setSearchPairs]);

  const handleTargetSelect = useCallback((index, id) => {
    updatePair(index, { target: id, targetDisplay: '' });
    if (id && id.trim()) triggerAutoSearch();
  }, [updatePair, triggerAutoSearch]);

  const handleReactionSelect = useCallback((index, id) => {
    updatePair(index, { reaction: id });
    if (id && id.trim()) triggerAutoSearch();
  }, [updatePair, triggerAutoSearch]);

  const handleEcSelect = useCallback((index, id) => {
    updatePair(index, { ec: id });
    if (id && id.trim()) triggerAutoSearch();
  }, [updatePair, triggerAutoSearch]);

  const addPair = useCallback(() => {
    setSearchPairs(prev => [...prev, {
      id: `new-${Date.now()}-${prev.length}`,
      mode: 'compound',
      source: '', target: '', reaction: '', ec: '',
      visible: true, sourceDisplay: '', targetDisplay: '',
      color: PAIR_COLORS[prev.length % PAIR_COLORS.length],
    }]);
  }, [setSearchPairs]);

  const removePair = useCallback((index) => {
    if (searchPairs.length > 1) {
      setSearchPairs(prev => prev.filter((_, i) => i !== index));
    }
  }, [searchPairs, setSearchPairs]);

  const handleSearch = () => {
    pendingSearchRef.current = false;
    onSearch(searchPairs);
  };

  const isSearchDisabled = isLoading || !searchPairs.some(p => {
    const m = p.mode || 'compound';
    if (m === 'compound') return p.target && p.target.trim();
    if (m === 'reaction') return p.reaction && p.reaction.trim();
    if (m === 'ec') return p.ec && p.ec.trim();
    return false;
  });

  // Summary for collapsed bar
  const activePairs = searchPairs.filter(p => {
    const m = p.mode || 'compound';
    if (m === 'compound') return p.target && p.target.trim();
    if (m === 'reaction') return p.reaction && p.reaction.trim();
    if (m === 'ec') return p.ec && p.ec.trim();
    return false;
  });
  const summaryText = activePairs.length > 0
    ? activePairs.map(p => {
        const m = p.mode || 'compound';
        if (m === 'compound') {
          const entry = compoundData.find(c => c.compound_id === p.target);
          return entry ? entry.name : (p.targetDisplay || p.target);
        }
        if (m === 'reaction') return p.reaction || '';
        if (m === 'ec') return `EC ${p.ec}` || '';
        return '';
      }).join(' · ')
    : 'Search pathways…';

  return (
    <div ref={dockRef} className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-2xl pointer-events-none">
      <div className="pointer-events-auto">

        {/* ── Top bar ── */}
        <div className={`flex items-center gap-1.5 bg-white/88 dark:bg-slate-800/88 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-600/35 px-2.5 py-1.5 shadow-lg shadow-slate-200/20 dark:shadow-black/20 transition-all duration-200 ${expanded ? 'rounded-t-2xl rounded-b-none border-b-0' : 'rounded-2xl'}`}>
          {/* Logo */}
          <div className="flex-shrink-0">
            <Logo className="w-7 h-7" />
          </div>

          {/* Search summary / expand trigger */}
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex-1 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors group min-w-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 flex-shrink-0 text-violet-500 animate-spin" />
            ) : (
              <Search className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-violet-400 transition-colors" />
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors truncate">
              {isLoading ? 'Searching…' : summaryText}
            </span>
            <ChevronUp className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`} />
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-slate-200/60 dark:bg-slate-700/40 flex-shrink-0" />

          {/* Result count */}
          {resultCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{resultCount}</span>
            </div>
          )}

          {/* Combined mode */}
          {hasResults && (
            <button onClick={toggleCombinedMode} className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${combinedMode ? 'bg-violet-50 dark:bg-violet-700/20 text-violet-500 dark:text-violet-300/80' : 'text-slate-400 hover:text-slate-500 hover:bg-slate-100/70 dark:hover:bg-slate-700/50'}`} title={combinedMode ? 'Separate view' : 'Combined view'}>
              <Layers className="w-4 h-4" />
            </button>
          )}

          {/* Import */}
          <label className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100/70 dark:hover:bg-slate-700/50 transition-all cursor-pointer flex-shrink-0 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`} title="Import session">
            <Upload className="w-4 h-4" />
            <input type="file" accept=".json" onChange={onImportSession} className="hidden" disabled={isLoading} />
          </label>

          {/* Export */}
          {canExport && (
            <button onClick={onExportSession} disabled={isLoading} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100/70 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50 flex-shrink-0" title="Export session">
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Theme */}
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>

        {/* ── Expanded search panel ── */}
        {expanded && (
          <div className="bg-white/92 dark:bg-slate-800/92 backdrop-blur-2xl border border-t-0 border-slate-200/50 dark:border-slate-600/35 rounded-b-2xl shadow-xl shadow-slate-300/15 dark:shadow-black/20">
            <div className="px-3 pt-2 pb-3 space-y-2">

              {searchPairs.map((pair, index) => {
                const pairMode = pair.mode || 'compound';
                return (
                <div key={pair.id || index} className="flex items-center gap-2 rounded-xl bg-slate-50/60 dark:bg-slate-700/30 px-2.5 py-2 group">

                  {/* Color dot — click to change */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-3 h-3 rounded-full cursor-pointer ring-2 ring-white dark:ring-slate-800 shadow-sm"
                      style={{ backgroundColor: pair.color || '#8B5CF6' }}
                    />
                    <input
                      type="color"
                      value={pair.color || '#8B5CF6'}
                      onChange={(e) => updatePair(index, { color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>

                  {/* Mode selector */}
                  <select
                    value={pairMode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      const cleared = { source: '', target: '', reaction: '', ec: '', sourceDisplay: '', targetDisplay: '', hasResults: undefined, resultCount: undefined };
                      updatePair(index, { ...cleared, mode: newMode });
                    }}
                    disabled={isLoading}
                    className="flex-shrink-0 text-[11px] font-medium rounded-md border border-slate-200/70 dark:border-slate-600/40 bg-white/80 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-1 py-1 focus:ring-1 focus:ring-violet-400/30 outline-none"
                  >
                    {SEARCH_MODES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  {/* Compound mode: Source → Target */}
                  {pairMode === 'compound' && (
                    <>
                      <div className="flex-1 min-w-0">
                        <AutocompleteInput
                          idPrefix={`dock-src-${index}`}
                          placeholder="Source (optional)"
                          value={pair.source}
                          onValueSelect={(id) => updatePair(index, { source: id, sourceDisplay: '' })}
                          compoundData={compoundData}
                          disabled={isLoading}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/40 text-sm text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-300 focus:ring-1 focus:ring-violet-300/20 transition-all outline-none"
                        />
                      </div>
                      <span className="text-slate-300 dark:text-slate-500 flex-shrink-0 text-xs font-medium select-none">→</span>
                      <div className="flex-1 min-w-0">
                        <AutocompleteInput
                          idPrefix={`dock-tgt-${index}`}
                          placeholder="Target *"
                          value={pair.target}
                          onValueSelect={(id) => handleTargetSelect(index, id)}
                          compoundData={compoundData}
                          disabled={isLoading}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/40 text-sm text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-300 focus:ring-1 focus:ring-violet-300/20 transition-all outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Reaction mode */}
                  {pairMode === 'reaction' && (
                    <div className="flex-1 min-w-0">
                      <AutocompleteInput
                        idPrefix={`dock-rxn-${index}`}
                        placeholder="Reaction ID (e.g. R00217)"
                        value={pair.reaction || ''}
                        onValueSelect={(id) => handleReactionSelect(index, id)}
                        compoundData={reactionData}
                        itemIdKey="reaction_id"
                        itemLabelKey="equation"
                        idPattern={/^R\d{5}$/i}
                        disabled={isLoading}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/40 text-sm text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-300 focus:ring-1 focus:ring-blue-300/20 transition-all outline-none"
                      />
                    </div>
                  )}

                  {/* EC mode */}
                  {pairMode === 'ec' && (
                    <div className="flex-1 min-w-0">
                      <AutocompleteInput
                        idPrefix={`dock-ec-${index}`}
                        placeholder="EC number (e.g. 1.1.1.1)"
                        value={pair.ec || ''}
                        onValueSelect={(id) => handleEcSelect(index, id)}
                        compoundData={ecData}
                        itemIdKey="ec_number"
                        itemLabelKey="ec_number"
                        idPattern={/^\d+(\.\d+){3}$/}
                        disabled={isLoading}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600/40 text-sm text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300/20 transition-all outline-none"
                      />
                    </div>
                  )}

                  {/* Fixed-width trailing zone — always same width for alignment */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 w-[72px] justify-end">
                    {typeof pair.resultCount === 'number' && pair.resultCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-50/80 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
                        {pair.resultCount}
                      </span>
                    )}
                    {pair.hasResults !== undefined && (
                      <button
                        onClick={() => onToggleVisibility(index)}
                        className={`p-1 rounded-md transition-all ${pair.visible ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      >
                        {pair.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {searchPairs.length > 1 ? (
                      <button
                        onClick={() => removePair(index)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all opacity-0 group-hover:opacity-100"
                        disabled={isLoading}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="w-[22px]" />
                    )}
                  </div>
                </div>
              );
              })}

              {/* Bottom row */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={addPair}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Add query
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleSearch}
                  disabled={isSearchDisabled}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-violet-500 hover:bg-violet-400 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isLoading ? 'Searching…' : 'Explore'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingDock;
