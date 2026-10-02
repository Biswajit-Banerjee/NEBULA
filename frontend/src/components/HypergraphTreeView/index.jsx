import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Route, X, Pin, Copy, Check, Link2, AlertTriangle } from 'lucide-react';
import TreeNode from './TreeNode';

// Distinct, ad-hoc colors for "pinned" path comparison — deliberately not
// reused from the pair-color palette so pinned paths never get confused
// with per-search-pair coloring elsewhere in the app.
const PIN_PALETTE = ['#f97316', '#ec4899', '#3b82f6', '#84cc16'];

/**
 * HypergraphTreeView — compact, collapsible AND-OR tree with a
 * target-switcher strip (for multi-target searches) and a readable
 * paths/solutions browser supporting selection, comparison (pin) and copy.
 */
const HypergraphTreeView = ({
  treeTargets = [],
  activeTreeIndex = 0,
  onSelectTreeTarget,
  sharedReactionInfo,
  height = '600px',
  focusedPath,
  onFocusPath,
  deletedReactionNames,
}) => {
  const activeTarget = treeTargets[activeTreeIndex] || treeTargets[0] || null;
  const treeData = activeTarget?.tree || null;
  const stats = activeTarget?.stats || null;
  const solutions = activeTarget?.solutions || [];
  const deletedSet = deletedReactionNames || new Set();

  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [activeSolution, setActiveSolution] = useState(null);
  const [pinnedSolutions, setPinnedSolutions] = useState([]);
  const [showSolutions, setShowSolutions] = useState(true);
  const [sharedOnly, setSharedOnly] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const treeContainerRef = useRef(null);

  // Reset local selection/expansion state whenever the active target/tree changes
  useEffect(() => {
    if (treeData && treeData.id) {
      const initial = new Set([treeData.id]);
      (treeData.producers || []).forEach(rxn => initial.add(rxn.id));
      setExpandedNodes(initial);
    }
    setActiveSolution(null);
    setPinnedSolutions([]);
    setSharedOnly(false);
  }, [treeData]);

  const toggleNode = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const primaryReactions = useMemo(() => {
    if (activeSolution === null || !solutions[activeSolution]) return new Set();
    return new Set(solutions[activeSolution].reactions.map(r => r.reaction));
  }, [activeSolution, solutions]);

  const pinnedReactionColors = useMemo(() => {
    const map = new Map();
    pinnedSolutions.forEach((solId, pinIdx) => {
      const sol = solutions.find(s => s.id === solId);
      if (!sol) return;
      const color = PIN_PALETTE[pinIdx % PIN_PALETTE.length];
      sol.reactions.forEach(r => {
        if (!map.has(r.reaction)) map.set(r.reaction, []);
        map.get(r.reaction).push(color);
      });
    });
    return map;
  }, [pinnedSolutions, solutions]);

  const expandToSolution = useCallback((solIdx) => {
    if (!treeData || !solutions[solIdx]) return;
    const solRxnNames = new Set(solutions[solIdx].reactions.map(r => r.reaction));
    const toExpand = new Set();
    const walk = (node) => {
      if (!node) return false;
      if (node.type === 'compound') {
        if (node.isLeaf || node.isShared) return true;
        for (const rxn of (node.producers || [])) {
          if (solRxnNames.has(rxn.reaction)) {
            toExpand.add(node.id);
            toExpand.add(rxn.id);
            for (const child of (rxn.reactants || [])) walk(child);
            return true;
          }
        }
        return false;
      }
      return false;
    };
    walk(treeData);
    setExpandedNodes(prev => new Set([...prev, ...toExpand]));
  }, [treeData, solutions]);

  // Single unified action: selecting a path both highlights it in the tree
  // AND filters the Table/Network/Map views to its reactions.
  const selectSolution = useCallback((idx) => {
    setActiveSolution(prev => {
      const next = prev === idx ? null : idx;
      if (next === null) {
        onFocusPath && onFocusPath(null);
      } else {
        expandToSolution(idx);
        const sol = solutions[idx];
        onFocusPath && onFocusPath({ ...sol, id: `${activeTreeIndex}:${sol.id}` });
      }
      return next;
    });
  }, [expandToSolution, solutions, activeTreeIndex, onFocusPath]);

  const togglePin = useCallback((e, solId) => {
    e.stopPropagation();
    setPinnedSolutions(prev => {
      if (prev.includes(solId)) return prev.filter(id => id !== solId);
      if (prev.length >= PIN_PALETTE.length) return prev;
      return [...prev, solId];
    });
  }, []);

  const copySolution = useCallback((e, sol) => {
    e.stopPropagation();
    const text = sol.reactions.map((r, i) => `${i + 1}. ${r.reaction}${r.equation ? `  ${r.equation}` : ''}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(sol.id);
      setTimeout(() => setCopiedId(null), 1200);
    }).catch(() => {});
  }, []);

  const expandAll = useCallback(() => {
    if (!treeData) return;
    const all = new Set();
    const walk = (node) => {
      if (!node) return;
      if (node.type === 'compound') {
        all.add(node.id);
        if (!node.isShared) (node.producers || []).forEach(rxn => walk(rxn));
      } else if (node.type === 'reaction') {
        all.add(node.id);
        (node.reactants || []).forEach(child => walk(child));
      }
    };
    walk(treeData);
    setExpandedNodes(all);
  }, [treeData]);

  const collapseAll = useCallback(() => {
    if (treeData && treeData.id) {
      setExpandedNodes(new Set([treeData.id]));
    }
  }, [treeData]);

  const visibleSolutions = useMemo(() => {
    if (!sharedOnly || !sharedReactionInfo) return solutions;
    return solutions.filter(sol => sol.reactions.some(r => sharedReactionInfo.has(r.reaction)));
  }, [solutions, sharedOnly, sharedReactionInfo]);

  const sharedCountForTarget = useMemo(() => {
    if (!sharedReactionInfo || sharedReactionInfo.size === 0) return 0;
    const seen = new Set();
    solutions.forEach(sol => sol.reactions.forEach(r => {
      if (sharedReactionInfo.has(r.reaction)) seen.add(r.reaction);
    }));
    return seen.size;
  }, [solutions, sharedReactionInfo]);

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-full text-content-muted">
        <div className="text-center">
          <Route className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No backtrace data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-surface" style={{ height }}>
      {/* ── Target switcher — only shown for multi-target searches ── */}
      {treeTargets.length > 1 && (
        <div className="flex-shrink-0 z-10 bg-surface-inset/60 border-b border-brd/40 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wide flex-shrink-0 mr-1">Targets</span>
          {treeTargets.map((t, idx) => {
            const isActive = idx === activeTreeIndex;
            return (
              <button
                key={t.pairId || idx}
                onClick={() => onSelectTreeTarget && onSelectTreeTarget(idx)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? 'bg-surface-overlay shadow-sm border-brd/60 text-content'
                    : 'border-transparent text-content-muted hover:text-content hover:bg-surface-overlay/50'
                }`}
                title={`${t.source ? `${t.source} → ` : ''}${t.target}`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
                <span className="font-mono font-semibold">{t.target}</span>
                <span className="text-content-muted">{(t.solutions || []).length} paths</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 z-10 bg-surface-overlay/80 backdrop-blur border-b border-brd/50 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-content whitespace-nowrap">Backtrace</span>
            <span className="font-mono text-xs font-bold text-brand-secondary bg-brand-secondary/10 px-2 py-0.5 rounded">{treeData.id}</span>
            {stats && (
              <span className="text-xs text-content-muted whitespace-nowrap">
                {stats.total_compounds} compounds · {stats.total_reactions} reactions · depth {stats.max_depth}
              </span>
            )}
            {activeSolution !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ok bg-ok-subtle/50 px-2 py-0.5 rounded-full">
                Path {activeSolution + 1} selected
                <button onClick={() => selectSolution(activeSolution)} className="hover:text-err" title="Clear">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-content-secondary hover:text-content hover:bg-surface-overlay/80"
              title="Expand all"
            >
              <ChevronsUpDown className="w-4 h-4" /> Expand
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-content-secondary hover:text-content hover:bg-surface-overlay/80"
              title="Collapse"
            >
              <ChevronsDownUp className="w-4 h-4" /> Collapse
            </button>
            {solutions.length > 0 && (
              <button
                onClick={() => setShowSolutions(s => !s)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  showSolutions ? 'text-ok bg-ok-subtle/50' : 'text-content-secondary hover:text-content hover:bg-surface-overlay/80'
                }`}
                title="Toggle paths panel"
              >
                <Route className="w-4 h-4" />
                {solutions.length} path{solutions.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Tree panel */}
        <div
          ref={treeContainerRef}
          className={`h-full overflow-auto py-6 px-8 ${showSolutions ? 'flex-1 min-w-0' : 'w-full'}`}
        >
          {pinnedSolutions.length > 0 && (
            <div className="max-w-4xl mx-auto mb-4 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Comparing</span>
              {pinnedSolutions.map((solId, i) => (
                <span key={solId} className="inline-flex items-center gap-1.5 text-xs font-medium text-content">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIN_PALETTE[i % PIN_PALETTE.length] }} />
                  Path {solId + 1}
                </span>
              ))}
            </div>
          )}
          <div className="max-w-4xl mx-auto">
            <TreeNode
              node={treeData}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              primaryReactions={primaryReactions}
              pinnedReactionColors={pinnedReactionColors}
              deletedReactionNames={deletedSet}
              depth={0}
            />
          </div>
        </div>

        {/* Paths panel */}
        {showSolutions && solutions.length > 0 && (
          <div className="w-96 flex-shrink-0 h-full border-l border-brd/50 bg-surface-inset/80 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brd/50">
              <span className="text-sm font-bold text-content flex items-center gap-2">
                <Route className="w-4 h-4 text-ok" />
                Paths
                <span className="text-content-muted font-normal">for {treeData.id}</span>
              </span>
              <button onClick={() => setShowSolutions(false)} className="text-content-muted hover:text-content p-1 rounded" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {treeTargets.length > 1 && sharedCountForTarget > 0 && (
              <button
                onClick={() => setSharedOnly(s => !s)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b border-brd/40 text-left transition-colors ${
                  sharedOnly ? 'bg-brand/10 text-brand' : 'text-content-secondary hover:bg-surface-overlay/40'
                }`}
                title="Toggle: show only paths that share a reaction with another target"
              >
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                {sharedCountForTarget} reaction{sharedCountForTarget !== 1 ? 's' : ''} shared with other targets
                {sharedOnly && <span className="ml-auto text-[10px] uppercase">shown</span>}
              </button>
            )}

            <div className="flex-1 overflow-auto">
              {visibleSolutions.map((sol) => {
                const idx = sol.id;
                const isSelected = activeSolution === idx;
                const pinIdx = pinnedSolutions.indexOf(idx);
                const isPinned = pinIdx !== -1;
                const isDisconnected = sol.reactions.some(r => deletedSet.has(r.reaction));
                const isShared = sharedReactionInfo && sol.reactions.some(r => sharedReactionInfo.has(r.reaction));

                return (
                  <div
                    key={sol.id}
                    onClick={() => selectSolution(idx)}
                    className={`group px-4 py-3 border-b border-brd/15 cursor-pointer transition-colors ${
                      isSelected ? 'bg-ok-subtle/30 border-l-4 border-l-ok' : 'border-l-4 border-l-transparent hover:bg-surface-overlay/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={`text-sm font-bold flex-shrink-0 ${isSelected ? 'text-ok' : 'text-content'}`}>#{idx + 1}</span>
                        <span className="text-xs text-content-muted flex-shrink-0">
                          {sol.reactionCount} step{sol.reactionCount !== 1 ? 's' : ''}
                        </span>
                        {isPinned && (
                          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIN_PALETTE[pinIdx % PIN_PALETTE.length] }} />
                        )}
                        {isShared && <Link2 className="w-3.5 h-3.5 text-brand flex-shrink-0" title="Shares a reaction with another target" />}
                        {isDisconnected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warn bg-warn-subtle/60 px-1.5 py-0.5 rounded flex-shrink-0">
                            <AlertTriangle className="w-3 h-3" /> Disconnected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={(e) => copySolution(e, sol)} className="p-1.5 rounded text-content-muted hover:text-brand hover:bg-brand/8" title="Copy reaction list">
                          {copiedId === sol.id ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => togglePin(e, idx)}
                          className={`p-1.5 rounded ${isPinned ? 'text-brand bg-brand/15' : 'text-content-muted hover:text-brand hover:bg-brand/8'}`}
                          title={isPinned ? 'Unpin from comparison' : 'Pin to compare with another path'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-1">
                      {sol.reactions.map((r, rIdx) => {
                        const rDeleted = deletedSet.has(r.reaction);
                        return (
                          <div key={r.reaction} className="flex items-baseline gap-2 text-xs">
                            <span className="text-content-muted w-4 text-right flex-shrink-0">{rIdx + 1}</span>
                            <span className={`font-mono font-semibold flex-shrink-0 ${rDeleted ? 'text-err line-through' : isSelected ? 'text-ok' : 'text-content'}`}>
                              {r.reaction}
                            </span>
                            {r.equation && (
                              <span className="text-content-muted truncate" title={r.equation}>{r.equation}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HypergraphTreeView;
