// ── Color scheme definitions for node coloring ──
// Each scheme is an array of [R, G, B] stops evenly spaced from 0→1.
// Interpolation between stops produces smooth continuous gradients.

export const COLOR_SCHEMES = {
  rainbow:  [[255,0,0],[255,127,0],[255,255,0],[0,200,0],[0,150,255],[75,0,130],[148,0,211]],
  viridis:  [[68,1,84],[59,82,139],[33,144,140],[93,201,99],[253,231,37]],
  plasma:   [[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]],
  turbo:    [[48,18,59],[70,131,236],[41,205,142],[217,225,44],[249,73,27]],
  inferno:  [[0,0,4],[87,16,110],[187,55,84],[249,142,9],[252,255,164]],
  spectral: [[213,62,79],[252,141,89],[254,224,139],[230,245,152],[153,213,148],[50,136,189],[94,79,162]],
  warm:     [[255,255,178],[254,204,92],[253,141,60],[240,59,32],[189,0,38]],
  cool:     [[247,252,253],[178,226,226],[102,194,164],[35,139,69],[0,68,27]],
  sunset:   [[71,44,122],[140,54,130],[195,87,113],[238,142,82],[255,209,87],[255,247,188]],
};

export const SCHEME_NAMES = Object.keys(COLOR_SCHEMES);

// Interpolate a color from a scheme at position t ∈ [0, 1]
export function interpolateScheme(schemeName, t) {
  const stops = COLOR_SCHEMES[schemeName] || COLOR_SCHEMES.rainbow;
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  return [
    Math.round(r1 + (r2 - r1) * f),
    Math.round(g1 + (g2 - g1) * f),
    Math.round(b1 + (b2 - b1) * f),
  ];
}

// Convert [r,g,b] to CSS string
export function rgbStr(rgb, alpha = 1) {
  return alpha < 1
    ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
    : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// ── Fixed type colors ──
// Three visually distinct colors for compound / reaction / ec
export const TYPE_COLORS = {
  compound: {
    light: { fill: '#ccfbf1', stroke: '#0d9488' },   // teal
    dark:  { fill: 'rgba(13,148,136,0.3)', stroke: '#2dd4bf' },
  },
  reaction: {
    light: { fill: '#e0e7ff', stroke: '#4f46e5' },   // indigo
    dark:  { fill: 'rgba(79,70,229,0.25)', stroke: '#818cf8' },
  },
  ec: {
    light: { fill: '#fef3c7', stroke: '#d97706' },   // amber
    dark:  { fill: 'rgba(217,119,6,0.25)', stroke: '#fbbf24' },
  },
};

// Get type-based fill/stroke for a node
export function getTypeColor(nodeType, isDark) {
  const base = nodeType === 'compound' ? 'compound'
    : nodeType === 'ec' ? 'ec'
    : 'reaction'; // reaction-in, reaction-out, etc.
  const mode = isDark ? 'dark' : 'light';
  return TYPE_COLORS[base][mode];
}

// Get scheme-based fill/stroke for a normalized value t ∈ [0, 1]
export function getSchemeColor(schemeName, t, isDark) {
  const rgb = interpolateScheme(schemeName, t);
  if (isDark) {
    // Darker fill, brighter stroke
    const fill = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`;
    const stroke = rgbStr(rgb);
    return { fill, stroke };
  }
  // Light mode: lighter fill, darker stroke
  const fill = `rgb(${Math.min(255, rgb[0] + 120)},${Math.min(255, rgb[1] + 120)},${Math.min(255, rgb[2] + 120)})`;
  const stroke = rgbStr(rgb);
  return { fill, stroke };
}

// Generate a tiny canvas gradient preview for a scheme (for UI swatches)
export function schemeGradientCSS(schemeName) {
  const stops = COLOR_SCHEMES[schemeName] || COLOR_SCHEMES.rainbow;
  const css = stops.map((rgb, i) => {
    const pct = Math.round((i / (stops.length - 1)) * 100);
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${pct}%`;
  });
  return `linear-gradient(90deg, ${css.join(', ')})`;
}
