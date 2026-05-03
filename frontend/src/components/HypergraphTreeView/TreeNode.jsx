import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Link2, ArrowRight } from 'lucide-react';

/**
 * Leaf-reason → visual styling map
 */
const LEAF_STYLES = {
  source: {
    cssVar: '--tree-source',
    label: 'Source',
  },
  gen0: {
    cssVar: '--tree-seed',
    label: 'Seed',
  },
  cofactor: {
    cssVar: '--tree-cofactor',
    label: 'Cofactor',
  },
  unknown: {
    cssVar: '--tree-cofactor',
    label: 'Unknown',
  },
  no_producers: {
    cssVar: '--tree-cofactor',
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
            border-brd bg-surface-inset/60
            text-content-muted cursor-default italic shadow-sm`}
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
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border border-brd text-content cursor-default shadow-sm hover:shadow transition-shadow"
          style={{ backgroundColor: `rgb(var(${style.cssVar}) / 0.12)`, borderColor: `rgb(var(${style.cssVar}) / 0.3)` }}
          onMouseEnter={() => onHighlight(node.id)}
          onMouseLeave={() => onHighlight(null)}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: `rgb(var(${style.cssVar}))` }} />
          <span className="font-mono font-bold text-xs">{node.id}</span>
          {node.generation >= 0 && <span className="text-[10px] text-content-secondary font-medium">gen {node.generation}</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold opacity-80" style={{ backgroundColor: `rgb(var(${style.cssVar}) / 0.1)` }}>
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
        className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border transition-all duration-200 text-content
          ${isRoot
            ? (isHighlighted
              ? 'shadow-lg ring-2'
              : 'shadow-md')
            : (isHighlighted
              ? 'shadow-md'
              : 'border-brd bg-surface-secondary hover:shadow shadow-sm')
          }`}
        style={isRoot || isHighlighted ? {
          borderColor: `rgb(var(--tree-metabolite))`,
          backgroundColor: `rgb(var(--tree-metabolite) / ${isRoot ? 0.12 : 0.08})`,
          ...(isRoot && isHighlighted ? { boxShadow: `0 0 0 2px rgb(var(--tree-metabolite) / 0.3)` } : {})
        } : undefined}
      >
        {hasProducers && (
          isExpanded
            ? <ChevronDown className="w-4 h-4" style={{ color: 'rgb(var(--tree-metabolite))' }} />
            : <ChevronRight className="w-4 h-4 text-content-muted" />
        )}
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${isRoot ? 'ring-2' : ''}`} style={{ backgroundColor: 'rgb(var(--tree-metabolite))', ...(isRoot ? { boxShadow: '0 0 0 2px rgb(var(--tree-metabolite) / 0.3)' } : {}) }} />
        <span className={`font-mono font-bold ${isRoot ? 'text-sm' : 'text-xs'}`}>{node.id}</span>
        {node.generation >= 0 && <span className="text-[10px] text-content-secondary font-medium">gen {node.generation}</span>}
        {hasProducers && (
          <span className="text-[10px] text-content-secondary font-semibold bg-surface-inset/60 px-2 py-0.5 rounded-full">
            {node.producers.length} reaction{node.producers.length > 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Expanded: show producing reactions */}
      {isExpanded && hasProducers && (
        <div className="ml-4 pl-5 border-l-[3px] border-brd mt-2">
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
          className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs border transition-all duration-200 text-content
            ${isInSolution
              ? 'shadow-md ring-2'
              : isHighlighted
                ? 'shadow-md'
                : 'border-brd bg-surface-inset/60 hover:shadow shadow-sm'
            }`}
          style={isInSolution ? {
            borderColor: 'rgb(var(--tree-solution))',
            backgroundColor: 'rgb(var(--tree-solution) / 0.12)',
            boxShadow: '0 0 0 2px rgb(var(--tree-solution) / 0.2)'
          } : isHighlighted ? {
            borderColor: 'rgb(var(--tree-reaction))',
            backgroundColor: 'rgb(var(--tree-reaction) / 0.08)'
          } : undefined}
        >
          {hasReactants && (
            isExpanded
              ? <ChevronDown className="w-4 h-4" style={{ color: 'rgb(var(--tree-reaction))' }} />
              : <ChevronRight className="w-4 h-4 text-content-muted" />
          )}
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm" style={{ backgroundColor: isInSolution ? 'rgb(var(--tree-solution))' : 'rgb(var(--tree-reaction))' }} />
          <span className="font-mono font-bold text-xs">{node.reaction}</span>
          {node.ecList && node.ecList.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-inset/60 text-content-secondary font-semibold">
              EC {node.ecList[0]}{node.ecList.length > 1 ? ` +${node.ecList.length - 1}` : ''}
            </span>
          )}
          {hasReactants && (
            <span className="text-[10px] text-content-secondary font-semibold bg-surface-inset/60 px-2 py-0.5 rounded-full">
              {node.reactants.length} substrate{node.reactants.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        {/* Equation — always visible when reaction is shown */}
        {node.equation && (
          <div className="ml-9 flex items-center gap-2 text-xs text-content-secondary font-mono max-w-2xl">
            <ArrowRight className="w-3.5 h-3.5 text-content-muted flex-shrink-0" />
            <span className="truncate" title={node.equation}>{node.equation}</span>
          </div>
        )}
      </div>

      {/* Expanded: show reactants */}
      {isExpanded && hasReactants && (
        <div className="ml-4 pl-5 border-l-[3px] mt-2" style={{ borderColor: isInSolution ? 'rgb(var(--tree-solution) / 0.5)' : 'rgb(var(--border-primary))' }}>
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
