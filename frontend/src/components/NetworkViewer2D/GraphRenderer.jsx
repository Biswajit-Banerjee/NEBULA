// NetworkViewer2D/GraphRenderer.jsx
import React, {
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
    useState,
  } from "react";
  import * as d3 from "d3";
  import { Lock, Unlock } from "lucide-react";
  import { getNodeColor, getLinkColor } from "./utils/colorSchemes";
  import { processData, applySpiral } from "./utils/graphProcessing";
  
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
  
      // Helper functions for D3 visualization
      const fitToView = () => {
        if (!svgRef.current || !mainGroupRef.current || !containerRef.current)
          return;
  
        const svg = d3.select(svgRef.current);
        const g = d3.select(mainGroupRef.current);
        const zoom = zoomRef.current;
        if (!zoom) return;
  
        // Get bounds of the content
        const bounds = mainGroupRef.current.getBBox();
  
        // Get container dimensions - account for fullscreen or normal mode
        let width, containerHeight;
        
        if (isFullscreen) {
          width = window.innerWidth;
          containerHeight = window.innerHeight;
        } else {
          width = containerRef.current.clientWidth;
          containerHeight = typeof height === "string" ? parseInt(height) : height;
        }
  
        // Calculate scale to fit content with padding
        const padding = 40; // Increased padding
        const scale =
          Math.min(
            (width - padding * 2) / bounds.width,
            (containerHeight - padding * 2) / bounds.height,
            1.8 // Reduced max scale to avoid overly large graphs
          ) * 0.95; // Slightly reduce scale to ensure padding
  
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
  
      const downloadFullSVG = () => {
        if (!svgRef.current || !mainGroupRef.current) return;
        
        // Pause any ongoing simulations
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
  
        // Create a new SVG element
        const tempContainer = document.createElement("div");
        const tempSvg = d3
          .select(tempContainer)
          .append("svg")
          .attr("xmlns", "http://www.w3.org/2000/svg");
  
        // Copy defs with arrowheads and other definitions
        const originalDefs = svgRef.current.querySelector("defs");
        if (originalDefs) {
          tempSvg.node().appendChild(originalDefs.cloneNode(true));
        }
  
        // Clone the main content
        const content = mainGroupRef.current.cloneNode(true);
        
        // Get accurate bounds before adding to the temporary SVG
        const bounds = mainGroupRef.current.getBBox();
        
        // Add the content to the SVG
        tempSvg.node().appendChild(content);
        
        // Set dimensions with generous padding
        const padding = 100; // Increased padding for better margins
        tempSvg
          .attr("width", bounds.width + padding * 2)
          .attr("height", bounds.height + padding * 2)
          .attr("viewBox", `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`);
        
        // No transform needed as we're using viewBox to position
        
        // Convert to string and download
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
        
        // Restart the simulation if it was running
        if (simulationRef.current) {
          simulationRef.current.restart();
        }
      };
  
      // Setup D3 visualization
      const setupVisualization = (processedData) => {
        if (!svgRef.current || !containerRef.current) return;
  
        // Clean up previous simulation
        if (simulationRef.current) {
          simulationRef.current.stop();
        }
  
        // Clear existing content
        d3.select(svgRef.current).selectAll("*").remove();
  
        // Process data
        const { nodes, links } = processData(processedData, currentGeneration);
  
        if (nodes.length === 0) return;
  
        // Only position new nodes or when explicitly resetting
        // This preserves user's manual positioning
        const existingNodes = new Set(
          simulationRef.current?.nodes().map((node) => node.id) || []
        );
        const newNodes = nodes.filter((node) => !existingNodes.has(node.id));
  
        // Get container dimensions
        const width = containerRef.current.clientWidth;
        const containerHeight =
          typeof height === "string"
            ? parseInt(height.replace("px", ""))
            : height;
  
        // Apply spiral layout to new nodes
        if (newNodes.length > 0) {
          applySpiral(
            nodes, 
            width / 2, 
            containerHeight / 2, 
            currentGeneration, 
            true,
            nodesLocked
          );
        }
  
        // Create SVG
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
          .attr("viewBox", "-5 -5 10 10")
          .attr("refX", 0)
          .attr("refY", 0)
          .attr("markerWidth", 8)
          .attr("markerHeight", 8)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M-5,-5 L0,0 L-5,5")
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
  
        // Create force simulation with separated forces
        const simulation = setupSimulation(nodes, links, width, containerHeight);
        
        // Create node and link elements
        createLinkElements(mainGroup, links);
        createNodeElements(mainGroup, nodes, simulation);
  
        // Initialize the simulation
        simulationRef.current = simulation;
  
        // Run simulation for initial layout
        if (layoutType === "spiral") {
          // If using spiral layout, run more iterations and gradually reduce alpha
          simulation.alpha(1);
          for (let i = 0; i < 300; i++) {
            simulation.tick();
            if (i % 30 === 0) {
              // Periodically reapply spiral constraints
              applySpiral(
                nodes, 
                width / 2, 
                containerHeight / 2, 
                currentGeneration, 
                false,
                nodesLocked
              );
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
  
        // Setup window resize handler
        const handleResize = () => {
          const width = containerRef.current.clientWidth;
          const containerHeight =
            typeof height === "string" ? parseInt(height) : height;
  
          svg.attr("width", width).attr("height", containerHeight);
          fitToView();
        };
  
        window.addEventListener("resize", handleResize);
  
        // Calculate better initial transform
        setTimeout(fitToView, 50);
  
        // Expose methods on the svg node for external control
        setupImperativeAPI(svg);
  
        // Clean up on unmount
        return () => {
          window.removeEventListener("resize", handleResize);
          if (simulationRef.current) simulationRef.current.stop();
        };
      };
  
      // Setup force simulation
      const setupSimulation = (nodes, links, width, containerHeight) => {
        // Create a more stable simulation with better defaults
        const simulation = d3
          .forceSimulation(nodes)
          .force(
            "link",
            d3
              .forceLink(links)
              .id((d) => d.id)
              .distance((d) => {
                // Increased distances to prevent collapse
                if (d.type === "reaction") return 90;
                if (d.type.startsWith("ec")) return 70;
                return 130 + (d.genDifference || 0) * 40;
              })
          )
          .force(
            "charge",
            d3.forceManyBody()
              .strength((d) => {
                // Stronger repulsion to avoid collapse
                const baseStrength = -800; 
                const genMultiplier = 1 + (d.generation || 0) * 0.2;
                return baseStrength * genMultiplier;
              })
              .distanceMin(10) // Minimum distance to apply forces
              .distanceMax(500) // Maximum distance to apply forces
          )
          .force("center", d3.forceCenter(width / 2, containerHeight / 2).strength(0.1))
          .force(
            "x",
            d3
              .forceX()
              .x((d) => {
                const gen = d.generation || 0;
                const angle = gen * (Math.PI / 2);
                const distance = 200 + gen * 100; // Increased distance
                return width / 2 + Math.cos(angle) * distance;
              })
              .strength(0.1)
          )
          .force(
            "y",
            d3
              .forceY()
              .y((d) => {
                const gen = d.generation || 0;
                const angle = gen * (Math.PI / 2);
                const distance = 200 + gen * 100; // Increased distance
                return containerHeight / 2 + Math.sin(angle) * distance;
              })
              .strength(0.1)
          )
          .force(
            "collision",
            d3
              .forceCollide()
              .radius((d) => {
                // Larger collision radii to prevent overlaps
                if (d.type === "compound") return 45;
                if (d.type === "ec") return 55;
                return 50;
              })
              .strength(1.0) // Maximum strength for collision
              .iterations(4) // More iterations for better collision detection
          )
          .alphaDecay(0.01) // Slower decay for more stable layout
          .velocityDecay(0.3); // Slightly higher to dampen oscillations
          
        return simulation;
      };
  
      // Create link elements
      const createLinkElements = (mainGroup, links) => {
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
  
        return { linkGroups, edgeLabels };
      };
  
      // Create node elements
      const createNodeElements = (mainGroup, nodes, simulation) => {
        // Setup drag behavior
        const drag = d3
          .drag()
          .on("start", (event, d) => dragstarted(event, d, simulation))
          .on("drag", (event, d) => dragged(event, d))
          .on("end", (event, d) => dragended(event, d, simulation));
  
        // Create node groups
        const node = mainGroup
          .append("g")
          .selectAll(".node")
          .data(nodes)
          .enter()
          .append("g")
          .attr("class", "node")
          .call(drag);
  
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
  
        return node;
      };
  
      // Handle drag events
      function dragstarted(event, d, simulation) {
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
  
      function dragended(event, d, simulation) {
        if (nodesLocked) return; // Don't allow dragging if nodes are locked
  
        if (!event.active) simulation.alphaTarget(0);
  
        // In unlocked mode, reset fx/fy to null so nodes can move freely again
        // unless we're in spiral mode, where we might want to keep some structure
        if (layoutType !== "spiral") {
          d.fx = null;
          d.fy = null;
        }
      }
  
      // Setup methods for external control
      const setupImperativeAPI = (svg) => {
        // Add methods to the SVG node for external access
        svg.node().zoomIn = () => {
          svg.transition().call(zoomRef.current.scaleBy, 1.5);
        };
  
        svg.node().zoomOut = () => {
          svg.transition().call(zoomRef.current.scaleBy, 0.75);
        };
  
        svg.node().resetView = () => {
          const width = containerRef.current.clientWidth;
          const containerHeight =
            typeof height === "string" ? parseInt(height) : height;
              
          svg
            .transition()
            .call(
              zoomRef.current.transform,
              d3.zoomIdentity.scale(0.8).translate(width / 4, containerHeight / 4)
            );
        };
  
        svg.node().downloadSVG = downloadFullSVG;
      };
  
      // Set up D3 visualization when core data or generation changes
      useEffect(() => {
        setupVisualization(Array.isArray(data) ? data : []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [data, currentGeneration, maxGeneration]);
  
      // Handle fullscreen enter/exit just by fitting view without rebuilding the graph
      useEffect(() => {
        fitToView();
      }, [isFullscreen, height]);
  
      // Update positions when the simulation ticks
      useEffect(() => {
        if (!simulationRef.current) return;
  
        let tickCount = 0; // throttle DOM updates for better performance
        simulationRef.current.on("tick", () => {
          tickCount++;
          if (tickCount % 2 !== 0) return; // update DOM every other tick
  
          const linkGroups = d3.selectAll(".link-group");
          const edgeLabels = d3.selectAll(".edge-label");
          const nodes = d3.selectAll(".node");
  
          linkGroups
            .selectAll("line")
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);
  
          edgeLabels.attr("transform", (d) => {
            const x = (d.source.x + d.target.x) / 2;
            const y = (d.source.y + d.target.y) / 2;
            return `translate(${x},${y})`;
          });
  
          nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
        });
      }, [simulationRef.current]);
  
      // Toggle locked nodes
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
  
      // Reset nodes to spiral layout
      const resetSpiral = (allGenerations = false) => {
        if (!simulationRef.current || !containerRef.current) return;
        
        const simulation = simulationRef.current;
        const nodes = simulation.nodes();
        const width = containerRef.current.clientWidth;
        const containerHeight = typeof height === "string" 
          ? parseInt(height) 
          : height;
  
        // Unlock nodes temporarily to allow repositioning
        let nodesWereLocked = nodesLocked;
        if (nodesWereLocked) {
          nodes.forEach((node) => {
            node.fx = null;
            node.fy = null;
          });
        }
  
        // Reapply spiral layout to all nodes or just current generation
        applySpiral(
          nodes, 
          width / 2, 
          containerHeight / 2, 
          currentGeneration, 
          !allGenerations,
          false
        );
  
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
          resetSpiral,
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