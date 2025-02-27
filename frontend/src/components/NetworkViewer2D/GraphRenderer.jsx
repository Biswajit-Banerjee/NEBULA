import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import * as d3 from "d3";
import { getNodeColor } from "./utils/colorSchemes";
import { Lock, Unlock } from "lucide-react";

const GraphRenderer = forwardRef(
  (
    {
      data,
      currentGeneration,
      maxGeneration,
      containerRef,
      height,
      isFullscreen,
    },
    ref
  ) => {
    const svgRef = useRef(null);
    const mainGroupRef = useRef(null);
    const zoomRef = useRef(null);
    const simulationRef = useRef(null);
    const [nodesLocked, setNodesLocked] = useState(false);
    const [layoutType, setLayoutType] = useState("spiral"); // 'spiral' or 'force'

    const fitToView = () => {
      if (!svgRef.current || !mainGroupRef.current || !containerRef.current)
        return;

      const svg = d3.select(svgRef.current);
      const g = d3.select(mainGroupRef.current);
      const zoom = zoomRef.current;
      if (!zoom) return;

      // Get bounds of the content
      const bounds = mainGroupRef.current.getBBox();

      // Get container dimensions
      const width = containerRef.current.clientWidth;
      const containerHeight =
        typeof height === "string" ? parseInt(height) : height;

      // Calculate scale to fit content with padding
      const padding = 10;
      const scale =
        Math.min(
          (width - padding * 2) / bounds.width,
          (containerHeight - padding * 2) / bounds.height,
          2
        ) * 0.98; // Slightly reduce scale to ensure padding

      // Calculate translations to center the content
      const xTranslate = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const yTranslate =
        (containerHeight - bounds.height * scale) / 2 - bounds.y * scale;

      // Create and apply the transform
      const transform = d3.zoomIdentity
        .translate(xTranslate, yTranslate)
        .scale(scale);

      // Apply transform with transition
      svg.transition().duration(750).call(zoom.transform, transform);
    };

    // Function to download full SVG
    const downloadFullSVG = () => {
      if (!svgRef.current || !mainGroupRef.current) return;

      const tempContainer = document.createElement("div");
      const tempSvg = d3
        .select(tempContainer)
        .append("svg")
        .attr("xmlns", "http://www.w3.org/2000/svg");

      // Copy defs
      const originalDefs = svgRef.current.querySelector("defs");
      if (originalDefs) {
        tempSvg.node().appendChild(originalDefs.cloneNode(true));
      }

      // Copy content
      const content = mainGroupRef.current.cloneNode(true);
      tempSvg.node().appendChild(content);

      // Get bounds and set size
      const bounds = content.getBBox();
      const padding = 50;
      tempSvg
        .attr("width", bounds.width + padding * 2)
        .attr("height", bounds.height + padding * 2);

      // Center content
      d3.select(content).attr(
        "transform",
        `translate(${padding - bounds.x},${padding - bounds.y})`
      );

      // Download
      const svgData = new XMLSerializer().serializeToString(tempSvg.node());
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "metabolic-network.svg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Process data for visualization based on current generation
    const processData = (data, currentGen) => {
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

      // Remove any nodes that don't have any connections
      const connectedNodeIds = new Set();
      links.forEach((link) => {
        connectedNodeIds.add(
          link.source instanceof Object ? link.source.id : link.source
        );
        connectedNodeIds.add(
          link.target instanceof Object ? link.target.id : link.target
        );
      });

      const connectedNodes = nodes.filter((node) => {
        // Always keep compounds, filter reactions and EC nodes with no connections
        if (node.type === "compound") return true;
        return connectedNodeIds.has(node.id);
      });

      return { nodes: connectedNodes, links };
    };

    // Apply spiral layout to nodes based on generation
    const applySpiral = (nodes, onlyForCurrentGeneration = true) => {
      const centerX = containerRef.current
        ? containerRef.current.clientWidth / 2
        : 400;
      const centerY =
        typeof height === "string"
          ? parseInt(height.replace("px", "")) / 2
          : height / 2;
      const spiralSpacing = 120; // Increased spacing between spiral layers (was 50)
      const nodeSpacing = 50; // Increased spacing between nodes in the same generation
      const angleIncrement = 0.7; // Increased angle increment to spread nodes further (was 0.5)

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

        const radius = 80 + generation * spiralSpacing; // Increased base radius (was 50)

        nodesToPosition.forEach((node, i) => {
          // Calculate position on the spiral
          // Add more spacing between nodes based on the number of nodes in this generation
          const angle = angleIncrement * i + (generation * Math.PI) / 2; // More spacing between generations
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

    // Render D3 visualization
    useEffect(() => {
      if (!svgRef.current || !containerRef.current || !data) return;

      // Log data for debugging
      console.log("Data received in GraphRenderer:", data);

      // Clean up previous simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      // Clear existing content
      d3.select(svgRef.current).selectAll("*").remove();

      // Process data - ensure we're passing valid data
      const processedData = Array.isArray(data) ? data : [];
      const { nodes, links } = processData(processedData, currentGeneration);

      if (nodes.length === 0) return;

      // Only position new nodes or when explicitly resetting
      // This preserves user's manual positioning
      const existingNodes = new Set(
        simulationRef.current?.nodes().map((node) => node.id) || []
      );
      const newNodes = nodes.filter((node) => !existingNodes.has(node.id));

      // Apply spiral layout only to new nodes
      if (newNodes.length > 0) {
        applySpiral(nodes, true); // Only apply to new nodes in current generation
      }

      // Create SVG
      const width = containerRef.current.clientWidth;
      const containerHeight =
        typeof height === "string"
          ? parseInt(height.replace("px", ""))
          : height;

      const svg = d3
        .select(svgRef.current)
        .attr("width", width)
        .attr("height", containerHeight);

      const mainGroup = svg.append("g");
      mainGroupRef.current = mainGroup.node();

      // Add defs for markers
      const defs = svg.append("defs");

      // Add arrowhead marker
      defs
        .append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-5 -5 10 10") // Centered viewBox
        .attr("refX", 0) // Tip at center point
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M-5,-5 L0,0 L-5,5") // Arrow shape pointing right
        .attr("fill", "currentColor");

      // Add zoom behavior
      const zoom = d3
        .zoom()
        .scaleExtent([0.2, 10])
        .on("zoom", (event) => {
          mainGroup.attr("transform", event.transform);
        });

      svg.call(zoom);
      zoomRef.current = zoom;

      // Create force simulation
      const simulation = d3
        .forceSimulation(nodes)
        .force(
          "link",
          d3
            .forceLink(links)
            .id((d) => d.id)
            .distance((d) => {
              if (d.type === "reaction") return 70; // Increased from 50
              if (d.type.startsWith("ec")) return 50; // Increased from 30
              return 100 + (d.genDifference || 0) * 30; // Increased spacing (was 80 + 20)
            })
        )
        .force(
          "charge",
          d3.forceManyBody().strength((d) => {
            // Stronger repulsion to avoid overlaps
            const baseStrength = -500; // Increased from -300
            const genMultiplier = 1 + (d.generation || 0) * 0.1;
            return baseStrength * genMultiplier;
          })
        )
        .force("center", d3.forceCenter(width / 2, containerHeight / 2))
        .force(
          "x",
          d3
            .forceX()
            .x((d) => {
              // Position by generation in spiral - x component
              const gen = d.generation || 0;
              const angle = gen * (Math.PI / 2); // 90 degrees per generation (was 60)
              const distance = 150 + gen * 80; // Increased distance from center (was 100 + 50)
              return width / 2 + Math.cos(angle) * distance;
            })
            .strength(0.1)
        ) // Reduced strength to respect user positioning (was 0.2)
        .force(
          "y",
          d3
            .forceY()
            .y((d) => {
              // Position by generation in spiral - y component
              const gen = d.generation || 0;
              const angle = gen * (Math.PI / 2); // 90 degrees per generation (was 60)
              const distance = 150 + gen * 80; // Increased distance from center (was 100 + 50)
              return containerHeight / 2 + Math.sin(angle) * distance;
            })
            .strength(0.1)
        ) // Reduced strength to respect user positioning (was 0.2)
        .force(
          "collision",
          d3
            .forceCollide()
            .radius((d) => {
              // Increased collision radius to prevent overlap
              if (d.type === "compound") return 35; // Was 25
              if (d.type === "ec") return 45; // Was 35
              return 40; // Was 30
            })
            .strength(0.8)
        ); // Increased strength for collision (default is 0.7)

      // Link groups for edges and labels
      const linkGroups = mainGroup
        .append("g")
        .selectAll("g")
        .data(links)
        .enter()
        .append("g")
        .attr("class", "link-group");

      // Add the main edge lines
      linkGroups
        .append("line")
        .attr("stroke", (d) => {
          if (d.type === "reaction") return "#9CA3AF";
          if (d.type.startsWith("ec")) return "#8B5CF6";

          const generation = d.generation || 0;
          const maxGen = Math.max(maxGeneration, 1);
          const hue = (generation / (maxGen + 1)) * 360;
          return `hsl(${hue}, 70%, 50%)`;
        })
        .attr("stroke-width", (d) =>
          d.stoichiometry ? 1 + Math.log(d.stoichiometry) : 1.5
        )
        .attr("marker-end", (d) => {
          if (d.type === "substrate" || d.type === "product")
            return "url(#arrowhead)";
          return null;
        })
        .attr("stroke-dasharray", (d) => {
          if (d.type === "reaction") return "5,5";
          if (d.type.startsWith("ec")) return "3,3";
          return null;
        });

      // Add edge weight labels for stoichiometry > 1
      const edgeLabels = linkGroups
        .filter((d) => d.stoichiometry && d.stoichiometry > 1)
        .append("g")
        .attr("class", "edge-label");

      edgeLabels
        .append("rect")
        .attr("rx", 4)
        .attr("width", 16)
        .attr("height", 16)
        .attr("x", -8)
        .attr("y", -12)
        .attr("fill", "white")
        .attr("opacity", 0.75);

      edgeLabels
        .append("text")
        .text((d) => d.stoichiometry)
        .attr("text-anchor", "middle")
        .attr("dy", -2)
        .attr("font-size", 10)
        .attr("fill", "#4B5563")
        .attr("font-weight", 500);

      // Create node groups
      const node = mainGroup
        .append("g")
        .selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .call(
          d3
            .drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        );

      // Add different shapes based on node type
      // Compound nodes (circles)
      node
        .filter((d) => d.type === "compound")
        .append("circle")
        .attr("r", 20)
        .attr("fill", (d) => getNodeColor(d, maxGeneration).fill)
        .attr("stroke", (d) => getNodeColor(d, maxGeneration).stroke)
        .attr("stroke-width", 2);

      // Reaction nodes (rectangles)
      node
        .filter((d) => d.type.startsWith("reaction"))
        .append("rect")
        .attr("width", 40)
        .attr("height", 20)
        .attr("x", -20)
        .attr("y", -10)
        .attr("rx", 5)
        .attr("fill", (d) => getNodeColor(d, maxGeneration).fill)
        .attr("stroke", (d) => getNodeColor(d, maxGeneration).stroke)
        .attr("stroke-width", 2);

      // EC nodes (rounded rectangles)
      node
        .filter((d) => d.type === "ec")
        .append("rect")
        .attr("width", 60)
        .attr("height", 20)
        .attr("x", -30)
        .attr("y", -10)
        .attr("rx", 10)
        .attr("fill", "white")
        .attr("stroke", (d) => getNodeColor(d, maxGeneration).stroke)
        .attr("stroke-width", 2);

      // Add hover effects to nodes
      node
        .on("mouseover", function (event, d) {
          d3.select(this)
            .select("circle, rect")
            .attr("stroke-width", 3)
            .attr("stroke", "#3B82F6");

          d3.select(this)
            .select("text")
            .attr("font-weight", "bold")
            .attr("fill", "#1E40AF");
        })
        .on("mouseout", function (event, d) {
          d3.select(this)
            .select("circle, rect")
            .attr("stroke-width", 2)
            .attr("stroke", getNodeColor(d, maxGeneration).stroke);

          d3.select(this)
            .select("text")
            .attr("font-weight", null)
            .attr("fill", "#1F2937");
        });

      // Add labels
      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", (d) => (d.type === "compound" ? 10 : 8))
        .attr("fill", "#1F2937")
        .text((d) => {
          if (d.type === "compound") return d.label;
          if (d.type === "ec") return d.label;
          // For reaction nodes, just use the base ID without side indicator
          return d.label.split("_")[0];
        });

      // Add generation indicators
      node
        .filter((d) => d.generation > 0)
        .append("text")
        .attr("x", (d) =>
          d.type === "compound" ? 0 : d.type === "ec" ? -20 : -15
        )
        .attr("y", (d) =>
          d.type === "compound" ? -25 : d.type === "ec" ? -15 : -20
        )
        .attr("text-anchor", "middle")
        .attr("font-size", 8)
        .attr("fill", (d) => getNodeColor(d, maxGeneration).stroke)
        .text((d) => `G${d.generation}`);

      // Handle drag events
      function dragstarted(event, d) {
        if (nodesLocked) return; // Don't allow dragging if nodes are locked

        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        if (nodesLocked) return; // Don't allow dragging if nodes are locked

        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (nodesLocked) return; // Don't allow dragging if nodes are locked

        if (!event.active) simulation.alphaTarget(0);

        // In unlocked mode, reset fx/fy to null so nodes can move freely again
        // unless we're in spiral mode, where we might want to keep some structure
        if (layoutType !== "spiral") {
          d.fx = null;
          d.fy = null;
        }
      }

      // Update position on tick
      simulation.on("tick", () => {
        linkGroups
          .select("line")
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        edgeLabels.attr("transform", (d) => {
          const x = (d.source.x + d.target.x) / 2;
          const y = (d.source.y + d.target.y) / 2;
          return `translate(${x},${y})`;
        });

        node.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

      // Initialize the simulation
      simulationRef.current = simulation;

      // Run simulation for initial layout
      if (layoutType === "spiral") {
        // If using spiral layout, run more iterations and gradually reduce alpha
        // to let the layout settle into a nice spiral pattern
        simulation.alpha(1);
        for (let i = 0; i < 300; i++) {
          simulation.tick();
          if (i % 30 === 0) {
            // Periodically reapply spiral constraints
            applySpiral(nodes);
          }
        }

        // After initial layout, fix node positions if locked
        if (nodesLocked) {
          nodes.forEach((node) => {
            node.fx = node.x;
            node.fy = node.y;
          });
        }
      } else {
        // For force-directed layout, fewer iterations are needed
        for (let i = 0; i < 100; i++) simulation.tick();
      }

      setTimeout(fitToView, 100);

      const handleResize = () => {
        const width = containerRef.current.clientWidth;
        const containerHeight =
          typeof height === "string" ? parseInt(height) : height;

        svg.attr("width", width).attr("height", containerHeight);

        fitToView();
      };

      window.addEventListener("resize", handleResize);

      // Set initial transform
      svg.call(
        zoom.transform,
        d3.zoomIdentity.scale(0.8).translate(width / 4, containerHeight / 4)
      );

      // Expose methods for external control
      svg.node().zoomIn = () => {
        svg.transition().call(zoom.scaleBy, 1.5);
      };

      svg.node().zoomOut = () => {
        svg.transition().call(zoom.scaleBy, 0.75);
      };

      svg.node().resetView = () => {
        svg
          .transition()
          .call(
            zoom.transform,
            d3.zoomIdentity.scale(0.8).translate(width / 4, containerHeight / 4)
          );
      };

      const handleDownloadSVG = () => {
        const svgElement = svgRef.current;
        if (!svgElement) return;
    
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(svgBlob);
    
        const link = document.createElement("a");
        link.href = url;
        link.download = "metabolic-network.svg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      svg.node().downloadSVG = handleDownloadSVG;

      // Clean up on unmount
      return () => {
        if (simulationRef.current) simulationRef.current.stop();
      };
    }, [
      data,
      currentGeneration,
      maxGeneration,
      containerRef,
      height,
      isFullscreen,
      nodesLocked,
      layoutType,
    ]);

    // Methods to expose to parent
    const zoomIn = () => {
      if (svgRef.current && svgRef.current.zoomIn) {
        svgRef.current.zoomIn();
      }
    };

    const zoomOut = () => {
      if (svgRef.current && svgRef.current.zoomOut) {
        svgRef.current.zoomOut();
      }
    };

    const resetView = () => {
      if (svgRef.current && svgRef.current.resetView) {
        svgRef.current.resetView();
      }
    };

    const downloadSVG = () => {
      if (svgRef.current && svgRef.current.downloadSVG) {
        svgRef.current.downloadSVG();
      }
    };

    const onSimulationEnd = () => {
      fitToContent(svg, g);
    };

    const toggleLock = () => {
      setNodesLocked((prev) => !prev);

      // Apply locking/unlocking to all nodes
      if (simulationRef.current) {
        const simulation = simulationRef.current;
        const nodes = simulation.nodes();

        if (!nodesLocked) {
          // Locking (new state will be locked)
          nodes.forEach((node) => {
            node.fx = node.x;
            node.fy = node.y;
          });
        } else {
          // Unlocking
          if (layoutType !== "spiral") {
            nodes.forEach((node) => {
              node.fx = null;
              node.fy = null;
            });
            simulation.alpha(0.3).restart();
          }
        }
      }
    };

    const resetSpiral = (allGenerations = false) => {
      if (simulationRef.current) {
        const simulation = simulationRef.current;
        const nodes = simulation.nodes();

        // Unlock nodes temporarily to allow repositioning
        let nodesWereLocked = nodesLocked;
        if (nodesWereLocked) {
          nodes.forEach((node) => {
            node.fx = null;
            node.fy = null;
          });
        }

        // Reapply spiral layout to all nodes or just current generation
        applySpiral(nodes, !allGenerations);

        // Reset simulation with a higher alpha to allow movement
        simulation.alpha(0.8).restart();

        // If nodes were locked before, relock them after a brief delay
        if (nodesWereLocked) {
          setTimeout(() => {
            nodes.forEach((node) => {
              node.fx = node.x;
              node.fy = node.y;
            });
          }, 200);
        }
      }
    };

    const resetToGenZero = () => {
      // Set current generation to 0 via parent component
      if (simulationRef.current) {
        resetSpiral(true); // Apply spiral layout to all generations
      }
    };

    // Make methods available to parent component
    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current)
              .transition()
              .call(zoomRef.current.scaleBy, 1.5);
          }
        },
        zoomOut: () => {
          if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current)
              .transition()
              .call(zoomRef.current.scaleBy, 0.75);
          }
        },
        resetView: fitToView,
        downloadSVG: downloadFullSVG,
        toggleLock,
        resetSpiral: () => {
          if (simulationRef.current) {
            const nodes = simulationRef.current.nodes();
            applySpiral(nodes, true);
            simulationRef.current.alpha(0.3).restart();
            setTimeout(fitToView, 100);
          }
        },
        isLocked: nodesLocked,
      }),
      [nodesLocked]
    );

    return (
      <div className="relative w-full h-full">
        <svg ref={svgRef} className="w-full h-full"></svg>

        {/* Lock/Unlock Button */}
        <button
          onClick={toggleLock}
          className={`absolute bottom-4 left-4 p-2 rounded-full ${
            nodesLocked
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 border border-gray-200"
          } shadow-md hover:shadow-lg transition-all z-10`}
          title={nodesLocked ? "Unlock node positions" : "Lock node positions"}
        >
          {nodesLocked ? (
            <Lock className="w-5 h-5" />
          ) : (
            <Unlock className="w-5 h-5" />
          )}
        </button>
      </div>
    );
  }
);

export default GraphRenderer;
