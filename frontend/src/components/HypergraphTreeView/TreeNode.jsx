import React, { memo } from 'react';
import { ChevronRight, ChevronDown, Link2, AlertCircle } from 'lucide-react';

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
const CompoundNode = memo(({ node, expandedNodes, toggleNode, primaryReactions, pinnedReactionColors, deletedReactionNames, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasProducers = node.producers && node.producers.length > 0;
  const isRoot = depth === 0;
  const allProducersDeleted = hasProducers && deletedReactionNames && node.producers.every(rxn => deletedReactionNames.has(rxn.reaction));

  // Shared node — compact ref indicator
  if (node.isShared) {
    return (
      <div className="my-1 ml-0.5">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs border border-dashed border-brd/50 bg-surface-inset/60 text-content-muted cursor-default"
          title={`${node.id} — already expanded elsewhere in this tree`}
        >
          <Link2 className="w-3.5 h-3.5 opacity-50" />
          <span className="font-mono font-medium">{node.id}</span>
          <span className="text-[10px] opacity-60">already shown above</span>
        </span>
      </div>
    );
  }

  // Leaf node — compact with color dot + label
  if (node.isLeaf) {
    const style = LEAF_STYLES[node.leafReason] || LEAF_STYLES.unknown;
    return (
      <div className="my-1">
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs text-content cursor-default border"
          style={{
            backgroundColor: `rgb(var(${style.cssVar}) / 0.1)`,
            borderColor: `rgb(var(${style.cssVar}) / 0.3)`,
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: `rgb(var(${style.cssVar}))` }} />
          <span className="font-mono font-semibold">{node.id}</span>
          <span className="text-[10px] text-content-muted">{style.label}</span>
        </span>
      </div>
    );
  }

  // Regular metabolite — expandable
  return (
    <div className={isRoot ? 'mb-2' : 'my-1'}>
      <button
        onClick={() => toggleNode(node.id)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-content border hover:brightness-95 ${
          isRoot ? 'font-bold text-sm' : ''
        }`}
        style={{
          backgroundColor: `rgb(var(--tree-metabolite) / ${isRoot ? 0.14 : 0.08})`,
          borderColor: `rgb(var(--tree-metabolite) / ${isRoot ? 0.4 : 0.28})`,
        }}
      >
        {hasProducers && (
          isExpanded
            ? <ChevronDown className="w-4 h-4" style={{ color: 'rgb(var(--tree-metabolite))' }} />
            : <ChevronRight className="w-4 h-4" style={{ color: 'rgb(var(--tree-metabolite) / 0.7)' }} />
        )}
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgb(var(--tree-metabolite))' }} />
        <span className="font-mono font-semibold">{node.id}</span>
        {node.generation >= 0 && <span className="text-[10px] text-content-muted">gen {node.generation}</span>}
        {hasProducers && !isExpanded && (
          <span className="text-[10px] text-content-muted">{node.producers.length} route{node.producers.length !== 1 ? 's' : ''}</span>
        )}
        {allProducersDeleted && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-err">
            <AlertCircle className="w-3.5 h-3.5" /> no viable producers
          </span>
        )}
      </button>

      {/* Expanded: show producing reactions */}
      {isExpanded && hasProducers && (
        <div className="ml-4 pl-4 border-l-2 border-brd/40 mt-1">
          {node.producers.map((rxn, idx) => (
            <ReactionNode
              key={rxn.id || idx}
              node={rxn}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              primaryReactions={primaryReactions}
              pinnedReactionColors={pinnedReactionColors}
              deletedReactionNames={deletedReactionNames}
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
const ReactionNode = memo(({ node, expandedNodes, toggleNode, primaryReactions, pinnedReactionColors, deletedReactionNames, depth }) => {
  const isExpanded = expandedNodes.has(node.id);
  const hasReactants = node.reactants && node.reactants.length > 0;
  const hasActiveFilter = primaryReactions && primaryReactions.size > 0;
  const isInSolution = hasActiveFilter && primaryReactions.has(node.reaction);
  // Gentle dimming: enough to draw the eye to the selected path without
  // making the rest of the tree unreadable.
  const isDimmed = hasActiveFilter && !isInSolution;
  const isDeleted = deletedReactionNames && deletedReactionNames.has(node.reaction);
  const pinColors = pinnedReactionColors ? (pinnedReactionColors.get(node.reaction) || []) : [];
  const isPinned = pinColors.length > 0;

  return (
    <div className={`my-1 transition-opacity ${isDimmed && !isDeleted && !isPinned ? 'opacity-45' : ''}`}>
      <button
        onClick={() => toggleNode(node.id)}
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs text-content border hover:brightness-95 ${
          isDeleted ? 'border-dashed' : ''
        }`}
        style={isDeleted ? {
          backgroundColor: 'rgb(var(--error) / 0.1)',
          borderColor: 'rgb(var(--error) / 0.4)',
        } : isInSolution ? {
          backgroundColor: 'rgb(var(--tree-solution) / 0.14)',
          borderColor: 'rgb(var(--tree-solution) / 0.4)',
        } : {
          backgroundColor: 'rgb(var(--tree-reaction) / 0.08)',
          borderColor: 'rgb(var(--tree-reaction) / 0.25)',
        }}
      >
        {hasReactants && (
          isExpanded
            ? <ChevronDown className="w-4 h-4" style={{ color: 'rgb(var(--tree-reaction))' }} />
            : <ChevronRight className="w-4 h-4 text-content-muted" />
        )}
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: isDeleted ? 'rgb(var(--error))' : isInSolution ? 'rgb(var(--tree-solution))' : 'rgb(var(--tree-reaction))' }} />
        <span className={`font-mono font-semibold ${isDeleted ? 'line-through text-err' : ''}`}>{node.reaction}</span>
        {isDeleted && <span className="text-[10px] font-bold text-err">Deleted</span>}
        {node.ecList && node.ecList.length > 0 && (
          <span className="text-[10px] text-content-muted">
            EC {node.ecList[0]}{node.ecList.length > 1 ? ` +${node.ecList.length - 1}` : ''}
          </span>
        )}
        {hasReactants && !isExpanded && (
          <span className="text-[10px] text-content-muted">{node.reactants.length} substrate{node.reactants.length !== 1 ? 's' : ''}</span>
        )}
        {isPinned && (
          <span className="flex items-center gap-0.5 ml-0.5">
            {pinColors.map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </span>
        )}
      </button>

      {/* Equation — shown only when expanded */}
      {isExpanded && node.equation && (
        <div className="ml-8 mt-0.5 text-[11px] text-content-muted font-mono truncate max-w-xl" title={node.equation}>
          {node.equation}
        </div>
      )}

      {/* Expanded: show reactants */}
      {isExpanded && hasReactants && (
        <div className="ml-4 pl-4 border-l-2 mt-1" style={{ borderColor: isInSolution ? 'rgb(var(--tree-solution) / 0.4)' : 'rgb(var(--border-primary) / 0.4)' }}>
          {node.reactants.map((child, idx) => (
            <CompoundNode
              key={child.id || idx}
              node={child}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              primaryReactions={primaryReactions}
              pinnedReactionColors={pinnedReactionColors}
              deletedReactionNames={deletedReactionNames}
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
const TreeNode = ({ node, expandedNodes, toggleNode, primaryReactions, pinnedReactionColors, deletedReactionNames, depth = 0 }) => {
  if (!node) return null;

  if (node.type === 'compound') {
    return (
      <CompoundNode
        node={node}
        expandedNodes={expandedNodes}
        toggleNode={toggleNode}
        primaryReactions={primaryReactions}
        pinnedReactionColors={pinnedReactionColors}
        deletedReactionNames={deletedReactionNames}
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
        primaryReactions={primaryReactions}
        pinnedReactionColors={pinnedReactionColors}
        deletedReactionNames={deletedReactionNames}
        depth={depth}
      />
    );
  }

  return null;
};

export default TreeNode;
