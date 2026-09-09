// One discrete rainbow for graph generation coloring. Keeping the stops solid
// prevents adjacent generations from collapsing into a low-contrast gradient.
export const RAINBOW_PALETTE = {
  light: ['#c53030', '#c05621', '#9b6b00', '#276749', '#0f766e', '#2563eb', '#6b46c1'],
  dark: ['#fc8181', '#f6ad55', '#f6e05e', '#68d391', '#4fd1c5', '#63b3ed', '#b794f4'],
};

export const SCHEME_NAMES = ['rainbow'];
export const COLOR_SCHEMES = { rainbow: RAINBOW_PALETTE };

// Convert [r,g,b] to CSS string
export function rgbStr(rgb, alpha = 1) {
  return alpha < 1
    ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
    : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// ── Fixed type colors ──
// Hardcoded fallbacks used only when CSS custom properties aren't available
const TYPE_COLORS_FALLBACK = {
  compound: {
    light: { fill: '#ccfbf1', stroke: '#0d9488' },
    dark:  { fill: 'rgba(13,148,136,0.3)', stroke: '#2dd4bf' },
  },
  reaction: {
    light: { fill: '#e0e7ff', stroke: '#4f46e5' },
    dark:  { fill: 'rgba(79,70,229,0.25)', stroke: '#818cf8' },
  },
  ec: {
    light: { fill: '#fef3c7', stroke: '#d97706' },
    dark:  { fill: 'rgba(217,119,6,0.25)', stroke: '#fbbf24' },
  },
};

// Read a CSS custom property (space-separated RGB) and return a CSS color string
function readCssColor(varName, alpha) {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return null;
    const parts = raw.split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return alpha !== undefined
      ? `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`
      : `rgb(${parts[0]},${parts[1]},${parts[2]})`;
  } catch { return null; }
}

// CSS var names for each type
const TYPE_VAR_MAP = {
  compound: { fill: '--node-compound-fill', stroke: '--node-compound-stroke' },
  reaction: { fill: '--node-reaction-fill', stroke: '--node-reaction-stroke' },
  ec:       { fill: '--node-ec-fill',       stroke: '--node-ec-stroke' },
};

// Get type-based fill/stroke for a node — reads theme tokens at runtime
export function getTypeColor(nodeType, isDark) {
  const base = nodeType === 'compound' ? 'compound'
    : nodeType === 'ec' ? 'ec'
    : 'reaction';
  const vars = TYPE_VAR_MAP[base];
  const fillAlpha = isDark ? 0.3 : undefined;
  const fill = readCssColor(vars.fill, fillAlpha);
  const stroke = readCssColor(vars.stroke);
  if (fill && stroke) return { fill, stroke };
  // Fallback to hardcoded values
  const mode = isDark ? 'dark' : 'light';
  return TYPE_COLORS_FALLBACK[base][mode];
}

// Get scheme-based fill/stroke for a normalized value t ∈ [0, 1]
export function getSchemeColor(schemeName, t, isDark) {
  const palette = RAINBOW_PALETTE[isDark ? 'dark' : 'light'];
  const index = Math.round(Math.max(0, Math.min(1, t)) * (palette.length - 1));
  const fill = palette[index];
  const stroke = isDark ? '#ffffff' : '#1f2937';
  return { fill, stroke };
}
