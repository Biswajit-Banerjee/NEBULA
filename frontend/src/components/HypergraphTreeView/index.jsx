import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Route, X, Crosshair, Eye, EyeOff } from 'lucide-react';
import TreeNode from './TreeNode';

/**
 * HypergraphTreeView — compact AND-OR tree with solution browser.
 */
const HypergraphTreeView = ({ treeData, height = '600px', stats, solutions = [], focusedPath, onFocusPath }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [activeSolution, setActiveSolution] = useState(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const treeContainerRef = useRef(null);

  // Auto-expand root + its first-level producers on load
  useEffect(() => {
    if (treeData && treeData.id) {
      const initial = new Set([treeData.id]);
      (treeData.producers || []).forEach(rxn => initial.add(rxn.id));
      setExpandedNodes(initial);
      setActiveSolution(null);
    }
  }, [treeData]);

  // Auto-show solutions panel if solutions exist
  useEffect(() => {
    if (solutions && solutions.length > 0) setShowSolutions(true);
  }, [solutions]);

  const toggleNode = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Set of reaction names in the active solution (for tree highlighting)
  const activeReactions = useMemo(() => {
    if (activeSolution === null || !solutions[activeSolution]) return new Set();
    return new Set(solutions[activeSolution].reactions.map(r => r.reaction));
  }, [activeSolution, solutions]);

  // When selecting a solution, expand only nodes on the solution's path
  const selectSolution = useCallback((idx) => {
    if (activeSolution === idx) {
      setActiveSolution(null);
      return;
    }
    setActiveSolution(idx);

    if (!treeData || !solutions[idx]) return;
    const solRxnNames = new Set(solutions[idx].reactions.map(r => r.reaction));

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
    setExpandedNodes(toExpand);
  }, [activeSolution, treeData, solutions]);

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
    setActiveSolution(null);
  }, [treeData]);

  const collapseAll = useCallback(() => {
    if (treeData && treeData.id) {
      setExpandedNodes(new Set([treeData.id]));
      setActiveSolution(null);
    }
  }, [treeData]);

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
      {/* ── Compact toolbar ── */}
      <div className="flex-shrink-0 z-10 bg-surface-overlay/80 backdrop-blur border-b border-brd/50 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: title + stats inline */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-content whitespace-nowrap">Backtrace</span>
            <span className="font-mono text-xs font-bold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.5 rounded">{treeData.id}</span>
            {stats && (
              <span className="text-[10px] text-content-muted whitespace-nowrap">
                {stats.total_compounds}c · {stats.total_reactions}r · d{stats.max_depth}
              </span>
            )}
            {/* Active state indicators */}
            {activeSolution !== null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok bg-ok-subtle/50 px-1.5 py-0.5 rounded">
                Path {activeSolution + 1}
                <button onClick={() => setActiveSolution(null)} className="hover:text-err" title="Clear"><X className="w-3 h-3" /></button>
              </span>
            )}
            {focusedPath && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                <Crosshair className="w-3 h-3" /> Focused
                <button onClick={() => onFocusPath && onFocusPath(null)} className="hover:text-err" title="Clear focus"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-content-secondary hover:text-content hover:bg-surface-overlay/80"
              title="Expand all"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" /> Expand
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-content-secondary hover:text-content hover:bg-surface-overlay/80"
              title="Collapse"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse
            </button>
            {solutions.length > 0 && (
              <button
                onClick={() => setShowSolutions(s => !s)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${
                  showSolutions
                    ? 'text-ok bg-ok-subtle/50'
                    : 'text-content-secondary hover:text-content hover:bg-surface-overlay/80'
                }`}
                title="Toggle paths panel"
              >
                <Route className="w-3.5 h-3.5" />
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
          className={`h-full overflow-auto py-6 px-8 ${
            showSolutions ? 'flex-1 min-w-0' : 'w-full'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <TreeNode
              node={treeData}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              activeReactions={activeReactions}
              depth={0}
            />
          </div>
        </div>

        {/* Paths panel — compact */}
        {showSolutions && solutions.length > 0 && (
          <div className="w-80 flex-shrink-0 h-full border-l border-brd/50 bg-surface-inset/80 flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-brd/50">
              <span className="text-xs font-bold text-content flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-ok" />
                Paths
                <span className="text-content-muted font-normal">for {treeData.id}</span>
              </span>
              <button onClick={() => setShowSolutions(false)} className="text-content-muted hover:text-content p-0.5 rounded" title="Close">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Path list */}
            <div className="flex-1 overflow-auto">
              {solutions.map((sol, idx) => {
                const isActive = activeSolution === idx;
                const isFocused = focusedPath && focusedPath.id === sol.id;
                return (
                  <div
                    key={sol.id}
                    onClick={() => selectSolution(idx)}
                    className={`px-3 py-2 border-b border-brd/15 cursor-pointer ${
                      isFocused
                        ? 'bg-brand/8 border-l-2 border-l-brand'
                        : isActive
                          ? 'bg-ok-subtle/30 border-l-2 border-l-ok'
                          : 'border-l-2 border-l-transparent hover:bg-surface-overlay/40'
                    }`}
                  >
                    {/* Compact header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${
                          isFocused ? 'text-brand' : isActive ? 'text-ok' : 'text-content'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-[10px] text-content-muted">
                          {sol.reactionCount} step{sol.reactionCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onFocusPath && onFocusPath(sol)}
                          className={`p-1 rounded ${
                            isFocused ? 'text-brand bg-brand/15' : 'text-content-muted hover:text-brand hover:bg-brand/8'
                          }`}
                          title={isFocused ? 'Unfocus' : 'Focus — filter all views to this path'}
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => selectSolution(idx)}
                          className={`p-1 rounded ${
                            isActive ? 'text-ok bg-ok/15' : 'text-content-muted hover:text-ok hover:bg-ok/8'
                          }`}
                          title={isActive ? 'Deselect' : 'Highlight in tree'}
                        >
                          {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {/* Reaction list — compact, one line each */}
                    <div className="flex flex-col gap-0.5 ml-1">
                      {sol.reactions.map((r, rIdx) => (
                        <div key={r.reaction} className="flex items-baseline gap-1.5 text-[10px]">
                          <span className="text-content-muted w-3 text-right flex-shrink-0">{rIdx + 1}</span>
                          <span className={`font-mono font-semibold truncate ${isActive ? 'text-ok' : 'text-content'}`}>
                            {r.reaction}
                          </span>
                        </div>
                      ))}
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
