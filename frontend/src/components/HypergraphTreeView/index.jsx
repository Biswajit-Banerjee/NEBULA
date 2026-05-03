import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link2, ChevronsDownUp, ChevronsUpDown, Route, X, ArrowRight } from 'lucide-react';
import TreeNode from './TreeNode';

/**
 * HypergraphTreeView — full-width collapsible AND-OR tree with solution browser.
 *
 * Props:
 *   treeData   — the AND-OR tree JSON from /api/backtrace/tree
 *   height     — container height (CSS string)
 *   stats      — tree stats from the backend
 *   solutions  — array of solution objects from enumerate_solutions
 */
const HypergraphTreeView = ({ treeData, height = '600px', stats, solutions = [] }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [highlightedNode, setHighlightedNode] = useState(null);
  const [activeSolution, setActiveSolution] = useState(null); // index or null
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

  const handleHighlight = useCallback((nodeId) => {
    setHighlightedNode(nodeId);
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

    // Walk the tree to find which nodes belong to this solution
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
          <Route className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No backtrace data available</p>
          <p className="text-xs mt-1 opacity-60">Search for a compound to trace its biosynthetic origins</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-surface" style={{ height }}>
      {/* ── Header bar ── */}
      <div className="flex-shrink-0 z-10 bg-surface-overlay/80 backdrop-blur-xl border-b border-brd/60 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-content tracking-tight flex items-center gap-2">
                <span className="w-1 h-5 rounded-full" style={{ background: `linear-gradient(to bottom, rgb(var(--brand-secondary)), rgb(var(--brand-primary)))` }}></span>
                Biosynthetic Backtrace
              </h2>
              <p className="text-xs text-content-secondary font-medium ml-3">
                Pathway origins of <span className="font-mono font-bold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.5 rounded">{treeData.id}</span>
              </p>
            </div>
            {/* Stats pills */}
            {stats && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-secondary/10 border border-brand-secondary/20 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-secondary animate-pulse"></div>
                  <span className="text-xs font-bold text-brand-secondary">{stats.total_compounds}</span>
                  <span className="text-[10px] font-medium text-brand-secondary/70">metabolites</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/20 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-sm bg-brand"></div>
                  <span className="text-xs font-bold text-brand">{stats.total_reactions}</span>
                  <span className="text-[10px] font-medium text-brand/70">reactions</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-inset border border-brd/50 shadow-sm">
                  <span className="text-xs font-bold text-content">depth {stats.max_depth}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-content-secondary hover:text-content bg-surface-overlay/60 hover:bg-surface-overlay border border-brd/60 hover:border-brd transition-all shadow-sm hover:shadow"
              title="Expand all nodes"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" /> Expand all
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-content-secondary hover:text-content bg-surface-overlay/60 hover:bg-surface-overlay border border-brd/60 hover:border-brd transition-all shadow-sm hover:shadow"
              title="Collapse to root"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse
            </button>

            {solutions.length > 0 && (
              <button
                onClick={() => { setShowSolutions(s => !s); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm hover:shadow ${
                  showSolutions
                    ? 'text-ok bg-ok-subtle/60 border-ok/30'
                    : 'text-content-secondary bg-surface-overlay/60 hover:bg-ok-subtle/30 border-brd/60 hover:border-ok/30'
                }`}
                title="Toggle minimal paths panel"
              >
                <Route className="w-3.5 h-3.5" />
                {solutions.length} pathway{solutions.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 text-[11px] text-content-secondary font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(var(--tree-metabolite))' }} /> Metabolite
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: 'rgb(var(--tree-reaction))' }} /> Reaction
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(var(--tree-source))' }} /> Source
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(var(--tree-seed))' }} /> Seed
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: 'rgb(var(--tree-cofactor))' }} /> Cofactor
          </span>
          <span className="flex items-center gap-2">
            <Link2 className="w-3 h-3" /> Shared
          </span>
          {activeSolution !== null && (
            <span className="flex items-center gap-2 text-ok font-bold bg-ok-subtle/60 px-2.5 py-1 rounded-lg border border-ok/30">
              <span className="w-2.5 h-2.5 rounded-sm bg-ok shadow-sm ring-2 ring-ok/20" />
              Pathway #{activeSolution + 1}
              <button onClick={() => setActiveSolution(null)} className="ml-1 hover:text-err transition-colors" title="Clear pathway selection">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Tree panel */}
        <div
          ref={treeContainerRef}
          className={`h-full overflow-auto py-6 px-8 transition-all duration-200 ${
            showSolutions ? 'flex-1 min-w-0' : 'w-full'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <TreeNode
              node={treeData}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              highlightedNode={highlightedNode}
              onHighlight={handleHighlight}
              activeReactions={activeReactions}
              depth={0}
            />
          </div>
        </div>

        {/* Minimal Paths panel */}
        {showSolutions && solutions.length > 0 && (
          <div className="w-96 flex-shrink-0 h-full border-l border-brd/60 bg-surface-inset/90 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brd/60 bg-surface-overlay/40">
              <div>
                <h3 className="text-sm font-bold text-content flex items-center gap-2">
                  <Route className="w-4 h-4 text-ok" />
                  Minimal Paths
                </h3>
                <p className="text-[10px] text-content-muted mt-1 leading-relaxed">
                  Minimal reaction sets producing <span className="font-mono font-bold text-ok">{treeData.id}</span>
                </p>
              </div>
              <button
                onClick={() => setShowSolutions(false)}
                className="text-content-muted hover:text-content transition-all p-1.5 rounded-lg hover:bg-surface-inset/60 hover:shadow-sm"
                title="Close paths panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {solutions.map((sol, idx) => {
                const isActive = activeSolution === idx;
                return (
                  <button
                    key={sol.id}
                    onClick={() => selectSolution(idx)}
                    className={`w-full text-left px-5 py-4 border-b border-brd/20 transition-all ${
                      isActive
                        ? 'bg-ok-subtle/40 border-l-4 border-l-ok shadow-sm'
                        : 'hover:bg-surface-overlay/80 border-l-4 border-l-transparent hover:border-l-brd'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-bold ${
                        isActive ? 'text-ok' : 'text-content'
                      }`}>
                        Pathway {idx + 1}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        isActive 
                          ? 'bg-ok/20 text-ok'
                          : 'bg-surface-inset text-content-secondary'
                      }`}>
                        {sol.reactionCount} step{sol.reactionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {sol.reactions.map((r, rIdx) => (
                        <div key={r.reaction} className="flex items-start gap-2.5">
                          <span className={`text-[10px] font-bold mt-0.5 w-5 text-right flex-shrink-0 ${
                            isActive ? 'text-ok/80' : 'text-content-muted'
                          }`}>
                            {rIdx + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[11px] font-mono font-bold ${
                              isActive ? 'text-ok' : 'text-content'
                            }`}>
                              {r.reaction}
                            </span>
                            {r.equation && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <ArrowRight className={`w-3 h-3 flex-shrink-0 ${
                                  isActive ? 'text-ok/60' : 'text-content-muted'
                                }`} />
                                <span className="text-[10px] font-mono text-content-secondary truncate leading-relaxed" title={r.equation}>
                                  {r.equation}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
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
