/**
 * Programmatic verification of the KEGG layout engine (no browser required).
 *
 * Runs the SAME pure layout function used by GraphCanvas.jsx
 * (frontend/src/components/SimpleGraphViewer/keggLayoutEngine.js) against the
 * real backend data — the full universe of compounds (worst case: every real
 * position + every precomputed fallback position at once, exactly what
 * "Show all KEGG" renders) — and checks every pair of non-skeleton nodes is
 * at least MIN_SEP apart. Prints violation count / worst offenders instead of
 * requiring a visual screenshot round-trip.
 *
 * Usage: node scripts/verify_kegg_layout.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyKeggLayout, computeMinSep } from '../frontend/src/components/SimpleGraphViewer/keggLayoutEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'backend', 'data');

const positions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'kegg_pos_svg.json'), 'utf-8'));
const fallbackPositions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'kegg_fallback_positions.json'), 'utf-8'));

// Worst-case node set: every compound in the universe (real + fallback), no
// edges (links only matter for the "missing from precompute entirely" safety
// net, which doesn't apply here since every one of these IS in one of the two
// position maps).
const allIds = new Set([...Object.keys(positions), ...Object.keys(fallbackPositions)]);
const nodes = [...allIds].map(id => ({ id }));
const links = [];

const mapCx = Object.values(positions).reduce((s, p) => s + p.x, 0) / Object.keys(positions).length;
const mapCy = Object.values(positions).reduce((s, p) => s + p.y, 0) / Object.keys(positions).length;

const nodeSizeScale = 1;
const isStructureMode = false;

console.log(`Universe: ${nodes.length} nodes (${Object.keys(positions).length} real, ${Object.keys(fallbackPositions).length} fallback)`);

const maxCollisionIters = Number(process.argv[2] || 2000);
const t0 = Date.now();
const matched = applyKeggLayout(nodes, links, positions, fallbackPositions, mapCx, mapCy, { isStructureMode, nodeSizeScale, maxCollisionIters });
const elapsedMs = Date.now() - t0;

const MIN_SEP = computeMinSep({ isStructureMode, nodeSizeScale });
console.log(`Matched (real position): ${matched}/${nodes.length}`);
console.log(`MIN_SEP required: ${MIN_SEP.toFixed(2)}`);
console.log(`maxCollisionIters: ${maxCollisionIters}, iterations actually run: ${applyKeggLayout.lastIterationsRun}`);
console.log(`Layout computed in ${elapsedMs}ms`);

// ── Verify: every pair of non-skeleton (unfixed) nodes must be >= MIN_SEP apart.
// Skeleton-skeleton pairs are intentionally exempt (real KEGG map density).
// Use a uniform spatial grid so this check itself is fast even for 5000+ nodes.
const cellSize = MIN_SEP;
const grid = new Map();
const cellKey = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
nodes.forEach((n, idx) => {
  n.__idx = idx;
  n.__fixed = !!positions[n.id];
  const k = cellKey(n.x, n.y);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push(n);
});

let violations = 0;
let worst = null;
const seenPairs = new Set();

nodes.forEach(a => {
  const acx = Math.floor(a.x / cellSize), acy = Math.floor(a.y / cellSize);
  for (let gx = acx - 1; gx <= acx + 1; gx++) {
    for (let gy = acy - 1; gy <= acy + 1; gy++) {
      const cell = grid.get(`${gx},${gy}`);
      if (!cell) continue;
      for (const b of cell) {
        if (b.__idx === a.__idx) continue;
        const pairKey = a.__idx < b.__idx ? `${a.__idx}-${b.__idx}` : `${b.__idx}-${a.__idx}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        if (a.__fixed && b.__fixed) continue; // both skeleton — exempt by design
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_SEP - 1e-6) {
          violations++;
          if (!worst || dist < worst.dist) {
            worst = { a: a.id, b: b.id, dist, aFixed: a.__fixed, bFixed: b.__fixed };
          }
        }
      }
    }
  }
});

console.log(`\nViolations (non-skeleton pairs closer than MIN_SEP): ${violations}`);
if (worst) {
  console.log(`Worst offender: ${worst.a} (fixed=${worst.aFixed}) <-> ${worst.b} (fixed=${worst.bFixed}) dist=${worst.dist.toFixed(2)} (need >= ${MIN_SEP.toFixed(2)})`);
  process.exitCode = 1;
} else {
  console.log('PASS: no violations.');
  process.exitCode = 0;
}
