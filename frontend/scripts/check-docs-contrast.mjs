#!/usr/bin/env node
/**
 * WCAG contrast check of the text pairings used by the documentation reader,
 * tour cards, Key pop-ups and help overlays, for every NEBULA theme.
 * Run: npm run check:docs-contrast
 */
import { THEMES } from '../src/config/themes.js';

const rgb = (s) => s.trim().split(/\s+/).map(Number);
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** Same recipe as .text-link in styles/global.css: brand colour mixed toward the text colour (sRGB). */
export const LINK_BRAND_SHARE = 0.55;
const mix = (brand, text) => brand.map((c, i) => Math.round(c * LINK_BRAND_SHARE + text[i] * (1 - LINK_BRAND_SHARE)));

/** [foreground token, background token, minimum ratio, description] */
const PAIRS = [
  ['text-primary', 'surface-primary', 4.5, 'body text on page'],
  ['text-primary', 'surface-secondary', 4.5, 'body text on sidebar / callouts'],
  ['text-primary', 'surface-overlay', 4.5, 'text in cards and pop-ups'],
  ['text-primary', 'surface-inset', 4.5, 'text on table headers / kbd'],
  ['text-secondary', 'surface-primary', 4.5, 'secondary text on page'],
  ['text-secondary', 'surface-secondary', 4.5, 'secondary text on sidebar / key rows'],
  ['text-secondary', 'surface-overlay', 4.5, 'secondary text in cards and pop-ups'],
  ['text-muted', 'surface-primary', 3, 'muted labels on page (large/UI text)'],
  ['@link', 'surface-primary', 4.5, 'links on page'],
  ['@link', 'surface-secondary', 4.5, 'links on sidebar / callouts'],
  ['@link', 'surface-overlay', 4.5, 'links in cards and pop-ups'],
  ['code-text', 'code-bg', 4.5, 'code text'],
  ['text-inverse', 'brand-primary', 3, 'primary buttons (bold UI text)'],
  ['info', 'surface-primary', 3, 'info accents'],
  ['error', 'surface-primary', 3, 'error accents'],
];

const failures = [];
let checked = 0;
for (const [id, theme] of Object.entries(THEMES)) {
  for (const [fg, bg, min, what] of PAIRS) {
    const a = fg === '@link' ? null : theme.colors[fg]; const b = theme.colors[bg];
    if ((fg !== '@link' && !a) || !b) { failures.push(`${theme.label}: missing token ${!a ? fg : bg}`); continue; }
    const fgRgb = fg === '@link' ? mix(rgb(theme.colors['brand-primary']), rgb(theme.colors['text-primary'])) : rgb(a);
    const ratio = contrast(fgRgb, rgb(b));
    checked += 1;
    const ok = ratio >= min;
    if (!ok) failures.push(`${theme.label} (${id}): ${what}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1, needs ${min}:1`);
  }
}

console.log(`Checked ${checked} pairings across ${Object.keys(THEMES).length} themes.`);
if (failures.length) {
  console.error('\nContrast failures:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}
console.log('All documentation text pairings meet their WCAG contrast targets.');
