import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Download, Upload, Layers, Loader2,
  Plus, X, Eye, EyeOff, Sparkles, ChevronUp, FlaskConical,
} from 'lucide-react';
import Logo from '../Logo';
import ThemeSelector from '../ThemeProvider/ThemeSelector';
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
  hideCofactors,
  toggleHideCofactors,
  onClearResults,
  forceExpanded,
  onForceCollapse,
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
      if (!expanded) return;
      
      // Don't close if clicking inside the dock itself
      if (dockRef.current && dockRef.current.contains(e.target)) return;
      
      // Don't close if clicking inside an autocomplete dropdown
      const dropdown = e.target.closest('ul');
      if (dropdown) return;
      
      setExpanded(false);
    };
    const onEscape = (e) => {
      if (e.key === 'Escape' && !forceExpanded) setExpanded(false);
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

  // Auto-search: when a required value is selected, trigger search after a debounce
  // Longer delay allows users to add multiple queries before search starts
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
    }, 1000);
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
    : 'Search paths…';

  return (
    <div ref={dockRef} className="fixed top-0 inset-x-0 z-50">

      {/* ── Top navigation bar ── */}
      <div
        data-tour="dock-bar"
        className="flex items-center justify-center h-14 px-4 bg-surface-overlay/95 backdrop-blur-xl border-b border-brd/40 shadow-sm"
      >
        {/* Centered content group */}
        <div className="flex items-center gap-3 w-full max-w-3xl">

          {/* Logo + brand name */}
          <button
            onClick={hasResults && onClearResults ? onClearResults : undefined}
            className={`flex items-center gap-2.5 flex-shrink-0 rounded-xl px-2.5 py-1.5 transition-colors ${hasResults && onClearResults ? 'hover:bg-surface-inset/60 cursor-pointer' : 'cursor-default'}`}
            title={hasResults ? 'Clear results — return home' : 'NEBULA'}
          >
            <Logo className="w-7 h-7" />
            <span className="text-base font-bold text-content tracking-tight">NEBULA</span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-brd/50 flex-shrink-0" />

          {/* Search trigger — styled like an input */}
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center gap-2.5 flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-brd/60 bg-surface-inset/60 hover:border-brand/50 hover:bg-surface-inset transition-colors text-left"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 flex-shrink-0 text-brand animate-spin" />
            ) : (
              <Search className="w-4 h-4 flex-shrink-0 text-content-muted" />
            )}
            <span className="text-sm text-content-secondary truncate flex-1">
              {isLoading ? 'Searching…' : summaryText}
            </span>
            <ChevronUp className={`w-4 h-4 text-content-muted flex-shrink-0 transition-transform duration-150 ${(expanded || forceExpanded) ? '' : 'rotate-180'}`} />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-brd/50 flex-shrink-0" />

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {resultCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-ok/10">
                <div className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                <span className="text-xs font-bold text-ok">{resultCount}</span>
              </div>
            )}

            {hasResults && (
              <button onClick={toggleCombinedMode} className={`p-2 rounded-xl transition-colors ${combinedMode ? 'bg-brand/10 text-brand' : 'text-content-muted hover:text-content hover:bg-surface-inset/60'}`} title={combinedMode ? 'Separate view' : 'Combined view'}>
                <Layers className="w-4.5 h-4.5" />
              </button>
            )}

            {hasResults && (
              <button onClick={toggleHideCofactors} className={`p-2 rounded-xl transition-colors ${hideCofactors ? 'bg-warn/10 text-warn' : 'text-content-muted hover:text-content hover:bg-surface-inset/60'}`} title={hideCofactors ? 'Show cofactors' : 'Hide cofactors'}>
                <FlaskConical className="w-4.5 h-4.5" />
              </button>
            )}

            <label data-tour="dock-actions" className={`p-2 rounded-xl text-content-muted hover:text-content hover:bg-surface-inset/60 transition-colors cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`} title="Import session">
              <Upload className="w-4.5 h-4.5" />
              <input type="file" accept=".json" onChange={onImportSession} className="hidden" disabled={isLoading} />
            </label>

            {canExport && (
              <button onClick={onExportSession} disabled={isLoading} className="p-2 rounded-xl text-content-muted hover:text-content hover:bg-surface-inset/60 transition-colors disabled:opacity-50" title="Export session">
                <Download className="w-4.5 h-4.5" />
              </button>
            )}

            <ThemeSelector />
          </div>
        </div>
      </div>

      {/* ── Expanded search panel ── */}
      {(expanded || forceExpanded) && (
        <div data-tour="dock-expanded" className="bg-surface-overlay/95 backdrop-blur-xl border-b border-brd/40 shadow-lg">
          <div className="px-4 py-3 space-y-2 max-w-3xl mx-auto">

            {searchPairs.map((pair, index) => {
              const pairMode = pair.mode || 'compound';
              return (
              <div key={pair.id || index} className="flex items-center gap-2 rounded-xl bg-surface-inset/60 px-2.5 py-2 group">

                {/* Color dot — click to change */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-3 h-3 rounded-full cursor-pointer ring-2 ring-surface-secondary shadow-sm"
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
                  className="flex-shrink-0 text-[11px] font-medium rounded-md border border-brd/70 bg-input-bg/80 text-content px-1 py-1 focus:ring-1 focus:ring-brand/30 outline-none"
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
                        className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg/80 border border-brd/70 text-sm text-content placeholder-content-muted focus:border-brand-hover focus:ring-1 focus:ring-brand/20 transition-all outline-none"
                      />
                    </div>
                    <span className="text-content-muted flex-shrink-0 text-xs font-medium select-none">→</span>
                    <div className="flex-1 min-w-0">
                      <AutocompleteInput
                        idPrefix={`dock-tgt-${index}`}
                        placeholder="Target *"
                        value={pair.target}
                        onValueSelect={(id) => handleTargetSelect(index, id)}
                        compoundData={compoundData}
                        disabled={isLoading}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg/80 border border-brd/70 text-sm text-content placeholder-content-muted focus:border-brand-hover focus:ring-1 focus:ring-brand/20 transition-all outline-none"
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
                      className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg/80 border border-brd/70 text-sm text-content placeholder-content-muted focus:border-brand-hover focus:ring-1 focus:ring-brand/20 transition-all outline-none"
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
                      className="w-full px-2.5 py-1.5 rounded-lg bg-input-bg/80 border border-brd/70 text-sm text-content placeholder-content-muted focus:border-brand-hover focus:ring-1 focus:ring-brand/20 transition-all outline-none"
                    />
                  </div>
                )}

                {/* Fixed-width trailing zone — always same width for alignment */}
                <div className="flex items-center gap-0.5 flex-shrink-0 w-[72px] justify-end">
                  {typeof pair.resultCount === 'number' && pair.resultCount > 0 && (
                    <span className="text-[10px] font-bold text-ok bg-ok-subtle/80 px-1.5 py-0.5 rounded-full">
                      {pair.resultCount}
                    </span>
                  )}
                  {pair.hasResults !== undefined && (
                    <button
                      onClick={() => onToggleVisibility(index)}
                      className={`p-1 rounded-md transition-all ${pair.visible ? 'text-ok hover:bg-ok-subtle' : 'text-content-muted hover:bg-surface-inset'}`}
                    >
                      {pair.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {searchPairs.length > 1 ? (
                    <button
                      onClick={() => removePair(index)}
                      className="p-1 rounded-md text-content-muted hover:text-err hover:bg-err-subtle transition-all opacity-0 group-hover:opacity-100"
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-content-secondary hover:bg-surface-inset/70 transition-all disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                Add query
              </button>

              <div className="flex-1" />

              <button
                onClick={handleSearch}
                disabled={isSearchDisabled}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isLoading ? 'Searching…' : 'Explore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingDock;
