import React, { useState } from 'react';
import { X, Pin, Copy, Check, Download, Focus, ArrowRight, Link2, GitFork, GitMerge } from 'lucide-react';
import { PIN_COLORS } from './palette';
import { shareOf } from './model';

const nameOf = (id, names, labelMode) => ((labelMode !== 'id' && names?.[id]) ? names[id] : id);

export const formatEquation = (eq, names, labelMode) =>
  (eq || '').replace(/[CZ]\d{5}/g, (id) => nameOf(id, names, labelMode)).replace(/=>/g, '→');

const ROLE_LABEL = {
  target: 'Target', source: 'Source compound', seed: 'Seed compound (generation 0)',
  intermediate: 'Intermediate', cofactor: 'Cofactor',
};

const Chip = ({ id, names, labelMode, onClick, onHover, tone }) => (
  <button
    onClick={() => onClick(id)}
    onMouseEnter={() => onHover && onHover(id)}
    onMouseLeave={() => onHover && onHover(null)}
    className={`inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md text-[11px] border hover:border-brand hover:text-brand transition-colors ${
      tone === 'source' ? 'border-ok/40 text-ok bg-ok/5' : 'border-brd/60 text-content-secondary bg-surface-inset/40'
    }`}
    title={id}
  >
    <span className="truncate">{nameOf(id, names, labelMode)}</span>
  </button>
);

const Section = ({ title, children, right }) => (
  <div className="px-4 py-3 border-b border-brd/30">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{title}</h4>
      {right}
    </div>
    {children}
  </div>
);

const ShareBar = ({ value }) => (
  <div className="h-1.5 w-full rounded-full bg-surface-inset overflow-hidden">
    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, value * 100)}%` }} />
  </div>
);

const Inspector = ({
  selection, path, model, names, labelMode, targets, targetColors, pins, synced,
  onClose, onSelectNode, onHoverElements, onTogglePin, onExportSelection, onIsolate, isolate,
  deletedReactionNames,
}) => {
  const [copied, setCopied] = useState(false);
  if (!selection) return null;

  const hoverReaction = (rid) => {
    if (!rid) return onHoverElements(null);
    const r = model.reactions.get(rid);
    onHoverElements(r ? { reactions: new Set([rid]), compounds: new Set([...r.inputs, ...r.outputs]) } : null);
  };
  const hoverCompound = (cid) => onHoverElements(cid ? { reactions: new Set(), compounds: new Set([cid]) } : null);

  const actions = (
    <div className="flex items-center gap-1 flex-wrap">
      <button onClick={onIsolate} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${isolate ? 'border-brand text-brand bg-brand/10' : 'border-brd/60 text-content-secondary hover:text-content'}`} title="Show only this selection on the canvas">
        <Focus className="w-3.5 h-3.5" /> Isolate
      </button>
      <button onClick={onExportSelection} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-brd/60 text-content-secondary hover:text-content" title="Download a publication SVG of just this selection">
        <Download className="w-3.5 h-3.5" /> SVG
      </button>
    </div>
  );

  let body;
  let title;
  let subtitle;

  if (selection.type === 'path' && path) {
    const pinIdx = pins.indexOf(path.key);
    title = `Path ${path.number}`;
    subtitle = `${path.reactionCount} steps · depth ${path.depth}${model.multi ? ` · to ${nameOf(path.target.target, names, labelMode)}` : ''}`;
    const copy = () => {
      const text = path.reactions.map((r, i) => `${i + 1}. ${r.reaction}${r.direction === 'reverse' ? ' (reverse)' : ''}\t${r.equation}\t${(r.ec_list || []).join(', ')}`).join('\n');
      navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
    };
    body = (
      <>
        <Section title="Actions">
          <div className="flex items-center gap-1 flex-wrap">
            {actions}
            <button onClick={() => onTogglePin(path.key)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-brd/60 text-content-secondary hover:text-content">
              <Pin className="w-3.5 h-3.5" style={{ color: pinIdx >= 0 ? PIN_COLORS[pinIdx] : undefined }} fill={pinIdx >= 0 ? PIN_COLORS[pinIdx] : 'none'} /> {pinIdx >= 0 ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={copy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-brd/60 text-content-secondary hover:text-content">
              {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />} Copy steps
            </button>
          </div>
        </Section>
        <Section title={`Seed & source compounds used (${path.precursors.length})`}>
          <div className="flex flex-wrap gap-1">
            {path.precursors.map((p) => (
              <Chip key={p} id={p} names={names} labelMode={labelMode} onClick={onSelectNode} onHover={hoverCompound}
                tone={model.compounds.get(p)?.role === 'source' ? 'source' : undefined} />
            ))}
          </div>
        </Section>
        <Section title="Steps (in order)">
          <ol className="space-y-2.5">
            {path.reactions.map((r, i) => {
              const deleted = deletedReactionNames?.has(r.reaction);
              return (
                <li
                  key={r.id}
                  className="flex gap-2.5 group cursor-pointer"
                  onMouseEnter={() => hoverReaction(r.id)}
                  onMouseLeave={() => hoverReaction(null)}
                  onClick={() => onSelectNode(r.id)}
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-inset text-[10px] font-bold text-content-secondary flex items-center justify-center tabular-nums group-hover:bg-brand group-hover:text-content-inverse">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono text-xs font-semibold ${deleted ? 'text-err line-through' : 'text-content'}`}>{r.reaction}</span>
                      {r.direction === 'reverse' && <span className="text-[10px] text-content-muted">reverse</span>}
                      {(r.ec_list || []).slice(0, 2).map((ec) => (
                        <span key={ec} className="text-[10px] font-mono text-content-muted bg-surface-inset/60 px-1 rounded">EC {ec}</span>
                      ))}
                      {(r.ec_list || []).length > 2 && <span className="text-[10px] text-content-muted">+{r.ec_list.length - 2}</span>}
                    </div>
                    <p className="text-[11px] text-content-secondary leading-snug mt-0.5 break-words">
                      {formatEquation(r.equation, names, labelMode)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      </>
    );
  } else if (selection.type === 'node' && model.compounds.has(selection.id)) {
    const c = model.compounds.get(selection.id);
    const share = shareOf(c, model.totals);
    title = nameOf(c.id, names, labelMode);
    subtitle = `${c.id} · ${ROLE_LABEL[c.role] || c.role} · generation ${c.level}`;
    body = (
      <>
        <Section title="Usage">
          <div className="text-xs text-content-secondary mb-1.5">
            On <b className="text-content">{Math.round(share * 100)}%</b> of listed Paths
          </div>
          <ShareBar value={share} />
          {model.multi && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-content-secondary">
              {[...c.targets].map((k) => {
                const t = targets.find((x) => x.key === k);
                return (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: targetColors[k] }} />
                    {t ? nameOf(t.target, names, labelMode) : k}
                  </span>
                );
              })}
            </div>
          )}
          {(c.diverges || c.merges) && (
            <div className="mt-2 space-y-1 text-[11px] text-content-secondary">
              {c.diverges && <p className="flex gap-1.5"><GitFork className="w-3.5 h-3.5 text-err flex-shrink-0" />Routes split here towards different targets.</p>}
              {c.merges && <p className="flex gap-1.5"><GitMerge className="w-3.5 h-3.5 text-err flex-shrink-0" />Different targets reach this compound by different reactions.</p>}
            </div>
          )}
          {actions && <div className="mt-3">{actions}</div>}
        </Section>
        {c.producers.length > 0 && (
          <Section title={`Made by (${c.producers.length} alternative${c.producers.length !== 1 ? 's' : ''})`}>
            <ul className="space-y-2">
              {c.producers
                .map((rid) => model.reactions.get(rid))
                .sort((a, b) => shareOf(b, model.totals) - shareOf(a, model.totals))
                .map((r) => (
                  <li key={r.id} className="cursor-pointer group" onClick={() => onSelectNode(r.id)}
                    onMouseEnter={() => hoverReaction(r.id)} onMouseLeave={() => hoverReaction(null)}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-content group-hover:text-brand">{r.reaction}</span>
                      <span className="ml-auto text-[10px] text-content-muted tabular-nums">{Math.round(shareOf(r, model.totals) * 100)}%</span>
                    </div>
                    <p className="text-[11px] text-content-muted leading-snug truncate" title={formatEquation(r.equation, names, labelMode)}>
                      {formatEquation(r.equation, names, labelMode)}
                    </p>
                  </li>
                ))}
            </ul>
          </Section>
        )}
        {c.consumers.length > 0 && (
          <Section title={`Used by (${c.consumers.length})`}>
            <div className="flex flex-wrap gap-1">
              {c.consumers.map((rid) => (
                <button key={rid} onClick={() => onSelectNode(rid)} onMouseEnter={() => hoverReaction(rid)} onMouseLeave={() => hoverReaction(null)}
                  className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-brd/60 text-content-secondary hover:text-brand hover:border-brand">
                  {model.reactions.get(rid)?.reaction}
                </button>
              ))}
            </div>
          </Section>
        )}
      </>
    );
  } else if (selection.type === 'node' && model.reactions.has(selection.id)) {
    const r = model.reactions.get(selection.id);
    const share = shareOf(r, model.totals);
    title = r.reaction;
    subtitle = `${r.direction === 'reverse' ? 'reverse · ' : ''}fires at generation ${r.level}`;
    const list = (label, ids) => ids.length > 0 && (
      <div className="mb-2">
        <div className="text-[10px] text-content-muted mb-1">{label}</div>
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => <Chip key={id} id={id} names={names} labelMode={labelMode} onClick={onSelectNode} onHover={hoverCompound} />)}
        </div>
      </div>
    );
    body = (
      <>
        <Section title="Reaction">
          <p className="text-xs text-content leading-snug break-words">{formatEquation(r.equation, names, labelMode)}</p>
          {r.ecList?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {r.ecList.map((ec) => <span key={ec} className="text-[10px] font-mono text-content-secondary bg-surface-inset/60 px-1.5 py-0.5 rounded">EC {ec}</span>)}
            </div>
          )}
          <div className="mt-3 text-xs text-content-secondary mb-1.5">On <b className="text-content">{Math.round(share * 100)}%</b> of listed Paths</div>
          <ShareBar value={share} />
          <div className="mt-3">{actions}</div>
        </Section>
        <Section title="Participants">
          {list('Requires (all of)', [...r.inputs, ...r.seedInputs])}
          {list('Produces (on route)', r.outputs)}
          {list('Side products', r.sideProducts || [])}
          {list('Cofactors (assumed available)', r.cofactors || [])}
        </Section>
      </>
    );
  } else {
    return null;
  }

  return (
    <div className="w-80 flex-shrink-0 h-full border-l border-brd/50 bg-surface-secondary/70 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-brd/40 flex items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-content truncate" title={title}>{title}</h3>
          <p className="text-[11px] text-content-muted truncate">{subtitle}</p>
        </div>
        <button onClick={onClose} className="ml-auto p-1 rounded text-content-muted hover:text-content hover:bg-surface-inset flex-shrink-0" title="Clear selection (Esc)">
          <X className="w-4 h-4" />
        </button>
      </div>
      {synced && (
        <div className="px-4 py-2 text-[11px] text-content-secondary bg-brand/5 border-b border-brd/30 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-brand flex-shrink-0" />
          Table, Network and Map views are filtered to this selection
          <ArrowRight className="w-3 h-3 ml-auto flex-shrink-0" />
        </div>
      )}
      <div className="flex-1 overflow-auto min-h-0">{body}</div>
    </div>
  );
};

export default Inspector;
