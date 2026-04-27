import React, { useState } from 'react';
import { CircleDot, RectangleHorizontal, Ellipsis, X, ChevronDown, ChevronUp } from 'lucide-react';
import compoundMapJson from '../SearchPanel/compound_map.json';
import ecMapJson from '../SearchPanel/ec_map.json';

/* ── Build lookup maps once at module load ── */
const compoundNameMap = new Map();
compoundMapJson.forEach(c => compoundNameMap.set(c.compound_id, c.name));

const ecInfoMap = new Map();
ecMapJson.forEach(e => ecInfoMap.set(e.ec_number, e));

const TYPE_CONFIG = {
  compound: { label: 'Compound', icon: CircleDot, accent: 'teal' },
  'reaction-in': { label: 'Reaction (in)', icon: RectangleHorizontal, accent: 'indigo' },
  'reaction-out': { label: 'Reaction (out)', icon: RectangleHorizontal, accent: 'indigo' },
  ec: { label: 'EC', icon: Ellipsis, accent: 'amber' },
};

const ACCENT_CLASSES = {
  teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200/60 dark:border-teal-700/30',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200/60 dark:border-indigo-700/30',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-700/30',
};

const BADGE_CLASSES = {
  teal: 'bg-teal-100 dark:bg-teal-800/30 text-teal-700 dark:text-teal-300',
  indigo: 'bg-indigo-100 dark:bg-indigo-800/30 text-indigo-700 dark:text-indigo-300',
  amber: 'bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300',
};

const Field = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex-shrink-0 mt-px w-16">{label}</span>
      <span className="text-[11px] text-slate-600 dark:text-slate-300 break-all leading-tight">{String(value)}</span>
    </div>
  );
};

const ReactionsList = ({ reactions }) => {
  const [expanded, setExpanded] = useState(false);
  if (!reactions || reactions.length === 0) return null;

  const shown = expanded ? reactions : reactions.slice(0, 3);
  const hasMore = reactions.length > 3;

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Reactions ({reactions.length})
      </button>
      {(expanded || reactions.length <= 3) && (
        <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
          {shown.map(r => (
            <div key={r.id} className="rounded px-1.5 py-0.5 bg-white/50 dark:bg-slate-700/30 border border-slate-200/30 dark:border-slate-600/20">
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{r.id}</span>
              {r.equation && (
                <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate">{r.equation}</div>
              )}
            </div>
          ))}
          {hasMore && !expanded && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500 pl-1">+{reactions.length - 3} more...</span>
          )}
        </div>
      )}
    </div>
  );
};

const NodeCard = ({ node, degree, onRemove, reactions }) => {
  const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.compound;
  const accent = cfg.accent;
  const Icon = cfg.icon;

  // Resolve names from local maps
  const compoundName = node.type === 'compound' ? compoundNameMap.get(node.id) : undefined;
  const ecInfo = node.type === 'ec' ? ecInfoMap.get(node.ec || node.label) : undefined;

  return (
    <div className={`relative rounded-lg border px-3 py-2 space-y-1.5 ${ACCENT_CLASSES[accent]}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3 h-3 flex-shrink-0 text-slate-500 dark:text-slate-400" />
          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${BADGE_CLASSES[accent]}`}>
            {cfg.label}
          </span>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-600/40 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Fields based on type */}
      {node.type === 'compound' && (
        <>
          <Field label="ID" value={node.id} />
          <Field label="Name" value={compoundName} />
          <Field label="Gen" value={node.generation} />
          <Field label="Rxns" value={degree} />
          <ReactionsList reactions={reactions} />
        </>
      )}

      {(node.type === 'reaction-in' || node.type === 'reaction-out') && (
        <>
          <Field label="ID" value={node.label || node.id} />
          {node.reaction && (
            <>
              <Field label="Equation" value={node.reaction.equation} />
              <Field label="Trans." value={node.reaction.transition} />
              <Field label="Coenz." value={node.reaction.coenzyme} />
              <Field label="Source" value={node.reaction.source} />
              {node.reaction.ec_list && node.reaction.ec_list.length > 0 && (
                <Field label="EC" value={node.reaction.ec_list.filter(e => e && e !== 'N/A').join(', ')} />
              )}
            </>
          )}
          <Field label="Degree" value={degree} />
        </>
      )}

      {node.type === 'ec' && (
        <>
          <Field label="EC" value={node.ec || node.label} />
          <Field label="Rxns" value={ecInfo?.reaction_count} />
          <Field label="Gen" value={node.generation} />
          <Field label="Degree" value={degree} />
        </>
      )}
    </div>
  );
};

const NodeInfoPanel = ({ selectedNodes, degreeMap, onDeselectNode, nodeReactionsMap }) => {
  if (!selectedNodes || selectedNodes.length === 0) return null;

  return (
    <div
      className="absolute bottom-3 right-3 z-20 w-56 pointer-events-auto"
      style={{ maxHeight: 'calc(100% - 60px)' }}
    >
      <div
        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-slate-600/30 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-slate-200/40 dark:border-slate-700/30 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Selection ({selectedNodes.length})
          </span>
        </div>

        {/* Scrollable card list — up to 5 visible */}
        <div className="overflow-y-auto p-2 space-y-2" style={{ maxHeight: '400px' }}>
          {selectedNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              degree={degreeMap.get(node.id) || 0}
              onRemove={onDeselectNode ? () => onDeselectNode(node.id) : undefined}
              reactions={nodeReactionsMap ? nodeReactionsMap.get(node.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NodeInfoPanel;
