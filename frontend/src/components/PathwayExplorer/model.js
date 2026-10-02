/**
 * Pathway Explorer — graph model, annotations and layered layout.
 *
 * Input: one or more "targets", each holding the backend pathway graph
 * (`graph.compounds`, `graph.reactions`) and its enumerated `solutions`.
 * Output: a merged display model (with multi-target sharing info) and a
 * left-to-right layered layout (starting compounds on the left, targets on
 * the right, one column per generation, reactions between columns).
 */

const ROLE_RANK = { target: 4, source: 3, intermediate: 2, seed: 1, cofactor: 0 };

export const COL_GAP = 210;
export const ROW_GAP = 64;
export const PAD = 60;

export const targetKeyOf = (t, idx) => t.pairId || `t${idx}`;
export const pathKeyOf = (targetKey, solId) => `${targetKey}:${solId}`;

// Strips "_v1"/"_v2"/"_v3"... suffixes so cofactor-only reaction variants
// (same transformation, different assumed-available cofactor) share a key.
const baseReactionId = (id) => id.replace(/_v\d+.*$/, '');

/**
 * Merge target graphs into one display model.
 * @param targets [{ key, target, color, graph, solutions }]
 * @param opts.compactSeeds  draw seed compounds as inline labels instead of nodes
 * @param opts.subset        optional { reactionIds:Set, compoundIds:Set } to isolate
 * @param opts.collapseVariants  merge cofactor-only reaction variants (_v1/_v2/...)
 *   that share the same base id, direction and (cofactor-free) reactants/products
 *   into a single node — only the first-seen variant's own fields are kept.
 */
export function buildModel(targets, {
  compactSeeds = true, subset = null, hideUnlisted = false, collapseVariants = false,
} = {}) {
  const compounds = new Map();
  const reactions = new Map();
  const canonByKey = new Map();
  const totals = {};

  const variantKey = (r) => [
    baseReactionId(r.id), r.direction || '',
    [...r.reactants].sort().join(','), [...r.products].sort().join(','),
  ].join('|');

  targets.forEach((t) => {
    const g = t.graph;
    if (!g) return;
    totals[t.key] = (t.solutions || []).length;
    g.compounds.forEach((c) => {
      if (subset && !subset.compoundIds.has(c.id)) return;
      let n = compounds.get(c.id);
      if (!n) {
        n = {
          id: c.id, kind: 'compound', level: c.level, generation: c.generation, role: c.role,
          targets: new Set(), isTargetOf: new Set(), pathCount: {},
        };
        compounds.set(c.id, n);
      }
      n.level = Math.min(n.level, c.level);
      if ((ROLE_RANK[c.role] ?? 0) > (ROLE_RANK[n.role] ?? 0)) n.role = c.role;
      if (c.role === 'target') n.isTargetOf.add(t.key);
      n.targets.add(t.key);
      n.pathCount[t.key] = c.pathCount;
    });
    g.reactions.forEach((r) => {
      if (subset && !subset.reactionIds.has(r.id)) return;
      if (hideUnlisted && !r.pathCount) return;
      const key = collapseVariants ? variantKey(r) : r.id;
      let n = canonByKey.get(key);
      if (!n) {
        n = {
          ...r, kind: 'reaction', targets: new Set(), pathCount: {},
          products: [...r.products], cofactors: [...(r.cofactors || [])],
        };
        canonByKey.set(key, n);
      } else {
        n.products = [...new Set([...n.products, ...r.products])];
        n.cofactors = [...new Set([...n.cofactors, ...(r.cofactors || [])])];
      }
      reactions.set(r.id, n); // every raw variant id resolves to the merged node
      n.level = Math.min(n.level, r.level);
      n.targets.add(t.key);
      n.pathCount[t.key] = (n.pathCount[t.key] || 0) + r.pathCount;
    });
  });

  const hidden = (id) => {
    const c = compounds.get(id);
    return !c || (compactSeeds && c.role === 'seed');
  };

  // Several raw ids can now point at the same merged node — process each once.
  const uniqueReactions = new Set(reactions.values());

  const edges = [];
  uniqueReactions.forEach((r) => {
    r.inputs = r.reactants.filter((id) => !hidden(id));
    r.seedInputs = r.reactants.filter((id) => compounds.has(id) && hidden(id));
    // `products` = compounds this reaction supplies on some route (from the
    // backend). Producing a starting compound is never part of a route.
    r.outputs = r.products.filter((id) => {
      const c = compounds.get(id);
      return c && c.role !== 'seed' && c.role !== 'source';
    });
    r.inputs.forEach((c) => edges.push({ id: `${c}>${r.id}`, from: c, to: r.id, rxn: r.id, cpd: c, kind: 'in' }));
    r.outputs.forEach((p) => edges.push({ id: `${r.id}>${p}`, from: r.id, to: p, rxn: r.id, cpd: p, kind: 'out' }));
  });

  // Annotations: producers / consumers, choice points, multi-target merge & divergence.
  compounds.forEach((c) => { c.producers = []; c.consumers = []; });
  uniqueReactions.forEach((r) => {
    r.outputs.forEach((p) => compounds.get(p).producers.push(r.id));
    r.inputs.forEach((i) => compounds.get(i).consumers.push(r.id));
    r.seedInputs.forEach((i) => compounds.get(i).consumers.push(r.id));
  });
  const sig = (set) => [...set].sort().join('|');
  const multi = Object.keys(totals).length > 1;
  compounds.forEach((c) => {
    c.isChoice = c.producers.length >= 2;
    c.shared = multi && c.targets.size >= 2;
    const consumerSigs = new Set(c.consumers.map((r) => sig(reactions.get(r).targets)));
    const producerSigs = new Set(c.producers.map((r) => sig(reactions.get(r).targets)));
    const leadsTo = new Set();
    c.consumers.forEach((r) => reactions.get(r).targets.forEach((k) => leadsTo.add(k)));
    c.isTargetOf.forEach((k) => leadsTo.add(k));
    c.diverges = c.shared && (consumerSigs.size >= 2 || (c.isTargetOf.size > 0 && leadsTo.size >= 2));
    c.merges = c.shared && producerSigs.size >= 2;
  });

  const visible = new Set();
  edges.forEach((e) => { visible.add(e.from); visible.add(e.to); });
  compounds.forEach((c) => { if (c.role === 'target') visible.add(c.id); });

  return { compounds, reactions, edges, totals, multi, visible, compactSeeds };
}

/** Share (0..1) of listed paths that use a reaction/compound. */
export function shareOf(node, totals) {
  let used = 0; let total = 0;
  Object.keys(totals).forEach((k) => {
    if (node.targets.has(k)) { used += node.pathCount[k] || 0; total += totals[k]; }
  });
  return total > 0 ? used / total : 0;
}

/**
 * Column ranks: compounds sit at even ranks (2 × generation at minimum),
 * reactions at the odd rank just left of their earliest product. Lateral
 * (same-generation) reactions push their products one column right so every
 * edge flows left → right; genuine cycles are broken by a DFS.
 */
function assignRanks(nodes, edgeList) {
  const out = new Map(); const indeg = new Map();
  nodes.forEach((_, id) => { out.set(id, []); indeg.set(id, 0); });
  const order = [...nodes.values()].sort((a, b) => (a.data.level - b.data.level) || a.id.localeCompare(b.id));

  // DFS back-edge detection (iterative).
  edgeList.forEach((e) => out.get(e.from).push(e));
  const state = new Map();
  const back = new Set();
  order.forEach((start) => {
    if (state.get(start.id)) return;
    const stack = [[start.id, 0]];
    state.set(start.id, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const outs = out.get(top[0]);
      if (top[1] >= outs.length) { state.set(top[0], 2); stack.pop(); continue; }
      const e = outs[top[1]++];
      const st = state.get(e.to);
      if (st === 1) back.add(e.id);
      else if (!st) { state.set(e.to, 1); stack.push([e.to, 0]); }
    }
  });

  const dag = edgeList.filter((e) => !back.has(e.id));
  const dagOut = new Map(); nodes.forEach((_, id) => dagOut.set(id, []));
  dag.forEach((e) => { dagOut.get(e.from).push(e.to); indeg.set(e.to, indeg.get(e.to) + 1); });

  const rank = new Map();
  nodes.forEach((n) => rank.set(n.id, n.kind === 'compound' ? 2 * n.data.level : 1));
  const queue = order.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  while (queue.length) {
    const u = queue.shift();
    dagOut.get(u).forEach((v) => {
      const nv = nodes.get(v);
      let need = rank.get(u) + 1;
      if (nv.kind === 'compound' && need % 2 === 1) need += 1;
      if (need > rank.get(v)) rank.set(v, need);
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    });
  }
  // Pull each reaction right, next to its earliest product.
  nodes.forEach((n) => {
    if (n.kind !== 'reaction') return;
    const outs = dagOut.get(n.id);
    if (outs.length) rank.set(n.id, Math.max(rank.get(n.id), Math.min(...outs.map((v) => rank.get(v))) - 1));
  });
  nodes.forEach((n) => { n.rank = rank.get(n.id); });
  return back;
}

/** Layered left-to-right layout with barycentric crossing reduction. */
export function layoutModel(model) {
  const nodes = new Map();
  model.compounds.forEach((c) => {
    if (model.visible.has(c.id)) nodes.set(c.id, { id: c.id, kind: 'compound', rank: 0, data: c });
  });
  model.reactions.forEach((r) => {
    nodes.set(r.id, { id: r.id, kind: 'reaction', rank: 0, data: r });
  });
  const edgeList = model.edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));
  assignRanks(nodes, edgeList);

  const adj = new Map();
  nodes.forEach((_, id) => adj.set(id, []));
  edgeList.forEach((e) => {
    adj.get(e.from).push(e.to);
    adj.get(e.to).push(e.from);
  });

  const columns = new Map();
  nodes.forEach((n) => {
    if (!columns.has(n.rank)) columns.set(n.rank, []);
    columns.get(n.rank).push(n);
  });
  const ranks = [...columns.keys()].sort((a, b) => a - b);
  const roleOrder = { target: 0, source: 1, intermediate: 2, seed: 3 };
  ranks.forEach((rk) => columns.get(rk).sort((a, b) =>
    (roleOrder[a.data.role] ?? 2) - (roleOrder[b.data.role] ?? 2) || a.id.localeCompare(b.id)));

  const assignY = (rk) => {
    const col = columns.get(rk);
    const n = col.length;
    col.forEach((node, i) => { node.y = (i - (n - 1) / 2) * ROW_GAP; });
  };
  ranks.forEach(assignY);

  for (let iter = 0; iter < 10; iter++) {
    const order = iter % 2 === 0 ? [...ranks].reverse() : ranks;
    order.forEach((rk) => {
      const col = columns.get(rk);
      col.forEach((node) => {
        const nb = adj.get(node.id);
        node.bary = nb.length ? nb.reduce((s, id) => s + nodes.get(id).y, 0) / nb.length : node.y;
      });
      col.sort((a, b) => a.bary - b.bary || a.id.localeCompare(b.id));
      assignY(rk);
    });
  }

  const minRank = ranks[0] ?? 0;
  nodes.forEach((n) => { n.x = (n.rank - minRank) * (COL_GAP / 2); });

  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  nodes.forEach((n) => {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  });
  if (!nodes.size) { minX = maxX = minY = maxY = 0; }

  const edges = edgeList.map((e) => {
    const a = nodes.get(e.from); const b = nodes.get(e.to);
    const x1 = a.x + nodeRadius(a); const x2 = b.x - nodeRadius(b);
    let bow = 0;
    // A long edge can legitimately skip several columns (e.g. a cofactor reused many
    // generations later). When it does, steer it around any unrelated node that would
    // otherwise sit directly on its straight path, so it reads as passing behind — not
    // as a spurious connection to that node.
    if (x2 > x1 + 40) {
      let worstGap = 0;
      nodes.forEach((o) => {
        if (o === a || o === b) return;
        if (o.x <= x1 + 12 || o.x >= x2 - 12) return;
        const t = (o.x - x1) / (x2 - x1);
        const ey = a.y + (b.y - a.y) * t;
        const clearance = nodeRadius(o) + 7;
        const gap = clearance - Math.abs(o.y - ey);
        if (gap > worstGap) {
          worstGap = gap;
          bow = (o.y >= ey ? -1 : 1) * Math.min(30, clearance + gap * 0.6);
        }
      });
    }
    return { ...e, d: edgePath(a, b, bow) };
  });

  // Column headers: the generation(s) of the compounds in each column.
  const genColumns = ranks.filter((rk) => rk % 2 === 0).map((rk) => {
    const lv = columns.get(rk).filter((n) => n.kind === 'compound').map((n) => n.data.level);
    const lo = lv.length ? Math.min(...lv) : rk / 2;
    const hi = lv.length ? Math.max(...lv) : rk / 2;
    return { rank: rk, x: (rk - minRank) * (COL_GAP / 2), generation: lo, label: lo === hi ? lo : `${lo}–${hi}` };
  });

  return {
    nodes, edges, genColumns,
    bounds: { minX: minX - PAD, minY: minY - PAD - 30, maxX: maxX + PAD + 40, maxY: maxY + PAD + 20 },
  };
}

function nodeRadius(n) {
  if (n.kind === 'reaction') return 7;
  return n.data.role === 'target' ? 13 : 9;
}

function edgePath(a, b, bow = 0) {
  const x1 = a.x + nodeRadius(a);
  const x2 = b.x - nodeRadius(b);
  const { y: y1 } = a; const { y: y2 } = b;
  if (x2 > x1) {
    const dx = Math.max(30, (x2 - x1) * 0.5);
    return `M${x1},${y1} C${x1 + dx},${y1 + bow} ${x2 - dx},${y2 + bow} ${x2},${y2}`;
  }
  // Back edge (only possible in "all routes" mode): loop underneath.
  const drop = Math.max(y1, y2) + ROW_GAP * 0.9;
  return `M${x1},${y1} C${x1 + 60},${drop} ${x2 - 60},${drop} ${x2},${y2}`;
}

export { nodeRadius };

/** Elements (reactions, compounds) of a single solution. */
export function solutionElements(sol) {
  return { reactions: sol._r || new Set(sol.reactionIds), compounds: sol._c || new Set(sol.compounds) };
}

/** Union of elements of several solutions. */
export function unionElements(sols) {
  const reactions = new Set(); const compounds = new Set();
  sols.forEach((s) => {
    s.reactionIds.forEach((r) => reactions.add(r));
    s.compounds.forEach((c) => compounds.add(c));
  });
  return { reactions, compounds };
}

/** Is an edge part of a highlighted element set? */
export function edgeInSet(e, set) {
  return set.reactions.has(e.rxn) && set.compounds.has(e.cpd);
}
