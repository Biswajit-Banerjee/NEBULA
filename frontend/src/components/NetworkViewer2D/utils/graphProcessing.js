// utils/graphProcessing.js

/**
 * Process data for visualization based on current generation
 * @param {Array} data - Raw results data
 * @param {number} currentGen - Current generation to display
 * @returns {Object} Object with nodes and links arrays
 */
export const processData = (data, currentGen) => {
    // Check if data is valid and iterable
    if (!data || !Array.isArray(data) || data.length === 0)
      return { nodes: [], links: [] };
  
    const nodes = [];
    const links = [];
    const uniqueNodes = new Map();
  
    // Helper function to add node if it doesn't exist yet
    const addUniqueNode = (id, type, generation, props = {}) => {
      if (!uniqueNodes.has(id)) {
        const node = {
          id,
          type,
          generation,
          ...props,
        };
        nodes.push(node);
        uniqueNodes.set(id, node);
        return node;
      }
      return uniqueNodes.get(id);
    };
  
    // First pass: Add all compounds for the current generation
    data.forEach((reaction) => {
      if (reaction.compound_generation) {
        Object.entries(reaction.compound_generation).forEach(
          ([compound, gen]) => {
            // Only add if the generation is <= current selected generation
            if (parseInt(gen) <= currentGen) {
              addUniqueNode(compound, "compound", parseInt(gen), {
                label: compound,
                isVisible: true,
              });
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
  
        // Skip reactions where target generation is higher than current
        if (targetGen > currentGen) return;
  
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
          }
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
            }
          );
  
          // Add link between reaction nodes
          links.push({
            source: reactantNodeId,
            target: productNodeId,
            type: "reaction",
            generation: targetGen,
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
                });
  
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
                  });
                }
  
                if (!existingOutLink) {
                  links.push({
                    source: ecNodeId,
                    target: productNodeId,
                    type: "ec-out",
                    generation: targetGen,
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
            });
          }
        });
      } catch (err) {
        console.error("Error processing reaction:", err);
      }
    });
  
    return { nodes, links };
  };
  
  /**
   * Apply spiral layout to nodes based on generation
   * @param {Array} nodes - Graph nodes to position
   * @param {number} centerX - X-center of the spiral
   * @param {number} centerY - Y-center of the spiral
   * @param {number} currentGeneration - Current generation being displayed
   * @param {boolean} onlyForCurrentGeneration - Whether to only apply to current generation
   * @param {boolean} nodesLocked - Whether nodes are currently locked in position
   * @returns {Array} Positioned nodes
   */
  export const applySpiral = (
    nodes, 
    centerX, 
    centerY, 
    currentGeneration, 
    onlyForCurrentGeneration = true,
    nodesLocked = false
  ) => {
    const spiralSpacing = 120; // Spacing between spiral layers
    const nodeSpacing = 50; // Spacing between nodes in the same generation
    const angleIncrement = 0.7; // Angle increment to spread nodes
  
    // Group nodes by generation
    const nodesByGeneration = {};
    nodes.forEach((node) => {
      const gen = node.generation || 0;
      if (!nodesByGeneration[gen]) {
        nodesByGeneration[gen] = [];
      }
      nodesByGeneration[gen].push(node);
    });
  
    // Position each generation in a spiral
    Object.entries(nodesByGeneration).forEach(([gen, genNodes]) => {
      const generation = parseInt(gen);
  
      // Skip this generation if we're only updating the current one
      // and this is not the current generation
      if (onlyForCurrentGeneration && generation !== currentGeneration) {
        return;
      }
  
      // Only apply positioning to nodes that don't have fixed positions already
      // unless we're forcing a reset
      const nodesToPosition = genNodes.filter((node) => !node.fx || !node.fy);
  
      if (nodesToPosition.length === 0) return;
  
      const radius = 80 + generation * spiralSpacing;
  
      nodesToPosition.forEach((node, i) => {
        // Calculate position on the spiral
        // Add more spacing between nodes based on the number in this generation
        const angle = angleIncrement * i + (generation * Math.PI) / 2;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
  
        // Add some jitter to prevent perfect overlaps
        node.x += (Math.random() - 0.5) * nodeSpacing * 0.5;
        node.y += (Math.random() - 0.5) * nodeSpacing * 0.5;
  
        // If nodes are locked, fix their position
        if (nodesLocked) {
          node.fx = node.x;
          node.fy = node.y;
        }
      });
    });
  
    return nodes;
  };