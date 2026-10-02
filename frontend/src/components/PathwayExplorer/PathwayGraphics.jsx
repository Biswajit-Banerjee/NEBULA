import React from 'react';
import { nodeRadius, shareOf, edgeInSet } from './model';

/**
 * Pure SVG rendering of a laid-out pathway model. Used both by the
 * interactive canvas (inside a zoomable <g>) and — via
 * renderToStaticMarkup — by the publication SVG export, so what you see is
 * exactly what you export. All colors come from `palette` (no CSS vars) so
 * the exported file is self-contained.
 */

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function compoundLabel(id, names, labelMode) {
  const name = names?.[id];
  if (labelMode === 'id' || !name) return { primary: id, secondary: null };
  return { primary: truncate(name, 26), secondary: labelMode === 'both' ? id : null };
}

function arcPath(r, a0, a1) {
  const x0 = r * Math.cos(a0); const y0 = r * Math.sin(a0);
  const x1 = r * Math.cos(a1); const y1 = r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
}

function compoundColor(c, palette, targetColors, multi) {
  if (c.role === 'target') {
    if (multi) {
      const k = [...c.isTargetOf][0];
      return targetColors[k] || palette.target;
    }
    return palette.target;
  }
  if (c.role === 'source') return palette.source;
  if (c.role === 'seed') return palette.seed;
  return palette.intermediate;
}

function edgeColor(e, model, palette, targetColors) {
  if (!model.multi) return palette.edge;
  const r = model.reactions.get(e.rxn);
  if (r && r.targets.size === 1) return targetColors[[...r.targets][0]] || palette.edge;
  return palette.edgeShared;
}

const PathwayGraphics = ({
  model,
  layout,
  palette,
  names,
  labelMode = 'name',
  showReactionLabels = true,
  active = null,            // { reactions:Set, compounds:Set } — emphasised elements
  pins = [],                // [{ color, reactions, compounds }]
  selectedId = null,
  deletedReactionNames,
  targetColors = {},
  exportMode = false,
  onNodeEnter,
  onNodeLeave,
  onNodeClick,
}) => {
  const { nodes, edges, genColumns, bounds } = layout;
  const dimNode = (inSet) => (active && !inSet ? 0.18 : 1);
  const font = palette.font;

  const edgeEls = [];
  const activeEdgeEls = [];
  edges.forEach((e) => {
    const r = model.reactions.get(e.rxn);
    const share = shareOf(r, model.totals);
    const unlisted = share === 0;
    const w = 1.1 + 4.5 * share;
    const inActive = active ? edgeInSet(e, active) : false;
    const color = edgeColor(e, model, palette, targetColors);
    const el = (
      <path
        key={e.id}
        d={e.d}
        fill="none"
        stroke={inActive ? palette.highlight : color}
        strokeWidth={inActive ? w + 1.4 : w * 0.82}
        strokeOpacity={active ? (inActive ? 1 : 0.1) : (unlisted ? 0.38 : 0.55)}
        strokeDasharray={unlisted ? '4 3' : undefined}
        strokeLinecap="round"
      />
    );
    (inActive ? activeEdgeEls : edgeEls).push(el);
  });

  const pinEls = [];
  pins.forEach((pin, pi) => {
    edges.forEach((e) => {
      if (!edgeInSet(e, pin)) return;
      pinEls.push(
        <path
          key={`pin-${pi}-${e.id}`}
          d={e.d}
          fill="none"
          stroke={pin.color}
          strokeWidth={Math.max(1.5, 6 - pi * 1.4)}
          strokeOpacity={0.85}
          strokeLinecap="round"
        />,
      );
    });
  });

  const nodeEls = [];
  const compoundElsByGeneration = new Map();
  const reactionElsByGeneration = new Map();
  const addNodeElement = (node, element) => {
    if (!exportMode) {
      nodeEls.push(element);
      return;
    }
    const generation = node.kind === 'compound' ? (node.data.level || 0) : Math.floor(node.rank / 2);
    const groups = node.kind === 'compound' ? compoundElsByGeneration : reactionElsByGeneration;
    if (!groups.has(generation)) groups.set(generation, []);
    groups.get(generation).push(element);
  };
  const safeSvgId = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  nodes.forEach((n) => {
    const handlers = onNodeClick ? {
      onMouseEnter: (ev) => onNodeEnter && onNodeEnter(n, ev),
      onMouseLeave: () => onNodeLeave && onNodeLeave(n),
      onClick: (ev) => { ev.stopPropagation(); onNodeClick(n, ev); },
      style: { cursor: 'pointer' },
    } : {};

    if (n.kind === 'reaction') {
      const r = n.data;
      const inSet = active ? active.reactions.has(r.id) : true;
      const deleted = deletedReactionNames?.has(r.reaction);
      const isSel = selectedId === r.id;
      const unlisted = shareOf(r, model.totals) === 0;
      const seedText = r.seedInputs && r.seedInputs.length
        ? `+ ${r.seedInputs.slice(0, 3).map((id) => truncate(names?.[id] && labelMode !== 'id' ? names[id] : id, 12)).join(', ')}${r.seedInputs.length > 3 ? ` +${r.seedInputs.length - 3}` : ''}`
        : null;
      addNodeElement(n,
        <g key={r.id} id={exportMode ? `Reaction_${safeSvgId(r.id)}` : undefined}
          data-node-id={exportMode ? r.id : undefined} transform={`translate(${n.x},${n.y})`} opacity={dimNode(inSet)} {...handlers}>
          {!exportMode && <rect x={-12} y={-12} width={24} height={24} fill="transparent" />}
          {/* Halo so crossing edges visibly pass behind the icon instead of touching it */}
          <rect x={-9} y={-9} width={18} height={18} rx={4} fill={palette.bg} />
          {isSel && <rect x={-11} y={-11} width={22} height={22} rx={5} fill="none" stroke={palette.highlight} strokeWidth={2} />}
          <rect
            x={-6} y={-6} width={12} height={12} rx={2.5}
            fill={deleted || unlisted ? palette.bg : (active && inSet ? palette.highlight : palette.reaction)}
            stroke={deleted ? palette.error : unlisted ? palette.reaction : palette.bg}
            strokeWidth={deleted || unlisted ? 1.6 : 1.2}
            strokeDasharray={deleted ? '2 2' : undefined}
          />
          {showReactionLabels && (
            <text y={-12} textAnchor="middle" fontFamily={font} fontSize={9} fill={deleted ? palette.error : palette.muted}
              textDecoration={deleted ? 'line-through' : undefined}>
              {r.reaction}
            </text>
          )}
          {seedText && (
            <text y={20} textAnchor="middle" fontFamily={font} fontSize={8.5} fill={palette.seed} fontStyle="italic">
              {seedText}
            </text>
          )}
        </g>,
      );
      return;
    }

    const c = n.data;
    const inSet = active ? active.compounds.has(c.id) : true;
    const rad = nodeRadius(n);
    const color = compoundColor(c, palette, targetColors, model.multi);
    const filled = c.role !== 'intermediate';
    const isSel = selectedId === c.id;
    const { primary, secondary } = compoundLabel(c.id, names, labelMode);
    const tags = [];
    if (c.diverges) tags.push('diverges');
    if (c.merges) tags.push('merges');
    const ringKeys = c.shared ? [...c.targets].sort() : [];

    addNodeElement(n,
      <g key={c.id} id={exportMode ? `Compound_${safeSvgId(c.id)}` : undefined}
        data-node-id={exportMode ? c.id : undefined} transform={`translate(${n.x},${n.y})`} opacity={dimNode(inSet)} {...handlers}>
        {!exportMode && <circle r={rad + 8} fill="transparent" />}
        {/* Halo so crossing edges visibly pass behind the icon instead of touching it */}
        <circle r={rad + 3} fill={palette.bg} />
        {isSel && <circle r={rad + 9} fill="none" stroke={palette.highlight} strokeWidth={2.5} />}
        {c.isChoice && (
          <circle r={rad + 4.5} fill="none" stroke={palette.choice} strokeWidth={1.3} strokeDasharray="3 2.5" />
        )}
        {ringKeys.length > 1 && ringKeys.map((k, i) => {
          const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / ringKeys.length + 0.08;
          const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / ringKeys.length - 0.08;
          return <path key={k} d={arcPath(rad + 2.5, a0, a1)} fill="none" stroke={targetColors[k] || palette.edgeShared} strokeWidth={3} />;
        })}
        <circle
          r={rad}
          fill={filled ? color : palette.nodeFill}
          stroke={ringKeys.length > 1 ? palette.bg : color}
          strokeWidth={filled ? 1.5 : 2.2}
        />
        <text y={rad + 13} textAnchor="middle" fontFamily={font} fontSize={c.role === 'target' ? 12.5 : 11}
          fontWeight={c.role === 'target' ? 700 : 600} fill={palette.text}
          {...(!exportMode && { paintOrder: 'stroke', stroke: palette.bg, strokeWidth: 2.2, strokeLinejoin: 'round' })}>
          {primary}
        </text>
        {secondary && (
          <text y={rad + 25} textAnchor="middle" fontFamily={font} fontSize={9} fill={palette.muted}
            {...(!exportMode && { paintOrder: 'stroke', stroke: palette.bg, strokeWidth: 2.2, strokeLinejoin: 'round' })}>
            {secondary}
          </text>
        )}
        {tags.length > 0 && (
          <text y={rad + (secondary ? 36 : 25)} textAnchor="middle" fontFamily={font} fontSize={8.5}
            fontStyle="italic" fontWeight={600} fill={palette.diverge} opacity={0.8}
            {...(!exportMode && { paintOrder: 'stroke', stroke: palette.bg, strokeWidth: 2.2, strokeLinejoin: 'round' })}>
            {tags.join(' · ')}
          </text>
        )}
      </g>,
    );
  });

  const renderGenerationGroups = (groups, idSuffix = '') => [...groups.keys()].sort((a, b) => a - b).map((generation) => (
    <g key={generation} id={`Generation_${generation}${idSuffix}`}>
      {groups.get(generation)}
    </g>
  ));

  return (
    <g>
      {exportMode ? (
        <g id="Generation_Guides">
          {genColumns.map((col) => (
            <g key={col.rank} id={`Generation_Guide_${col.label}`}>
              <line x1={col.x} x2={col.x} y1={bounds.minY + 26} y2={bounds.maxY - 10}
                stroke={palette.grid} strokeWidth={1} strokeDasharray="2 6" />
              <text x={col.x} y={bounds.minY + 14} textAnchor="middle" fontFamily={font} fontSize={10}
                fontWeight={600} fill={palette.muted} letterSpacing="0.06em">
                {col.label === 0 ? 'SEED' : `GEN ${col.label}`}
              </text>
            </g>
          ))}
        </g>
      ) : genColumns.map((col) => (
        <g key={col.rank}>
          <line x1={col.x} x2={col.x} y1={bounds.minY + 26} y2={bounds.maxY - 10}
            stroke={palette.grid} strokeWidth={1} strokeDasharray="2 6" />
          <text x={col.x} y={bounds.minY + 14} textAnchor="middle" fontFamily={font} fontSize={10}
            fontWeight={600} fill={palette.muted} letterSpacing="0.06em">
            {col.label === 0 ? 'SEED' : `GEN ${col.label}`}
          </text>
        </g>
      ))}
      {exportMode ? (
        <>
          <g id="Edges">{edgeEls}</g>
          <g id="Pinned_Paths">{pinEls}</g>
          <g id="Highlighted_Edges">{activeEdgeEls}</g>
          <g id="Reactions">{renderGenerationGroups(reactionElsByGeneration, '_Reactions')}</g>
          <g id="Compounds">{renderGenerationGroups(compoundElsByGeneration)}</g>
        </>
      ) : <>{edgeEls}{pinEls}{activeEdgeEls}{nodeEls}</>}
    </g>
  );
};

export default PathwayGraphics;

/** Legend drawn inside exported SVGs. Returns { element, height }. */
export function SvgLegend({ x, y, palette, model, targets, targetColors }) {
  const font = palette.font;
  const items = [
    { kind: 'circle', color: palette.intermediate, hollow: true, label: 'Intermediate compound' },
    { kind: 'target', color: palette.target, label: 'Target' },
    { kind: 'circle', color: palette.seed, label: 'Seed compound (generation 0)' },
    { kind: 'circle', color: palette.source, label: 'Source compound' },
    { kind: 'rect', color: palette.reaction, label: 'Reaction (requires all inputs)' },
    { kind: 'choice', color: palette.choice, label: 'Branch point (alternative producers)' },
    { kind: 'line', color: palette.edge, label: 'Line width = share of pathways using the step' },
  ];
  if ([...model.reactions.values()].some((r) => shareOf(r, model.totals) === 0)) {
    items.push({ kind: 'dashed', color: palette.edge, label: 'Parallel route outside the listed pathways' });
  }
  if (model.multi) {
    targets.forEach((t) => items.push({ kind: 'line', color: targetColors[t.key], label: `Used only by ${t.target}` }));
    items.push({ kind: 'line', color: palette.edgeShared, label: 'Shared by several targets' });
  }
  const colW = 250;
  const perCol = Math.ceil(items.length / 3);
  return (
    <g transform={`translate(${x},${y})`}>
      {items.map((it, i) => {
        const cx = Math.floor(i / perCol) * colW;
        const cy = (i % perCol) * 18;
        let sym;
        if (it.kind === 'circle') sym = <circle cx={6} cy={cy} r={5} fill={it.hollow ? palette.nodeFill : it.color} stroke={it.color} strokeWidth={it.hollow ? 2 : 1} />;
        else if (it.kind === 'target') sym = <circle cx={6} cy={cy} r={6} fill={it.color} />;
        else if (it.kind === 'rect') sym = <rect x={1.5} y={cy - 4.5} width={9} height={9} rx={2} fill={it.color} />;
        else if (it.kind === 'choice') sym = <circle cx={6} cy={cy} r={6} fill="none" stroke={it.color} strokeWidth={1.3} strokeDasharray="3 2.5" />;
        else if (it.kind === 'dashed') sym = <line x1={0} x2={13} y1={cy} y2={cy} stroke={it.color} strokeWidth={1.5} strokeDasharray="4 3" />;
        else sym = <line x1={0} x2={13} y1={cy} y2={cy} stroke={it.color} strokeWidth={3} strokeLinecap="round" />;
        return (
          <g key={i} transform={`translate(${cx},0)`}>
            {sym}
            <text x={20} y={cy + 3.5} fontFamily={font} fontSize={10} fill={palette.text}>{it.label}</text>
          </g>
        );
      })}
    </g>
  );
}

export const legendHeight = (model, targets) => {
  const unlisted = [...model.reactions.values()].some((r) => shareOf(r, model.totals) === 0) ? 1 : 0;
  const n = 7 + unlisted + (model.multi ? targets.length + 1 : 0);
  return Math.ceil(n / 3) * 18 + 10;
};
