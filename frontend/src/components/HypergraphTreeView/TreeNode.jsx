import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Link2 } from 'lucide-react';

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
const CompoundNode = memo(({ node, expandedNodes, toggleNode, activeReactions, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasProducers = node.producers && node.producers.length > 0;
  const isRoot = depth === 0;

  // Shared node — compact ref indicator
  if (node.isShared) {
    return (
      <div className="my-0.5 ml-0.5">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] border border-dashed border-brd/50 bg-surface-inset/60 text-content-muted cursor-default"
          title={`${node.id} — expanded elsewhere`}
        >
          <Link2 className="w-3 h-3 opacity-40" />
          <span className="font-mono font-medium">{node.id}</span>
          <span className="text-[9px] opacity-50">ref</span>
        </span>
      </div>
    );
  }

  // Leaf node — compact with color dot + label
  if (node.isLeaf) {
    const style = LEAF_STYLES[node.leafReason] || LEAF_STYLES.unknown;
    return (
      <div className="my-0.5">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] text-content cursor-default border"
          style={{
            backgroundColor: `rgb(var(${style.cssVar}) / 0.08)`,
            borderColor: `rgb(var(${style.cssVar}) / 0.25)`,
          }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: `rgb(var(${style.cssVar}))` }} />
          <span className="font-mono font-semibold">{node.id}</span>
          <span className="text-[9px] text-content-muted">{style.label}</span>
        </span>
      </div>
    );
  }

  // Regular metabolite — expandable
  return (
    <div className={isRoot ? 'mb-1' : 'my-0.5'}>
      <button
        onClick={() => toggleNode(node.id)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-content border hover:brightness-95 ${
          isRoot ? 'font-bold text-xs' : ''
        }`}
        style={{
          backgroundColor: `rgb(var(--tree-metabolite) / ${isRoot ? 0.12 : 0.07})`,
          borderColor: `rgb(var(--tree-metabolite) / ${isRoot ? 0.35 : 0.25})`,
        }}
      >
        {hasProducers && (
          isExpanded
            ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgb(var(--tree-metabolite))' }} />
            : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgb(var(--tree-metabolite) / 0.6)' }} />
        )}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgb(var(--tree-metabolite))' }} />
        <span className="font-mono font-semibold">{node.id}</span>
        {node.generation >= 0 && <span className="text-[9px] text-content-muted">g{node.generation}</span>}
        {hasProducers && !isExpanded && (
          <span className="text-[9px] text-content-muted">{node.producers.length}r</span>
        )}
      </button>

      {/* Expanded: show producing reactions */}
      {isExpanded && hasProducers && (
        <div className="ml-3 pl-3 border-l-2 border-brd/40 mt-0.5">
          {node.producers.map((rxn, idx) => (
            <ReactionNode
              key={rxn.id || idx}
              node={rxn}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
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
const ReactionNode = memo(({ node, expandedNodes, toggleNode, activeReactions, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasReactants = node.reactants && node.reactants.length > 0;
  const hasActiveFilter = activeReactions && activeReactions.size > 0;
  const isInSolution = hasActiveFilter && activeReactions.has(node.reaction);
  const isDimmed = hasActiveFilter && !isInSolution;

  return (
    <div className={`my-0.5 ${isDimmed ? 'opacity-15' : ''}`}>
      <button
        onClick={() => toggleNode(node.id)}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] text-content border hover:brightness-95"
        style={isInSolution ? {
          backgroundColor: 'rgb(var(--tree-solution) / 0.12)',
          borderColor: 'rgb(var(--tree-solution) / 0.35)',
        } : {
          backgroundColor: 'rgb(var(--tree-reaction) / 0.07)',
          borderColor: 'rgb(var(--tree-reaction) / 0.2)',
        }}
      >
        {hasReactants && (
          isExpanded
            ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgb(var(--tree-reaction))' }} />
            : <ChevronRight className="w-3.5 h-3.5 text-content-muted" />
        )}
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: isInSolution ? 'rgb(var(--tree-solution))' : 'rgb(var(--tree-reaction))' }} />
        <span className="font-mono font-semibold">{node.reaction}</span>
        {node.ecList && node.ecList.length > 0 && (
          <span className="text-[9px] text-content-muted">
            EC {node.ecList[0]}{node.ecList.length > 1 ? ` +${node.ecList.length - 1}` : ''}
          </span>
        )}
        {hasReactants && !isExpanded && (
          <span className="text-[9px] text-content-muted">{node.reactants.length}s</span>
        )}
      </button>

      {/* Equation — shown only when expanded */}
      {isExpanded && node.equation && (
        <div className="ml-7 text-[10px] text-content-muted font-mono truncate max-w-xl" title={node.equation}>
          {node.equation}
        </div>
      )}

      {/* Expanded: show reactants */}
      {isExpanded && hasReactants && (
        <div className="ml-3 pl-3 border-l-2 mt-0.5" style={{ borderColor: isInSolution ? 'rgb(var(--tree-solution) / 0.4)' : 'rgb(var(--border-primary) / 0.4)' }}>
          {node.reactants.map((child, idx) => (
            <CompoundNode
              key={child.id || idx}
              node={child}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
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
const TreeNode = ({ node, expandedNodes, toggleNode, activeReactions, depth = 0 }) => {
  if (!node) return null;

  if (node.type === 'compound') {
    return (
      <CompoundNode
        node={node}
        expandedNodes={expandedNodes}
        toggleNode={toggleNode}
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
        activeReactions={activeReactions}
        depth={depth}
      />
    );
  }

  return null;
};

export default TreeNode;
