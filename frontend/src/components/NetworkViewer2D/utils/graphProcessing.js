// utils/graphProcessing.js

/**
 * Process data for visualization based on current generation
 * @param {Array} data - Raw results data
 * @param {number} currentGen - Current generation to display (upper bound)
 * @param {number} minVisibleGen - Minimum visible generation (lower bound, default 0)
 * @returns {Object} Object with nodes and links arrays
 */
export const processData = (data, currentGen, minVisibleGen = 0) => {
    // Check if data is valid and iterable
    if (!data || !Array.isArray(data) || data.length === 0)
      return { nodes: [], links: [] };
  
    const nodes = [];
    const links = [];
    const uniqueNodes = new Map();
  
    // Helper function to add node if it doesn't exist yet
    const addUniqueNode = (id, type, generation, props = {}, pairIndex = null) => {
      if (!uniqueNodes.has(id)) {
        const node = {
          id,
          type,
          generation,
          pairIndices: pairIndex !== null ? [pairIndex] : [],
          ...props,
        };
        nodes.push(node);
        uniqueNodes.set(id, node);
        return node;
      }
  
      // If node already exists, merge the pair metadata
      const existing = uniqueNodes.get(id);
      if (pairIndex !== null && !existing.pairIndices.includes(pairIndex)) {
        existing.pairIndices.push(pairIndex);
      }
      return existing;
    };
  
    // First pass: Add all compounds for the current generation
    data.forEach((reaction) => {
      if (reaction.compound_generation) {
        Object.entries(reaction.compound_generation).forEach(
          ([compound, gen]) => {
            // Only add if the generation is within visible range
            if (parseInt(gen) <= currentGen && parseInt(gen) >= minVisibleGen) {
              addUniqueNode(compound, "compound", parseInt(gen), {
                label: compound,
                isVisible: true,
              }, reaction.pairIndex ?? null);
            }
          }
        );
      }
    });
  
    // Second pass: Process reactions and their connections
    data.forEach((reaction) => {
      try {
        // Parse the transition to get source and target generations
        const transition = reaction.transition;
        let sourceGen = 0;
        let targetGen = 0;
  
        if (transition) {
          const match = transition.match(/(\d+)\s*->\s*(\d+)/);
          if (match) {
            sourceGen = parseInt(match[1]);
            targetGen = parseInt(match[2]);
          }
        }
  
        // Skip reactions outside the visible generation range
        if (targetGen > currentGen || targetGen < minVisibleGen) return;
  
        // Parse equation to get reactants and products
        const parts = reaction.equation.split("=>").map((s) => s.trim());
        if (parts.length !== 2) return;
  
        const [reactantsStr, productsStr] = parts;
  
        const reactants = reactantsStr.split("+").map((s) => {
          const parts = s.trim().match(/^(\d*\.?\d*)\s*(.+)$/);
          return {
            id: parts ? parts[2].trim() : s.trim(),
            stoichiometry: parts && parts[1] ? parseFloat(parts[1]) : 1,
          };
        });
  
        const products = productsStr.split("+").map((s) => {
          const parts = s.trim().match(/^(\d*\.?\d*)\s*(.+)$/);
          return {
            id: parts ? parts[2].trim() : s.trim(),
            stoichiometry: parts && parts[1] ? parseFloat(parts[1]) : 1,
          };
        });
  
        // Create reaction nodes - reactant node
        const reactantNodeId = `${reaction.reaction}_r`;
        const reactantNode = addUniqueNode(
          reactantNodeId,
          "reaction-in",
          sourceGen,
          {
            label: reaction.reaction,
            reaction: reaction,
          },
          reaction.pairIndex ?? null
        );
  
        // Only add product nodes if we're at the target generation or higher
        if (currentGen >= targetGen) {
          // Create product node
          const productNodeId = `${reaction.reaction}_p`;
          const productNode = addUniqueNode(
            productNodeId,
            "reaction-out",
            targetGen,
            {
              label: reaction.reaction,
              reaction: reaction,
            },
            reaction.pairIndex ?? null
          );
  
          // Add link between reaction nodes
          links.push({
            source: reactantNodeId,
            target: productNodeId,
            type: "reaction",
            generation: targetGen,
            pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
          });
  
          // Add EC nodes if present and we're at target generation
          if (
            reaction.ec_list &&
            reaction.ec_list.length > 0 &&
            currentGen >= targetGen
          ) {
            reaction.ec_list.forEach((ec) => {
              if (ec && ec !== "N/A") {
                // Create consistent node ID using EC number and target generation
                const ecNodeId = `ec_${ec}_${targetGen}`;
  
                // Add EC node if it doesn't exist yet
                const ecNode = addUniqueNode(ecNodeId, "ec", targetGen, {
                  label: ec,
                  ec: ec,
                  generation: targetGen,
                }, reaction.pairIndex ?? null);
  
                // Create connections only if they don't already exist
                const existingInLink = links.find(
                  (l) => l.source === reactantNodeId && l.target === ecNodeId
                );
                const existingOutLink = links.find(
                  (l) => l.source === ecNodeId && l.target === productNodeId
                );
  
                if (!existingInLink) {
                  links.push({
                    source: reactantNodeId,
                    target: ecNodeId,
                    type: "ec-in",
                    generation: targetGen,
                    pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
                  });
                }
  
                if (!existingOutLink) {
                  links.push({
                    source: ecNodeId,
                    target: productNodeId,
                    type: "ec-out",
                    generation: targetGen,
                    pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
                  });
                }
              }
            });
          }
  
          // Connect products to reaction product node
          products.forEach((product) => {
            const productCompound = uniqueNodes.get(product.id);
            if (productCompound) {
              links.push({
                source: productNodeId,
                target: product.id,
                type: "product",
                stoichiometry: product.stoichiometry,
                generation: targetGen,
                pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
              });
            }
          });
        }
  
        // Always connect reactants to reaction reactant node if the compound is visible
        reactants.forEach((reactant) => {
          const reactantCompound = uniqueNodes.get(reactant.id);
          if (reactantCompound) {
            links.push({
              source: reactant.id,
              target: reactantNodeId,
              type: "substrate",
              stoichiometry: reactant.stoichiometry,
              generation: sourceGen,
              pairIndices: reaction.pairIndex !== undefined ? [reaction.pairIndex] : [],
            });
          }
        });
      } catch (err) {
        console.error("Error processing reaction:", err);
      }
    });
  
    return { nodes, links };
  };
  
  // ── Layout constants ──
  // Gap between sub-columns within a generation band
  export const SUB_COL_GAP = 180;
  // Gap between generation bands
  export const GEN_GAP = 200;
  // Vertical spacing between nodes within a sub-column (must be > 2 × collision radius)
  export const ROW_SPACING = 90;

  // Sub-column order per transition band N→N+1:
  //   compound(gen=N) → reaction-in(gen=N) → ec(gen=N+1) → reaction-out(gen=N+1) → compound(gen=N+1)
  //   circle           rectangle             oval           rectangle               circle
  //
  // Band index = N.  Each band has 4 slots (0–3).
  // compound & reaction-in use their own gen as the band.
  // ec & reaction-out have generation = targetGen, so their band = gen - 1.
  const computeSubColumn = (node) => {
    const gen = node.generation || 0;
    switch (node.type) {
      case "compound":
        // Band = gen, slot 0
        return gen * 4;
      case "reaction-in":
        // Band = gen (source side), slot 1
        return gen * 4 + 1;
      case "ec":
        // Band = gen-1 (ec has gen=targetGen, belongs to previous transition), slot 2
        return Math.max(0, gen - 1) * 4 + 2;
      case "reaction-out":
        // Band = gen-1 (reaction-out has gen=targetGen), slot 3
        return Math.max(0, gen - 1) * 4 + 3;
      default:
        return gen * 4 + 2;
    }
  };

  /**
   * Compute the X position for a sub-column index.
   * Sub-columns within a gen band are tightly spaced (SUB_COL_GAP),
   * with a larger GEN_GAP between bands.
   */
  const subColToX = (subCol) => {
    const genBand = Math.floor(subCol / 4);
    const slot = subCol % 4;
    return genBand * (4 * SUB_COL_GAP + GEN_GAP) + slot * SUB_COL_GAP;
  };

  /**
   * Find the longest directed path through the graph (the "backbone").
   * Uses a greedy forward walk: at each step pick the neighbor with the
   * highest generation (prefers compounds over reaction nodes for ties).
   * O(n + m) — safe for 10K+ nodes.
   */
  const findBackbone = (nodes, links) => {
    // Build directed adjacency: source → [targets]
    const adj = {};
    links.forEach((l) => {
      const s = l.source?.id || l.source;
      const t = l.target?.id || l.target;
      if (!adj[s]) adj[s] = [];
      adj[s].push(t);
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Find max generation
    let maxGen = 0;
    nodes.forEach((n) => { if ((n.generation || 0) > maxGen) maxGen = n.generation; });

    // Find all gen-0 compounds as starting points
    const starts = nodes.filter((n) => n.type === "compound" && (n.generation || 0) === 0);
    if (starts.length === 0 && nodes.length > 0) {
      // Fallback: node with lowest generation
      const sorted = [...nodes].sort((a, b) => (a.generation || 0) - (b.generation || 0));
      starts.push(sorted[0]);
    }

    let bestPath = [];

    // Greedy forward walk from each start — pick neighbor with highest gen
    const tryStarts = Math.min(starts.length, 20);
    for (let si = 0; si < tryStarts; si++) {
      const path = [starts[si].id];
      const visited = new Set(path);
      let cur = starts[si].id;

      while (true) {
        const neighbors = (adj[cur] || []).filter((id) => !visited.has(id));
        if (neighbors.length === 0) break;

        // Sort: prefer higher generation, then compounds over others
        neighbors.sort((a, b) => {
          const na = nodeMap.get(a);
          const nb = nodeMap.get(b);
          const ga = na ? na.generation || 0 : 0;
          const gb = nb ? nb.generation || 0 : 0;
          if (gb !== ga) return gb - ga;
          // Prefer compounds (they continue the chain)
          const ta = na && na.type === "compound" ? 0 : 1;
          const tb = nb && nb.type === "compound" ? 0 : 1;
          return ta - tb;
        });

        const next = neighbors[0];
        path.push(next);
        visited.add(next);
        cur = next;
      }

      if (path.length > bestPath.length) {
        bestPath = path;
      }
    }

    return bestPath;
  };

  /**
   * Apply hierarchical backbone-first layout.
   *
   * 1. Each node gets a sub-column X based on (generation, type):
   *    compound(g) → reaction-in(g) → ec(g) → reaction-out(g) → compound(g+1) → ...
   * 2. The longest path (backbone) is laid out along y = centerY.
   * 3. Non-backbone nodes are placed above/below the backbone,
   *    ordered to minimize edge crossings.
   */
  export const applyHierarchicalLayout = (
    nodes,
    centerY,
    positionCache = {},
    nodesLocked = false,
    links = [],
    spacingScale = 1.0
  ) => {
    if (!nodes.length) return { nodes, genMap: [] };

    // ── Compact generation mapping: skip empty generations ──
    // Collect which generation bands actually have nodes
    const populatedBands = new Set();
    nodes.forEach((n) => {
      const gen = n.generation || 0;
      const type = n.type;
      // Determine which band this node belongs to
      if (type === 'compound' || type === 'reaction-in') {
        populatedBands.add(gen);
      } else if (type === 'ec' || type === 'reaction-out') {
        populatedBands.add(Math.max(0, gen - 1));
      } else {
        populatedBands.add(gen);
      }
    });
    const sortedBands = [...populatedBands].sort((a, b) => a - b);
    // Map original band → compact index
    const bandToCompact = new Map();
    sortedBands.forEach((band, idx) => { bandToCompact.set(band, idx); });
    // genMap: array of { gen: originalGen, compactIdx } for label drawing
    const genMap = sortedBands.map((band, idx) => ({ gen: band, idx }));

    // Scale sub-column X positions by spacingScale, using compact band index
    const scaledSubColToX = (subCol, compactBand) => {
      const slot = subCol % 4;
      const gap = SUB_COL_GAP * spacingScale;
      const genGap = GEN_GAP * spacingScale;
      return compactBand * (4 * gap + genGap) + slot * gap;
    };

    // Assign targetX based on sub-column with compact band mapping
    nodes.forEach((n) => {
      const sc = computeSubColumn(n);
      const origBand = Math.floor(sc / 4);
      const compactBand = bandToCompact.get(origBand) ?? origBand;
      n._subCol = compactBand * 4 + (sc % 4); // remap to compact sub-column
      n.targetX = scaledSubColToX(sc, compactBand);
    });

    // ── Backbone detection ──
    const backbone = findBackbone(nodes, links);
    const backboneSet = new Set(backbone);

    // ── Group non-backbone nodes by sub-column ──
    const nonBackboneBySubCol = {};
    nodes.forEach((n) => {
      if (backboneSet.has(n.id)) return;
      const sc = n._subCol;
      if (!nonBackboneBySubCol[sc]) nonBackboneBySubCol[sc] = [];
      nonBackboneBySubCol[sc].push(n);
    });

    // Sort within each sub-column by id for determinism
    Object.values(nonBackboneBySubCol).forEach((arr) => {
      arr.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    });

    // ── Place backbone nodes at y = centerY ──
    backbone.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      if (positionCache[id]) {
        node.x = positionCache[id].x;
        node.y = positionCache[id].y;
      } else if (node.x === undefined || node.x === null || isNaN(node.x)) {
        node.x = node.targetX;
        node.y = centerY;
      }
      node._isBackbone = true;
      if (nodesLocked) { node.fx = node.x; node.fy = node.y; }
    });

    // ── Place non-backbone nodes above/below the backbone ──
    Object.entries(nonBackboneBySubCol).forEach(([sc, arr]) => {
      const half = Math.ceil(arr.length / 2);
      arr.forEach((node, i) => {
        if (positionCache[node.id]) {
          node.x = positionCache[node.id].x;
          node.y = positionCache[node.id].y;
        } else if (node.x === undefined || node.x === null || isNaN(node.x)) {
          node.x = node.targetX;
          // Place alternating above/below backbone with increasing distance
          if (i < half) {
            node.y = centerY - (i + 1) * ROW_SPACING;
          } else {
            node.y = centerY + (i - half + 1) * ROW_SPACING;
          }
        }
        node._isBackbone = false;
        if (nodesLocked) { node.fx = node.x; node.fy = node.y; }
      });
    });

    // ── Static collision resolution (replaces physics) ──
    // Group by sub-column, sort by y, push apart any that are too close
    const MIN_DIST = ROW_SPACING * spacingScale;
    const byCol = {};
    nodes.forEach((n) => {
      const col = n._subCol;
      if (!byCol[col]) byCol[col] = [];
      byCol[col].push(n);
    });
    // Multiple passes to propagate pushes
    for (let pass = 0; pass < 4; pass++) {
      Object.values(byCol).forEach((col) => {
        col.sort((a, b) => a.y - b.y);
        for (let i = 1; i < col.length; i++) {
          const gap = col[i].y - col[i - 1].y;
          if (gap < MIN_DIST) {
            const push = (MIN_DIST - gap) / 2;
            col[i - 1].y -= push;
            col[i].y += push;
          }
        }
      });
    }
    // Also do a global O(n²) pass for nodes across columns that are very close
    const GLOBAL_MIN = 40;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < GLOBAL_MIN && dist > 0) {
            const push = (GLOBAL_MIN - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            nodes[i].x -= nx * push;
            nodes[i].y -= ny * push;
            nodes[j].x += nx * push;
            nodes[j].y += ny * push;
          }
        }
      }
    }

    // Update position cache after collision resolution
    nodes.forEach((n) => {
      if (positionCache[n.id]) {
        positionCache[n.id] = { x: n.x, y: n.y };
      }
    });

    return { nodes, genMap };
  };