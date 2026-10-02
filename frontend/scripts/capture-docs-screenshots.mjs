#!/usr/bin/env node
/**
 * Captures the annotated screenshots used by the documentation (docs/guide/images).
 *
 * Needs, already running:
 *   - the backend  (uvicorn app.main:app --port 8020, from /backend)
 *   - the frontend (npm run dev, default http://127.0.0.1:5173/NEBULA/)
 * and an installed Chrome or Edge (no browser download; uses playwright-core).
 * The Protein Domain Viewer and expanded KEGG rows need internet access.
 *
 * Usage:
 *   node scripts/capture-docs-screenshots.mjs                 # all scenes
 *   node scripts/capture-docs-screenshots.mjs pf-overview rn  # only scenes whose id starts with one of the arguments
 *   NEBULA_URL=http://host:5173/NEBULA/ BROWSER_CHANNEL=msedge node scripts/capture-docs-screenshots.mjs
 *   RAW=1 node scripts/capture-docs-screenshots.mjs ...        # no numbered call-outs (for finding coordinates)
 *
 * Numbered call-outs are matched by the numbered lists under each figure in the Markdown.
 * Elements are found by selector, or by `at: [x, y]` viewport fractions for canvas-drawn items.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../docs/guide/images');
const BASE = process.env.NEBULA_URL || 'http://127.0.0.1:5173/NEBULA/';
const CHANNEL = process.env.BROWSER_CHANNEL || 'chrome';
const RAW = !!process.env.RAW;
const filters = process.argv.slice(2);
const VIEWPORT = { width: 1440, height: 860 };

fs.mkdirSync(OUT, { recursive: true });

const wanted = (id) => filters.length === 0 || filters.some((f) => id.startsWith(f));
const groupWanted = (prefix) => filters.length === 0 || filters.some((f) => f.startsWith(prefix) || prefix.startsWith(f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── call-out badges ─────────────────────────────────────────────── */

async function boxOf(page, c) {
  if (c.at) return { x: c.at[0] * VIEWPORT.width, y: c.at[1] * VIEWPORT.height, width: 0, height: 0 };
  const loc = page.locator(c.sel).first();
  if (!(await loc.count())) { console.warn(`  ! call-out ${c.n}: no element for ${c.sel}`); return null; }
  return loc.boundingBox();
}

async function addCallouts(page, callouts) {
  if (RAW) return;
  const placed = [];
  for (const c of callouts) {
    const b = await boxOf(page, c);
    if (!b) continue;
    const corner = c.corner || 'tl';
    const x = corner.includes('r') ? b.x + b.width : corner.includes('c') ? b.x + b.width / 2 : b.x;
    const y = corner.includes('b') ? b.y + b.height : b.y;
    placed.push({ n: c.n, x: x + (c.dx || 0), y: y + (c.dy || 0) });
  }
  await page.evaluate((items) => {
    items.forEach(({ n, x, y }) => {
      const d = document.createElement('div');
      d.setAttribute('data-docs-callout', '1');
      d.textContent = String(n);
      Object.assign(d.style, {
        position: 'fixed', left: `${x - 11}px`, top: `${y - 11}px`, width: '22px', height: '22px',
        borderRadius: '50%', background: '#e11d48', color: '#fff', font: '700 12px/22px Inter, Arial, sans-serif',
        textAlign: 'center', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.45)',
        zIndex: '2147483647', pointerEvents: 'none',
      });
      document.body.appendChild(d);
    });
  }, placed);
}

const removeCallouts = (page) => page.evaluate(() => document.querySelectorAll('[data-docs-callout]').forEach((e) => e.remove()));

async function shot(page, id, { callouts = [], clip, clipSel, pad = 14 } = {}) {
  if (!wanted(id)) return;
  await addCallouts(page, callouts);
  let clipBox = clip;
  if (clipSel) {
    const boxes = [];
    for (const s of [].concat(clipSel)) {
      const b = await page.locator(s).first().boundingBox();
      if (b) boxes.push(b);
    }
    if (boxes.length) {
      const x0 = Math.min(...boxes.map((b) => b.x)) - pad; const y0 = Math.min(...boxes.map((b) => b.y)) - pad;
      const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + pad; const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
      clipBox = { x: Math.max(0, x0), y: Math.max(0, y0), width: Math.min(VIEWPORT.width, x1) - Math.max(0, x0), height: Math.min(VIEWPORT.height, y1) - Math.max(0, y0) };
    }
  }
  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file, clip: clipBox });
  await removeCallouts(page);
  console.log(`  saved ${path.relative(process.cwd(), file)}`);
}

/* ── helpers ─────────────────────────────────────────────────────── */

const openDock = async (page) => {
  if (!(await page.locator('[data-tour="dock-expanded"]').count())) {
    await page.locator('[data-tour="dock-bar"] button.flex-1').click();
    await page.waitForSelector('[data-tour="dock-expanded"]');
  }
  await sleep(200);
};
const closeDock = async (page) => {
  if (await page.locator('[data-tour="dock-expanded"]').count()) {
    await page.mouse.click(40, 600);
    await sleep(250);
  }
};
const waitSearchDone = async (page) => {
  await page.waitForSelector('[data-tour="view-switcher"]', { timeout: 120000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Tracing paths'), null, { timeout: 120000 });
  await sleep(1200);
};
const pickTarget = async (page, nth, text, label) => {
  const input = page.locator('input[placeholder="Target *"]').nth(nth);
  await input.click();
  await input.fill(text);
  await page.locator(`li:has-text("${label}")`).first().click();
};
const freshCompoundSearch = async (ctx, id, label) => {
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-tour="dock-bar"]');
  await sleep(800);
  await openDock(p);
  await pickTarget(p, 0, id, label);
  await p.locator('button:has-text("Explore")').click();
  await waitSearchDone(p);
  await closeDock(p);
  return p;
};
const view = async (page, name) => {
  await page.locator('[data-tour="view-switcher"] button', { hasText: name }).first().click();
  await sleep(1500);
};

const ISOLATED_CALLOUTS = [
  { n: 1, at: [0.4935, 0.4512] }, { n: 2, at: [0.5019, 0.5504] }, { n: 3, at: [0.4382, 0.5291] },
  { n: 4, at: [0.4396, 0.6023] }, { n: 5, at: [0.4088, 0.5465] }, { n: 6, at: [0.6866, 0.5488] },
  { n: 7, at: [0.7125, 0.5349] }, { n: 8, at: [0.5576, 0.1628] },
];
const RN_OVERVIEW_CALLOUTS = [
  { n: 1, at: [0.1, 0.085], dx: -30 },
  { n: 2, at: [0.1001, 0.317], dy: -16 },
  { n: 3, at: [0.155, 0.366], dy: -16 },
  { n: 4, at: [0.2105, 0.366], dy: -16 },
  { n: 5, at: [0.266, 0.366], dy: -16 },
  { n: 6, sel: 'div.pointer-events-auto.w-full.max-w-xl', corner: 'tl' },
  { n: 7, sel: 'button[title="Settings"]:visible', corner: 'tl', dx: -6, dy: 26 },
];
const RN_TIMELINE_CALLOUTS = [
  { n: 1, at: [0.3406, 0.906], dy: -24 }, { n: 2, at: [0.397, 0.906], dy: -24 }, { n: 3, at: [0.529, 0.906], dy: -24 },
  { n: 4, at: [0.657, 0.906], dy: -24 }, { n: 5, at: [0.683, 0.906], dy: -24 }, { n: 6, at: [0.829, 0.034], dy: 24 },
];
const RN_TARGET = { id: 'C00256', label: '(R)-Lactate' };
const RN_OVERVIEW_GENS = 150;
const RN_ZOOM = { pick: { x: 205, y: 380 }, x: 110, y: 380, steps: 2, clip: { x: 40, y: 190, width: 1180, height: 380 } };
const MM_ZOOM = { x: 698, y: 459, steps: 2 };
const RN_OVERVIEW_OUT = { x: 300, y: 450, steps: 1 };
const HYPERGRAPH_CALLOUTS = [
  { n: 1, at: [0.0715, 0.3356], dy: -16 },
  { n: 2, at: [0.1271, 0.3698], dy: -14 },
  { n: 3, at: [0.1788, 0.4430], dy: -16 },
  { n: 4, at: [0.2316, 0.4267], dy: -14 },
  { n: 5, at: [0.2865, 0.4430], dy: -16 },
  { n: 6, at: [0.3414, 0.4554], dy: 14 },
  { n: 7, at: [0.3936, 0.4430], dy: -16 },
];
const MM_CALLOUTS = [
  { n: 1, at: [0.449, 0.557], dy: -14 },
  { n: 2, at: [0.477, 0.4408], dy: -14 },
  { n: 3, sel: 'button[title="Search backbone (SMILES substructure)"]', corner: 'tr', dx: 2, dy: -2 },
  { n: 4, at: [0.9902, 0.5016], dx: -22 },
  { n: 5, at: [0.3316, 0.2775] },
  { n: 6, at: [0.264, 0.331] },
];
const PROTEIN_CALLOUTS = [
  { n: 1, at: [0.0701, 0.1473] },
  { n: 2, sel: 'div[role="dialog"] button[class*="min-w-"]', corner: 'tl' },
  { n: 3, at: [0.0957, 0.2508], dy: -14 },
  { n: 4, sel: '[id^="domain-cell-"]', corner: 'tl' },
  { n: 5, at: [0.38, 0.41] },
  { n: 6, at: [0.8865, 0.1366] },
];
const MULTI_ZOOM = { x: 1240, y: 480, steps: 3 };
const ISO_ZOOM = { x: 1090, y: 490, steps: 3 };

/* ── scenes ──────────────────────────────────────────────────────── */

async function main() {
  const browser = await chromium.launch({ channel: CHANNEL, headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(() => {
    localStorage.setItem('nebula-tour-seen', 'true');
    localStorage.setItem('nebula-theme', 'nebula-light');
    localStorage.setItem('nebula-text-scale', '1');
  });
  let page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-tour="dock-bar"]');
  await sleep(800);

  if (true) {
    await shot(page, 'ui-landing', {
      callouts: [
        { n: 1, sel: '[data-tour="dock-bar"]', corner: 'tl', dx: 4, dy: 4 },
        { n: 2, sel: 'button:has-text("Take a quick tour")', corner: 'tr', dx: 2, dy: 2 },
        { n: 3, sel: '[data-tour="help-btn"] button', corner: 'tl' },
      ],
    });
  }

  // Search L-Glutamate
  await openDock(page);
  await pickTarget(page, 0, 'C00025', 'L-Glutamate');
  await page.locator('button:has-text("Explore")').click();
  await waitSearchDone(page);

  if (true) {
    await openDock(page);
    await shot(page, 'ui-dock-expanded', {
      clipSel: ['[data-tour="dock-bar"]', '[data-tour="dock-expanded"]'],
      callouts: [
        { n: 1, sel: '[data-tour="dock-expanded"] button.rounded-full', corner: 'tl', dx: -4, dy: -10 },
        { n: 2, sel: '[data-tour="dock-expanded"] select', corner: 'tc', dy: -14 },
        { n: 3, sel: 'input[placeholder="Target *"]', corner: 'tc', dy: -14 },
        { n: 4, sel: '[data-tour="dock-expanded"] span.rounded-full', corner: 'bc', dy: 16 },
        { n: 5, sel: 'button:has-text("Add query")', corner: 'tl', dx: -8, dy: 2 },
        { n: 6, sel: 'button:has-text("Explore")', corner: 'tr', dy: -2 },
        { n: 7, sel: '[data-tour="dock-bar"] div.flex-shrink-0.gap-1', corner: 'tc', dy: -4 },
      ],
    });
    await closeDock(page);
  }

  if (groupWanted('records')) {
    await view(page, 'Metabolome Records');
    await page.waitForSelector('tbody tr');
    await shot(page, 'records-overview', {
      callouts: [
        { n: 1, sel: 'tbody tr:first-child td:first-child div.w-5', corner: 'tr', dy: -2 },
        { n: 2, sel: 'tbody tr:first-child td:nth-child(2) button', corner: 'tr', dy: -4 },
        { n: 3, sel: 'tbody tr:first-child', corner: 'tl', dx: 16, dy: 34 },
        { n: 4, sel: 'thead th:nth-child(3)', corner: 'tc', dy: -2, dx: 20 },
        { n: 5, sel: 'tbody button.text-nfo', corner: 'tl', dx: -4 },
        { n: 6, sel: 'button:has(svg.lucide-funnel), button:has(svg.lucide-filter)', corner: 'tr' },
        { n: 7, sel: 'button:has(svg.lucide-settings-2)', corner: 'tr' },
        { n: 8, sel: 'button[title="Show the symbol key for this view"]', corner: 'tl' },
      ],
    });
  }

  if (groupWanted('pf')) {
    await view(page, 'Path Finder');
    await page.waitForSelector('#pathway-explorer-root svg g');
    await sleep(800);
    await shot(page, 'pf-overview', {
      callouts: [
        { n: 1, sel: '#pathway-explorer-root button[title^="C00025"], #pathway-explorer-root button:has-text("L-Glutamate")', corner: 'tl' },
        { n: 2, sel: 'button:has-text("Linked")', corner: 'tl' },
        { n: 3, sel: '#pathway-explorer-root div.w-80 >> text=distinct route', corner: 'tl', dx: -6, dy: -4 },
        { n: 4, sel: '#pathway-explorer-root div.group.relative', corner: 'tl', dx: 14, dy: 8 },
        { n: 5, sel: '#pathway-explorer-root svg text:has-text("GEN 1")', corner: 'tl', dx: -10, dy: -8 },
        { n: 6, at: [0.62, 0.5] },
        { n: 7, sel: '#pathway-explorer-root div.pointer-events-none.absolute.bottom-16', corner: 'tl' },
        { n: 8, sel: 'button[title="Fit to screen"]', corner: 'tl' },
      ],
    });

    // Highlight a path
    await page.locator('#pathway-explorer-root div.group.relative').nth(1).click();
    await sleep(900);
    await shot(page, 'pf-highlight-inspector', {
      callouts: [
        { n: 1, sel: '#pathway-explorer-root div.group.relative >> nth=1', corner: 'tl', dx: 14, dy: 10 },
        { n: 2, at: [0.55, 0.5] },
        { n: 3, sel: '#pathway-explorer-root div.w-80.border-l h4:has-text("Steps")', corner: 'tl', dx: -14 },
        { n: 4, sel: '#pathway-explorer-root div.w-80.border-l button:has-text("Isolate")', corner: 'tl' },
        { n: 5, sel: 'text=Highlighting', corner: 'tl', dy: -4 },
      ],
    });

    // One Path isolated: clean enough to read every symbol
    if (wanted('pf-isolated')) {
      await page.locator('#pathway-explorer-root div.group.relative').first().click();
      await sleep(500);
      await page.locator('text=Highlighting').locator('..').locator('button:has-text("Isolate")').click();
      await sleep(1500);
      await page.mouse.move(ISO_ZOOM.x, ISO_ZOOM.y);
      for (let i = 0; i < ISO_ZOOM.steps; i += 1) { await page.mouse.wheel(0, -240); await sleep(120); }
      await page.mouse.move(700, 790);
      await sleep(900);
      await shot(page, 'pf-isolated', {
        clip: { x: 322, y: 112, width: 800, height: 640 },
        callouts: ISOLATED_CALLOUTS,
      });
      await page.locator('text=Highlighting').locator('..').locator('button:has-text("Isolated")').click();
      await sleep(600);
      await page.locator('#pathway-explorer-root div.group.relative').nth(1).click();
      await sleep(600);
    }

    // Display + Export menus
    await page.locator('button:has-text("Display")').click();
    await sleep(400);
    await shot(page, 'pf-display', { clipSel: ['button:has-text("Linked")', 'button:has-text("Export SVG")', 'div[class*="z-[200]"]'], pad: 14 });
    await page.mouse.click(300, 14);
    await sleep(300);
    await page.locator('button:has-text("Export SVG")').click();
    await sleep(400);
    await shot(page, 'pf-export', { clipSel: ['button:has-text("Linked")', 'button:has-text("Export SVG")', 'div[class*="z-[200]"]'], pad: 14 });
    await page.mouse.click(300, 14);
    await sleep(300);
    await page.keyboard.press('Escape');
  }

  if (groupWanted('pf-multi')) {
    await openDock(page);
    await page.locator('button:has-text("Add query")').click();
    await sleep(300);
    await pickTarget(page, 1, 'C00041', 'L-Alanine');
    await sleep(500);
    await page.locator('button:has-text("Explore")').click();
    await waitSearchDone(page);
    await closeDock(page);
    await view(page, 'Path Finder');
    await page.waitForSelector('#pathway-explorer-root svg g');
    await sleep(1000);
    await page.mouse.click(900, 250);
    await page.keyboard.press('Escape');
    await sleep(700);
    await page.mouse.move(MULTI_ZOOM.x, MULTI_ZOOM.y);
    for (let i = 0; i < MULTI_ZOOM.steps; i += 1) { await page.mouse.wheel(0, -240); await sleep(150); }
    await page.mouse.move(700, 800);
    await sleep(900);
    await shot(page, 'pf-multi-target', {
      callouts: [
        { n: 1, sel: '#pathway-explorer-root button:has-text("All targets")', corner: 'tl' },
        { n: 2, at: [0.6422, 0.5465], dx: 16, dy: -14 },
        { n: 3, at: [0.6422, 0.5767], dx: 36, dy: 4 },
        { n: 4, sel: '#pathway-explorer-root button:has-text("Shared")', corner: 'tl' },
      ],
    });
  }

  if (groupWanted('protein')) {
    await view(page, 'Metabolome Records');
    await page.waitForSelector('tbody tr');
    const ec = page.locator('tbody button:has-text("1.4.1.2")');
    await ((await ec.count()) ? ec.first() : page.locator('tbody button.text-nfo').first()).click();
    await page.waitForSelector('div[role="dialog"] h2:has-text("EC")', { timeout: 60000 });
    await sleep(14000);
    await shot(page, 'protein-overview', { callouts: PROTEIN_CALLOUTS });
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  if (groupWanted('rn') || groupWanted('concept')) {
    // A small, readable network (a generation-3 compound with 11 reactions).
    const rnPage = await freshCompoundSearch(ctx, RN_TARGET.id, RN_TARGET.label);
    page = rnPage;
    await view(page, 'Reaction Network');
    await sleep(2500);
    const stepGen = async (count) => {
      for (let i = 0; i < count; i += 1) {
        const next = page.locator('button[title="Next generation"]:visible');
        if (!(await next.count()) || (await next.isDisabled())) break;
        await next.click();
        await sleep(40);
      }
    };
    const fit = async () => { await page.mouse.click(700, 600); await page.keyboard.press('0'); await sleep(1500); };
    // The timeline opens at generation 0 (seeds only): step forward to reveal the first generations.
    await stepGen(RN_OVERVIEW_GENS);
    await fit();
    await page.mouse.move(RN_OVERVIEW_OUT.x, RN_OVERVIEW_OUT.y);
    for (let i = 0; i < RN_OVERVIEW_OUT.steps; i += 1) { await page.mouse.wheel(0, 240); await sleep(150); }
    await page.mouse.move(700, 20);
    await sleep(800);
    await shot(page, 'rn-overview', { callouts: RN_OVERVIEW_CALLOUTS });
    await page.locator('button[title="Settings"]:visible').click();
    await sleep(700);
    await shot(page, 'rn-timeline-settings', { callouts: RN_TIMELINE_CALLOUTS });
    await page.locator('button[title="Settings"]:visible').click();
    await sleep(500);
    if (groupWanted('concept')) {
      await stepGen(150);
      await fit();
      await page.mouse.click(RN_ZOOM.pick.x, RN_ZOOM.pick.y);
      await page.mouse.move(RN_ZOOM.x, RN_ZOOM.y);
      for (let i = 0; i < RN_ZOOM.steps; i += 1) { await page.mouse.wheel(0, -240); await sleep(120); }
      await page.mouse.move(700, 20);
      await sleep(900);
      await shot(page, 'concept-hypergraph', { clip: RN_ZOOM.clip, callouts: HYPERGRAPH_CALLOUTS });
    }
  }

  if (groupWanted('mm')) {
    if (!groupWanted('rn') && !groupWanted('concept')) page = await freshCompoundSearch(ctx, RN_TARGET.id, RN_TARGET.label);
    await view(page, 'Metabolic Map');
    await sleep(2500);
    await page.locator('button[title="Settings"]:visible').click();
    await sleep(600);
    await page.locator('button:has-text("Pruned")').click();
    await sleep(300);
    await page.locator('text=Show all map compounds').first().click();
    await sleep(300);
    await page.locator('button[title="Settings"]:visible').click();
    await sleep(2500);
    await page.mouse.move(MM_ZOOM.x, MM_ZOOM.y);
    for (let i = 0; i < MM_ZOOM.steps; i += 1) { await page.mouse.wheel(0, -240); await sleep(150); }
    await page.mouse.move(700, 790);
    await sleep(1200);
    await shot(page, 'mm-overview', { callouts: MM_CALLOUTS });
  }

  if (groupWanted('key')) {
    await view(page, 'Path Finder');
    await page.waitForSelector('#pathway-explorer-root svg g');
    await page.locator('button[data-tour="key-btn"]:visible').click();
    await sleep(700);
    await shot(page, 'key-popover', { clip: { x: 1440 - 16 - 486, y: 76, width: 492, height: 790 } });
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  if (groupWanted('docs')) {
    const dp = await ctx.newPage();
    await dp.addInitScript(() => { localStorage.setItem('nebula-theme', 'magnetar'); });
    await dp.goto(BASE, { waitUntil: 'networkidle' });
    await dp.waitForSelector('[data-tour="help-btn"]');
    await sleep(800);
    await dp.locator('[data-tour="help-btn"] button').click();
    await dp.locator('button:has-text("Documentation")').click();
    await dp.waitForSelector('nav[aria-label="Documentation pages"]');
    await dp.locator('nav[aria-label="Documentation pages"] button:has-text("Path Finder")').first().click();
    await dp.waitForSelector('article h1:has-text("Path Finder")');
    await dp.locator('button[aria-label="Increase text size"]').first().click();
    await sleep(1500);
    await shot(dp, 'docs-dark-theme', {});
    await dp.close();
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
