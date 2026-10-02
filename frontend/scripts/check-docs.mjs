#!/usr/bin/env node
/**
 * Documentation checker.
 *   - every manifest slug has a file, and every guide file is in the manifest
 *   - internal links (slug and slug#anchor) resolve, anchors match real headings / ids
 *   - images exist and have alt text; sym: glyph ids exist; <nebula-key view> ids exist
 *   - citations [[n]](references#ref-n) point at an existing reference
 *   - legacy view names are not used
 * Run: npm run check:docs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_GLYPH_IDS, KEY_VIEWS } from '../src/components/Key/keyData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const guideDir = path.resolve(here, '../../docs/guide');
const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

const slugify = (text) => String(text)
  .toLowerCase()
  .replace(/`|\*|_|\[|\]|\(.*?\)/g, '')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .trim()
  .replace(/\s+/g, '-');

const manifest = JSON.parse(fs.readFileSync(path.join(guideDir, 'manifest.json'), 'utf8'));
const slugs = manifest.sections.flatMap((s) => s.pages.map((p) => p.slug));
const files = fs.readdirSync(guideDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));

slugs.forEach((s) => { if (!files.includes(s)) err('manifest.json', `slug "${s}" has no .md file`); });
files.forEach((f) => { if (!slugs.includes(f)) err(`${f}.md`, 'not listed in manifest.json'); });
if (new Set(slugs).size !== slugs.length) err('manifest.json', 'duplicate slugs');

const GLYPH_EXTRA = new Set();
const anchorsByPage = {};
const contentByPage = {};

files.forEach((slug) => {
  const text = fs.readFileSync(path.join(guideDir, `${slug}.md`), 'utf8');
  contentByPage[slug] = text;
  const anchors = new Set();
  let fenced = false;
  text.split(/\r?\n/).forEach((line) => {
    if (/^```/.test(line)) fenced = !fenced;
    if (fenced) return;
    const m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) anchors.add(slugify(m[2]));
  });
  for (const m of text.matchAll(/\bid="([^"]+)"/g)) anchors.add(m[1]);
  anchorsByPage[slug] = anchors;
});

const LEGACY = [/\bBacktrace\b/, /\bKEGG Map\b/, /\b2D Network\b/, /\b3D Network\b/, /\bprimordial\b/i, /\bSTART\b/, /find_Paths/, /\bPathFinder\b/, /Metabolome-Records|Metabolic-Map|Reaction-Network/];

files.forEach((slug) => {
  const text = contentByPage[slug];
  const file = `${slug}.md`;
  const stripped = text.replace(/```[\s\S]*?```/g, '');

  // links and images
  for (const m of stripped.matchAll(/(!?)\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const [, bang, label, hrefRaw] = m;
    const href = hrefRaw.trim();
    if (bang) {
      if (href.startsWith('sym:')) {
        if (!ALL_GLYPH_IDS.has(href.slice(4))) err(file, `unknown glyph "${href}"`);
      } else {
        if (!label.trim()) err(file, `image "${href}" has no alt text`);
        const img = path.join(guideDir, href);
        if (!fs.existsSync(img)) err(file, `missing image ${href}`);
      }
      continue;
    }
    if (/^(https?:|mailto:)/.test(href)) continue;
    const [target, anchor] = href.split('#');
    const page = target || slug;
    if (!slugs.includes(page)) { err(file, `link to unknown page "${href}"`); continue; }
    if (anchor && !anchorsByPage[page].has(anchor)) err(file, `link "${href}": no heading or id "${anchor}" in ${page}.md`);
  }

  // key panels
  for (const m of stripped.matchAll(/<nebula-key\s+view="([^"]+)"/g)) {
    if (!KEY_VIEWS[m[1]]) err(file, `<nebula-key> unknown view "${m[1]}"`);
  }

  // legacy names (outside code)
  LEGACY.forEach((re) => {
    const hit = re.exec(stripped);
    if (hit) err(file, `legacy term "${hit[0]}"`);
  });
});

// Citations resolve
const refPage = anchorsByPage.references || new Set();
Object.entries(contentByPage).forEach(([slug, text]) => {
  for (const m of text.matchAll(/references#(ref-\d+)/g)) {
    if (!refPage.has(m[1])) err(`${slug}.md`, `citation ${m[1]} not found in references.md`);
  }
});

// Each cited reference is used at least once (warning)
const cited = new Set();
Object.values(contentByPage).forEach((t) => { for (const m of t.matchAll(/references#(ref-\d+)/g)) cited.add(m[1]); });
[...refPage].filter((a) => /^ref-\d+$/.test(a) && !cited.has(a)).forEach((a) => warnings.push(`references.md: ${a} is never cited`));

console.log(`Checked ${files.length} pages, ${[...cited].length} distinct citations, ${ALL_GLYPH_IDS.size} key glyphs.`);
warnings.forEach((w) => console.warn(`warning: ${w}`));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}
console.log('Documentation checks passed.');
