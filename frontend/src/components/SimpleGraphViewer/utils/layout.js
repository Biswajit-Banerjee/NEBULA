// utils/layout.js — Hybrid layout for metabolic compound graph
//
// Approach inspired by KEGG pathway maps & Becker-Rojas (2001):
//   1. Generation gives a soft LEFT→RIGHT flow (X-axis hint)
//   2. Force-directed simulation spreads nodes vertically & refines X
//   3. Much larger spacing than typical force layouts for readability
//   4. Barnes-Hut-lite: skip far-away pairs for O(n·log n)-ish perf

/**
 * @param {Array} nodes - compound nodes with .generation
 * @param {Array} links - reaction edges with .source/.target (string ids)
 * @param {number} centerX
 * @param {number} centerY
 * @param {Object} positionCache - persistent {nodeId: {x,y}}
 * @param {number} spacingScale - user slider (default 1.0)
 * @returns {{ nodes: Array }}
 */
export const applySimpleLayout = (nodes, links, centerX, centerY, positionCache = {}, spacingScale = 1.0) => {
  if (!nodes.length) return { nodes };

  const N = nodes.length;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // ── Tunables (generous spacing) ──
  const GEN_COL_GAP  = 280 * spacingScale;     // X-gap per generation step
  const IDEAL_LEN    = 240 * spacingScale;      // target spring rest length
  const REPULSION    = 20000 * spacingScale * spacingScale;
  const SPRING_K     = 0.04;                    // spring stiffness
  const GEN_PULL     = 0.006;                   // soft pull toward gen-X column
  const GRAVITY      = 0.003;                   // gentle centering
  const DAMPING      = 0.82;
  const MAX_ITERS    = 500;
  const CONVERGE     = 0.25;
  const MIN_DIST     = 120 * spacingScale;      // hard separation

  // ── Build edge list (deduplicated pairs for force calc) ──
  const edgePairSet = new Set();
  const edgeList = [];
  links.forEach(l => {
    const sId = l.source?.id || l.source;
    const tId = l.target?.id || l.target;
    if (!nodeMap.has(sId) || !nodeMap.has(tId)) return;
    const key = sId < tId ? `${sId}||${tId}` : `${tId}||${sId}`;
    if (!edgePairSet.has(key)) {
      edgePairSet.add(key);
      edgeList.push([sId, tId]);
    }
  });

  // ── Index map ──
  const idxOf = new Map();
  nodes.forEach((n, i) => idxOf.set(n.id, i));

  // ── Generation info ──
  let maxGen = 0;
  nodes.forEach(n => { if ((n.generation || 0) > maxGen) maxGen = n.generation; });
  const genCounts = new Map();
  nodes.forEach(n => {
    const g = n.generation || 0;
    genCounts.set(g, (genCounts.get(g) || 0) + 1);
  });

  // Target X for each generation (centered around centerX)
  const genTargetX = (gen) => {
    const mid = maxGen / 2;
    return centerX + (gen - mid) * GEN_COL_GAP;
  };

  // ── Initial positions ──
  // Use generation-based columns with vertical spread (much better starting point than circle)
  let hasUncached = false;
  nodes.forEach(n => {
    if (positionCache[n.id] && positionCache[n.id].x !== undefined) {
      n.x = positionCache[n.id].x;
      n.y = positionCache[n.id].y;
    } else {
      hasUncached = true;
    }
  });

  if (hasUncached) {
    const genSlots = new Map(); // gen → current slot index
    nodes.forEach(n => {
      if (n.x !== undefined && n.x !== null && !isNaN(n.x)) return;
      const g = n.generation || 0;
      const count = genCounts.get(g) || 1;
      const slot = genSlots.get(g) || 0;
      genSlots.set(g, slot + 1);

      const totalHeight = (count - 1) * (MIN_DIST * 1.2);
      n.x = genTargetX(g) + (Math.random() - 0.5) * GEN_COL_GAP * 0.3;
      n.y = centerY - totalHeight / 2 + slot * (MIN_DIST * 1.2);
    });
  }

  // ── Neighbor set for each node (for attractive-only short-range) ──
  const neighbors = new Map();
  edgeList.forEach(([s, t]) => {
    if (!neighbors.has(s)) neighbors.set(s, new Set());
    if (!neighbors.has(t)) neighbors.set(t, new Set());
    neighbors.get(s).add(t);
    neighbors.get(t).add(s);
  });

  // ── Velocity buffers ──
  const vx = new Float64Array(N);
  const vy = new Float64Array(N);

  // ── Simulation ──
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const fx = new Float64Array(N);
    const fy = new Float64Array(N);
    const temp = 1.0 - (iter / MAX_ITERS) * 0.7; // slow cool

    // 1) Repulsion — all pairs (with distance cutoff for perf)
    const cutoff = IDEAL_LEN * 5;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;

        // Fast reject far-away pairs
        if (Math.abs(dx) > cutoff && Math.abs(dy) > cutoff) continue;

        const d2 = dx * dx + dy * dy;
        const dist = Math.sqrt(d2) || 0.1;
        if (dist > cutoff) continue;

        const ux = dx / dist, uy = dy / dist;

        // Coulomb repulsion
        const repF = REPULSION / (d2 + 100);
        fx[i] += ux * repF; fy[i] += uy * repF;
        fx[j] -= ux * repF; fy[j] -= uy * repF;

        // Hard collision
        if (dist < MIN_DIST) {
          const push = (MIN_DIST - dist) * 3;
          fx[i] += ux * push; fy[i] += uy * push;
          fx[j] -= ux * push; fy[j] -= uy * push;
        }
      }
    }

    // 2) Spring attraction along edges
    edgeList.forEach(([sId, tId]) => {
      const si = idxOf.get(sId), ti = idxOf.get(tId);
      if (si === undefined || ti === undefined) return;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const displacement = dist - IDEAL_LEN;
      // Only attract if stretched beyond rest length
      if (displacement > 0) {
        const force = SPRING_K * displacement;
        const ux = dx / dist, uy = dy / dist;
        fx[si] += ux * force; fy[si] += uy * force;
        fx[ti] -= ux * force; fy[ti] -= uy * force;
      }
    });

    // 3) Soft generation-column pull (X-axis structure like KEGG)
    for (let i = 0; i < N; i++) {
      const targetX = genTargetX(nodes[i].generation || 0);
      fx[i] += (targetX - nodes[i].x) * GEN_PULL;
    }

    // 4) Gentle gravity toward center
    for (let i = 0; i < N; i++) {
      fx[i] += (centerX - nodes[i].x) * GRAVITY * 0.3;
      fy[i] += (centerY - nodes[i].y) * GRAVITY;
    }

    // 5) Integrate
    let maxDisp = 0;
    const eff = DAMPING * (0.4 + 0.6 * temp);
    for (let i = 0; i < N; i++) {
      vx[i] = (vx[i] + fx[i]) * eff;
      vy[i] = (vy[i] + fy[i]) * eff;
      const disp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      const maxStep = 12 * temp + 1;
      if (disp > maxStep) {
        vx[i] *= maxStep / disp;
        vy[i] *= maxStep / disp;
      }
      nodes[i].x += vx[i];
      nodes[i].y += vy[i];
      if (disp > maxDisp) maxDisp = disp;
    }

    if (maxDisp < CONVERGE) break;
  }

  // ── Final collision resolution (generous) ──
  for (let pass = 0; pass < 40; pass++) {
    let anyOverlap = false;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        if (dist < MIN_DIST) {
          anyOverlap = true;
          const push = (MIN_DIST - dist) / 2 + 1;
          const ux = dx / dist, uy = dy / dist;
          nodes[i].x += ux * push; nodes[i].y += uy * push;
          nodes[j].x -= ux * push; nodes[j].y -= uy * push;
        }
      }
    }
    if (!anyOverlap) break;
  }

  // Update cache
  nodes.forEach(n => {
    positionCache[n.id] = { x: n.x, y: n.y };
  });

  return { nodes };
};
