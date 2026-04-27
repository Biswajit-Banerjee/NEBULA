import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Link2, ArrowRight } from 'lucide-react';

/**
 * Leaf-reason → visual styling map
 */
const LEAF_STYLES = {
  source: {
    bg: 'bg-green-50 dark:bg-green-900/15',
    border: 'border-green-200 dark:border-green-700/30',
    dot: 'bg-green-400',
    label: 'Source',
  },
  gen0: {
    bg: 'bg-blue-50 dark:bg-blue-900/15',
    border: 'border-blue-200 dark:border-blue-700/30',
    dot: 'bg-blue-400',
    label: 'Seed',
  },
  cofactor: {
    bg: 'bg-stone-50 dark:bg-stone-800/30',
    border: 'border-stone-200 dark:border-stone-600/30',
    dot: 'bg-stone-400',
    label: 'Cofactor',
  },
  unknown: {
    bg: 'bg-gray-50 dark:bg-gray-800/30',
    border: 'border-gray-200 dark:border-gray-600/30',
    dot: 'bg-gray-400',
    label: 'Unknown',
  },
  no_producers: {
    bg: 'bg-orange-50 dark:bg-orange-900/15',
    border: 'border-orange-200 dark:border-orange-700/30',
    dot: 'bg-orange-300',
    label: 'Dead end',
  },
};

/**
 * CompoundNode — renders a metabolite node.
 * Click to expand/collapse its producing reactions.
 */
const CompoundNode = memo(({ node, expandedNodes, toggleNode, highlightedNode, onHighlight, activeReactions, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const isHighlighted = highlightedNode === node.id;
  const hasProducers = node.producers && node.producers.length > 0;
  const hasActiveFilter = activeReactions && activeReactions.size > 0;
  const isRoot = depth === 0;

  // Shared node — dashed border, link icon
  if (node.isShared) {
    return (
      <div className="my-1.5">
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs border-2 border-dashed
            border-slate-300 dark:border-slate-600/40 bg-slate-100/60 dark:bg-slate-800/30
            text-slate-500 dark:text-slate-400 cursor-default italic shadow-sm`}
          title={`${node.id} — already expanded elsewhere in the tree`}
        >
          <Link2 className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          <span className="font-mono text-xs font-semibold">{node.id}</span>
          {node.generation >= 0 && <span className="text-[10px] opacity-60 font-medium">gen {node.generation}</span>}
          <span className="text-[10px] opacity-60 font-medium">(ref)</span>
        </div>
      </div>
    );
  }

  // Leaf node — styled by reason
  if (node.isLeaf) {
    const style = LEAF_STYLES[node.leafReason] || LEAF_STYLES.unknown;
    return (
      <div className="my-1.5">
        <div
          className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border
            ${style.bg} ${style.border} text-slate-700 dark:text-slate-200 cursor-default shadow-sm hover:shadow transition-shadow`}
          onMouseEnter={() => onHighlight(node.id)}
          onMouseLeave={() => onHighlight(null)}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${style.dot} flex-shrink-0 shadow-sm`} />
          <span className="font-mono font-bold text-xs">{node.id}</span>
          {node.generation >= 0 && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">gen {node.generation}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.bg} font-semibold opacity-80`}>
            {style.label}
          </span>
        </div>
      </div>
    );
  }

  // Regular metabolite — expandable
  return (
    <div className="my-1.5">
      <button
        onClick={() => toggleNode(node.id)}
        onMouseEnter={() => onHighlight(node.id)}
        onMouseLeave={() => onHighlight(null)}
        className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border transition-all duration-200
          ${isRoot
            ? (isHighlighted
              ? 'border-cyan-500 dark:border-cyan-400 bg-gradient-to-br from-cyan-50 to-cyan-100/80 dark:from-cyan-900/40 dark:to-cyan-900/30 shadow-lg ring-2 ring-cyan-300/50 dark:ring-cyan-600/40'
              : 'border-cyan-400 dark:border-cyan-600/50 bg-gradient-to-br from-cyan-50/90 to-cyan-100/60 dark:from-cyan-900/30 dark:to-cyan-900/20 shadow-md')
            : (isHighlighted
              ? 'border-cyan-400 dark:border-cyan-500 bg-gradient-to-br from-cyan-50/80 to-white dark:from-cyan-900/25 dark:to-slate-800/30 shadow-md'
              : 'border-slate-300 dark:border-slate-600/40 bg-white dark:bg-slate-800/40 hover:bg-gradient-to-br hover:from-cyan-50/60 hover:to-white dark:hover:from-cyan-900/20 dark:hover:to-slate-800/40 hover:border-cyan-300 dark:hover:border-cyan-600/50 shadow-sm hover:shadow')
          }
          text-slate-800 dark:text-slate-100`}
      >
        {hasProducers && (
          isExpanded
            ? <ChevronDown className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        )}
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${isRoot ? 'bg-cyan-500 ring-2 ring-cyan-300/60 dark:ring-cyan-600/50' : 'bg-cyan-500'}`} />
        <span className={`font-mono font-bold ${isRoot ? 'text-sm' : 'text-xs'}`}>{node.id}</span>
        {node.generation >= 0 && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">gen {node.generation}</span>}
        {hasProducers && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-100/60 dark:bg-slate-700/40 px-2 py-0.5 rounded-full">
            {node.producers.length} reaction{node.producers.length > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Expanded: show producing reactions */}
      {isExpanded && hasProducers && (
        <div className="ml-4 pl-5 border-l-[3px] border-slate-300 dark:border-slate-700/50 mt-2">
          {node.producers.map((rxn, idx) => (
            <ReactionNode
              key={rxn.id || idx}
              node={rxn}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              highlightedNode={highlightedNode}
              onHighlight={onHighlight}
              activeReactions={activeReactions}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CompoundNode.displayName = 'CompoundNode';


/**
 * ReactionNode — renders a reaction step.
 * Click to expand/collapse its required reactants.
 */
const ReactionNode = memo(({ node, expandedNodes, toggleNode, highlightedNode, onHighlight, activeReactions, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const isHighlighted = highlightedNode === node.id;
  const hasReactants = node.reactants && node.reactants.length > 0;
  const hasActiveFilter = activeReactions && activeReactions.size > 0;
  const isInSolution = hasActiveFilter && activeReactions.has(node.reaction);
  const isDimmed = hasActiveFilter && !isInSolution;

  return (
    <div className={`my-2 ${isDimmed ? 'opacity-20' : ''} transition-opacity duration-200`}>
      <div className="flex flex-col gap-1">
        <button
          onClick={() => toggleNode(node.id)}
          onMouseEnter={() => onHighlight(node.id)}
          onMouseLeave={() => onHighlight(null)}
          className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border transition-all duration-200
            ${isInSolution
              ? 'border-emerald-400 dark:border-emerald-600/50 bg-gradient-to-br from-emerald-50/90 to-emerald-100/70 dark:from-emerald-900/30 dark:to-emerald-900/20 shadow-md ring-2 ring-emerald-300/50 dark:ring-emerald-700/30'
              : isHighlighted
                ? 'border-violet-400 dark:border-violet-500 bg-gradient-to-br from-violet-50/80 to-violet-100/50 dark:from-violet-900/25 dark:to-violet-900/15 shadow-md'
                : 'border-slate-300 dark:border-slate-600/40 bg-slate-100/60 dark:bg-slate-800/30 hover:bg-gradient-to-br hover:from-violet-50/60 hover:to-white dark:hover:from-violet-900/15 dark:hover:to-slate-800/30 hover:border-violet-300 dark:hover:border-violet-600/50 shadow-sm hover:shadow'
            }
            text-slate-700 dark:text-slate-200`}
        >
          {hasReactants && (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
          <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm ${isInSolution ? 'bg-emerald-500' : 'bg-violet-400 dark:bg-violet-400'}`} />
          <span className="font-mono font-bold text-xs">{node.reaction}</span>
          {node.ecList && node.ecList.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 font-semibold">
              EC {node.ecList[0]}{node.ecList.length > 1 ? ` +${node.ecList.length - 1}` : ''}
            </span>
          )}
          {hasReactants && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-100/60 dark:bg-slate-700/40 px-2 py-0.5 rounded-full">
              {node.reactants.length} substrate{node.reactants.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        {/* Equation — always visible when reaction is shown */}
        {node.equation && (
          <div className="ml-9 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono max-w-2xl">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
            <span className="truncate" title={node.equation}>{node.equation}</span>
          </div>
        )}
      </div>

      {/* Expanded: show reactants */}
      {isExpanded && hasReactants && (
        <div className={`ml-4 pl-5 border-l-[3px] mt-2 ${isInSolution ? 'border-emerald-300 dark:border-emerald-700/40' : 'border-slate-300 dark:border-slate-700/50'}`}>
          {node.reactants.map((child, idx) => (
            <CompoundNode
              key={child.id || idx}
              node={child}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              highlightedNode={highlightedNode}
              onHighlight={onHighlight}
              activeReactions={activeReactions}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ReactionNode.displayName = 'ReactionNode';


/**
 * TreeNode — entry point; dispatches to CompoundNode or ReactionNode
 */
const TreeNode = ({ node, expandedNodes, toggleNode, highlightedNode, onHighlight, activeReactions, depth = 0 }) => {
  if (!node) return null;

  if (node.type === 'compound') {
    return (
      <CompoundNode
        node={node}
        expandedNodes={expandedNodes}
        toggleNode={toggleNode}
        highlightedNode={highlightedNode}
        onHighlight={onHighlight}
        activeReactions={activeReactions}
        depth={depth}
      />
    );
  }

  if (node.type === 'reaction') {
    return (
      <ReactionNode
        node={node}
        expandedNodes={expandedNodes}
        toggleNode={toggleNode}
        highlightedNode={highlightedNode}
        onHighlight={onHighlight}
        activeReactions={activeReactions}
        depth={depth}
      />
    );
  }

  return null;
};

export default TreeNode;
