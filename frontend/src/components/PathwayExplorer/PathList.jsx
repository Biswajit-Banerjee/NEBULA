import React, { useEffect, useRef, useState } from 'react';
import { Search, Pin, AlertTriangle, GitFork, GitMerge, X, Route, Split, Telescope, Loader2, Layers } from 'lucide-react';
import { PIN_COLORS } from './palette';
import { shareOf } from './model';

const displayName = (id, names, labelMode) =>
  (labelMode !== 'id' && names?.[id]) ? names[id] : id;

const DeeperButton = ({ onSearchDeeper, searching, deeperLimit }) => (onSearchDeeper ? (
  <button
    onClick={onSearchDeeper}
    disabled={searching}
    className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold border border-brand/40 text-brand hover:bg-brand/10 disabled:opacity-50"
    title="Re-run the enumeration with a larger cap"
  >
    {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Telescope className="w-3.5 h-3.5" />}
    Search deeper (up to {deeperLimit.toLocaleString()} paths)
  </button>
) : null);

const Summary = ({ targets, multi, model, names, labelMode, statsByKey, onSelectNode, deeper, expandedPaths }) => {
  if (!multi) {
    const t = targets[0];
    if (!t) return null;
    const sols = t.solutions || [];
    const stats = statsByKey[t.key] || {};
    const distinctRoutes = stats.distinct_routes ?? sols.length;
    const shortest = sols.length ? Math.min(...sols.map((s) => s.reactionCount)) : 0;
    const branchPoints = [...model.compounds.values()].filter((c) => c.isChoice && model.visible.has(c.id)).length;
    const starts = new Set(); expandedPaths.forEach((p) => p.precursors.forEach((c) => starts.add(c)));
    return (
      <div className="px-4 pt-4 pb-3 border-b border-brd/40">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-content tabular-nums">{distinctRoutes}{stats.truncated ? '+' : ''}</span>
          <span className="text-sm text-content-secondary">distinct route{distinctRoutes !== 1 ? 's' : ''} to make</span>
        </div>
        <button
          onClick={() => onSelectNode(t.target)}
          className="mt-0.5 text-sm font-semibold text-content hover:text-brand truncate max-w-full text-left"
          title={t.target}
        >
          {displayName(t.target, names, labelMode)} <span className="font-mono text-xs text-content-muted">{t.target}</span>
        </button>
        {distinctRoutes < sols.length && (
          <p className="mt-1 text-[11px] text-content-muted leading-snug">
            {sols.length.toLocaleString()} raw combinations of interchangeable steps (e.g. alternate ways
            to make a shared precursor) collapse into these routes — look for the <Layers className="inline w-3 h-3 -mt-0.5" /> badge.
          </p>
        )}
        {sols.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              [shortest, 'shortest (steps)'],
              [branchPoints, 'branch points'],
              [starts.size, 'seed / source compounds'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-surface-inset/50 px-2 py-1.5">
                <div className="text-base font-bold text-content tabular-nums">{v}</div>
                <div className="text-[10px] leading-tight text-content-muted">{l}</div>
              </div>
            ))}
          </div>
        )}
        {stats.truncated && (
          <p className="mt-2 text-[11px] text-content-muted leading-snug">
            There are more than {sols.length.toLocaleString()} pathways; the shortest ones are listed.
            All parallel reactions are still drawn on the graph (dashed if not in a listed path).
          </p>
        )}
        {stats.truncated && <DeeperButton {...deeper} />}
        {t.source && (
          <p className="mt-2 text-[11px] text-content-muted">
            Every path consumes <span className="font-mono">{t.source}</span>.
          </p>
        )}
      </div>
    );
  }

  const shared = [...model.compounds.values()].filter((c) => c.shared && model.visible.has(c.id));
  return (
    <div className="px-4 pt-4 pb-3 border-b border-brd/40 space-y-2">
      {targets.map((t) => {
        const n = statsByKey[t.key]?.distinct_routes ?? (t.solutions || []).length;
        const trunc = statsByKey[t.key]?.truncated;
        return (
          <button key={t.key} onClick={() => onSelectNode(t.target)} className="w-full flex items-center gap-2 text-left group">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
            <span className="text-sm font-semibold text-content truncate group-hover:text-brand">{displayName(t.target, names, labelMode)}</span>
            <span className="ml-auto text-xs text-content-muted tabular-nums flex-shrink-0">{n}{trunc ? '+' : ''} routes</span>
          </button>
        );
      })}
      <div className="flex items-center gap-3 pt-1 text-[11px] text-content-muted">
        <span><b className="text-content">{shared.length}</b> shared intermediates</span>
        <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{shared.filter((c) => c.diverges).length} diverge</span>
        <span className="flex items-center gap-1"><GitMerge className="w-3 h-3" />{shared.filter((c) => c.merges).length} merge</span>
      </div>
      {targets.some((t) => statsByKey[t.key]?.truncated) && <DeeperButton {...deeper} />}
    </div>
  );
};

const CARD_H = 78;

const PathCard = ({
  path, multi, isSelected, pinIdx, broken, names, labelMode, onSelect, onHover, onPin,
}) => {
  const pre = path.precursors.map((p) => displayName(p, names, labelMode));
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ height: CARD_H }}
      className={`group relative px-4 py-2.5 border-b border-brd/15 cursor-pointer transition-colors overflow-hidden ${
        isSelected ? 'bg-brand/10' : 'hover:bg-surface-overlay/60'
      }`}
    >
      {isSelected && <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand" />}
      <div className="flex items-center gap-2">
        {multi && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: path.target.color }} />}
        <span className={`text-sm font-bold ${isSelected ? 'text-brand' : 'text-content'}`}>Path {path.number}</span>
        <span className="text-xs text-content-secondary tabular-nums">{path.reactionCount} step{path.reactionCount !== 1 ? 's' : ''}</span>
        <span className="text-xs text-content-muted tabular-nums">· depth {path.depth}</span>
        {path.isShortest && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-ok bg-ok/10 px-1.5 py-0.5 rounded">shortest</span>
        )}
        {path.clusterSize > 1 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded"
            title={`${path.clusterSize} equivalent combinations of interchangeable steps — differs only in: ${
              (path.swaps || []).map((s) => `${s.reactions.length} ways to make ${s.compounds.map((c) => displayName(c, names, labelMode)).join('/')}`).join('; ')
            }`}
          >
            <Layers className="w-3 h-3" />{path.clusterSize}
          </span>
        )}
        {broken && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warn" title="Uses a reaction deleted in the Table view">
            <AlertTriangle className="w-3 h-3" /> broken
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className={`ml-auto p-1 rounded transition-opacity ${pinIdx >= 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-surface-inset`}
          title={pinIdx >= 0 ? 'Unpin' : 'Pin to compare (overlay on graph)'}
        >
          <Pin className="w-3.5 h-3.5" style={{ color: pinIdx >= 0 ? PIN_COLORS[pinIdx] : undefined }} fill={pinIdx >= 0 ? PIN_COLORS[pinIdx] : 'none'} />
        </button>
      </div>
      <div className="mt-1 text-[11px] text-content-muted truncate" title={pre.join(', ')}>
        from {pre.slice(0, 3).join(', ')}{pre.length > 3 ? ` +${pre.length - 3}` : ''}
      </div>
      {path.diff && !path.isShortest && (
        <div className="mt-0.5 text-[11px] text-content-muted">
          vs path 1: <span className="text-ok font-medium">+{path.diff.added}</span>{' '}
          <span className="text-err font-medium">−{path.diff.removed}</span> steps
        </div>
      )}
    </div>
  );
};

const NodeRow = ({ c, names, labelMode, model, onSelect, onHover, targetColors, selected }) => (
  <button
    onClick={() => onSelect(c.id)}
    onMouseEnter={() => onHover(c.id)}
    onMouseLeave={() => onHover(null)}
    className={`w-full text-left px-4 py-2 border-b border-brd/15 hover:bg-surface-overlay/60 ${selected ? 'bg-brand/10' : ''}`}
  >
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-content truncate">{displayName(c.id, names, labelMode)}</span>
      <span className="font-mono text-[10px] text-content-muted flex-shrink-0">{c.id}</span>
      <span className="ml-auto text-[10px] text-content-muted flex-shrink-0">gen {c.level}</span>
    </div>
    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-content-muted">
      {model.multi ? (
        <>
          <span className="flex items-center gap-0.5">
            {[...c.targets].map((k) => <span key={k} className="w-2 h-2 rounded-full" style={{ backgroundColor: targetColors[k] }} />)}
          </span>
          {c.diverges && <span className="flex items-center gap-0.5 text-err font-medium"><GitFork className="w-3 h-3" />diverges</span>}
          {c.merges && <span className="flex items-center gap-0.5 text-err font-medium"><GitMerge className="w-3 h-3" />merges</span>}
        </>
      ) : (
        <span>{c.producers.length} alternative producing reactions</span>
      )}
      <span className="ml-auto tabular-nums">{Math.round(shareOf(c, model.totals) * 100)}% of paths</span>
    </div>
  </button>
);

const PathList = ({
  targets, multi, model, names, labelMode, statsByKey, targetColors,
  paths, totalPaths, selection, selectedPathKey, pins, onSelectPath, onHoverPath, onTogglePin,
  onSelectNode, onHoverNode, query, setQuery, sortBy, setSortBy, tab, setTab,
  nodeFilter, onClearNodeFilter, deletedReactionNames, searching, onSearchDeeper, deeperLimit, allPaths = [],
}) => {
  // Windowed list — targets can have thousands of pathways.
  const listRef = useRef(null);
  const [scroll, setScroll] = useState({ top: 0, h: 600 });
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setScroll((s) => ({ ...s, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);
  useEffect(() => {
    const el = listRef.current;
    if (!el || !selectedPathKey) return;
    const idx = paths.findIndex((p) => p.key === selectedPathKey);
    if (idx < 0) return;
    const top = idx * CARD_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + CARD_H > el.scrollTop + el.clientHeight) el.scrollTop = top + CARD_H - el.clientHeight;
  }, [selectedPathKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = Math.max(0, Math.floor(scroll.top / CARD_H) - 6);
  const last = Math.min(paths.length, Math.ceil((scroll.top + scroll.h) / CARD_H) + 6);

  const nodeList = [...model.compounds.values()]
    .filter((c) => model.visible.has(c.id) && (multi ? c.shared : c.isChoice))
    .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));

  return (
    <div className="w-80 flex-shrink-0 h-full border-r border-brd/50 bg-surface-secondary/70 flex flex-col min-h-0">
      <Summary targets={targets} multi={multi} model={model} names={names} labelMode={labelMode} statsByKey={statsByKey}
        onSelectNode={onSelectNode} deeper={{ onSearchDeeper, searching, deeperLimit: deeperLimit || 0 }} expandedPaths={allPaths} />

      <div className="flex items-center gap-1 px-3 pt-2 border-b border-brd/40">
        {[
          ['paths', <Route key="i" className="w-3.5 h-3.5" />, `Paths`, totalPaths],
          ['nodes', multi ? <Split key="i" className="w-3.5 h-3.5" /> : <GitFork key="i" className="w-3.5 h-3.5" />, multi ? 'Shared' : 'Branch points', nodeList.length],
        ].map(([id, icon, label, n]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-brand text-content' : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            {icon}{label}<span className="text-content-muted font-normal tabular-nums">{n}</span>
          </button>
        ))}
      </div>

      {tab === 'paths' ? (
        <>
          <div className="px-3 py-2 space-y-2 border-b border-brd/30">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by compound or reaction…"
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-input-bg border border-input-brd focus:outline-none focus:border-input-focus text-content placeholder:text-content-muted"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-content-muted">
              <span className="tabular-nums">{paths.length} of {totalPaths} shown</span>
              <label className="flex items-center gap-1">
                Sort
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-content font-medium focus:outline-none cursor-pointer"
                >
                  <option value="length">Fewest steps</option>
                  <option value="depth">Shallowest</option>
                  <option value="precursors">Fewest seed / source compounds</option>
                </select>
              </label>
            </div>
            {nodeFilter && (
              <div className="flex items-center gap-2 text-[11px] bg-brand/10 text-content rounded-md px-2 py-1">
                <span className="truncate">Through <b>{displayName(nodeFilter, names, labelMode)}</b></span>
                <button onClick={onClearNodeFilter} className="ml-auto text-content-muted hover:text-content flex-shrink-0" title="Show all paths">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div
            ref={listRef}
            className="flex-1 overflow-auto min-h-0"
            onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, h: e.currentTarget.clientHeight })}
          >
            {paths.length === 0 && (
              <p className="px-4 py-6 text-xs text-content-muted text-center">No paths match.</p>
            )}
            <div style={{ height: paths.length * CARD_H, position: 'relative' }}>
            <div style={{ position: 'absolute', top: first * CARD_H, left: 0, right: 0 }}>
            {paths.slice(first, last).map((p) => {
              const isSelected = selectedPathKey === p.key;
              return (
                <PathCard
                  key={p.key}
                  path={p}
                  multi={multi}
                  isSelected={isSelected}
                  pinIdx={pins.indexOf(p.key)}
                  broken={deletedReactionNames?.size > 0 && p.reactions.some((r) => deletedReactionNames.has(r.reaction))}
                  names={names}
                  labelMode={labelMode}
                  onSelect={() => onSelectPath(p.key)}
                  onHover={(on) => onHoverPath(on ? p.key : null)}
                  onPin={() => onTogglePin(p.key)}
                />
              );
            })}
            </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <p className="px-4 py-2 text-[11px] text-content-muted leading-snug border-b border-brd/20">
            {multi
              ? 'Intermediates used on the way to more than one target. Diverges: routes split towards different targets here. Merges: different targets reach it by different reactions.'
              : 'Compounds that can be made by more than one reaction — this is where alternative pathways branch.'}
          </p>
          {nodeList.length === 0 && <p className="px-4 py-6 text-xs text-content-muted text-center">None.</p>}
          {nodeList.map((c) => (
            <NodeRow
              key={c.id}
              c={c}
              names={names}
              labelMode={labelMode}
              model={model}
              targetColors={targetColors}
              selected={selection?.type === 'node' && selection.id === c.id}
              onSelect={onSelectNode}
              onHover={onHoverNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PathList;
