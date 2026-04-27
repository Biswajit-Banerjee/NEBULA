// utils/graphProcessing.js — Convert hypergraph data to simple graph (compounds=nodes, reactions=edges)

/**
 * Process raw reaction data into a simple directed graph.
 * Nodes = unique compounds (circles).
 * Links = one edge per reaction, connecting each substrate → each product.
 * Each edge carries the reaction name as its label.
 *
 * @param {Array} data - Raw results array (each item is a reaction row)
 * @returns {{ nodes: Array, links: Array }}
 */
export const processSimpleGraph = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0)
    return { nodes: [], links: [] };

  const compoundMap = new Map(); // compoundId → node object
  const links = [];
  const seenEdges = new Set(); // "rxnId||src||tgt" to avoid dups within same reaction

  data.forEach((reaction) => {
    if (!reaction.equation) return;

    // Collect compounds from compound_generation
    if (reaction.compound_generation) {
      Object.entries(reaction.compound_generation).forEach(([cid, gen]) => {
        if (!compoundMap.has(cid)) {
          compoundMap.set(cid, {
            id: cid,
            label: cid,
            type: 'compound',
            generation: parseInt(gen),
            pairIndices: [],
          });
        }
        const node = compoundMap.get(cid);
        if (reaction.pairIndex !== undefined && !node.pairIndices.includes(reaction.pairIndex)) {
          node.pairIndices.push(reaction.pairIndex);
        }
      });
    }

    // Parse equation: "A + B => C + D"
    const parts = reaction.equation.split('=>').map(s => s.trim());
    if (parts.length !== 2) return;

    const parseCompounds = (str) =>
      str.split('+').map(s => {
        const m = s.trim().match(/^(\d*\.?\d*)\s*(.+)$/);
        return m ? m[2].trim() : s.trim();
      });

    const substrates = parseCompounds(parts[0]);
    const products = parseCompounds(parts[1]);

    const rxnId = reaction.reaction || '';

    // One edge per (reaction, substrate, product) triple
    substrates.forEach(sub => {
      if (!compoundMap.has(sub)) return;
      products.forEach(prod => {
        if (!compoundMap.has(prod)) return;
        if (sub === prod) return;

        const edgeKey = `${rxnId}||${sub}||${prod}`;
        if (seenEdges.has(edgeKey)) return;
        seenEdges.add(edgeKey);

        links.push({
          source: sub,
          target: prod,
          reactionId: rxnId,
          label: rxnId,
          equation: reaction.equation,
          ecList: reaction.ec_list || [],
          pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
        });
      });
    });
  });

  const nodes = [...compoundMap.values()];
  return { nodes, links };
};

/**
 * Prune a simple graph: merge all edges between the same (source, target) pair
 * into a single edge carrying the list of unique reactions.
 *
 * @param {{ nodes: Array, links: Array }} graph
 * @returns {{ nodes: Array, links: Array }}
 */
export const pruneSimpleGraph = (graph) => {
  if (!graph.links.length) return graph;

  // Key: "source||target" (directed)
  const merged = new Map();

  graph.links.forEach(l => {
    const sId = l.source?.id || l.source;
    const tId = l.target?.id || l.target;
    const key = `${sId}||${tId}`;

    if (!merged.has(key)) {
      merged.set(key, {
        source: sId,
        target: tId,
        reactions: [],
        _rxnIds: new Set(),
        pairIndices: [],
      });
    }

    const m = merged.get(key);
    const rxnId = l.reactionId || l.label || '';
    if (rxnId && !m._rxnIds.has(rxnId)) {
      m._rxnIds.add(rxnId);
      m.reactions.push({
        id: rxnId,
        equation: l.equation || '',
        ecList: l.ecList || [],
      });
    }
    if (l.pairIndices) {
      l.pairIndices.forEach(pi => {
        if (!m.pairIndices.includes(pi)) m.pairIndices.push(pi);
      });
    }
  });

  const prunedLinks = [];
  merged.forEach(m => {
    prunedLinks.push({
      source: m.source,
      target: m.target,
      reactions: m.reactions,
      reactionCount: m.reactions.length,
      label: m.reactions.length === 1 ? m.reactions[0].id : `${m.reactions.length} rxns`,
      reactionId: m.reactions.length === 1 ? m.reactions[0].id : '',
      pairIndices: m.pairIndices,
    });
  });

  return { nodes: graph.nodes, links: prunedLinks };
};
