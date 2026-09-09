// Shared helpers for SVG export/import round-tripping (positions, colors, labels).
// Keeping these in one place ensures the exporter (GraphRendererCanvas) and the
// importer (NetworkViewer2D/index) agree on ids and color comparisons.

// Sanitize a string for use as an SVG group id (also an Illustrator layer name).
export const safeId = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

// Structural layer ids used by the exporter — never a node id, so they must be
// skipped when walking up the DOM to find a node's owning group.
const RESERVED_GROUP_IDS = new Set(['Nodes', 'Edges', 'Generation_Labels']);
export const isReservedGroupId = (id) => !id || RESERVED_GROUP_IDS.has(id) || /^Generation_\d+$/.test(id);

// Normalize any CSS color string (hex/rgb/named) to the browser's canonical form
// so imported colors can be reliably diffed against computed defaults.
let _normCtx = null;
export const normalizeColor = (color) => {
  if (!color) return null;
  try {
    if (!_normCtx) _normCtx = document.createElement('canvas').getContext('2d');
    _normCtx.fillStyle = '#000000'; // reset so an invalid input can't reuse a stale value
    _normCtx.fillStyle = color;
    return _normCtx.fillStyle;
  } catch {
    return String(color).trim().toLowerCase();
  }
};
