const NODE_LABEL = 'node-label';
const NODE_SUBTITLE = 'node-subtitle';
const TEXT_BOX = 'text-box';

const DEFAULTS = {
  [NODE_LABEL]: { fontSize: 7, fontFamily: 'Inter, Arial, sans-serif', fontWeight: '600', fontStyle: 'normal', textAlign: 'center', fill: null, opacity: 1, underline: false },
  [NODE_SUBTITLE]: { fontSize: 6, fontFamily: 'Inter, Arial, sans-serif', fontWeight: '400', fontStyle: 'normal', textAlign: 'center', fill: null, opacity: 0.9, underline: false },
  [TEXT_BOX]: { fontSize: 16, fontFamily: 'Inter, Arial, sans-serif', fontWeight: '400', fontStyle: 'normal', textAlign: 'left', fill: null, opacity: 1, underline: false },
};

let nextFreeTextId = 1;

export const TEXT_KINDS = { NODE_LABEL, NODE_SUBTITLE, TEXT_BOX };

export const nodeTextId = (nodeId, kind) => `node:${encodeURIComponent(nodeId)}:${kind}`;

export const createTextBox = (x, y, overrides = {}) => ({
  id: `text:${Date.now()}:${nextFreeTextId++}`,
  kind: TEXT_BOX,
  content: '',
  position: { x, y },
  anchor: null,
  offset: null,
  autoPosition: false,
  visible: true,
  ...DEFAULTS[TEXT_BOX],
  ...overrides,
});

export const cloneTextItem = (item) => ({
  ...item,
  position: item.position ? { ...item.position } : null,
  anchor: item.anchor ? { ...item.anchor } : null,
  offset: item.offset ? { ...item.offset } : null,
});

export const normalizeTextItem = (raw) => {
  const defaults = DEFAULTS[raw.kind] || DEFAULTS[TEXT_BOX];
  return {
    visible: true,
    content: '',
    position: { x: 0, y: 0 },
    anchor: null,
    offset: null,
    autoPosition: false,
    ...defaults,
    ...raw,
    position: raw.position ? { ...raw.position } : { x: 0, y: 0 },
    anchor: raw.anchor ? { ...raw.anchor } : null,
    offset: raw.offset ? { ...raw.offset } : null,
  };
};

const defaultNodeLabel = (node) => {
  let label = node.label ?? node.id;
  if (/reaction-/.test(node.type)) label = label.split('_')[0];
  return label;
};

const defaultSubtitle = (node, nameMap) => nameMap.get(node.id) || '';

export const nodeTextDefaults = (node, { hasStructure = false, compoundRadius = 16, structureHeight = 50 } = {}) => {
  if (hasStructure && node.type === 'compound') {
    return {
      label: { x: 0, y: structureHeight / 2 + 4 },
      subtitle: { x: 0, y: structureHeight / 2 + 14 },
    };
  }
  return {
    label: { x: 0, y: 0 },
    subtitle: { x: 0, y: compoundRadius + 4 },
  };
};

/**
 * Adds required node label/subtitle records, removes stale anchored records,
 * and preserves every user edit, style, visibility value, and custom offset.
 */
export const reconcileNodeText = (items, nodes, nameMap, getPresentation) => {
  const byId = new Map(items.map(item => [item.id, normalizeTextItem(item)]));
  const nodeIds = new Set(nodes.map(node => node.id));

  nodes.forEach(node => {
    const presentation = getPresentation(node);
    const defaults = nodeTextDefaults(node, presentation);
    const labelId = nodeTextId(node.id, NODE_LABEL);
    const label = byId.get(labelId);

    if (!label) {
      byId.set(labelId, normalizeTextItem({
        id: labelId,
        kind: NODE_LABEL,
        content: defaultNodeLabel(node),
        anchor: { nodeId: node.id },
        offset: defaults.label,
        autoPosition: true,
      }));
    } else {
      if (!label.contentEdited) label.content = defaultNodeLabel(node);
      if (label.autoPosition) label.offset = defaults.label;
      label.anchor = { nodeId: node.id };
    }

    if (node.type !== 'compound') return;
    const subtitleId = nodeTextId(node.id, NODE_SUBTITLE);
    const subtitle = byId.get(subtitleId);
    const subtitleContent = defaultSubtitle(node, nameMap);
    if (!subtitle) {
      byId.set(subtitleId, normalizeTextItem({
        id: subtitleId,
        kind: NODE_SUBTITLE,
        content: subtitleContent,
        anchor: { nodeId: node.id },
        offset: defaults.subtitle,
        autoPosition: true,
      }));
    } else {
      if (!subtitle.contentEdited) subtitle.content = subtitleContent;
      if (subtitle.autoPosition) subtitle.offset = defaults.subtitle;
      subtitle.anchor = { nodeId: node.id };
    }
  });

  return [...byId.values()].filter(item => !item.anchor || nodeIds.has(item.anchor.nodeId));
};

export const resolveTextPosition = (item, nodeMap) => {
  if (item.anchor?.nodeId) {
    const node = nodeMap.get(item.anchor.nodeId);
    if (node) return { x: node.x + (item.offset?.x || 0), y: node.y + (item.offset?.y || 0) };
  }
  return item.position || { x: 0, y: 0 };
};

const textFill = (item, kind, theme) => {
  if (item.fill) return item.fill;
  if (kind === NODE_SUBTITLE) return `rgb(${theme.muted})`;
  return `rgb(${theme.primary})`;
};

const font = (item, fontScale) => {
  const scale = item.kind === TEXT_BOX ? 1 : fontScale;
  const size = Math.max(4, item.fontSize * scale);
  const italic = item.fontStyle === 'italic' ? 'italic ' : '';
  return { css: `${italic}${item.fontWeight || '400'} ${size}px ${item.fontFamily}`, size };
};

export const drawCanvasText = (ctx, items, nodeMap, options) => {
  const { transform, fontScale = 1, theme, selectedId, layoutCache, showLabels, showSubtitles } = options;
  const zoom = transform.k;
  layoutCache.clear();

  items.forEach(item => {
    if (!item.visible || !item.content) return;
    if (item.kind === NODE_LABEL && (!showLabels || zoom < 0.45)) return;
    if (item.kind === NODE_SUBTITLE && (!showSubtitles || zoom < 0.45)) return;

    const pos = resolveTextPosition(item, nodeMap);
    const { css, size } = font(item, fontScale);
    const lines = item.content.split('\n');
    const lineHeight = size * 1.28;

    ctx.save();
    ctx.font = css;
    ctx.textAlign = item.textAlign;
    ctx.textBaseline = item.kind === NODE_LABEL ? 'middle' : item.kind === NODE_SUBTITLE ? 'top' : 'alphabetic';
    ctx.fillStyle = textFill(item, item.kind, theme);
    ctx.globalAlpha = item.opacity;

    let widest = 0;
    lines.forEach((line, index) => {
      const y = item.kind === NODE_LABEL ? pos.y + index * lineHeight : pos.y + index * lineHeight;
      const width = ctx.measureText(line || ' ').width;
      widest = Math.max(widest, width);
      ctx.fillText(line || ' ', pos.x, y);
      if (item.underline) {
        const startX = item.textAlign === 'center' ? pos.x - width / 2 : item.textAlign === 'right' ? pos.x - width : pos.x;
        ctx.beginPath();
        ctx.moveTo(startX, y + size * 0.16);
        ctx.lineTo(startX + width, y + size * 0.16);
        ctx.lineWidth = Math.max(0.5, size * 0.065);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.stroke();
      }
    });

    const width = Math.max(22, widest + 12);
    const height = Math.max(size, lines.length * lineHeight) + 8;
    const left = item.textAlign === 'center' ? pos.x - width / 2 : item.textAlign === 'right' ? pos.x - width : pos.x - 6;
    const top = item.kind === NODE_LABEL ? pos.y - size / 2 - 4 : item.kind === NODE_SUBTITLE ? pos.y - 4 : pos.y - size - 5;
    const box = { x: left, y: top, width, height, position: pos };
    layoutCache.set(item.id, box);

    if (selectedId === item.id) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = `rgb(${theme.accent})`;
      ctx.fillStyle = `rgba(${theme.accent},0.09)`;
      ctx.setLineDash([3 / zoom, 2 / zoom]);
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
};

export const hitTestCanvasText = (items, layoutCache, x, y, { showLabels, showSubtitles }) => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item.visible || !item.content) continue;
    if (item.kind === NODE_LABEL && !showLabels) continue;
    if (item.kind === NODE_SUBTITLE && !showSubtitles) continue;
    const box = layoutCache.get(item.id);
    if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return item;
  }
  return null;
};

const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svgAnchor = align => (align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle');

export const textItemToSvg = (item, position, fallbackFill = '#374151') => {
  if (!item.visible || !item.content) return '';
  const attrs = [
    `x="${position.x.toFixed(2)}"`,
    `y="${position.y.toFixed(2)}"`,
    `font-family="${esc(item.fontFamily)}"`,
    `font-size="${item.fontSize}"`,
    `font-weight="${esc(item.fontWeight)}"`,
    `font-style="${esc(item.fontStyle)}"`,
    `fill="${esc(item.fill || fallbackFill)}"`,
    `text-anchor="${svgAnchor(item.textAlign)}"`,
    `data-nebula-text-kind="${item.kind}"`,
    `data-nebula-text-id="${esc(item.id)}"`,
  ];
  if (item.opacity < 1) attrs.push(`opacity="${item.opacity.toFixed(2)}"`);
  if (item.underline) attrs.push('text-decoration="underline"');
  if (item.kind === NODE_LABEL) attrs.push('dominant-baseline="middle"');
  if (item.kind === NODE_SUBTITLE) attrs.push('dominant-baseline="hanging"');
  if (item.anchor?.nodeId) attrs.push(`data-nebula-anchor-node="${esc(item.anchor.nodeId)}"`);
  if (item.offset) attrs.push(`data-nebula-offset-x="${item.offset.x.toFixed(2)}"`, `data-nebula-offset-y="${item.offset.y.toFixed(2)}"`);

  const lines = item.content.split('\n');
  if (lines.length === 1) return `<text ${attrs.join(' ')}>${esc(lines[0])}</text>`;
  const lineHeight = item.fontSize * 1.28;
  const tspans = lines.map((line, index) => `<tspan x="${position.x.toFixed(2)}" dy="${index === 0 ? 0 : lineHeight.toFixed(2)}">${esc(line)}</tspan>`).join('');
  return `<text ${attrs.join(' ')}>${tspans}</text>`;
};
