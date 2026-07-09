/**
 * Pure, framework-free KEGG map layout engine.
 *
 * Extracted out of GraphCanvas.jsx so the placement algorithm can be run and
 * verified OUTSIDE the browser (e.g. from a Node script against real backend
 * data) instead of relying on visual screenshots to catch overlap bugs. This
 * module has no React/DOM dependency — it only operates on plain objects.
 *
 * Placement pipeline for a search-result graph, given the real KEGG map
 * positions and the offline-precomputed fallback positions:
 *   1. Any node with a real KEGG position ("skeleton" node) is placed there
 *      exactly and is never moved by anything below.
 *   2. Every other node gets its precomputed fallback anchor (tier 1 = most
 *      connected, tier 2 = similar generation, tier 3 = map center) and is
 *      placed on a phyllotaxis spiral around that anchor, together with every
 *      OTHER unplaced node whose anchor lands in the same MIN_SEP-sized
 *      bucket (so anchors that are close but not pixel-identical still get a
 *      jointly-computed, non-overlapping spiral instead of independently
 *      overlapping ones).
 *   3. Any node missing from the offline precompute entirely falls back to
 *      centroid-of-local-neighbors (BFS over the current search result only),
 *      then a last-resort spiral around the map center.
 *   4. A final collision-resolution pass pushes any remaining overlapping
 *      pair apart. Skeleton nodes never move; if both sides of a conflict are
 *      skeleton nodes, the pair is left alone (real KEGG map density is not
 *      ours to change).
 */

export const KEGG_SCALE = 1;
export const R_COMPOUND = 7.2;
export const STRUCT_WORLD_H = 56;

// ≈ 2.39996 rad (137.5°) — the golden angle, standard for phyllotaxis
// ("sunflower seed") spirals: advancing by this angle every step and growing
// radius by sqrt(k) packs points with uniform density and no shared radial
// alignment between points (unlike a fixed N-per-ring layout, which stacks
// every ring's k-th point along the same N spokes, forming a visible star).
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function computeMinSep({ isStructureMode, nodeSizeScale }) {
  return isStructureMode
    ? STRUCT_WORLD_H * nodeSizeScale * 2.6
    : R_COMPOUND * nodeSizeScale * 4.6;
}

function makeRingPlace(MIN_SEP) {
  return function ringPlace(items, keyFn) {
    const groups = new Map();
    items.forEach(entry => {
      const key = keyFn(entry);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });
    for (const group of groups.values()) {
      group.forEach((entry, k) => {
        const angle = k * GOLDEN_ANGLE;
        const radius = MIN_SEP * 1.2 * Math.sqrt(k + 1);
        entry.node.x = entry.anchor.x + Math.cos(angle) * radius;
        entry.node.y = entry.anchor.y + Math.sin(angle) * radius;
      });
    }
  };
}

/**
 * @param {Array} nds - array of node objects (mutated in place: sets n.x, n.y)
 * @param {Array} lks - array of link objects ({source, target} ids or node refs)
 * @param {Object} positions - { compoundId: {x, y} } real KEGG positions
 * @param {Object} fallbackPositions - { compoundId: {x, y, tier} } precomputed fallback anchors
 * @param {number} cx - fallback center x (map coordinate space) for true last-resort placement
 * @param {number} cy - fallback center y
 * @param {Object} opts - { isStructureMode: boolean, nodeSizeScale: number, maxCollisionIters?: number }
 * @returns {number} matched - count of nodes placed at a real KEGG position
 */
export function applyKeggLayout(nds, lks, positions, fallbackPositions, cx, cy, opts = {}) {
  // 2000 is generous headroom — verified via scripts/verify_kegg_layout.mjs that
  // the full 5620-compound universe (the worst case: every real + fallback
  // position at once, i.e. what "Show all KEGG" renders) fully converges to
  // ZERO overlap violations in ~756 iterations / ~8s. Any real search result
  // (a small subset of the universe) converges far faster than that.
  const { isStructureMode = false, nodeSizeScale = 1, maxCollisionIters = 2000 } = opts;

  let matched = 0;
  nds.forEach(n => {
    const pos = positions[n.id];
    if (pos) { n.x = pos.x * KEGG_SCALE; n.y = pos.y * KEGG_SCALE; matched++; }
  });

  const nodeMap = new Map(nds.map(n => [n.id, n]));
  const unplaced = nds.filter(n => !positions[n.id]);
  const MIN_SEP = computeMinSep({ isStructureMode, nodeSizeScale });
  const ringPlace = makeRingPlace(MIN_SEP);

  // Bucket by MIN_SEP (not a tiny fixed pixel granularity) — precomputed
  // anchors for different compounds are rarely IDENTICAL but are very often
  // within collision range of each other (e.g. neighboring generation
  // centroids, or slightly different BFS weighted-centroids for compounds
  // sharing most of their real neighbors). Bucketing at MIN_SEP scale means
  // anchors close enough to collide land in the SAME group and get a proper
  // non-overlapping spiral from the start, instead of independently
  // overlapping singleton placements that rely entirely on the O(n²) fixup
  // below to untangle.
  const bucketKey = (anchor) => `${Math.round(anchor.x / MIN_SEP)},${Math.round(anchor.y / MIN_SEP)}`;

  let stillUnplaced = [];
  const fallbackAnchored = [];
  unplaced.forEach(n => {
    const fb = fallbackPositions[n.id];
    if (fb) {
      fallbackAnchored.push({ node: n, anchor: { x: fb.x * KEGG_SCALE, y: fb.y * KEGG_SCALE } });
    } else {
      stillUnplaced.push(n);
    }
  });
  ringPlace(fallbackAnchored, e => bucketKey(e.anchor));

  // Safety net for compounds missing from the offline precompute entirely (e.g. a
  // brand new ID generated after the last precompute run) — propagate from the
  // *local* search-result graph (lks), then spiral as a true last resort.
  if (stillUnplaced.length > 0) {
    const localAdj = new Map();
    lks.forEach(l => {
      const s = l.source?.id || l.source;
      const t = l.target?.id || l.target;
      if (!localAdj.has(s)) localAdj.set(s, new Set());
      if (!localAdj.has(t)) localAdj.set(t, new Set());
      localAdj.get(s).add(t);
      localAdj.get(t).add(s);
    });

    let remaining = stillUnplaced;
    for (let round = 0; round < 8 && remaining.length > 0; round++) {
      const nextRemaining = [];
      const localAnchored = [];
      remaining.forEach(n => {
        const neighbors = localAdj.get(n.id);
        let sumX = 0, sumY = 0, count = 0;
        if (neighbors) {
          neighbors.forEach(nbId => {
            const nb = nodeMap.get(nbId);
            if (nb && nb.x !== undefined && nb.y !== undefined) {
              sumX += nb.x; sumY += nb.y; count++;
            }
          });
        }
        if (count > 0) {
          localAnchored.push({ node: n, anchor: { x: sumX / count, y: sumY / count } });
        } else {
          nextRemaining.push(n);
        }
      });
      ringPlace(localAnchored, e => bucketKey(e.anchor));
      remaining = nextRemaining;
    }

    // True last resort: nodes with no positioned neighbors anywhere (local or KEGG).
    remaining.forEach((n, idx) => {
      const angle = idx * GOLDEN_ANGLE;
      const radius = MIN_SEP * 1.5 * Math.sqrt(idx + 1);
      n.x = cx + Math.cos(angle) * radius;
      n.y = cy + Math.sin(angle) * radius;
    });
  }

  applyKeggLayout.lastIterationsRun = resolveCollisions(nds, positions, MIN_SEP, maxCollisionIters);

  return matched;
}

// Collision resolution: push overlapping nodes apart to guarantee breathing
// space. Skeleton (real KEGG-positioned) nodes are the fixed "bones" of the
// map and must NEVER move — only the non-skeleton side of a conflict yields.
// If both sides are skeleton nodes, leave them untouched entirely: their
// real-world density is inherent to the source map and is not ours to change.
//
// Uses a uniform spatial grid (cell size = MIN_SEP) rebuilt every iteration so
// each node only checks the ~9 cells around it instead of every other node —
// any two nodes within MIN_SEP of each other are guaranteed to fall in the
// same or an adjacent cell, so this finds EXACTLY the same conflicts as a
// brute-force all-pairs sweep, just in O(n) instead of O(n²) per iteration.
// That's the difference between a full pass over 5000+ nodes taking minutes
// (and still not converging within a small fixed iteration budget) vs.
// converging fully in well under a second.
function resolveCollisions(nds, positions, MIN_SEP, maxIters) {
  const cellOf = (x, y) => `${Math.floor(x / MIN_SEP)},${Math.floor(y / MIN_SEP)}`;
  let iterationsRun = 0;

  for (let iter = 0; iter < maxIters; iter++) {
    iterationsRun = iter + 1;
    const grid = new Map();
    nds.forEach((n, idx) => {
      n.__idx = idx;
      const k = cellOf(n.x, n.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(n);
    });

    let moved = false;
    const seenPairs = new Set();

    for (const a of nds) {
      const acx = Math.floor(a.x / MIN_SEP), acy = Math.floor(a.y / MIN_SEP);
      for (let gx = acx - 1; gx <= acx + 1; gx++) {
        for (let gy = acy - 1; gy <= acy + 1; gy++) {
          const cell = grid.get(`${gx},${gy}`);
          if (!cell) continue;
          for (const b of cell) {
            if (b.__idx === a.__idx) continue;
            const pairKey = a.__idx < b.__idx ? `${a.__idx}-${b.__idx}` : `${b.__idx}-${a.__idx}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);

            const iFixed = !!positions[a.id];
            const jFixed = !!positions[b.id];
            if (iFixed && jFixed) continue; // both skeleton — immovable, skip entirely

            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_SEP && dist > 0) {
              const push = (MIN_SEP - dist) / 2 + 1;
              const ux = dx / dist, uy = dy / dist;
              if (!iFixed && !jFixed) {
                a.x -= ux * push; a.y -= uy * push;
                b.x += ux * push; b.y += uy * push;
              } else if (!iFixed) {
                a.x -= ux * push * 2; a.y -= uy * push * 2;
              } else {
                b.x += ux * push * 2; b.y += uy * push * 2;
              }
              moved = true;
            } else if (dist === 0) {
              if (!iFixed) {
                a.x += MIN_SEP * (0.5 + Math.random());
                a.y += MIN_SEP * (0.5 + Math.random());
              } else {
                b.x += MIN_SEP * (0.5 + Math.random());
                b.y += MIN_SEP * (0.5 + Math.random());
              }
              moved = true;
            }
          }
        }
      }
    }
    if (!moved) break;
  }

  return iterationsRun;
}
