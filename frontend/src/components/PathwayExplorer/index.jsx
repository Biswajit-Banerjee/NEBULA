import React, { useState, useMemo, useCallback, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import {
  Route, Download, ZoomIn, ZoomOut, Maximize2, SlidersHorizontal, Link2, Unlink, Loader2, Info, X, Focus,
} from 'lucide-react';
import { getApiUrl } from '../../config/api';
import { ThemeContext } from '../ThemeProvider/ThemeProvider';
import {
  buildModel, layoutModel, targetKeyOf, pathKeyOf, solutionElements, unionElements, shareOf,
} from './model';
import PathwayGraphics from './PathwayGraphics';
import PathList from './PathList';
import Inspector from './Inspector';
import { themePalette, PUBLICATION_PALETTE, PIN_COLORS } from './palette';
import { buildSvgString, downloadText } from './exportSvg';
import KeyButton from '../Key/KeyButton';

/* ------------------------------------------------------------------ */
/* Compound names (shared cache across mounts)                          */
/* ------------------------------------------------------------------ */

const NAME_CACHE = {};

function useCompoundNames(ids) {
  const [tick, setTick] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    const missing = ids.filter((id) => !(id in NAME_CACHE));
    if (!missing.length) return undefined;
    const ctrl = new AbortController();
    fetch(getApiUrl('compound-names'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compound_ids: missing }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { names: {} }))
      .then(({ names = {} }) => {
        missing.forEach((id) => { NAME_CACHE[id] = names[id] || null; });
        setTick((t) => t + 1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => ({ ...NAME_CACHE }), [tick, key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                     */
/* ------------------------------------------------------------------ */

const Segmented = ({ value, onChange, options, disabled }) => (
  <div className="inline-flex items-center p-0.5 rounded-lg bg-surface-inset/70 border border-brd/40">
    {options.map(([v, label, title]) => (
      <button
        key={v}
        disabled={disabled}
        onClick={() => onChange(v)}
        title={title}
        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 ${
          value === v ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-muted hover:text-content'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

// Renders into document.body as a fixed-position layer anchored to `anchorRef`'s
// trigger button, so it always stays fully on-screen and on top of everything
// else (canvas, Inspector panel) instead of being clipped/overlapped by them.
const Popover = ({ open, onClose, children, className = '', anchorRef }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open || !anchorRef?.current) { setPos(null); return undefined; }
    const update = () => {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, right: pos.right }}
      className={`z-[200] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-brd/60 bg-surface-overlay/95 backdrop-blur-xl shadow-2xl p-3 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
};

const ToolbarButton = ({ active, onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
      active ? 'border-brand/50 bg-brand/10 text-brand' : 'border-brd/50 text-content-secondary hover:text-content hover:bg-surface-overlay/70'
    }`}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ */
/* Zoomable canvas                                                      */
/* ------------------------------------------------------------------ */

const ZoomCanvas = ({ layout, fitKey, onBackgroundClick, children, palette }) => {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const fittedKey = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const z = d3.zoom()
      .scaleExtent([0.08, 4])
      .on('zoom', (ev) => { gRef.current?.setAttribute('transform', ev.transform.toString()); });
    zoomRef.current = z;
    d3.select(svgRef.current).call(z).on('dblclick.zoom', null);
  }, []);

  const fit = useCallback((animate = true) => {
    const { w, h } = size;
    if (!w || !h || !zoomRef.current) return;
    const b = layout.bounds;
    const bw = b.maxX - b.minX; const bh = b.maxY - b.minY;
    const k = Math.min(w / bw, h / bh, 1.25) * 0.94;
    const t = d3.zoomIdentity
      .translate(w / 2 - ((b.minX + b.maxX) / 2) * k, h / 2 - ((b.minY + b.maxY) / 2) * k)
      .scale(k);
    const sel = d3.select(svgRef.current);
    (animate ? sel.transition().duration(350) : sel).call(zoomRef.current.transform, t);
  }, [layout, size]);

  useEffect(() => {
    if (!size.w || !size.h) return;
    if (fittedKey.current !== fitKey) {
      fit(fittedKey.current !== null);
      fittedKey.current = fitKey;
    }
  }, [fitKey, size, fit]);

  const zoomBy = (f) => d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, f);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onClick={onBackgroundClick}
        style={{ display: 'block', background: palette.bg, cursor: 'grab' }}
      >
        <g ref={gRef}>{children}</g>
      </svg>
      <div className="absolute top-3 right-3 flex flex-col rounded-lg border border-brd/50 bg-surface-overlay/90 backdrop-blur shadow-sm overflow-hidden">
        <button onClick={() => zoomBy(1.3)} className="p-2 text-content-secondary hover:text-content hover:bg-surface-inset/60" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => zoomBy(1 / 1.3)} className="p-2 text-content-secondary hover:text-content hover:bg-surface-inset/60 border-t border-brd/40" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => fit(true)} className="p-2 text-content-secondary hover:text-content hover:bg-surface-inset/60 border-t border-brd/40" title="Fit to screen"><Maximize2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

const PathwayExplorer = ({
  treeTargets = [],
  pathMode = 'parallel',
  pathMaxPaths = 6000,
  onChangePathMode,
  treeLoading = false,
  focusedPath,
  onFocusPath,
  deletedReactionNames,
  hideCofactors = false,
  height = '600px',
}) => {
  const { themeName } = useContext(ThemeContext);
  const targets = useMemo(
    () => treeTargets.map((t, i) => ({ ...t, key: targetKeyOf(t, i), color: t.color || '#64748b' })),
    [treeTargets],
  );
  const targetColors = useMemo(() => Object.fromEntries(targets.map((t) => [t.key, t.color])), [targets]);
  const statsByKey = useMemo(() => Object.fromEntries(targets.map((t) => [t.key, t.stats || {}])), [targets]);

  const [view, setView] = useState('all');
  const [compactSeeds, setCompactSeeds] = useState(true);
  const [labelMode, setLabelMode] = useState('name');
  const [showRxnLabels, setShowRxnLabels] = useState(true);
  const [hideUnlisted, setHideUnlisted] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [selection, setSelection] = useState(null); // {type:'path', key} | {type:'node', id}
  const [hover, setHover] = useState(null);          // same, or {type:'elements', set}
  const [pins, setPins] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('length');
  const [tab, setTab] = useState('paths');
  const [syncViews, setSyncViews] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const optionsAnchorRef = useRef(null);
  const exportAnchorRef = useRef(null);
  const [exportOpts, setExportOpts] = useState({ scope: 'view', title: true, legend: true, background: true, palette: 'publication' });
  const [palette, setPalette] = useState(() => themePalette());

  useEffect(() => {
    const id = requestAnimationFrame(() => setPalette(themePalette()));
    return () => cancelAnimationFrame(id);
  }, [themeName]);

  // Reset interaction state when the data changes.
  useEffect(() => {
    setView(targets.length > 1 ? 'all' : (targets[0]?.key || 'all'));
    setSelection(null); setHover(null); setPins([]); setQuery(''); setIsolate(false);
  }, [targets]);

  const multiAvailable = targets.length > 1;
  const shownTargets = useMemo(
    () => (view === 'all' ? targets : targets.filter((t) => t.key === view)),
    [targets, view],
  );

  const allIds = useMemo(() => {
    const s = new Set();
    targets.forEach((t) => (t.graph?.compounds || []).forEach((c) => s.add(c.id)));
    targets.forEach((t) => s.add(t.target));
    return [...s].sort();
  }, [targets]);
  const names = useCompoundNames(allIds);

  /* ---------- paths ---------- */
  // Expand the compact solutions (reaction ids only) using the target graph.
  const allPaths = useMemo(() => {
    const out = [];
    shownTargets.forEach((t) => {
      const rxById = new Map((t.graph?.reactions || []).map((r) => [r.id, r]));
      const roleOf = new Map((t.graph?.compounds || []).map((c) => [c.id, c.role]));
      const sols = t.solutions || [];
      const first = sols[0] ? new Set(sols[0].reactionIds) : null;
      sols.forEach((s, i) => {
        const rset = new Set(s.reactionIds);
        const cset = new Set([t.target]);
        const pre = new Set();
        const reactions = s.reactionIds.map((id, k) => {
          const r = rxById.get(id) || { id, reaction: id, reactants: [] };
          r.reactants.forEach((c) => {
            cset.add(c);
            const role = roleOf.get(c);
            if (role === 'seed' || role === 'source') pre.add(c);
          });
          return {
            id, reaction: r.reaction, direction: r.direction, equation: r.equation,
            ec_list: r.ecList || [], step: s.steps?.[k] ?? k + 1,
          };
        });
        let diff = null;
        if (first) {
          let added = 0; rset.forEach((r) => { if (!first.has(r)) added++; });
          let removed = 0; first.forEach((r) => { if (!rset.has(r)) removed++; });
          diff = { added, removed };
        }
        out.push({
          ...s, key: pathKeyOf(t.key, s.id), target: t, number: s.id + 1, isShortest: i === 0,
          reactions, compounds: [...cset], precursors: [...pre].sort(),
          _r: rset, _c: cset, diff,
        });
      });
    });
    return out;
  }, [shownTargets]);
  const pathByKey = useMemo(() => new Map(allPaths.map((p) => [p.key, p])), [allPaths]);

  // Group paths that only differ by a single interchangeable reaction (e.g.
  // an alternate way to make a shared cofactor-like precursor) into one
  // card, keyed by the shortest member — this is what keeps the list usable
  // when a target has thousands of raw combinations of a few independent
  // choices. Falls back to the raw list if the backend didn't send clusters.
  const clusteredPaths = useMemo(() => {
    const out = [];
    shownTargets.forEach((t) => {
      const clusters = t.clusters || [];
      if (!clusters.length) {
        allPaths.forEach((p) => { if (p.target === t) out.push(p); });
        return;
      }
      clusters.forEach((c) => {
        const rep = pathByKey.get(pathKeyOf(t.key, c.representativeId));
        if (!rep) return;
        out.push(c.size > 1 ? { ...rep, clusterSize: c.size, swaps: c.swaps, memberIds: c.memberIds } : rep);
      });
    });
    return out;
  }, [shownTargets, allPaths, pathByKey]);

  const pathsThroughNode = useCallback(
    (id) => allPaths.filter((p) => p._c.has(id) || p._r.has(id)),
    [allPaths],
  );

  const elementsFor = useCallback((sel) => {
    if (!sel) return null;
    if (sel.type === 'elements') return sel.set;
    if (sel.type === 'path') {
      const p = pathByKey.get(sel.key);
      return p ? solutionElements(p) : null;
    }
    const through = pathsThroughNode(sel.id);
    if (!through.length) return { reactions: new Set([sel.id]), compounds: new Set([sel.id]) };
    return unionElements(through);
  }, [pathByKey, pathsThroughNode]);

  const selectedSet = useMemo(() => elementsFor(selection), [elementsFor, selection]);
  const hoverSet = useMemo(() => elementsFor(hover), [elementsFor, hover]);

  /* ---------- model + layout ---------- */
  const fullModel = useMemo(
    () => buildModel(shownTargets, { compactSeeds, hideUnlisted, collapseVariants: hideCofactors }),
    [shownTargets, compactSeeds, hideUnlisted, hideCofactors],
  );
  const model = useMemo(
    () => (isolate && selectedSet
      ? buildModel(shownTargets, { compactSeeds, collapseVariants: hideCofactors, subset: { reactionIds: selectedSet.reactions, compoundIds: selectedSet.compounds } })
      : fullModel),
    [isolate, selectedSet, shownTargets, compactSeeds, hideCofactors, fullModel],
  );
  const hasUnlisted = useMemo(
    () => shownTargets.some((t) => (t.graph?.reactions || []).some((r) => !r.pathCount)),
    [shownTargets],
  );
  const layout = useMemo(() => layoutModel(model), [model]);

  const active = hoverSet || selectedSet;
  const pinSets = useMemo(
    () => pins.map((k, i) => {
      const p = pathByKey.get(k);
      return p ? { color: PIN_COLORS[i % PIN_COLORS.length], ...solutionElements(p) } : null;
    }).filter(Boolean),
    [pins, pathByKey],
  );

  /* ---------- filtered path list ---------- */
  // A selected node/branch point narrows to the exact raw paths through it
  // (clustering is about taming the unfiltered list, not this already-small set).
  const nodeFilter = selection?.type === 'node' ? selection.id : null;
  const visiblePaths = useMemo(() => {
    let list = nodeFilter ? pathsThroughNode(nodeFilter) : clusteredPaths;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.compounds.some((c) => c.toLowerCase().includes(q) || (names[c] || '').toLowerCase().includes(q))
        || p.reactions.some((r) => r.reaction.toLowerCase().includes(q) || (r.ec_list || []).some((ec) => ec.includes(q))));
    }
    const cmp = {
      length: (a, b) => a.reactionCount - b.reactionCount || a.number - b.number,
      depth: (a, b) => a.depth - b.depth || a.reactionCount - b.reactionCount,
      precursors: (a, b) => a.precursors.length - b.precursors.length || a.reactionCount - b.reactionCount,
    }[sortBy];
    return [...list].sort((a, b) => cmp(a, b) || a.key.localeCompare(b.key));
  }, [clusteredPaths, nodeFilter, pathsThroughNode, query, sortBy, names]);

  /* ---------- selection handlers ---------- */
  const selectPath = useCallback((key) => {
    setSelection((prev) => (prev?.type === 'path' && prev.key === key ? null : { type: 'path', key }));
  }, []);
  const selectNode = useCallback((id) => {
    setSelection((prev) => (prev?.type === 'node' && prev.id === id ? null : { type: 'node', id }));
  }, []);
  const clearSelection = useCallback(() => { setSelection(null); setIsolate(false); }, []);
  const togglePin = useCallback((key) => {
    setPins((prev) => (prev.includes(key) ? prev.filter((k) => k !== key)
      : prev.length >= PIN_COLORS.length ? prev : [...prev, key]));
  }, []);

  useEffect(() => { if (!selection) setIsolate(false); }, [selection]);

  // Keyboard: Esc clears, ↑/↓ steps through the visible path list.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const root = document.getElementById('pathway-explorer-root');
      if (!root || root.offsetParent === null) return;
      if (e.key === 'Escape') clearSelection();
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && visiblePaths.length) {
        e.preventDefault();
        const idx = selection?.type === 'path' ? visiblePaths.findIndex((p) => p.key === selection.key) : -1;
        const next = e.key === 'ArrowDown' ? Math.min(visiblePaths.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelection({ type: 'path', key: visiblePaths[next].key });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visiblePaths, selection, clearSelection]);

  /* ---------- sync with other views ---------- */
  const lastSent = useRef(null);
  useEffect(() => {
    if (!onFocusPath) return;
    if (!syncViews || !selection) {
      if (lastSent.current) { lastSent.current = null; onFocusPath(null); }
      return;
    }
    let payload = null;
    if (selection.type === 'path') {
      const p = pathByKey.get(selection.key);
      if (p) {
        payload = {
          id: `path:${p.key}`,
          label: `Path ${p.number} → ${names[p.target.target] || p.target.target}`,
          reactions: p.reactions.map((r) => ({ reaction: r.reaction })),
        };
      }
    } else {
      const through = pathsThroughNode(selection.id);
      const rx = new Map();
      through.forEach((p) => p.reactions.forEach((r) => rx.set(r.reaction, { reaction: r.reaction })));
      const r = fullModel.reactions.get(selection.id);
      if (r) rx.set(r.reaction, { reaction: r.reaction });
      const label = r ? r.reaction : (names[selection.id] || selection.id);
      payload = { id: `node:${selection.id}:${view}`, label: `Paths through ${label}`, reactions: [...rx.values()] };
    }
    if (payload && lastSent.current !== payload.id) {
      lastSent.current = payload.id;
      onFocusPath(payload);
    }
  }, [selection, syncViews, pathByKey, pathsThroughNode, fullModel, names, view, onFocusPath]);

  // Focus cleared from outside (e.g. the global "focused" chip) → clear here too.
  useEffect(() => {
    if (!focusedPath && lastSent.current) {
      lastSent.current = null;
      setSelection(null);
    }
  }, [focusedPath]);

  /* ---------- canvas events ---------- */
  const onNodeEnter = useCallback((n, ev) => {
    setHover({ type: 'node', id: n.id });
    setTooltip({ node: n, x: ev.clientX, y: ev.clientY });
  }, []);
  const onNodeLeave = useCallback(() => { setHover(null); setTooltip(null); }, []);
  const onNodeClick = useCallback((n) => { setTooltip(null); selectNode(n.id); }, [selectNode]);

  /* ---------- export ---------- */
  const modeLabel = pathMode === 'earliest' ? 'strictly generation-increasing routes' : 'all parallel routes';
  const titleFor = (tlist) => (tlist.length === 1
    ? `Paths to ${names[tlist[0].target] || tlist[0].target} (${tlist[0].target})`
    : `Paths to ${tlist.map((t) => names[t.target] || t.target).join(', ')}`);

  const doExport = useCallback((scope) => {
    const opts = { ...exportOpts, scope: scope || exportOpts.scope };
    const pal = opts.palette === 'publication' ? PUBLICATION_PALETTE : palette;
    let m = fullModel; let l; let act = null; let pinsOut = [];
    const selLabel = selection?.type === 'path'
      ? `Path ${pathByKey.get(selection.key)?.number}`
      : selection ? `Paths through ${fullModel.reactions.get(selection.id)?.reaction || names[selection.id] || selection.id}` : '';
    if (opts.scope === 'selection' && selectedSet) {
      m = buildModel(shownTargets, { compactSeeds, collapseVariants: hideCofactors, subset: { reactionIds: selectedSet.reactions, compoundIds: selectedSet.compounds } });
    } else if (opts.scope === 'full') {
      m = buildModel(shownTargets, { compactSeeds, collapseVariants: hideCofactors });
    } else if (opts.scope === 'view') {
      m = model; act = selectedSet; pinsOut = pinSets;
    }
    l = layoutModel(m);
    const nPaths = shownTargets.reduce((s, t) => s + (t.solutions || []).length, 0);
    const trunc = shownTargets.some((t) => t.stats?.truncated);
    let caption = `${nPaths}${trunc ? '+' : ''} minimal Paths from seed compounds · ${modeLabel}`;
    if (opts.scope === 'selection' && selLabel) caption = `${selLabel} · ${modeLabel}`;
    else if (act && selLabel) caption += ` · highlighted: ${selLabel}`;
    const svg = buildSvgString({
      model: m, layout: l, palette: pal, names, labelMode, showReactionLabels: showRxnLabels,
      active: act, pins: pinsOut, targets: shownTargets, targetColors, deletedReactionNames,
      title: opts.title ? titleFor(shownTargets) : null, caption,
      background: opts.background, legend: opts.legend,
    });
    const base = shownTargets.map((t) => t.target).join('_');
    const suffix = opts.scope === 'selection' ? `_${(selLabel || 'selection').replace(/\s+/g, '-').toLowerCase()}` : opts.scope === 'view' && act ? '_highlighted' : '';
    downloadText(svg, `nebula_Paths_${base}${suffix}.svg`);
    setExportOpen(false);
  }, [exportOpts, palette, fullModel, model, selectedSet, pinSets, shownTargets, compactSeeds, names, labelMode,
    showRxnLabels, targetColors, deletedReactionNames, selection, pathByKey, modeLabel, hideCofactors]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- render ---------- */
  if (!targets.length) {
    return (
      <div className="flex items-center justify-center h-full text-content-muted">
        <div className="text-center">
          <Route className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No pathway data</p>
        </div>
      </div>
    );
  }

  const selectedPath = selection?.type === 'path' ? pathByKey.get(selection.key) : null;
  const emptyTargets = shownTargets.filter((t) => !(t.solutions || []).length);
  const hasGraph = layout.nodes.size > 0;
  const selectionLabel = selectedPath
    ? `Path ${selectedPath.number}`
    : selection ? (fullModel.reactions.get(selection.id)?.reaction || names[selection.id] || selection.id) : null;

  return (
    <div id="pathway-explorer-root" className="flex flex-col w-full bg-surface pt-16" style={{ height }}>
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-brd/50 bg-surface-secondary/60 backdrop-blur">
        <Route className="w-4 h-4 text-brand flex-shrink-0" />
        <span className="text-sm font-bold text-content mr-2">Path Finder</span>

        <div className="flex items-center gap-1 overflow-x-auto min-w-0">
          {multiAvailable && (
            <button
              onClick={() => { setView('all'); setSelection(null); }}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${view === 'all' ? 'bg-surface-elevated border-brd shadow-sm text-content' : 'border-transparent text-content-muted hover:text-content'}`}
              title="Overlay all targets to see where their Paths merge and diverge"
            >
              All targets
            </button>
          )}
          {targets.map((t) => (
            <button
              key={t.key}
              onClick={() => { setView(t.key); setSelection(null); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${view === t.key ? 'bg-surface-elevated border-brd shadow-sm text-content' : 'border-transparent text-content-muted hover:text-content'}`}
              title={`${t.source ? `${t.source} → ` : ''}${t.target}`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="max-w-[10rem] truncate">{names[t.target] || t.target}</span>
              <span className="text-content-muted tabular-nums">{(t.solutions || []).length}{t.stats?.truncated ? '+' : ''}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {treeLoading && <Loader2 className="w-4 h-4 animate-spin text-brand" />}
          <Segmented
            value={pathMode}
            disabled={treeLoading || !onChangePathMode}
            onChange={(m) => onChangePathMode && onChangePathMode(m, pathMaxPaths)}
            options={[
              ['parallel', 'All parallel routes', 'Every route whose substrates appear no later than their products — includes parallel and same-generation (lateral) reactions'],
              ['earliest', 'Earliest only', 'Only strictly generation-increasing routes: every substrate exists before its product'],
            ]}
          />
          <ToolbarButton active={syncViews} onClick={() => setSyncViews((s) => !s)}
            title={syncViews ? 'Selections filter the Table / Network / Map views (click to unlink)' : 'Link selections to the other views'}>
            {syncViews ? <Link2 className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
            {syncViews ? 'Linked' : 'Unlinked'}
          </ToolbarButton>
          <KeyButton view="path-finder" />
          <div ref={optionsAnchorRef} className="relative">
            <ToolbarButton active={optionsOpen} onClick={() => setOptionsOpen((o) => !o)} title="Display options">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Display
            </ToolbarButton>
            <Popover open={optionsOpen} onClose={() => setOptionsOpen(false)} anchorRef={optionsAnchorRef} className="w-64 space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">Labels</div>
                <Segmented value={labelMode} onChange={setLabelMode} options={[['name', 'Names'], ['id', 'IDs'], ['both', 'Both']]} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">Seed compounds (generation 0)</div>
                <Segmented value={compactSeeds ? 'compact' : 'nodes'} onChange={(v) => setCompactSeeds(v === 'compact')}
                  options={[['compact', 'Inline', 'List seed (generation 0) inputs under each reaction'], ['nodes', 'As nodes', 'Draw seed (generation 0) compounds as their own nodes']]} />
              </div>
              <label className="flex items-center gap-2 text-xs text-content-secondary cursor-pointer">
                <input type="checkbox" checked={showRxnLabels} onChange={(e) => setShowRxnLabels(e.target.checked)} />
                Show reaction IDs
              </label>
              {hasUnlisted && (
                <label className="flex items-start gap-2 text-xs text-content-secondary cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={!hideUnlisted} onChange={(e) => setHideUnlisted(!e.target.checked)} />
                  <span>Show parallel routes beyond the listed Paths <span className="text-content-muted">(dashed)</span></span>
                </label>
              )}
            </Popover>
          </div>
          <div ref={exportAnchorRef} className="relative">
            <button
              onClick={() => setExportOpen((o) => !o)}
              disabled={!hasGraph}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-content-inverse shadow-sm disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export SVG
            </button>
            <Popover open={exportOpen} onClose={() => setExportOpen(false)} anchorRef={exportAnchorRef} className="w-72 space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">What to export</div>
                {[
                  ['full', 'Whole pathway graph', 'All listed Paths, no highlighting'],
                  ['view', 'Current view', selection || pins.length ? 'As shown, with selection & pinned paths emphasised' : 'As shown on the canvas'],
                  ['selection', 'Selection only', selection ? `Just ${selectionLabel}, re-laid out` : 'Select a path or compound first'],
                ].map(([v, label, hint]) => (
                  <label key={v} className={`flex items-start gap-2 py-1 cursor-pointer ${v === 'selection' && !selection ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input type="radio" name="export-scope" className="mt-0.5" checked={exportOpts.scope === v}
                      onChange={() => setExportOpts((o) => ({ ...o, scope: v }))} />
                    <span>
                      <span className="block text-xs font-medium text-content">{label}</span>
                      <span className="block text-[11px] text-content-muted leading-snug">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-1.5">Style</div>
                <Segmented value={exportOpts.palette} onChange={(v) => setExportOpts((o) => ({ ...o, palette: v }))}
                  options={[['publication', 'Publication', 'Colorblind-safe palette on white'], ['theme', 'Current theme']]} />
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[['title', 'Title & caption'], ['legend', 'Legend'], ['background', 'Background']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1.5 text-xs text-content-secondary cursor-pointer">
                      <input type="checkbox" checked={exportOpts[k]} onChange={(e) => setExportOpts((o) => ({ ...o, [k]: e.target.checked }))} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={() => doExport()} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-content-inverse">
                <Download className="w-3.5 h-3.5" /> Download SVG
              </button>
            </Popover>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        <PathList
          targets={shownTargets}
          multi={fullModel.multi}
          model={fullModel}
          names={names}
          labelMode={labelMode}
          statsByKey={statsByKey}
          targetColors={targetColors}
          paths={visiblePaths}
          allPaths={allPaths}
          totalPaths={nodeFilter ? allPaths.length : clusteredPaths.length}
          selection={selection}
          selectedPathKey={selection?.type === 'path' ? selection.key : null}
          pins={pins}
          onSelectPath={selectPath}
          onHoverPath={(k) => setHover(k ? { type: 'path', key: k } : null)}
          onTogglePin={togglePin}
          onSelectNode={selectNode}
          onHoverNode={(id) => setHover(id ? { type: 'node', id } : null)}
          query={query}
          setQuery={setQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          tab={tab}
          setTab={setTab}
          nodeFilter={nodeFilter}
          onClearNodeFilter={clearSelection}
          deletedReactionNames={deletedReactionNames}
          searching={treeLoading}
          onSearchDeeper={onChangePathMode && pathMaxPaths < 20000 && shownTargets.some((t) => t.stats?.truncated)
            ? () => onChangePathMode(pathMode, Math.min(20000, pathMaxPaths * 5))
            : null}
          deeperLimit={Math.min(20000, pathMaxPaths * 5)}
        />

        <div className="relative flex-1 min-w-0">
          {hasGraph ? (
            <ZoomCanvas layout={layout} fitKey={`${view}|${compactSeeds}|${hideUnlisted}|${isolate}|${pathMode}|${pathMaxPaths}|${treeTargets.length}|${layout.nodes.size}`}
              onBackgroundClick={clearSelection} palette={palette}>
              <PathwayGraphics
                model={model}
                layout={layout}
                palette={palette}
                names={names}
                labelMode={labelMode}
                showReactionLabels={showRxnLabels}
                active={active}
                pins={pinSets}
                selectedId={selection?.type === 'node' ? selection.id : null}
                deletedReactionNames={deletedReactionNames}
                targetColors={targetColors}
                onNodeEnter={onNodeEnter}
                onNodeLeave={onNodeLeave}
                onNodeClick={onNodeClick}
              />
            </ZoomCanvas>
          ) : null}

          {emptyTargets.length > 0 && (
            <div className={`${hasGraph ? 'absolute bottom-4 left-1/2 -translate-x-1/2' : 'absolute inset-0 flex items-center justify-center'} pointer-events-none`}>
              <div className="pointer-events-auto max-w-md rounded-xl border border-warn/40 bg-surface-overlay/95 backdrop-blur px-4 py-3 shadow-lg">
                {emptyTargets.map((t) => (
                  <p key={t.key} className="text-xs text-content-secondary flex gap-2">
                    <Info className="w-4 h-4 text-warn flex-shrink-0" />
                    <span>
                      <b className="text-content">{names[t.target] || t.target}:</b>{' '}
                      {t.stats?.message || 'No pathway found.'}
                      {pathMode === 'earliest' && !t.stats?.unreachable && ' Try “All parallel routes”.'}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {selection && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-brd/50 bg-surface-overlay/95 backdrop-blur shadow-md pl-3 pr-1 py-1 text-xs">
              <span className="text-content-secondary">Highlighting <b className="text-content">{selectionLabel}</b></span>
              <button onClick={() => setIsolate((v) => !v)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${isolate ? 'bg-brand text-content-inverse' : 'text-content-secondary hover:text-content hover:bg-surface-inset'}`}>
                <Focus className="w-3 h-3" /> {isolate ? 'Isolated' : 'Isolate'}
              </button>
              <button onClick={clearSelection} className="p-1 rounded-full text-content-muted hover:text-content hover:bg-surface-inset" title="Clear (Esc)">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {hasGraph && (
            <div className="absolute bottom-16 left-3 rounded-lg border border-brd/40 bg-surface-overlay/90 backdrop-blur px-3 py-2 text-[10px] text-content-secondary space-y-1 pointer-events-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: palette.intermediate }} />Intermediate</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.target }} />Target</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette.source }} />Source</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette.reaction }} />Reaction (needs all inputs)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border border-dashed" style={{ borderColor: palette.choice }} />Branch point</span>
                <span>Line width = share of Paths</span>
                {fullModel.multi && <span className="italic" style={{ color: palette.diverge }}>diverges / merges</span>}
              </div>
            </div>
          )}

          {tooltip && <NodeTooltip tip={tooltip} model={model} names={names} />}
        </div>

        <Inspector
          selection={selection}
          path={selectedPath}
          model={fullModel}
          names={names}
          labelMode={labelMode}
          targets={shownTargets}
          targetColors={targetColors}
          pins={pins}
          synced={syncViews && !!focusedPath}
          isolate={isolate}
          onClose={clearSelection}
          onSelectNode={selectNode}
          onHoverElements={(set) => setHover(set ? { type: 'elements', set } : null)}
          onTogglePin={togglePin}
          onIsolate={() => setIsolate((v) => !v)}
          onExportSelection={() => doExport('selection')}
          deletedReactionNames={deletedReactionNames}
        />
      </div>
    </div>
  );
};

const NodeTooltip = ({ tip, model, names }) => {
  const { node, x, y } = tip;
  const d = node.data;
  const share = Math.round(shareOf(d, model.totals) * 100);
  return (
    <div
      className="fixed z-50 pointer-events-none max-w-xs rounded-lg border border-brd/60 bg-surface-overlay/95 backdrop-blur shadow-xl px-3 py-2 text-xs"
      style={{ left: x + 14, top: y + 14 }}
    >
      {node.kind === 'compound' ? (
        <>
          <div className="font-semibold text-content">{names[d.id] || d.id}</div>
          <div className="text-[11px] text-content-muted font-mono">{d.id} · gen {d.level} · {d.role}</div>
          <div className="mt-1 text-[11px] text-content-secondary">On {share}% of Paths</div>
          {d.isChoice && <div className="text-[11px] text-content-secondary">{d.producers.length} alternative producing reactions</div>}
          {d.diverges && <div className="text-[11px] text-err">Routes to different targets split here</div>}
          {d.merges && <div className="text-[11px] text-err">Targets reach it by different reactions</div>}
        </>
      ) : (
        <>
          <div className="font-semibold font-mono text-content">{d.reaction}{d.direction === 'reverse' ? ' (reverse)' : ''}</div>
          <div className="mt-0.5 text-[11px] text-content-secondary leading-snug">
            {(d.equation || '').replace(/[CZ]\d{5}/g, (id) => names[id] || id).replace(/=>/g, '→')}
          </div>
          {d.ecList?.length > 0 && <div className="text-[11px] text-content-muted font-mono mt-0.5">EC {d.ecList.join(', ')}</div>}
          <div className="mt-1 text-[11px] text-content-secondary">On {share}% of Paths</div>
        </>
      )}
      <div className="mt-1 text-[10px] text-content-muted">Click to select</div>
    </div>
  );
};

export default PathwayExplorer;
