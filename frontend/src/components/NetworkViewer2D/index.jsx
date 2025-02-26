import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  Play,
  Pause,
  SkipForward,
  SkipBack,
} from "lucide-react";

const NetworkViewer2D = ({ results, height = "600px" }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const zoomRef = useRef(null);
  const simulationRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState(0);
  const [maxGeneration, setMaxGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  console.log(JSON.stringify(results));

  // Extract max generation from the data
  useEffect(() => {
    if (!results || results.length === 0) return;

    let highestGen = 0;

    // Check through all compounds in compound_generation fields
    results.forEach((item) => {
      if (item.compound_generation) {
        Object.values(item.compound_generation).forEach((gen) => {
          highestGen = Math.max(highestGen, parseInt(gen));
        });
      }
    });

    console.log("Setting max gen:", highestGen);
    setMaxGeneration(highestGen);
  }, [results]);

  // Process data for visualization based on current generation
  const processData = (data, currentGen) => {
    if (!data || data.length === 0) return { nodes: [], links: [] };

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
    data.forEach((reaction, index) => {
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
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });

    const connectedNodes = nodes.filter((node) => {
      // Always keep compounds, filter reactions and EC nodes with no connections
      if (node.type === "compound") return true;
      return connectedNodeIds.has(node.id);
    });

    return { nodes: connectedNodes, links };
  };

  // Render D3 visualization
  useEffect(() => {
    if (
      !svgRef.current ||
      !containerRef.current ||
      !results ||
      results.length === 0
    )
      return;

    // Clean up previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Clear existing content
    d3.select(svgRef.current).selectAll("*").remove();

    // Process data
    const { nodes, links } = processData(results, currentGeneration);
    if (nodes.length === 0) return;

    // Create SVG
    const width = containerRef.current.clientWidth;
    const containerHeight = parseInt(height);

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", containerHeight);

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

    // Create container for zoom
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
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
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, containerHeight / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(containerHeight / 2).strength(0.1))
      .force("collision", d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    const getNodeColor = (node) => {
      const generation = node.generation || 0;
      const maxGen = Math.max(maxGeneration, 1); // Ensure we don't divide by zero
      const hue = (generation / (maxGen + 1)) * 360; // Distribute hues evenly up to maxGen
      const saturation = 40; // Keep colors vibrant
      return {
        fill: `hsl(${hue}, ${saturation}%, 90%)`, // Light pastel fill
        stroke: `hsl(${hue}, ${saturation}%, 50%)`, // Darker stroke
      };
    };

    const linkGroups = g.append("g")
      .selectAll("g")
      .data(links)
      .enter()
      .append("g")
      .attr("class", "link-group");

    // Add the main edge lines
    linkGroups.append("line")
      .attr("stroke", d => {
        if (d.type === "reaction") return "#9CA3AF";
        if (d.type === "ec-in" || d.type === "ec-out") return "#8B5CF6";
        
        const generation = d.generation || 0;
        const maxGen = Math.max(maxGeneration, 1);
        const hue = (generation / (maxGen + 1)) * 360;
        return `hsl(${hue}, 70%, 50%)`;
      })
      .attr("stroke-width", 1.5)
      .attr("marker-mid", d => {
        if (d.type === "substrate" || d.type === "product") return "url(#arrowhead)";
        return null;
      })
      .attr("stroke-dasharray", d => {
        if (d.type === "reaction") return "5,5";
        if (d.type === "ec-in" || d.type === "ec-out") return "3,3";
        return null;
      });

    // Add edge weight labels
    const edgeLabels = linkGroups.filter(d => d.stoichiometry && d.stoichiometry !== 1)
      .append("g")
      .attr("class", "edge-label");

    edgeLabels.append("rect")
      .attr("rx", 4)
      .attr("width", 16)
      .attr("height", 16)
      .attr("x", -8)
      .attr("y", -12)
      .attr("fill", "white")
      .attr("opacity", 0.35);

    edgeLabels.append("text")
      .text(d => d.stoichiometry)
      .attr("text-anchor", "middle")
      .attr("dy", -2)
      .attr("font-size", 10)
      .attr("fill", "#4B5563")
      .attr("font-weight", 500);

    // Create nodes
    const node = g
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
      .attr("fill", (d) => getNodeColor(d).fill)
      .attr("stroke", (d) => getNodeColor(d).stroke)
      .attr("stroke-width", 2);

    // Reaction nodes (rectangles)
    node
      .filter((d) => d.type === "reaction-in")
      .append("rect")
      .attr("width", 50)
      .attr("height", 25)
      .attr("x", -25)
      .attr("y", -12.5)
      .attr("rx", 5)
      .attr("fill", (d) => getNodeColor(d).fill)
      .attr("stroke", (d) => getNodeColor(d).stroke)
      .attr("stroke-width", 2);

    node
      .filter((d) => d.type === "reaction-out")
      .append("rect")
      .attr("width", 50)
      .attr("height", 25)
      .attr("x", -25)
      .attr("y", -12.5)
      .attr("rx", 5)
      .attr("fill", (d) => getNodeColor(d).fill)
      .attr("stroke", (d) => getNodeColor(d).stroke)
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
      .attr("stroke", (d) => getNodeColor(d).stroke)
      .attr("stroke-width", 2);

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
        return d.label.split("_")[0]; // Truncate reaction IDs
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
      .attr("fill", (d) => getNodeColor(d).stroke)
      .text((d) => `G${d.generation}`);

    // Handle drag events
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep nodes fixed at their dragged position
    }

    // Update position on tick
    simulation.on("tick", () => {
      linkGroups.select("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      linkGroups.select(".edge-label")
        .attr("transform", d => {
          const x = (d.source.x + d.target.x) / 2;
          const y = (d.source.y + d.target.y) / 2;
          return `translate(${x},${y})`;
        });

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Run simulation for a bit
    for (let i = 0; i < 300; i++) simulation.tick();

    // Set initial transform
    svg.call(
      zoom.transform,
      d3.zoomIdentity.scale(0.8).translate(width / 4, containerHeight / 4)
    );

    // Clean up on unmount
    return () => {
      simulation.stop();
    };
  }, [results, height, currentGeneration]);

  // Handle animation playback
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentGeneration((prev) => {
          if (prev >= maxGeneration) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // Animation speed (1.5 seconds per step)
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, maxGeneration]);

  // Handle play/pause
  const togglePlay = () => {
    if (currentGeneration >= maxGeneration && !isPlaying) {
      setCurrentGeneration(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Handle step navigation
  const stepForward = () => {
    if (currentGeneration < maxGeneration) {
      setCurrentGeneration((prev) => prev + 1);
    }
  };

  const stepBackward = () => {
    if (currentGeneration > 0) {
      setCurrentGeneration((prev) => prev - 1);
    }
  };

  // Handle zoom controls
  const handleZoomIn = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(zoomRef.current.scaleBy, 0.75);
    }
  };

  const handleReset = () => {
    if (zoomRef.current && svgRef.current && containerRef.current) {
      const width = containerRef.current.clientWidth;
      const containerHeight = parseInt(height);

      d3.select(svgRef.current)
        .transition()
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.scale(0.8).translate(width / 4, containerHeight / 4)
        );
    }
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;

    if (!isFullscreen) {
      if (wrapperRef.current.requestFullscreen) {
        wrapperRef.current.requestFullscreen();
      } else if (wrapperRef.current.mozRequestFullScreen) {
        wrapperRef.current.mozRequestFullScreen();
      } else if (wrapperRef.current.webkitRequestFullscreen) {
        wrapperRef.current.webkitRequestFullscreen();
      } else if (wrapperRef.current.msRequestFullscreen) {
        wrapperRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ||
          document.mozFullScreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Handle SVG download
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

  return (
    <div className="relative rounded-xl border border-gray-200 shadow" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Floating Visualization Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? 
              <Minimize className="w-5 h-5 text-gray-700" /> : 
              <Maximize className="w-5 h-5 text-gray-700" />
            }
          </button>
          <button
            onClick={handleDownloadSVG}
            className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            title="Download as SVG"
          >
            <Download className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Main Visualization Area */}
        <div className="flex-1 relative">
          <svg ref={svgRef} className="w-full h-full"></svg>
        </div>

        {/* Generation Controls and Slider */}
        <div className="p-6 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
            {/* Generation info and controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Generation: <span className="text-blue-600">{currentGeneration}</span> / {maxGeneration}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentGeneration(Math.max(0, currentGeneration - 1))}
                  disabled={currentGeneration === 0}
                  className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-1.5 rounded-md ${
                    isPlaying ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setCurrentGeneration(Math.min(maxGeneration, currentGeneration + 1))}
                  disabled={currentGeneration === maxGeneration}
                  className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Generation slider controls */}
          <div className="relative h-12 flex items-center">
            <input
              type="range"
              min="0"
              max={maxGeneration}
              value={currentGeneration}
              onChange={(e) => setCurrentGeneration(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${Array.from({ length: maxGeneration + 1 })
                  .map((_, i) => {
                    const hue = (i / (maxGeneration + 1)) * 360;
                    return `hsl(${hue}, 70%, 50%) ${(i / maxGeneration) * 100}%`;
                  })
                  .join(", ")})`,
              }}
            />

            {/* Generation Ticks */}
            <div className="absolute w-full flex justify-between top-5 px-2">
              {Array.from({ length: maxGeneration + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center cursor-pointer"
                  onClick={() => setCurrentGeneration(i)}
                >
                  <div
                    className={`w-1 h-3 ${
                      currentGeneration >= i ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  ></div>
                  <span
                    className={`text-xs mt-1 ${
                      currentGeneration === i
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    {i}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend and Help Text */}
          <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-200 border border-blue-500 mr-1"></div>
                <span>Compound</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-200 border border-purple-500 rounded-sm mr-1"></div>
                <span>Reaction</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-3 rounded-md bg-white border border-purple-500 mr-1"></div>
                <span>EC Number</span>
              </div>
            </div>
            <div className="italic">
              Drag to move nodes • Scroll to zoom • Slider to change generations
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkViewer2D;
