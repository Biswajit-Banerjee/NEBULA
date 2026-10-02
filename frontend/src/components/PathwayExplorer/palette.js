/**
 * Color palettes for the pathway graphics.
 *  - themePalette(): resolved from the active theme's CSS custom properties
 *  - PUBLICATION_PALETTE: fixed, colorblind-safe (Okabe–Ito) palette on white,
 *    used for exported figures.
 */

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const PUBLICATION_PALETTE = {
  font: FONT,
  bg: '#ffffff',
  text: '#1a1a1a',
  muted: '#5f6b7a',
  grid: '#d9dee5',
  edge: '#8f9aa8',
  edgeShared: '#3b3b3b',
  nodeFill: '#ffffff',
  intermediate: '#0072B2',
  target: '#D55E00',
  source: '#009E73',
  seed: '#8c8c8c',
  reaction: '#4B3F8F',
  highlight: '#E69F00',
  choice: '#CC79A7',
  diverge: '#B8336A',
  error: '#D62728',
};

const cssRgb = (style, name, fallback) => {
  const v = style.getPropertyValue(name).trim();
  if (!v) return fallback;
  const parts = v.split(/[\s,]+/).filter(Boolean);
  return parts.length >= 3 ? `rgb(${parts.slice(0, 3).join(',')})` : fallback;
};

const cssRgba = (style, name, alpha, fallback) => {
  const v = style.getPropertyValue(name).trim();
  const parts = v.split(/[\s,]+/).filter(Boolean);
  return parts.length >= 3 ? `rgba(${parts.slice(0, 3).join(',')},${alpha})` : fallback;
};

export function themePalette() {
  if (typeof window === 'undefined') return PUBLICATION_PALETTE;
  const s = getComputedStyle(document.documentElement);
  const P = PUBLICATION_PALETTE;
  return {
    font: FONT,
    bg: cssRgb(s, '--surface-primary', P.bg),
    text: cssRgb(s, '--text-primary', P.text),
    muted: cssRgb(s, '--text-muted', P.muted),
    grid: cssRgba(s, '--text-muted', 0.22, P.grid),
    edge: cssRgba(s, '--text-muted', 0.9, P.edge),
    edgeShared: cssRgb(s, '--text-secondary', P.edgeShared),
    nodeFill: cssRgb(s, '--surface-elevated', P.nodeFill),
    intermediate: cssRgb(s, '--tree-metabolite', P.intermediate),
    target: cssRgb(s, '--warning', P.target),
    source: cssRgb(s, '--tree-source', P.source),
    seed: cssRgb(s, '--tree-cofactor', P.seed),
    reaction: cssRgb(s, '--tree-reaction', P.reaction),
    highlight: cssRgb(s, '--tree-solution', P.highlight),
    choice: cssRgb(s, '--accent-violet', P.choice),
    diverge: cssRgb(s, '--error', P.diverge),
    error: cssRgb(s, '--error', P.error),
  };
}

/** Colors used for pinned path comparison. */
export const PIN_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#CC79A7'];
