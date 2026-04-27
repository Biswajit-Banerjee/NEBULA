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
      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
        <div className="text-center">
          <Route className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No backtrace data available</p>
          <p className="text-xs mt-1 opacity-60">Search for a compound to trace its biosynthetic origins</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50" style={{ height }}>
      {/* ── Header bar ── */}
      <div className="flex-shrink-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/40 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-violet-500 rounded-full"></span>
                Biosynthetic Backtrace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-3">
                Pathway origins of <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded">{treeData.id}</span>
              </p>
            </div>
            {/* Stats pills */}
            {stats && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-900/20 dark:to-cyan-900/10 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{stats.total_compounds}</span>
                  <span className="text-[10px] font-medium text-cyan-600/70 dark:text-cyan-400/70">metabolites</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-900/10 border border-violet-200/50 dark:border-violet-700/30 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-sm bg-violet-500"></div>
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">{stats.total_reactions}</span>
                  <span className="text-[10px] font-medium text-violet-600/70 dark:text-violet-400/70">reactions</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/40 dark:to-slate-800/20 border border-slate-200/50 dark:border-slate-700/30 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">depth {stats.max_depth}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm hover:shadow"
              title="Expand all nodes"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" /> Expand all
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm hover:shadow"
              title="Collapse to root"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse
            </button>

            {solutions.length > 0 && (
              <button
                onClick={() => { setShowSolutions(s => !s); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-sm hover:shadow ${
                  showSolutions
                    ? 'text-emerald-700 dark:text-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/20 border-emerald-300/60 dark:border-emerald-700/40'
                    : 'text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 border-slate-200/60 dark:border-slate-700/40 hover:border-emerald-300/40'
                }`}
                title="Toggle minimal pathways panel"
              >
                <Route className="w-3.5 h-3.5" />
                {solutions.length} pathway{solutions.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm" /> Metabolite
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-violet-400 shadow-sm" /> Reaction
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> Source
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> Seed
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400 shadow-sm" /> Cofactor
          </span>
          <span className="flex items-center gap-2">
            <Link2 className="w-3 h-3" /> Shared
          </span>
          {activeSolution !== null && (
            <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/60 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-300/40 dark:border-emerald-700/30">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm ring-2 ring-emerald-200/50 dark:ring-emerald-700/40" />
              Pathway #{activeSolution + 1}
              <button onClick={() => setActiveSolution(null)} className="ml-1 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Clear pathway selection">
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

        {/* Minimal Pathways panel */}
        {showSolutions && solutions.length > 0 && (
          <div className="w-96 flex-shrink-0 h-full border-l border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-br from-slate-50/90 via-white/50 to-slate-50/90 dark:from-slate-800/60 dark:via-slate-800/40 dark:to-slate-800/60 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/40 bg-white/40 dark:bg-slate-900/40">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Route className="w-4 h-4 text-emerald-500" />
                  Minimal Pathways
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Minimal reaction sets producing <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{treeData.id}</span>
                </p>
              </div>
              <button
                onClick={() => setShowSolutions(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:shadow-sm"
                title="Close pathways panel"
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
                    className={`w-full text-left px-5 py-4 border-b border-slate-200/40 dark:border-slate-700/20 transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-50/90 to-emerald-100/60 dark:from-emerald-900/25 dark:to-emerald-900/15 border-l-4 border-l-emerald-500 shadow-sm'
                        : 'hover:bg-white/80 dark:hover:bg-slate-700/40 border-l-4 border-l-transparent hover:border-l-slate-300 dark:hover:border-l-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-bold ${
                        isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                      }`}>
                        Pathway {idx + 1}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        isActive 
                          ? 'bg-emerald-200/50 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200/50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400'
                      }`}>
                        {sol.reactionCount} step{sol.reactionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {sol.reactions.map((r, rIdx) => (
                        <div key={r.reaction} className="flex items-start gap-2.5">
                          <span className={`text-[10px] font-bold mt-0.5 w-5 text-right flex-shrink-0 ${
                            isActive ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-slate-400 dark:text-slate-600'
                          }`}>
                            {rIdx + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[11px] font-mono font-bold ${
                              isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {r.reaction}
                            </span>
                            {r.equation && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <ArrowRight className={`w-3 h-3 flex-shrink-0 ${
                                  isActive ? 'text-emerald-500/60' : 'text-slate-400 dark:text-slate-600'
                                }`} />
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate leading-relaxed" title={r.equation}>
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
