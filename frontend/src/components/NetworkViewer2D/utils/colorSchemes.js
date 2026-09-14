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

// ── HSV ↔ RGB conversion utilities ──

// Parse hex color (#RRGGBB) to [r, g, b] (0–255)
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Convert [r, g, b] (0–255) to [h, s, v] (h: 0–360, s: 0–1, v: 0–1)
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

// Convert [h, s, v] (h: 0–360, s: 0–1, v: 0–1) to [r, g, b] (0–255)
export function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1, g1, b1;
  if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else              { r1 = c; g1 = 0; b1 = x; }
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

// Convert [r, g, b] to hex string
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

/**
 * Apply HSV adjustments to a hex color.
 * @param {string} hex     - Input color (#RRGGBB)
 * @param {number} hueShift    - Hue rotation in degrees (-180 to 180)
 * @param {number} satScale    - Saturation multiplier (0 to 2, 1 = no change)
 * @param {number} valScale    - Value/brightness multiplier (0 to 2, 1 = no change)
 * @returns {string} Adjusted hex color
 */
export function adjustHsv(hex, hueShift = 0, satScale = 1, valScale = 1) {
  const [r, g, b] = hexToRgb(hex);
  let [h, s, v] = rgbToHsv(r, g, b);
  h = ((h + hueShift) % 360 + 360) % 360;
  s = Math.max(0, Math.min(1, s * satScale));
  v = Math.max(0, Math.min(1, v * valScale));
  const [nr, ng, nb] = hsvToRgb(h, s, v);
  return rgbToHex(nr, ng, nb);
}

// Get scheme-based fill/stroke for a normalized value t ∈ [0, 1]
// hsvAdj: optional { hueShift, satScale, valScale } for global color tuning
export function getSchemeColor(schemeName, t, isDark, hsvAdj = null, customPalette = null) {
  const palette = (customPalette && customPalette[isDark ? 'dark' : 'light']) || RAINBOW_PALETTE[isDark ? 'dark' : 'light'];
  const index = Math.round(Math.max(0, Math.min(1, t)) * (palette.length - 1));
  let fill = palette[index];
  if (hsvAdj) {
    fill = adjustHsv(fill, hsvAdj.hueShift || 0, hsvAdj.satScale ?? 1, hsvAdj.valScale ?? 1);
  }
  const stroke = isDark ? '#ffffff' : '#1f2937';
  return { fill, stroke };
}
