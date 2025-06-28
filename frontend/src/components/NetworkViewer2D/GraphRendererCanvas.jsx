import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  useContext,
} from "react";
import * as d3 from "d3";
import { processData, applySpiral } from "./utils/graphProcessing";
import { Lock, Unlock } from "lucide-react";
import { ThemeContext } from "../ThemeProvider/ThemeProvider";



const GraphRendererCanvas = forwardRef(
  (
    {
      data,
      currentGeneration,
      maxGeneration,
      containerRef,
      height = 600,
      isFullscreen,
      tension,
      repulsion,
      pairColorMap = {},
      showOverlay = false,
    },
    ref
  ) => {
    const { dark } = useContext(ThemeContext);
    const canvasRef = useRef(null);
    const simulationRef = useRef(null);
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const [collapsedRoots, setCollapsedRoots] = useState(new Set()); // reaction-side nodes acting as collapse pivots
    const [hiddenIds, setHiddenIds] = useState(new Set());
    const [nodesLocked, setNodesLocked] = useState(false);
    const [ctrlHeld, setCtrlHeld] = useState(false);

    /* ------------------------------------------------------------------ */
    /* Helpers                                                            */
    /* ------------------------------------------------------------------ */

    const computeHiddenNodes = useCallback(
      (nodes, links, roots) => {
        if (!roots || roots.size === 0) return new Set();

        const toHide = new Set();
        const adjacency = {};
        links.forEach((l) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          if (!adjacency[sId]) adjacency[sId] = [];
          if (!adjacency[tId]) adjacency[tId] = [];
          adjacency[sId].push(tId);
          adjacency[tId].push(sId);
        });

        const bfs = (startId, direction) => {
          /** direction: "upstream" | "downstream" */
          const queue = [startId];
          const visited = new Set([startId]);
          while (queue.length) {
            const cur = queue.shift();
            (adjacency[cur] || []).forEach((nbr) => {
              if (visited.has(nbr)) return;
              visited.add(nbr);

              const nbrNode = nodes.find((n) => n.id === nbr);
              if (!nbrNode) return;

              // Continue only if direction matches relative position in reaction pair
              const isReactionSide = /reaction-/.test(nbrNode.type);
              if (direction === "upstream") {
                // Stop traversing past product side
                if (nbrNode.id.endsWith("_p")) return;
              }
              if (direction === "downstream") {
                if (nbrNode.id.endsWith("_r")) return;
              }

              toHide.add(nbr);
              queue.push(nbr);
            });
          }
        };

        roots.forEach((rootId) => {
          const rootDir = rootId.endsWith("_r") ? "upstream" : "downstream";
          bfs(rootId, rootDir);
        });

        // Never hide the roots themselves
        roots.forEach((id) => toHide.delete(id));

        return toHide;
      },
      []
    );

    const [graph, setGraph] = useState({ nodes: [], links: [] });

    /* ------------------------------------------------------------------ */
    /* Build/Update graph when raw data or generation changes              */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
      if (!Array.isArray(data)) return;
      const processed = processData(data, currentGeneration);
      setGraph(processed);
    }, [data, currentGeneration]);

    /* ------------------------------------------------------------------ */
    /* Collapse logic                                                     */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      const hidden = computeHiddenNodes(graph.nodes, graph.links, collapsedRoots);
      setHiddenIds(hidden);
    }, [collapsedRoots, graph, computeHiddenNodes]);

    /* ------------------------------------------------------------------ */
    /* Force-simulation                                                   */
    /* ------------------------------------------------------------------ */

    const draw = useCallback((nodes) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const { width: w, height: h } = canvasRef.current;
      // Clear
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      ctx.clearRect(0, 0, w, h);
      ctx.restore();

      ctx.save();
      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      /* ---------------------------------------------------------- */
      /* Grid overlay – drawn in world coordinates so it scales    */
      /* ---------------------------------------------------------- */

      // Dynamically determine grid cell size so that a node fits neatly
      const nodeGridSize = (() => {
        let max = 0;
        nodes.forEach((n) => {
          let size;
          switch (n.type) {
            case "compound":
              size = 36; // diameter 18 * 2
              break;
            case "ec":
              size = 48; // width (rx 24 * 2)
              break;
            default:
              size = 40; // rectangle width
          }
          if (size > max) max = size;
        });
        return max || 40; // fallback
      })();

      const gridSpacing = nodeGridSize;
      const gridColor = dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1 / t.k; // keep 1px regardless of zoom

      // Compute visible bounds in world coords
      const viewMinX = (-t.x) / t.k;
      const viewMinY = (-t.y) / t.k;
      const viewMaxX = viewMinX + w / t.k;
      const viewMaxY = viewMinY + h / t.k;

      // Align grid start to spacing
      const startX = Math.floor(viewMinX / gridSpacing) * gridSpacing;
      const startY = Math.floor(viewMinY / gridSpacing) * gridSpacing;

      for (let x = startX; x <= viewMaxX; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, viewMinY);
        ctx.lineTo(x, viewMaxY);
        ctx.stroke();
      }
      for (let y = startY; y <= viewMaxY; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(viewMinX, y);
        ctx.lineTo(viewMaxX, y);
        ctx.stroke();
      }
      ctx.restore();

      /* ---------------------------------------------------------- */
      /* Path overlay – per node & edge highlight                   */
      /* ---------------------------------------------------------- */

      if (showOverlay) {
        const alphaEdge = 0.25;
        const alphaNode = 0.35;

        const hexToRgba = (hex, alpha = 0.3) => {
          let h = hex.replace("#", "");
          if (h.length === 3) h = h.split("").map((c) => c + c).join("");
          const bigint = parseInt(h, 16);
          const r = (bigint >> 16) & 255;
          const g = (bigint >> 8) & 255;
          const b = bigint & 255;
          return `rgba(${r},${g},${b},${alpha})`;
        };

        // Highlight edges first (so nodes overlay edges)
        graph.links.forEach((l) => {
          if (!l.pairIndices || l.pairIndices.length === 0) return;
          const srcId = l.source?.id || l.source;
          const trgId = l.target?.id || l.target;
          if (hiddenIds.has(srcId) || hiddenIds.has(trgId)) return;
          const src = nodes.find((n) => n.id === srcId);
          const trg = nodes.find((n) => n.id === trgId);
          if (!src || !trg) return;

          l.pairIndices.forEach((pi) => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(6 / t.k, 3);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(trg.x, trg.y);
            ctx.stroke();
            ctx.restore();
          });
        });

        // Highlight nodes
        nodes.forEach((n) => {
          if (!n.pairIndices || n.pairIndices.length === 0) return;
          if (hiddenIds.has(n.id)) return;

          n.pairIndices.forEach((pi) => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(6 / t.k, 3);
            const pad = 4; // expansion around original size
            switch (n.type) {
              case "compound":
                ctx.beginPath();
                ctx.arc(n.x, n.y, 18 + pad, 0, Math.PI * 2);
                ctx.stroke();
                break;
              case "ec":
                ctx.beginPath();
                ctx.ellipse(n.x, n.y, 24 + pad, 14 + pad, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
              default:
                const rx = n.x - 20 - pad;
                const ry = n.y - 12 - pad;
                const rw = 40 + pad * 2;
                const rh = 24 + pad * 2;
                const radius = 6;
                ctx.beginPath();
                ctx.moveTo(rx + radius, ry);
                ctx.lineTo(rx + rw - radius, ry);
                ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
                ctx.lineTo(rx + rw, ry + rh - radius);
                ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
                ctx.lineTo(rx + radius, ry + rh);
                ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
                ctx.lineTo(rx, ry + radius);
                ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
                ctx.stroke();
            }
            ctx.restore();
          });
        });
      }

      const links = graph.links.filter((l) => {
        const sId = l.source?.id || l.source;
        const tId = l.target?.id || l.target;
        return !hiddenIds.has(sId) && !hiddenIds.has(tId);
      });

      // Draw links with style per type
      ctx.lineCap = "round";
      links.forEach((l) => {
        const lType = l.type;
        if (lType && lType.startsWith("ec")) {
          ctx.strokeStyle = dark ? "#c4b5fd" : "#8B5CF6";
          ctx.setLineDash([2 / t.k, 4 / t.k]);
        } else if (lType === "reaction") {
          ctx.strokeStyle = dark ? "#CBD5E1" : "#9CA3AF";
          ctx.setLineDash([6 / t.k, 4 / t.k]);
        } else {
          ctx.strokeStyle = dark ? "#CBD5E1" : "#9CA3AF";
          ctx.setLineDash([]);
        }

        ctx.lineWidth = Math.max(1 / t.k, 0.8);
        const srcId = l.source?.id || l.source;
        const trgId = l.target?.id || l.target;
        if (hiddenIds.has(srcId) || hiddenIds.has(trgId)) return;
        const src = nodes.find((n) => n.id === srcId);
        const trg = nodes.find((n) => n.id === trgId);
        if (!src || !trg) return;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(trg.x, trg.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (l.stoichiometry && l.stoichiometry > 1) {
          ctx.save();
          ctx.fillStyle = dark ? "#334155" : "#1F2937";
          //ctx.font = `${Math.max(8 / t.k, 6)}px Inter, sans-serif`;
          ctx.font = `6px Inter, sans-serif`;
          const midX = (src.x + trg.x) / 2;
          const midY = (src.y + trg.y) / 2 - 4 / t.k;
          ctx.fillText(l.stoichiometry, midX, midY);
          ctx.restore();
        }
      });

      // Helper to compute color for a generation index
      const genColor = (g) => {
        const hue = maxGeneration ? (g / (maxGeneration + 1)) * 320 : 200;
        return {
          fill: `hsl(${hue}, 70%, 90%)`,
          stroke: `hsl(${hue}, 70%, 45%)`,
        };
      };

      // Draw nodes
      nodes.forEach((n) => {
        if (hiddenIds.has(n.id)) return;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.1)";
        ctx.shadowBlur = 3;
        ctx.beginPath();

        // Determine styles
        {
          const { fill, stroke } = genColor(n.generation || 0);
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
        }

        switch (n.type) {
          case "compound":
            ctx.lineWidth = 1.5;
            ctx.arc(n.x, n.y, 18, 0, Math.PI * 2);
            break;
          case "ec":
            ctx.lineWidth = 1.5;
            ctx.ellipse(n.x, n.y, 24, 14, 0, 0, Math.PI * 2);
            break;
          default:
            ctx.lineWidth = collapsedRoots.has(n.id) ? 3 : 1.5;
            // rounded rectangle
            const rx = n.x - 20;
            const ry = n.y - 12;
            const rw = 40;
            const rh = 24;
            const radius = 4;
            ctx.beginPath();
            ctx.moveTo(rx + radius, ry);
            ctx.lineTo(rx + rw - radius, ry);
            ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
            ctx.lineTo(rx + rw, ry + rh - radius);
            ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
            ctx.lineTo(rx + radius, ry + rh);
            ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
            ctx.lineTo(rx, ry + radius);
            ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
            ctx.fill();
            ctx.stroke();
            break;
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Draw labels (compound + EC + reaction as text)
      //ctx.font = `${Math.max(9 / t.k, 5)}px "Inter", sans-serif`;
      ctx.font = `7px "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      nodes.forEach((n) => {
        if (hiddenIds.has(n.id)) return;
        let label = n.label ?? n.id;
        if (/reaction-/.test(n.type)) label = label.split("_")[0];

        ctx.fillStyle = dark ? "#1E293B" : "#374151";
        ctx.fillText(label, n.x, n.y);
      });

      ctx.restore();
    }, [dark, graph, hiddenIds, maxGeneration, collapsedRoots, showOverlay]);

    // Use effect to redraw when overlay toggled or graph updated
    useEffect(() => {
      draw(graph.nodes);
    }, [showOverlay, graph, draw]);

    useEffect(() => {
      if (!graph.nodes.length) return;

      // Deep copy nodes so d3 can mutate x/y without affecting state
      const nodesCopy = graph.nodes.map((n) => ({ ...n }));
      const linksCopy = graph.links.map((l) => ({ ...l }));

      // Remove hidden nodes from simulation arrays
      const visibleNodes = nodesCopy.filter((n) => !hiddenIds.has(n.id));

      // Visible links corresponding to visible nodes
      const visibleLinks = linksCopy.filter((l) => {
        const sId = l.source?.id || l.source;
        const tId = l.target?.id || l.target;
        return !hiddenIds.has(sId) && !hiddenIds.has(tId);
      });

      // Fix positions of nodes from earlier generations so they remain stable
      visibleNodes.forEach((n) => {
        if ((n.generation || 0) < currentGeneration && !nodesLocked) {
          n.fx = n.x;
          n.fy = n.y;
        }
      });

      // Initial positions – reuse previous if simulation exists
      const prevPositions = simulationRef.current?.nodes().reduce((acc, n) => {
        acc[n.id] = { x: n.x, y: n.y };
        return acc;
      }, {});
      visibleNodes.forEach((n) => {
        if (prevPositions?.[n.id]) {
          n.x = prevPositions[n.id].x;
          n.y = prevPositions[n.id].y;
        }
      });

      // Spiral placement for fresh nodes
      applySpiral(
        visibleNodes,
        (containerRef.current?.clientWidth || 800) / 2,
        (typeof height === "string" ? parseInt(height) : height) / 2,
        currentGeneration,
        true,
        nodesLocked
      );

      if (simulationRef.current) simulationRef.current.stop();

      const sim = d3
        .forceSimulation(visibleNodes)
        .force(
          "link",
          d3
            .forceLink(visibleLinks)
            .id((d) => d.id)
            .distance(tension)
        )
        .force("charge", d3.forceManyBody().strength(-repulsion))
        .force(
          "center",
          d3.forceCenter(
            (containerRef.current?.clientWidth || 800) / 2,
            (typeof height === "string" ? parseInt(height) : height) / 2
          )
        )
        .alpha(0.5) // gentler start to avoid "explosion" effect
        .alphaDecay(0.05)
        .on("tick", () => draw(sim.nodes()));

      if (nodesLocked) {
        sim.stop();
      }

      simulationRef.current = sim;

      // Initial draw
      draw(visibleNodes);

      return () => {
        sim.stop();
      };
    }, [graph, hiddenIds, nodesLocked, currentGeneration, height, containerRef, tension, repulsion, draw]);

    /* ------------------------------------------------------------------ */
    /* Canvas & Zoom                                                      */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: true });

      const handleResize = () => {
        const w = isFullscreen ? window.innerWidth : containerRef.current?.clientWidth || 800;
        const h = isFullscreen
          ? window.innerHeight
          : typeof height === "string"
          ? parseInt(height)
          : height;
        canvas.width = w * window.devicePixelRatio;
        canvas.height = h * window.devicePixelRatio;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        draw(simulationRef.current?.nodes() || []);
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      const zoom = d3
        .zoom()
        .scaleExtent([0.2, 10])
        .filter((ev) => {
          if (ev.type !== 'mousedown') return true;
          // Disable zoom if pointer is on a node (so we can drag it)
          const rect = canvas.getBoundingClientRect();
          const mx = (ev.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const my = (ev.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          const hitNode = (simulationRef.current?.nodes() || []).find((n) => {
            const radius = n.type === 'compound' ? 18 : n.type === 'ec' ? 24 : 20;
            return (mx - n.x) ** 2 + (my - n.y) ** 2 <= radius ** 2;
          });
          return !hitNode; // allow pan if not clicking on node
        })
        .on("zoom", (ev) => {
          transformRef.current = ev.transform;
          draw(simulationRef.current?.nodes() || []);
        });
      d3.select(canvas).call(zoom);
      zoomRef.current = zoom;

      return () => {
        window.removeEventListener("resize", handleResize);
        d3.select(canvas).on('.zoom', null);
      };
    }, [containerRef, height, isFullscreen, draw]);

    /* ------------------------------------------------------------------ */
    /* Drawing                                                             */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      const down = (e) => {
        if (e.key === 'Control') setCtrlHeld(true);
      };
      const up = (e) => {
        if (e.key === 'Control') setCtrlHeld(false);
      };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
      };
    }, []);

    /* ------------------------------------------------------------------ */
    /* Pointer interaction – selection & collapse                          */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;

      const handleClick = (evt) => {
        if (!evt.ctrlKey) return;
        const rect = canvas.getBoundingClientRect();
        const x = (evt.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
        const y = (evt.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

        const hit = (simulationRef.current?.nodes() || []).find((n) => {
          if (/reaction-/.test(n.type)) {
            // Reaction side nodes are small rectangles 24×12
            return x >= n.x - 12 && x <= n.x + 12 && y >= n.y - 6 && y <= n.y + 6;
          } else if (n.type === "compound") {
            return (x - n.x) ** 2 + (y - n.y) ** 2 <= 100; // r=10
          }
          return false;
        });
        if (hit && /reaction-/.test(hit.type)) {
          setCollapsedRoots((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(hit.id)) newSet.delete(hit.id);
            else newSet.add(hit.id);
            return newSet;
          });
        }
      };

      canvas.addEventListener("click", handleClick);
      return () => canvas.removeEventListener("click", handleClick);
    }, []);

    /* ------------------------------------------------------------------ */
    /* Dragging for node reposition                                        */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let dragging = null;

      const pointerdown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
        const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
        const node = (simulationRef.current?.nodes() || []).find((n) => {
          return (mx - n.x) ** 2 + (my - n.y) ** 2 < 400;
        });
        if (node) {
          dragging = node;
          simulationRef.current.alphaTarget(0.3).restart();
          node.fx = node.x;
          node.fy = node.y;
          canvas.style.cursor = "grabbing";
        }
      };

      const pointermove = (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
        const my = (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
        dragging.fx = mx;
        dragging.fy = my;
        if (nodesLocked) draw(simulationRef.current?.nodes() || []);
      };

      const pointerup = () => {
        if (dragging) {
          // Permanently fix node at its dropped location, regardless of mode
          dragging.fx = dragging.x;
          dragging.fy = dragging.y;

          // Calm simulation so neighbours settle without pulling node back
          simulationRef.current.alphaTarget(0);
          if (nodesLocked) draw(simulationRef.current?.nodes() || []);
          dragging = null;
          canvas.style.cursor = 'grab';
        }
      };

      canvas.addEventListener("pointerdown", pointerdown, { passive: false });
      window.addEventListener("pointermove", pointermove);
      window.addEventListener("pointerup", pointerup);

      return () => {
        canvas.removeEventListener("pointerdown", pointerdown);
        window.removeEventListener("pointermove", pointermove);
        window.removeEventListener("pointerup", pointerup);
      };
    }, [nodesLocked]);

    /* ------------------------------------------------------------------ */
    /* Imperative API – for ActionButtons etc.                             */
    /* ------------------------------------------------------------------ */

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        const canvasSel = d3.select(canvasRef.current);
        canvasSel.transition().call(zoomRef.current.scaleBy, 1.5);
      },
      zoomOut: () => {
        const canvasSel = d3.select(canvasRef.current);
        canvasSel.transition().call(zoomRef.current.scaleBy, 0.75);
      },
      resetView: () => {
        const w = containerRef.current?.clientWidth || 800;
        const h = typeof height === "string" ? parseInt(height) : height;
        const identity = d3.zoomIdentity.translate(w / 4, h / 4).scale(0.8);
        d3.select(canvasRef.current)
          .transition()
          .call(zoomRef.current.transform, identity);
      },
      downloadSVG: () => {
        // Build an off-screen SVG containing the whole graph (not just viewport)
        const nodes = simulationRef.current?.nodes() || [];
        if (!nodes.length) return;

        const visibleLinks = graph.links.filter((l) => {
          const s = l.source?.id || l.source;
          const t = l.target?.id || l.target;
          return !hiddenIds.has(s) && !hiddenIds.has(t);
        });

        // Determine bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x);
          maxY = Math.max(maxY, n.y);
        });
        const pad = 50;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const width = maxX - minX;
        const heightSvg = maxY - minY;

        // Helper to derive node colours exactly as in canvas rendering
        const getNodeStyle = (n) => {
          const hue = maxGeneration ? ((n.generation || 0) / (maxGeneration + 1)) * 320 : 200;
          return {
            fill: `hsl(${hue}, 70%, 90%)`,
            stroke: `hsl(${hue}, 70%, 45%)`,
          };
        };

        const svgParts = [];
        svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${heightSvg}" viewBox="${minX} ${minY} ${width} ${heightSvg}">`);

        // Links
        visibleLinks.forEach((l) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          const src = nodes.find((n) => n.id === sId);
          const trg = nodes.find((n) => n.id === tId);
          if (!src || !trg) return;
          let dash = '';
          if (l.type && l.type.startsWith('ec')) dash = '2 4';
          else if (l.type === 'reaction') dash = '6 4';

          let stroke;
          if (l.type && l.type.startsWith('ec')) stroke = dark ? '#c4b5fd' : '#8B5CF6';
          else if (l.type === 'reaction') stroke = dark ? '#CBD5E1' : '#9CA3AF';
          else stroke = dark ? '#CBD5E1' : '#9CA3AF';

          svgParts.push(`<line x1="${src.x}" y1="${src.y}" x2="${trg.x}" y2="${trg.y}" stroke="${stroke}" stroke-width="1" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
        });

        // Nodes
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          const { fill, stroke } = getNodeStyle(n);
          if (n.type === 'compound') {
            svgParts.push(`<circle cx="${n.x}" cy="${n.y}" r="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
          } else if (n.type === 'ec') {
            svgParts.push(`<ellipse cx="${n.x}" cy="${n.y}" rx="24" ry="14" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
          } else {
            svgParts.push(`<rect x="${n.x - 20}" y="${n.y - 12}" width="40" height="24" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
          }
          // label
          let label = n.label ?? n.id;
          if (/reaction-/.test(n.type)) label = label.split('_')[0];
          const textColor = dark ? '#1E293B' : '#374151';
          svgParts.push(`<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${textColor}" font-family="Inter, sans-serif">${label}</text>`);
        });

        svgParts.push('</svg>');

        const blob = new Blob(svgParts, { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'metabolic-network.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      toggleLock: () => {
        setNodesLocked((prev) => {
          const next = !prev;
          const simNodes = simulationRef.current?.nodes?.() || [];

          if (next) {
            /* ------------- Locking: snap nodes to nearest grid ------------- */

            // Determine grid spacing based on largest node footprint
            const spacing = (() => {
              let max = 0;
              simNodes.forEach((n) => {
                let size;
                switch (n.type) {
                  case "compound":
                    size = 36; // diameter
                    break;
                  case "ec":
                    size = 48; // ellipse width
                    break;
                  default:
                    size = 40; // rectangle width
                }
                if (size > max) max = size;
              });
              return max || 40;
            })();

            // Helper to find nearest free grid coordinate
            const occupied = new Set();
            const findFreeCell = (gx, gy) => {
              if (!occupied.has(`${gx},${gy}`)) return [gx, gy];
              let r = 1;
              while (r < 100) {
                for (let dx = -r; dx <= r; dx++) {
                  for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
                    const key = `${gx + dx},${gy + dy}`;
                    if (!occupied.has(key)) return [gx + dx, gy + dy];
                  }
                }
                r++;
              }
              return [gx, gy]; // fallback
            };

            simNodes.forEach((n) => {
              const gx = Math.round(n.x / spacing);
              const gy = Math.round(n.y / spacing);
              const [fxg, fyg] = findFreeCell(gx, gy);
              occupied.add(`${fxg},${fyg}`);
              const snappedX = fxg * spacing;
              const snappedY = fyg * spacing;
              n.x = snappedX;
              n.y = snappedY;
              n.fx = snappedX;
              n.fy = snappedY;
            });

            simulationRef.current?.stop();
          } else {
            // Unlocking: allow movement again
            simNodes.forEach((n) => {
              delete n.fx;
              delete n.fy;
            });
            simulationRef.current?.alpha(0.7).restart();
          }

          draw(simNodes);
          return next;
        });
      },
      resetSpiral: () => {
        simulationRef.current?.stop();
        applySpiral(
          simulationRef.current.nodes(),
          (containerRef.current?.clientWidth || 800) / 2,
          (typeof height === "string" ? parseInt(height) : height) / 2,
          currentGeneration,
          true,
          false
        );
        simulationRef.current?.alpha(0.8).restart();
      },
      isLocked: nodesLocked,
      /**
       * Return a map of nodeId -> { x, y } capturing current positions.
       */
      getNodePositions: () => {
        const nodes = simulationRef.current?.nodes?.() || [];
        const positions = {};
        nodes.forEach((n) => {
          positions[n.id] = { x: n.x, y: n.y };
        });
        return positions;
      },
      /**
       * Restore node positions from a previously captured map.
       * The map should have the shape { nodeId: { x, y } }
       */
      setNodePositions: (positions) => {
        if (!positions) return;
        const nodes = simulationRef.current?.nodes?.() || [];
        nodes.forEach((n) => {
          const pos = positions[n.id];
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
            n.fx = pos.x;
            n.fy = pos.y;
          }
        });
        // Redraw canvas with updated positions
        draw(nodes);
      },
      /**
       * Rotate all visible nodes around the canvas centre by a given angle (radians, CCW).
       */
      rotateGraph: (angleRad) => {
        const nodes = simulationRef.current?.nodes?.() || [];
        if (!nodes.length) return;
        const cx = (containerRef.current?.clientWidth || 800) / 2;
        const cy = (typeof height === 'string' ? parseInt(height) : height) / 2;
        nodes.forEach((n) => {
          const dx = n.x - cx;
          const dy = n.y - cy;
          const rX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + cx;
          const rY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + cy;
          n.x = rX;
          n.y = rY;
          if (n.fx !== undefined) {
            n.fx = rX;
            n.fy = rY;
          }
        });
        draw(nodes);
      },
    }));

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    return (
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", cursor: 'grab' }}
        />

        {/* Lock Button */}
        <button
          onClick={() => setNodesLocked((p) => !p)}
          className={`absolute bottom-4 left-4 p-2 rounded-full z-10 shadow-md hover:shadow-lg transition-all ${
             nodesLocked ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
           }`}
          title={nodesLocked ? "Unlock node positions" : "Lock node positions"}
        >
          {nodesLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
        </button>
      </div>
    );
  }
);

export default GraphRendererCanvas; 