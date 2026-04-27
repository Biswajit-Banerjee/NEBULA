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
import { processData, applyHierarchicalLayout, SUB_COL_GAP, GEN_GAP, ROW_SPACING } from "./utils/graphProcessing";
import { getSchemeColor, getTypeColor } from "./utils/colorSchemes";
import { ThemeContext } from "../ThemeProvider/ThemeProvider";
import NodeInfoPanel from "./NodeInfoPanel";



const GraphRendererCanvas = forwardRef(
  (
    {
      data,
      currentGeneration,
      minVisibleGeneration = 0,
      maxGeneration,
      containerRef,
      height = 600,
      isFullscreen,
      pairColorMap = {},
      showOverlay = false,
      edgeOpacity = 0.5,
      spacingScale = 1.0,
      colorMode = 'generation',
      colorScheme = 'viridis',
      bgColor = '',
      gridColor = '',
    },
    ref
  ) => {
    const { dark } = useContext(ThemeContext);
    const canvasRef = useRef(null);
    const nodesRef = useRef([]); // static node array (no physics)
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const [collapsedRoots, setCollapsedRoots] = useState(new Set()); // reaction-side nodes acting as collapse pivots
    const [hiddenIds, setHiddenIds] = useState(new Set());
    const [ctrlHeld, setCtrlHeld] = useState(false);
    const positionCacheRef = useRef({}); // persistent nodeId → {x,y}
    const dirtyRef = useRef(false);      // rAF batching flag
    const rafIdRef = useRef(null);       // rAF handle
    const hoveredNodeRef = useRef(null); // id of node under cursor (for edge highlight)
    const pinnedNodesRef = useRef(new Set()); // pinned node IDs (click-to-hold)
    const [selectedNodes, setSelectedNodes] = useState([]);
    const drawRef = useRef(null);        // always points to latest draw fn
    const syncSelectionRef = useRef(null); // always points to latest syncSelection
    const needsFitRef = useRef(true);    // auto-fit view on first layout / new data
    const prevDataRef = useRef(null);    // track data identity for auto-fit
    const genMapRef = useRef([]);        // compact generation mapping from layout

    // Sync pinnedNodesRef → selectedNodes state so NodeInfoPanel re-renders
    const syncSelection = useCallback(() => {
      const nodes = nodesRef.current;
      const pinned = pinnedNodesRef.current;
      if (pinned.size === 0) { setSelectedNodes([]); return; }
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const sel = [];
      pinned.forEach(id => { const n = nodeMap.get(id); if (n) sel.push(n); });
      setSelectedNodes(sel);
    }, []);

    /* ------------------------------------------------------------------ */
    /* Helpers                                                            */
    /* ------------------------------------------------------------------ */

    const computeHiddenNodes = useCallback(
      (nodes, links, roots) => {
        if (!roots || roots.size === 0) return new Set();

        const toHide = new Set();
        // O(1) lookup map instead of nodes.find()
        const nodeMap = new Map(nodes.map((n) => [n.id, n]));
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

              const nbrNode = nodeMap.get(nbr);
              if (!nbrNode) return;

              // Continue only if direction matches relative position in reaction pair
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

    // Compute degree map from current graph for the info panel
    const degreeMap = React.useMemo(() => {
      const m = new Map();
      (graph.links || []).forEach(l => {
        const s = l.source?.id || l.source;
        const t = l.target?.id || l.target;
        m.set(s, (m.get(s) || 0) + 1);
        m.set(t, (m.get(t) || 0) + 1);
      });
      return m;
    }, [graph]);

    // Deselect a single node from the info panel
    const handleDeselectNode = useCallback((nodeId) => {
      pinnedNodesRef.current.delete(nodeId);
      syncSelection();
      drawRef.current?.(nodesRef.current);
    }, [syncSelection]);

    /* ------------------------------------------------------------------ */
    /* Build/Update graph when raw data or generation changes              */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
      if (!Array.isArray(data)) return;
      const processed = processData(data, currentGeneration, minVisibleGeneration);
      setGraph(processed);
    }, [data, currentGeneration, minVisibleGeneration]);

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
      // Clear with background color
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      ctx.restore();

      ctx.save();
      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // ── O(1) node lookup map for all link/overlay drawing ──
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // ── Visible bounds in world coords (for viewport culling) ──
      const CULL_MARGIN = 60; // px margin around viewport
      const viewMinX = (-t.x) / t.k - CULL_MARGIN;
      const viewMinY = (-t.y) / t.k - CULL_MARGIN;
      const viewMaxX = (-t.x + w) / t.k + CULL_MARGIN;
      const viewMaxY = (-t.y + h) / t.k + CULL_MARGIN;

      const inView = (x, y) =>
        x >= viewMinX && x <= viewMaxX && y >= viewMinY && y <= viewMaxY;

      /* ---------------------------------------------------------- */
      /* Grid overlay – batched into 2 draw calls                  */
      /* ---------------------------------------------------------- */
      const nodeGridSize = 48; // constant (largest node = EC ellipse)
      const gridSpacing = nodeGridSize;
      const effectiveGridColor = gridColor
        ? gridColor + '18' // user color with ~10% opacity (hex alpha)
        : dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

      ctx.save();
      ctx.strokeStyle = effectiveGridColor;
      ctx.lineWidth = 1 / t.k;

      const startX = Math.floor(viewMinX / gridSpacing) * gridSpacing;
      const startY = Math.floor(viewMinY / gridSpacing) * gridSpacing;

      // Batch vertical lines
      ctx.beginPath();
      for (let x = startX; x <= viewMaxX; x += gridSpacing) {
        ctx.moveTo(x, viewMinY);
        ctx.lineTo(x, viewMaxY);
      }
      ctx.stroke();

      // Batch horizontal lines
      ctx.beginPath();
      for (let y = startY; y <= viewMaxY; y += gridSpacing) {
        ctx.moveTo(viewMinX, y);
        ctx.lineTo(viewMaxX, y);
      }
      ctx.stroke();
      ctx.restore();

      /* ---------------------------------------------------------- */
      /* Generation column labels (no background stripes)           */
      /* ---------------------------------------------------------- */
      if (genMapRef.current.length > 0) {
        ctx.save();
        const colLabelColor = dark ? "rgba(148,163,184,0.45)" : "rgba(100,116,139,0.35)";
        ctx.font = `bold 9px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const scaledGap = SUB_COL_GAP * spacingScale;
        const scaledGenGap = GEN_GAP * spacingScale;
        const bandWidth = 4 * scaledGap + scaledGenGap;
        genMapRef.current.forEach(({ gen, idx }) => {
          // X center using compact index (skips empty generations)
          const bandX = idx * bandWidth;
          ctx.fillStyle = colLabelColor;
          const label = gen === 0 ? "Seed" : `Gen ${gen}`;
          ctx.fillText(label, bandX, viewMinY + 6);
        });
        ctx.restore();
      }

      // Node size constants (used for edge clipping & node drawing)
      const R_COMPOUND = 12;
      const EC_RX = 18, EC_RY = 10;
      const RECT_W = 30, RECT_H = 18, RECT_R = 3;

      // Compute point on node surface in direction (dx, dy) from center
      const surfacePoint = (node, dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) return { x: node.x, y: node.y };
        const ux = dx / d, uy = dy / d;
        let r;
        if (node.type === 'compound') {
          r = R_COMPOUND;
        } else if (node.type === 'ec') {
          // Ellipse polar radius: r = rx*ry / sqrt((ry*cos)^2 + (rx*sin)^2)
          r = (EC_RX * EC_RY) / Math.sqrt((EC_RY * ux) ** 2 + (EC_RX * uy) ** 2);
        } else {
          // Rectangle: ray-box intersection
          const hw = RECT_W / 2, hh = RECT_H / 2;
          const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
          const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
          r = Math.min(tx, ty);
        }
        return { x: node.x + ux * r, y: node.y + uy * r };
      };

      /* ---------------------------------------------------------- */
      /* Path overlay – per node & edge highlight                   */
      /* ---------------------------------------------------------- */

      if (showOverlay) {
        // Highlight edges first (so nodes overlay edges)
        graph.links.forEach((l) => {
          if (!l.pairIndices || l.pairIndices.length === 0) return;
          const srcId = l.source?.id || l.source;
          const trgId = l.target?.id || l.target;
          if (hiddenIds.has(srcId) || hiddenIds.has(trgId)) return;
          const src = nodeMap.get(srcId);
          const trg = nodeMap.get(trgId);
          if (!src || !trg) return;
          if (!inView(src.x, src.y) && !inView(trg.x, trg.y)) return;

          l.pairIndices.forEach((pi) => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(6 / t.k, 3);
            ctx.lineCap = "round";
            const odx = trg.x - src.x, ody = trg.y - src.y;
            const oSrc = surfacePoint(src, odx, ody);
            const oTrg = surfacePoint(trg, -odx, -ody);
            ctx.beginPath();
            ctx.moveTo(oSrc.x, oSrc.y);
            ctx.lineTo(oTrg.x, oTrg.y);
            ctx.stroke();
            ctx.restore();
          });
        });

        // Highlight nodes
        nodes.forEach((n) => {
          if (!n.pairIndices || n.pairIndices.length === 0) return;
          if (hiddenIds.has(n.id)) return;
          if (!inView(n.x, n.y)) return;

          n.pairIndices.forEach((pi) => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(4 / t.k, 2);
            const pad = 3;
            switch (n.type) {
              case "compound":
                ctx.beginPath();
                ctx.arc(n.x, n.y, 12 + pad, 0, Math.PI * 2);
                ctx.stroke();
                break;
              case "ec":
                ctx.beginPath();
                ctx.ellipse(n.x, n.y, 18 + pad, 10 + pad, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
              default: {
                const rx = n.x - 15 - pad;
                const ry = n.y - 9 - pad;
                const rw = 30 + pad * 2;
                const rh = 18 + pad * 2;
                ctx.beginPath();
                ctx.roundRect(rx, ry, rw, rh, 5);
                ctx.stroke();
                break;
              }
            }
            ctx.restore();
          });
        });
      }

      /* ---------------------------------------------------------- */
      /* Draw links – adaptive opacity, bezier curves, hover-aware */
      /* ---------------------------------------------------------- */

      // Build per-node link index for hover highlighting
      const linksByNode = new Map();
      const visibleEdges = [];
      graph.links.forEach((l) => {
        const srcId = l.source?.id || l.source;
        const trgId = l.target?.id || l.target;
        if (hiddenIds.has(srcId) || hiddenIds.has(trgId)) return;
        const src = nodeMap.get(srcId);
        const trg = nodeMap.get(trgId);
        if (!src || !trg) return;
        if (!inView(src.x, src.y) && !inView(trg.x, trg.y)) return;
        const idx = visibleEdges.length;
        visibleEdges.push({ src, trg, link: l });
        if (!linksByNode.has(srcId)) linksByNode.set(srcId, []);
        if (!linksByNode.has(trgId)) linksByNode.set(trgId, []);
        linksByNode.get(srcId).push(idx);
        linksByNode.get(trgId).push(idx);
      });

      const edgeCount = visibleEdges.length;
      const hovId = hoveredNodeRef.current;
      const pinned = pinnedNodesRef.current;

      // Highlighted set = union of hovered node + all pinned nodes
      const highlightIds = new Set(pinned);
      if (hovId != null && nodeMap.has(hovId)) highlightIds.add(hovId);
      const hasHighlight = highlightIds.size > 0;

      // Build set of edge indices connected to ANY highlighted node
      const highlightedEdgeSet = new Set();
      if (hasHighlight) {
        highlightIds.forEach((nid) => {
          (linksByNode.get(nid) || []).forEach((idx) => highlightedEdgeSet.add(idx));
        });
      }

      // Adaptive base opacity scaled by user edgeOpacity setting (0–1)
      const autoAlpha = edgeCount <= 50
        ? 0.35
        : edgeCount <= 500
          ? 0.35 - (edgeCount - 50) / 450 * 0.27
          : Math.max(0.03, 0.08 - (edgeCount - 500) / 3000 * 0.05);
      const baseAlpha = autoAlpha * (edgeOpacity * 2); // edgeOpacity 0.5 = default

      const dimAlpha = hasHighlight ? Math.min(baseAlpha * 0.25, 0.04) : baseAlpha;
      const brightAlpha = 0.85;

      ctx.lineCap = "round";

      // Draw dim edges first (batch), then bright highlighted edges on top
      for (let pass = 0; pass < 2; pass++) {
        visibleEdges.forEach(({ src, trg, link }, idx) => {
          const isBright = hasHighlight && highlightedEdgeSet.has(idx);
          if (pass === 0 && isBright) return;   // skip bright edges on dim pass
          if (pass === 1 && !isBright) return;  // skip dim edges on bright pass
          if (pass === 1 && !hasHighlight) return;

          const alpha = isBright ? brightAlpha : dimAlpha;
          const lType = link.type;

          // Edge color by type
          let r, g, b;
          if (lType && lType.startsWith("ec")) {
            r = dark ? 196 : 139; g = dark ? 181 : 92; b = dark ? 253 : 246;
          } else if (lType === "reaction") {
            r = dark ? 203 : 156; g = dark ? 213 : 163; b = dark ? 225 : 175;
          } else {
            r = dark ? 148 : 120; g = dark ? 163 : 140; b = dark ? 184 : 160;
          }

          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = isBright
            ? Math.max(1.5 / t.k, 1)
            : Math.max(0.6 / t.k, 0.4);

          // Dash convention:  solid = substrate/product,  dashed = reaction,  dotted = EC
          if (lType && lType.startsWith("ec")) {
            ctx.setLineDash([2 / t.k, 3 / t.k]); // dotted
          } else if (lType === "reaction") {
            ctx.setLineDash([5 / t.k, 3 / t.k]); // dashed
          } else {
            ctx.setLineDash([]); // solid
          }

          // Gentle bezier curve — clip at node surface
          const dx = trg.x - src.x;
          const dy = trg.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const curvature = Math.min(dist * 0.12, 30);
          const mx = (src.x + trg.x) / 2;
          const my = (src.y + trg.y) / 2;
          const nx = dist > 0 ? -dy / dist : 0;
          const ny = dist > 0 ? dx / dist : 0;
          const cpx = mx + nx * curvature;
          const cpy = my + ny * curvature;

          // Tangent at t=0 points from src toward control; at t=1 from control toward trg
          const s0 = surfacePoint(src, cpx - src.x, cpy - src.y);
          const s1 = surfacePoint(trg, cpx - trg.x, cpy - trg.y);

          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y);
          ctx.quadraticCurveTo(cpx, cpy, s1.x, s1.y);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      /* ---------------------------------------------------------- */
      /* Draw nodes – compact, clean, hover-aware                  */
      /* ---------------------------------------------------------- */

      // Compute node degrees for 'degree' color mode
      const degreeMap = new Map();
      if (colorMode === 'degree') {
        graph.links.forEach((l) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          degreeMap.set(sId, (degreeMap.get(sId) || 0) + 1);
          degreeMap.set(tId, (degreeMap.get(tId) || 0) + 1);
        });
      }
      const maxDeg = degreeMap.size > 0 ? Math.max(1, ...degreeMap.values()) : 1;

      // Unified node color function
      // Generation & degree use a 0–100 normalized bucket scale:
      //   - With few generations (e.g. 5), each maps to a wide bucket → discrete colors
      //   - With many generations (e.g. 80), buckets are narrow → near-continuous gradient
      const MAX_BUCKET = 100;
      const nodeColor = (n) => {
        if (colorMode === 'type') {
          return getTypeColor(n.type, dark);
        }
        if (colorMode === 'degree') {
          const deg = degreeMap.get(n.id) || 0;
          // Normalize to 0–100 bucket, then to 0–1
          const bucket = Math.round((deg / maxDeg) * MAX_BUCKET);
          const t = bucket / MAX_BUCKET;
          return getSchemeColor(colorScheme, t, dark);
        }
        // 'generation' (default) — map gen to 0–100 bucket scale
        const gen = n.generation || 0;
        const bucket = maxGeneration > 0
          ? Math.round((gen / maxGeneration) * MAX_BUCKET)
          : 0;
        const t = bucket / MAX_BUCKET;
        return getSchemeColor(colorScheme, t, dark);
      };

      // (Node sizes defined above before edge drawing)

      nodes.forEach((n) => {
        if (hiddenIds.has(n.id)) return;
        if (!inView(n.x, n.y)) return;

        const isHighlighted = highlightIds.has(n.id);
        const { fill, stroke } = nodeColor(n);

        // Highlighted node (hovered or pinned) gets a soft glow ring
        if (isHighlighted) {
          ctx.save();
          ctx.strokeStyle = dark ? "rgba(96,165,250,0.6)" : "rgba(59,130,246,0.5)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (n.type === "compound") ctx.arc(n.x, n.y, R_COMPOUND + 4, 0, Math.PI * 2);
          else if (n.type === "ec") ctx.ellipse(n.x, n.y, EC_RX + 4, EC_RY + 4, 0, 0, Math.PI * 2);
          else {
            const rx = n.x - RECT_W / 2 - 3, ry = n.y - RECT_H / 2 - 3;
            ctx.roundRect(rx, ry, RECT_W + 6, RECT_H + 6, RECT_R + 2);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;

        switch (n.type) {
          case "compound":
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(n.x, n.y, R_COMPOUND, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
          case "ec":
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.ellipse(n.x, n.y, EC_RX, EC_RY, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
          default: {
            ctx.lineWidth = collapsedRoots.has(n.id) ? 2.5 : 1.2;
            const rx = n.x - RECT_W / 2;
            const ry = n.y - RECT_H / 2;
            ctx.beginPath();
            ctx.roundRect(rx, ry, RECT_W, RECT_H, RECT_R);
            ctx.fill();
            ctx.stroke();
            break;
          }
        }
      });

      /* ---------------------------------------------------------- */
      /* Draw labels – progressive: only when zoomed in enough      */
      /* ---------------------------------------------------------- */
      if (t.k >= 0.45) {
        const fontSize = Math.max(5, Math.min(7, 6 / t.k * t.k));
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          if (!inView(n.x, n.y)) return;
          let label = n.label ?? n.id;
          if (/reaction-/.test(n.type)) label = label.split("_")[0];

          ctx.fillStyle = dark ? "#CBD5E1" : "#374151";
          ctx.fillText(label, n.x, n.y);
        });
      }

      ctx.restore();
    }, [dark, graph, hiddenIds, maxGeneration, collapsedRoots, showOverlay, pairColorMap, edgeOpacity, spacingScale, colorMode, colorScheme, bgColor, gridColor]);

    // Keep refs always pointing to the latest functions (fixes stale closure in event handlers)
    drawRef.current = draw;
    syncSelectionRef.current = syncSelection;

    // Prune stale hover/pinned state when graph changes (keep valid pins)
    useEffect(() => {
      hoveredNodeRef.current = null;
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      const pinned = pinnedNodesRef.current;
      for (const id of pinned) {
        if (!nodeIds.has(id)) pinned.delete(id);
      }
      syncSelection();
    }, [graph, syncSelection]);

    // Use effect to redraw when overlay toggled or graph updated
    useEffect(() => {
      draw(graph.nodes);
    }, [showOverlay, graph, draw]);

    useEffect(() => {
      if (!graph.nodes.length) return;

      const centerY = (typeof height === "string" ? parseInt(height) : height) / 2;

      // Deep copy nodes so we can mutate x/y without affecting state
      const nodesCopy = graph.nodes.map((n) => ({ ...n }));
      const linksCopy = graph.links.map((l) => ({ ...l }));

      // Remove hidden nodes
      const visibleNodes = nodesCopy.filter((n) => !hiddenIds.has(n.id));
      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

      // Visible links corresponding to visible nodes
      const visibleLinks = linksCopy.filter((l) => {
        const sId = l.source?.id || l.source;
        const tId = l.target?.id || l.target;
        return visibleNodeIds.has(sId) && visibleNodeIds.has(tId);
      });

      // Snapshot current positions into the persistent cache
      nodesRef.current.forEach((n) => {
        positionCacheRef.current[n.id] = { x: n.x, y: n.y };
      });

      // Static hierarchical layout: assigns x/y directly, no physics
      const layoutResult = applyHierarchicalLayout(
        visibleNodes,
        centerY,
        positionCacheRef.current,
        false,
        visibleLinks,
        spacingScale
      );
      genMapRef.current = layoutResult.genMap || [];

      // Update cache with final positions
      visibleNodes.forEach((n) => {
        positionCacheRef.current[n.id] = { x: n.x, y: n.y };
      });

      // Store nodes for drawing and interaction
      nodesRef.current = visibleNodes;

      // Auto-fit view when data changes (new search) or first layout
      if (data !== prevDataRef.current) {
        prevDataRef.current = data;
        needsFitRef.current = true;
      }

      if (needsFitRef.current && visibleNodes.length > 0 && canvasRef.current && zoomRef.current) {
        needsFitRef.current = false;
        const canvas = canvasRef.current;
        const w = canvas.clientWidth || 800;
        const h = canvas.clientHeight || 600;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        visibleNodes.forEach((n) => {
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x);
          maxY = Math.max(maxY, n.y);
        });
        const pad = 60;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const graphH = maxY - minY || 1;
        // Scale to fit vertically; let graph extend rightward naturally
        const scale = Math.min(h / graphH, 1.5);
        // Gen 0 at 5% from left edge, vertically centered
        const tx = w * 0.05 - minX * scale;
        const ty = (h - graphH * scale) / 2 - minY * scale;
        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
        transformRef.current = t;
        d3.select(canvas).call(zoomRef.current.transform, t);
      }

      // Draw immediately (no simulation ticks needed)
      draw(visibleNodes);

      return () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      };
    }, [graph, hiddenIds, currentGeneration, height, containerRef, draw, spacingScale, data]);

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
        drawRef.current?.(nodesRef.current);
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
          const hitNode = nodesRef.current.find((n) => {
            const radius = n.type === 'compound' ? 18 : n.type === 'ec' ? 24 : 20;
            return (mx - n.x) ** 2 + (my - n.y) ** 2 <= radius ** 2;
          });
          return !hitNode; // allow pan if not clicking on node
        })
        .on("zoom", (ev) => {
          transformRef.current = ev.transform;
          drawRef.current?.(nodesRef.current);
        });
      d3.select(canvas).call(zoom);
      zoomRef.current = zoom;

      return () => {
        window.removeEventListener("resize", handleResize);
        d3.select(canvas).on('.zoom', null);
      };
    }, [containerRef, height, isFullscreen]);

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
    /* Pointer interaction – collapse, pin-highlight, drag, hover         */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let dragging = null;
      let didDrag = false; // distinguish drag from click

      // ── Hit-test helper ──
      const hitTest = (mx, my) => {
        const nodes = nodesRef.current;
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          if ((mx - n.x) ** 2 + (my - n.y) ** 2 < 300) return n;
        }
        return null;
      };

      const worldCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        return {
          mx: (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k,
          my: (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k,
        };
      };

      // ── Pointer down: start drag ──
      const pointerdown = (e) => {
        const { mx, my } = worldCoords(e);
        const node = hitTest(mx, my);
        if (node) {
          dragging = node;
          didDrag = false;
          canvas.style.cursor = "grabbing";
        }
      };

      // ── Pointer move: drag or hover ──
      const pointermove = (e) => {
        const { mx, my } = worldCoords(e);

        if (dragging) {
          dragging.x = mx;
          dragging.y = my;
          didDrag = true;
          drawRef.current?.(nodesRef.current);
          return;
        }

        // Hover detection
        const hit = hitTest(mx, my);
        const found = hit ? hit.id : null;
        if (found !== hoveredNodeRef.current) {
          hoveredNodeRef.current = found;
          canvas.style.cursor = found ? 'pointer' : 'grab';
          drawRef.current?.(nodesRef.current);
        }
      };

      // ── Pointer up: finish drag + enforce no-overlap ──
      const pointerup = () => {
        if (dragging) {
          // Hard collision enforcement: push away from any overlapping neighbor
          const MIN_DIST = 88; // 2 × collision radius
          for (const other of nodesRef.current) {
            if (other === dragging) continue;
            const dx = dragging.x - other.x;
            const dy = dragging.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST && dist > 0) {
              const push = (MIN_DIST - dist) / 2 + 1;
              const nx = dx / dist;
              const ny = dy / dist;
              dragging.x += nx * push;
              dragging.y += ny * push;
            }
          }
          positionCacheRef.current[dragging.id] = { x: dragging.x, y: dragging.y };
          drawRef.current?.(nodesRef.current);
          dragging = null;
          canvas.style.cursor = 'grab';
        }
      };

      // ── Click: Ctrl+click = collapse, plain click = pin highlight, Shift+click = multi-pin ──
      const handleClick = (evt) => {
        if (didDrag) { didDrag = false; return; } // was a drag, not a click

        const { mx, my } = worldCoords(evt);
        const hit = hitTest(mx, my);
        // Ctrl+click on reaction node = toggle collapse
        if (evt.ctrlKey && hit && /reaction-/.test(hit.type)) {
          setCollapsedRoots((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(hit.id)) newSet.delete(hit.id);
            else newSet.add(hit.id);
            return newSet;
          });
          return;
        }

        // Shift+click on node = toggle it in pinned set (multi-select)
        if (evt.shiftKey && hit) {
          const pinned = pinnedNodesRef.current;
          if (pinned.has(hit.id)) {
            pinned.delete(hit.id);
          } else {
            pinned.add(hit.id);
          }
          drawRef.current?.(nodesRef.current);
          syncSelectionRef.current?.();
          return;
        }

        // Plain click on node = pin only that node (replace selection)
        if (hit && !evt.ctrlKey) {
          const pinned = pinnedNodesRef.current;
          if (pinned.size === 1 && pinned.has(hit.id)) {
            pinned.clear();
          } else {
            pinned.clear();
            pinned.add(hit.id);
          }
          drawRef.current?.(nodesRef.current);
          syncSelectionRef.current?.();
          return;
        }

        // Click on empty space = clear all pins
        if (!hit) {
          pinnedNodesRef.current.clear();
          drawRef.current?.(nodesRef.current);
          syncSelectionRef.current?.();
        }
      };

      canvas.addEventListener("pointerdown", pointerdown, { passive: false });
      canvas.addEventListener("click", handleClick);
      window.addEventListener("pointermove", pointermove);
      window.addEventListener("pointerup", pointerup);

      return () => {
        canvas.removeEventListener("pointerdown", pointerdown);
        canvas.removeEventListener("click", handleClick);
        window.removeEventListener("pointermove", pointermove);
        window.removeEventListener("pointerup", pointerup);
      };
    }, []);

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
        const canvas = canvasRef.current;
        if (!canvas || !zoomRef.current) return;
        const nodes = nodesRef.current;
        const w = canvas.clientWidth || 800;
        const h = canvas.clientHeight || 600;
        if (!nodes.length) {
          d3.select(canvas).transition().call(zoomRef.current.transform, d3.zoomIdentity);
          return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
        });
        const pad = 60;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const graphH = maxY - minY || 1;
        const scale = Math.min(h / graphH, 1.5);
        const tx = w * 0.05 - minX * scale;
        const ty = (h - graphH * scale) / 2 - minY * scale;
        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(canvas).transition().duration(400).call(zoomRef.current.transform, t);
      },
      downloadSVG: () => {
        // Build an off-screen SVG containing the whole graph (not just viewport)
        const nodes = nodesRef.current;
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

        // Links – use Map for O(1) lookups
        const svgNodeMap = new Map(nodes.map((n) => [n.id, n]));
        visibleLinks.forEach((l) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          const src = svgNodeMap.get(sId);
          const trg = svgNodeMap.get(tId);
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
      resetLayout: () => {
        const centerY = (typeof height === "string" ? parseInt(height) : height) / 2;
        positionCacheRef.current = {};
        const nodes = nodesRef.current;
        // Clear existing positions so the layout function assigns fresh DAG positions
        nodes.forEach((n) => { n.x = undefined; n.y = undefined; n.fx = undefined; n.fy = undefined; });
        const result = applyHierarchicalLayout(nodes, centerY, {}, false, graph.links, spacingScale);
        genMapRef.current = result.genMap || [];
        nodes.forEach((n) => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
        draw(nodes);
      },
      resetSpiral: () => {
        const centerY = (typeof height === "string" ? parseInt(height) : height) / 2;
        positionCacheRef.current = {};
        const nodes = nodesRef.current;
        // Clear existing positions so the layout function assigns fresh DAG positions
        nodes.forEach((n) => { n.x = undefined; n.y = undefined; n.fx = undefined; n.fy = undefined; });
        const result = applyHierarchicalLayout(nodes, centerY, {}, false, graph.links, spacingScale);
        genMapRef.current = result.genMap || [];
        nodes.forEach((n) => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
        draw(nodes);
      },
      /**
       * Return a map of nodeId -> { x, y } capturing current positions.
       */
      getNodePositions: () => {
        const nodes = nodesRef.current;
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
        const nodes = nodesRef.current;
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
       * One-shot force simulation: runs to convergence then stops.
       *
       * Forces (by priority):
       *  1. Hard exclusion zone — each node has a circle of empty space
       *     matching its rendered size that nothing can penetrate.
       *  2. Same generation  → gentle attract
       *  3. Diff generation  → gentle repel
       *  4. Same node type   → gentle attract
       *  5. Diff node type   → gentle repel
       *  6. Edge tension     → spring pull along edges
       */
      tightenEdges: () => {
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        /* ── Node exclusion radii: 300% of rendered size ── */
        const nodeRadius = (n) => {
          if (n.type === 'compound') return 36;           // 12 * 3
          if (n.type === 'ec')       return 54;           // 18 * 3
          return 51;                                      // ~17 * 3
        };

        /* ── Tunables ── */
        const GEN_ATTRACT    = 0.0008;  // same-generation pull  (very gentle)
        const GEN_REPEL      = 0.0012;  // diff-generation push  (very gentle)
        const TYPE_ATTRACT   = 0.0004;  // same-type pull
        const TYPE_REPEL     = 0.0006;  // diff-type push
        const EDGE_TENSION   = 0.04;    // spring along edges
        const INTERACT_RANGE = 250;     // max range for gen/type forces
        const DAMPING        = 0.80;    // velocity damping per tick
        const MAX_ITERS      = 500;
        const CONVERGE       = 0.15;    // stop when max disp < this

        /* ── Adjacency ── */
        const edgeList = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        (graph.links || []).forEach(l => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          if (nodeMap.has(sId) && nodeMap.has(tId)) edgeList.push([sId, tId]);
        });

        const visible = nodes.filter(n => !hiddenIds.has(n.id));
        const N = visible.length;
        if (N === 0) return;

        /* ── Pre-compute radii ── */
        const radii = visible.map(n => nodeRadius(n));

        /* ── Index maps for fast lookup ── */
        const idxOf = new Map();
        visible.forEach((n, i) => idxOf.set(n.id, i));

        /* ── Velocity buffers ── */
        const vx = new Float64Array(N);
        const vy = new Float64Array(N);

        /* ── Normalise node type ── */
        const ntype = (n) => {
          if (n.type === 'reaction-in' || n.type === 'reaction-out') return 'reaction';
          return n.type || 'unknown';
        };

        for (let iter = 0; iter < MAX_ITERS; iter++) {
          const fx = new Float64Array(N);
          const fy = new Float64Array(N);

          /* Pairwise forces */
          for (let i = 0; i < N; i++) {
            const ni = visible[i];
            const ri = radii[i];
            for (let j = i + 1; j < N; j++) {
              const nj = visible[j];
              const rj = radii[j];
              const ex = ni.x - nj.x;
              const ey = ni.y - nj.y;
              const d2 = ex * ex + ey * ey;
              const dist = Math.sqrt(d2) || 0.1;
              const ux = ex / dist;
              const uy = ey / dist;

              /* 1) HARD exclusion — sum of radii is the minimum allowed distance */
              const minDist = ri + rj;
              if (dist < minDist) {
                // Very strong push: proportional to overlap depth
                const overlap = minDist - dist;
                const pushF = overlap * 2.0;   // strong multiplier
                fx[i] += ux * pushF;  fy[i] += uy * pushF;
                fx[j] -= ux * pushF;  fy[j] -= uy * pushF;
              }

              if (dist > INTERACT_RANGE) continue;

              /* 2-5) Soft generation & type forces */
              let force = 0;

              const sameGen = ni.generation === nj.generation;
              if (sameGen) {
                force -= GEN_ATTRACT * dist;
              } else {
                force += (GEN_REPEL * minDist * minDist) / (d2 + 1);
              }

              const sameType = ntype(ni) === ntype(nj);
              if (sameType) {
                force -= TYPE_ATTRACT * dist;
              } else {
                force += (TYPE_REPEL * minDist * minDist) / (d2 + 1);
              }

              fx[i] += ux * force;  fy[i] += uy * force;
              fx[j] -= ux * force;  fy[j] -= uy * force;
            }
          }

          /* 6) Edge tension — spring pull */
          edgeList.forEach(([sId, tId]) => {
            const si = idxOf.get(sId);
            const ti = idxOf.get(tId);
            if (si === undefined || ti === undefined) return;
            const ns = visible[si], nt = visible[ti];
            const ex = nt.x - ns.x;
            const ey = nt.y - ns.y;
            const dist = Math.sqrt(ex * ex + ey * ey) || 0.1;
            // Only pull if beyond the sum of radii (don't fight exclusion)
            const minE = radii[si] + radii[ti];
            if (dist > minE) {
              const pull = (dist - minE) * EDGE_TENSION / dist;
              fx[si] += ex * pull;  fy[si] += ey * pull;
              fx[ti] -= ex * pull;  fy[ti] -= ey * pull;
            }
          });

          /* Apply forces → velocity → position */
          let maxDisp = 0;
          for (let i = 0; i < N; i++) {
            vx[i] = (vx[i] + fx[i]) * DAMPING;
            vy[i] = (vy[i] + fy[i]) * DAMPING;
            const disp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            const maxStep = 6;
            if (disp > maxStep) {
              vx[i] *= maxStep / disp;
              vy[i] *= maxStep / disp;
            }
            visible[i].x += vx[i];
            visible[i].y += vy[i];
            if (disp > maxDisp) maxDisp = disp;
          }

          if (maxDisp < CONVERGE) break;
        }

        /* Post-pass: resolve any remaining overlaps deterministically */
        for (let pass = 0; pass < 50; pass++) {
          let anyOverlap = false;
          for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
              const ni = visible[i], nj = visible[j];
              const ex = ni.x - nj.x;
              const ey = ni.y - nj.y;
              const dist = Math.sqrt(ex * ex + ey * ey) || 0.1;
              const minD = radii[i] + radii[j];
              if (dist < minD) {
                anyOverlap = true;
                const push = (minD - dist) / 2 + 0.5;
                const ux = ex / dist;
                const uy = ey / dist;
                ni.x += ux * push;  ni.y += uy * push;
                nj.x -= ux * push;  nj.y -= uy * push;
              }
            }
          }
          if (!anyOverlap) break;
        }

        // Persist & redraw
        visible.forEach(n => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
        draw(nodes);
      },
      /**
       * Rotate all visible nodes around the canvas centre by a given angle (radians, CCW).
       */
      rotateGraph: (angleRad) => {
        const nodes = nodesRef.current;
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
        <NodeInfoPanel
          selectedNodes={selectedNodes}
          degreeMap={degreeMap}
          onDeselectNode={handleDeselectNode}
        />
      </div>
    );
  }
);

export default GraphRendererCanvas; 