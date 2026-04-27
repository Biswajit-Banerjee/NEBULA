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
import { processSimpleGraph, pruneSimpleGraph } from "./utils/graphProcessing";
import { applySimpleLayout } from "./utils/layout";
import { getSchemeColor, getTypeColor } from "../NetworkViewer2D/utils/colorSchemes";
import { ThemeContext } from "../ThemeProvider/ThemeProvider";
import NodeInfoPanel from "../NetworkViewer2D/NodeInfoPanel";
import SmilesDrawer from "smiles-drawer";

const R_COMPOUND = 14;

const GraphCanvas = forwardRef(
  (
    {
      data,
      containerRef,
      height = 600,
      isFullscreen,
      pairColorMap = {},
      showOverlay = false,
      edgeOpacity = 0.5,
      spacingScale = 1.0,
      colorMode = "generation",
      colorScheme = "viridis",
      bgColor = "",
      gridColor = "",
      edgeStyle = "curved",
      pruneEdges = true,
      nodeDisplay = "circle",
      keggLayout = false,
      keggOrthoEdges = false,
      backboneMatchIds = null,
    },
    ref
  ) => {
    const { dark } = useContext(ThemeContext);
    const canvasRef = useRef(null);
    const nodesRef = useRef([]);
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const positionCacheRef = useRef({});
    const hoveredNodeRef = useRef(null);
    const pinnedNodesRef = useRef(new Set());
    const [selectedNodes, setSelectedNodes] = useState([]);
    const drawRef = useRef(null);
    const syncSelectionRef = useRef(null);
    const needsFitRef = useRef(true);
    const prevDataRef = useRef(null);
    const smilesDataRef = useRef({});       // { compoundId: smilesString }
    const structTexRef = useRef(new Map());  // Map<compoundId, OffscreenCanvas>
    const nodeDisplayRef = useRef(nodeDisplay);
    nodeDisplayRef.current = nodeDisplay;
    const keggPositionsRef = useRef(null);   // { compoundId: {x, y} } from KEGG map
    const prevKeggLayoutRef = useRef(false);
    const keggOrthoEdgesRef = useRef(null);  // [{points, color, name, reaction}, ...] from KEGG map

    const [graph, setGraph] = useState({ nodes: [], links: [] });

    // Sync pinned → selectedNodes state
    const syncSelection = useCallback(() => {
      const nodes = nodesRef.current;
      const pinned = pinnedNodesRef.current;
      if (pinned.size === 0) { setSelectedNodes([]); return; }
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const sel = [];
      pinned.forEach(id => { const n = nodeMap.get(id); if (n) sel.push(n); });
      setSelectedNodes(sel);
    }, []);

    // Degree map for info panel — count unique reactions per node
    const degreeMap = React.useMemo(() => {
      const m = new Map();
      (graph.links || []).forEach(l => {
        const s = l.source?.id || l.source;
        const t = l.target?.id || l.target;
        // In pruned mode, reactionCount is the number of unique reactions on this edge
        const weight = l.reactionCount || 1;
        m.set(s, (m.get(s) || 0) + weight);
        m.set(t, (m.get(t) || 0) + weight);
      });
      return m;
    }, [graph]);

    // Per-node reactions map: nodeId → [{id, equation, ecList}]
    const nodeReactionsMap = React.useMemo(() => {
      const m = new Map();
      (graph.links || []).forEach(l => {
        const s = l.source?.id || l.source;
        const t = l.target?.id || l.target;
        const rxns = l.reactions || [{ id: l.reactionId || l.label, equation: l.equation || '', ecList: l.ecList || [] }];
        [s, t].forEach(nid => {
          if (!m.has(nid)) m.set(nid, new Map());
          const nodeRxns = m.get(nid);
          rxns.forEach(r => {
            if (r.id && !nodeRxns.has(r.id)) nodeRxns.set(r.id, r);
          });
        });
      });
      // Convert inner Maps to arrays
      const result = new Map();
      m.forEach((rxnMap, nid) => result.set(nid, [...rxnMap.values()]));
      return result;
    }, [graph]);

    const handleDeselectNode = useCallback((nodeId) => {
      pinnedNodesRef.current.delete(nodeId);
      syncSelection();
      drawRef.current?.(nodesRef.current);
    }, [syncSelection]);

    /* ── Build graph when raw data or pruning changes ── */
    useEffect(() => {
      if (!Array.isArray(data)) return;
      const raw = processSimpleGraph(data);
      const processed = pruneEdges ? pruneSimpleGraph(raw) : raw;
      setGraph(processed);
    }, [data, pruneEdges]);

    /* ── Fetch structures & pre-render textures ── */
    const STRUCT_TEX = 1024;      // high-res offscreen canvas
    const STRUCT_WORLD_H = 70;    // fixed size in world units (square)

    // Element colors for MOL renderer
    const ELEM_COLORS_DARK = { C: '#cbd5e1', O: '#ef4444', N: '#3b82f6', S: '#eab308', P: '#f97316', F: '#22c55e', Cl: '#14b8a6', Br: '#d97706', I: '#8b5cf6', H: '#cbd5e1' };
    const ELEM_COLORS_LIGHT = { C: '#334155', O: '#dc2626', N: '#2563eb', S: '#ca8a04', P: '#ea580c', F: '#16a34a', Cl: '#0d9488', Br: '#b45309', I: '#7c3aed', H: '#334155' };

    // Parse MOL V2000 text → { atoms: [{x,y,symbol}], bonds: [{a1,a2,type}] }
    const parseMol = (molText) => {
      const lines = molText.split('\n');
      // Find counts line (line index 3 in standard MOL, but be flexible)
      let countsIdx = 3;
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        if (/^\s*\d+\s+\d+/.test(lines[i]) && lines[i].includes('V2000')) {
          countsIdx = i; break;
        }
      }
      const counts = lines[countsIdx].trim().split(/\s+/);
      const nAtoms = parseInt(counts[0]) || 0;
      const nBonds = parseInt(counts[1]) || 0;
      const atoms = [];
      for (let i = 0; i < nAtoms; i++) {
        const parts = lines[countsIdx + 1 + i]?.trim().split(/\s+/);
        if (!parts || parts.length < 4) continue;
        atoms.push({ x: parseFloat(parts[0]), y: parseFloat(parts[1]), symbol: parts[3] });
      }
      const bonds = [];
      for (let i = 0; i < nBonds; i++) {
        const parts = lines[countsIdx + 1 + nAtoms + i]?.trim().split(/\s+/);
        if (!parts || parts.length < 3) continue;
        bonds.push({ a1: parseInt(parts[0]) - 1, a2: parseInt(parts[1]) - 1, type: parseInt(parts[2]) || 1 });
      }
      return { atoms, bonds };
    };

    // Render parsed MOL to an offscreen canvas
    const renderMol = (mol, size, isDark) => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!mol.atoms.length) return null;

      const colors = isDark ? ELEM_COLORS_DARK : ELEM_COLORS_LIGHT;
      const defaultCol = isDark ? '#cbd5e1' : '#334155';

      // Compute bounding box and scale
      let axMin = Infinity, ayMin = Infinity, axMax = -Infinity, ayMax = -Infinity;
      mol.atoms.forEach(a => {
        axMin = Math.min(axMin, a.x); ayMin = Math.min(ayMin, a.y);
        axMax = Math.max(axMax, a.x); ayMax = Math.max(ayMax, a.y);
      });
      const aw = axMax - axMin || 1, ah = ayMax - ayMin || 1;
      const padding = size * 0.12;
      const usable = size - padding * 2;
      const scale = Math.min(usable / aw, usable / ah);
      const ox = (size - aw * scale) / 2 - axMin * scale;
      const oy = (size - ah * scale) / 2 - ayMin * scale;
      const tx = (a) => a.x * scale + ox;
      // MOL Y is inverted (up is positive in MOL, but canvas Y goes down)
      const ty = (a) => size - (a.y * scale + oy);

      const bondW = Math.max(2, scale * 0.06);
      const bondGap = Math.max(3, scale * 0.08);

      // Draw bonds
      mol.bonds.forEach(b => {
        const a1 = mol.atoms[b.a1], a2 = mol.atoms[b.a2];
        if (!a1 || !a2) return;
        const x1 = tx(a1), y1 = ty(a1), x2 = tx(a2), y2 = ty(a2);
        ctx.strokeStyle = defaultCol;
        ctx.lineWidth = bondW;
        ctx.lineCap = 'round';

        if (b.type === 1) {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        } else if (b.type === 2) {
          const dx = x2 - x1, dy = y2 - y1;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / d * bondGap / 2, ny = dx / d * bondGap / 2;
          ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1 - nx, y1 - ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.stroke();
        } else if (b.type === 3) {
          const dx = x2 - x1, dy = y2 - y1;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / d * bondGap, ny = dx / d * bondGap;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1 - nx, y1 - ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.stroke();
        }
      });

      // Draw atom labels (skip C unless terminal/charged)
      const fontSize = Math.max(14, Math.min(scale * 0.32, 48));
      ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      mol.atoms.forEach(a => {
        if (a.symbol === 'C') return; // skip carbon labels (standard chem drawing)
        const ax = tx(a), ay = ty(a);
        // Clear a small area behind the label
        const lw = ctx.measureText(a.symbol).width + 4;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.clearRect(ax - lw / 2, ay - fontSize / 2 - 2, lw, fontSize + 4);
        ctx.fillStyle = colors[a.symbol] || defaultCol;
        ctx.fillText(a.symbol, ax, ay);
      });

      canvas._aspect = 1;
      return canvas;
    };

    // Render a cofactor name as a styled text canvas
    const renderNameTex = (name, size, isDark) => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const fg = isDark ? '#a5b4fc' : '#4f46e5'; // indigo for cofactors
      const fontSize = Math.min(size * 0.18, 120);
      ctx.font = `600 ${fontSize}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Word-wrap if needed
      const words = name.split(/\s+/);
      const lines = [];
      let line = '';
      const maxW = size * 0.85;
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line); line = w;
        } else { line = test; }
      });
      if (line) lines.push(line);

      const lineH = fontSize * 1.25;
      const totalH = lines.length * lineH;
      const startY = (size - totalH) / 2 + lineH / 2;

      ctx.fillStyle = fg;
      lines.forEach((l, i) => {
        ctx.fillText(l, size / 2, startY + i * lineH);
      });

      canvas._aspect = 1;
      return canvas;
    };

    useEffect(() => {
      if (nodeDisplay !== 'structure' || !graph.nodes.length) return;
      let cancelled = false;

      // Collect both C and Z compound IDs
      const compoundIds = graph.nodes
        .filter(n => n.type === 'compound' || !n.type)
        .map(n => n.id)
        .filter(id => /^[CZ]\d{5}$/.test(id));

      const needed = compoundIds.filter(id => !structTexRef.current.has(id));
      if (needed.length === 0) return;

      (async () => {
        try {
          const resp = await fetch('/api/smiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compound_ids: needed }),
          });
          if (!resp.ok || cancelled) return;
          const { smiles, mol, names } = await resp.json();
          if (cancelled) return;

          Object.assign(smilesDataRef.current, smiles || {});

          // 1) Render SMILES structures via SmilesDrawer
          const drawer = new SmilesDrawer.Drawer({
            width: STRUCT_TEX,
            height: STRUCT_TEX,
            bondThickness: 1.5,
            bondLength: 25,
            shortBondLength: 0.85,
            bondSpacing: 7,
            fontSizeLarge: 11,
            fontSizeSmall: 5,
            padding: 40,
            compactDrawing: true,
            explicitHydrogens: false,
            terminalCarbons: false,
            themes: {
              dark: {
                C: '#cbd5e1', O: '#ef4444', N: '#3b82f6', S: '#eab308',
                P: '#f97316', F: '#22c55e', CL: '#14b8a6', BR: '#d97706',
                I: '#8b5cf6', H: '#cbd5e1', BACKGROUND: 'transparent',
              },
              light: {
                C: '#334155', O: '#dc2626', N: '#2563eb', S: '#ca8a04',
                P: '#ea580c', F: '#16a34a', CL: '#0d9488', BR: '#b45309',
                I: '#7c3aed', H: '#334155', BACKGROUND: 'transparent',
              },
            },
          });
          const theme = dark ? 'dark' : 'light';

          for (const cid of needed) {
            if (cancelled) return;
            const smi = smiles?.[cid];
            if (!smi) continue;
            try {
              await new Promise((resolve, reject) => {
                SmilesDrawer.parse(smi, (tree) => {
                  const offscreen = document.createElement('canvas');
                  offscreen.width = STRUCT_TEX;
                  offscreen.height = STRUCT_TEX;
                  drawer.draw(tree, offscreen, theme, false);
                  offscreen._aspect = 1;
                  structTexRef.current.set(cid, offscreen);
                  resolve();
                }, (err) => { reject(err); });
              });
            } catch (e) {
              // Will try MOL fallback below
            }
          }

          // 2) Render MOL structures for compounds that have no SMILES texture
          if (mol) {
            for (const [cid, molText] of Object.entries(mol)) {
              if (cancelled) return;
              if (structTexRef.current.has(cid) || !molText) continue;
              try {
                const parsed = parseMol(molText);
                if (parsed.atoms.length > 0) {
                  const tex = renderMol(parsed, STRUCT_TEX, dark);
                  if (tex) structTexRef.current.set(cid, tex);
                }
              } catch (e) {
                // Skip unparseable MOL files
              }
            }
          }

          // 3) Render Z compound cofactor names as styled text
          if (names) {
            for (const [cid, name] of Object.entries(names)) {
              if (cancelled) return;
              if (structTexRef.current.has(cid)) continue;
              const tex = renderNameTex(name, STRUCT_TEX, dark);
              if (tex) structTexRef.current.set(cid, tex);
            }
          }

          if (!cancelled) drawRef.current?.(nodesRef.current);
        } catch (e) {
          console.warn('[NEBULA] Structure fetch failed:', e);
        }
      })();

      return () => { cancelled = true; };
    }, [graph.nodes, nodeDisplay, dark]);

    /* ── Max generation for color scaling ── */
    const maxGeneration = React.useMemo(() => {
      let mg = 0;
      graph.nodes.forEach(n => { if ((n.generation || 0) > mg) mg = n.generation; });
      return mg;
    }, [graph]);

    /* ── Draw function ── */
    const draw = useCallback((nodes) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const { width: w, height: h } = canvasRef.current;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
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

      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // Viewport culling
      const CULL_MARGIN = 60;
      const viewMinX = (-t.x) / t.k - CULL_MARGIN;
      const viewMinY = (-t.y) / t.k - CULL_MARGIN;
      const viewMaxX = (-t.x + w) / t.k + CULL_MARGIN;
      const viewMaxY = (-t.y + h) / t.k + CULL_MARGIN;
      const inView = (x, y) =>
        x >= viewMinX && x <= viewMaxX && y >= viewMinY && y <= viewMaxY;

      /* ── Grid ── */
      const gridSpacing = 48;
      const effectiveGridColor = gridColor
        ? gridColor + "18"
        : dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      ctx.save();
      ctx.strokeStyle = effectiveGridColor;
      ctx.lineWidth = 1 / t.k;
      const startX = Math.floor(viewMinX / gridSpacing) * gridSpacing;
      const startY = Math.floor(viewMinY / gridSpacing) * gridSpacing;
      ctx.beginPath();
      for (let x = startX; x <= viewMaxX; x += gridSpacing) {
        ctx.moveTo(x, viewMinY); ctx.lineTo(x, viewMaxY);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let y = startY; y <= viewMaxY; y += gridSpacing) {
        ctx.moveTo(viewMinX, y); ctx.lineTo(viewMaxX, y);
      }
      ctx.stroke();
      ctx.restore();

      /* ── Surface point on compound circle ── */
      const surfacePoint = (node, dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) return { x: node.x, y: node.y };
        const ux = dx / d, uy = dy / d;
        return { x: node.x + ux * R_COMPOUND, y: node.y + uy * R_COMPOUND };
      };

      /* ── Edges ── */
      const visibleEdges = [];
      const linksByNode = new Map();
      graph.links.forEach(l => {
        const srcId = l.source?.id || l.source;
        const trgId = l.target?.id || l.target;
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
      const selectedIds = new Set(pinned);
      if (hovId != null && nodeMap.has(hovId)) selectedIds.add(hovId);
      // Expand highlight to include direct neighbors of selected nodes
      const highlightIds = new Set(selectedIds);
      if (selectedIds.size > 0) {
        graph.links.forEach(l => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          if (selectedIds.has(sId)) highlightIds.add(tId);
          if (selectedIds.has(tId)) highlightIds.add(sId);
        });
      }
      const hasHighlight = highlightIds.size > 0;

      const highlightedEdgeSet = new Set();
      if (hasHighlight) {
        // Only brighten edges that touch a selected node (not neighbor-to-neighbor)
        selectedIds.forEach(nid => {
          (linksByNode.get(nid) || []).forEach(idx => highlightedEdgeSet.add(idx));
        });
      }

      // Backbone substructure search overlay
      const hasBackbone = backboneMatchIds !== null && backboneMatchIds instanceof Set;

      // Adaptive opacity — more generous base for sparse layout
      const autoAlpha = edgeCount <= 80
        ? 0.45
        : edgeCount <= 400
          ? 0.45 - (edgeCount - 80) / 320 * 0.30
          : Math.max(0.05, 0.15 - (edgeCount - 400) / 2000 * 0.10);
      const baseAlpha = autoAlpha * (edgeOpacity * 2);
      const dimAlpha = hasHighlight ? Math.min(baseAlpha * 0.18, 0.035) : baseAlpha;
      const brightAlpha = 0.9;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Count parallel edges between same node pair for offset
      const pairCount = new Map();
      const pairIdx = new Map();
      visibleEdges.forEach(({ src, trg }, idx) => {
        const key = [src.id, trg.id].sort().join('||');
        if (!pairCount.has(key)) pairCount.set(key, 0);
        pairIdx.set(idx, pairCount.get(key));
        pairCount.set(key, pairCount.get(key) + 1);
      });

      const isOrtho = edgeStyle === 'orthogonal';
      const G = gridSpacing; // 48px grid

      // Helper: snap value to nearest grid line
      const snap = (v) => Math.round(v / G) * G;

      // Node occupancy: mark grid cells within R_COMPOUND+margin of each node
      const nodeOccGrid = new Map();
      if (isOrtho) {
        nodes.forEach(n => {
          const gx = snap(n.x), gy = snap(n.y);
          // Mark center + immediate neighbors (covers the node's visual radius)
          for (let ox = -G; ox <= G; ox += G) {
            for (let oy = -G; oy <= G; oy += G) {
              const cx = gx + ox, cy = gy + oy;
              // Only mark if grid cell is actually close to node center
              if (Math.abs(cx - n.x) < G * 0.8 && Math.abs(cy - n.y) < G * 0.8) {
                nodeOccGrid.set(`${cx},${cy}`, n.id);
              }
            }
          }
        });
      }

      // Check if a horizontal segment at y=segY from x=x1..x2 hits any node (excluding src/trg)
      const hSegBlocked = (segY, x1, x2, skipA, skipB) => {
        const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
        for (let gx = snap(lo); gx <= hi + G / 2; gx += G) {
          const occ = nodeOccGrid.get(`${gx},${snap(segY)}`);
          if (occ && occ !== skipA && occ !== skipB) return true;
        }
        return false;
      };
      // Check if a vertical segment at x=segX from y=y1..y2 hits any node
      const vSegBlocked = (segX, y1, y2, skipA, skipB) => {
        const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
        for (let gy = snap(lo); gy <= hi + G / 2; gy += G) {
          const occ = nodeOccGrid.get(`${snap(segX)},${gy}`);
          if (occ && occ !== skipA && occ !== skipB) return true;
        }
        return false;
      };

      // Helper: filled triangle arrow at a point along a direction
      const drawMidArrow = (px, py, dirX, dirY, alpha) => {
        const aSize = Math.max(8 / t.k, 6);
        ctx.beginPath();
        ctx.moveTo(px + dirX * aSize, py + dirY * aSize);
        ctx.lineTo(px - dirX * aSize * 0.45 + dirY * aSize * 0.55,
                   py - dirY * aSize * 0.45 - dirX * aSize * 0.55);
        ctx.lineTo(px - dirX * aSize * 0.45 - dirY * aSize * 0.55,
                   py - dirY * aSize * 0.45 + dirX * aSize * 0.55);
        ctx.closePath();
        const edgeR = dark ? 140 : 160;
        const edgeG = dark ? 160 : 170;
        const edgeB = dark ? 190 : 185;
        ctx.fillStyle = `rgba(${edgeR},${edgeG},${edgeB},${Math.min(alpha * 1.8, 0.95)})`;
        ctx.fill();
      };

      // Helper: find point & direction at a given fraction (0..1) along a polyline path
      const pathPointAtFrac = (path, frac = 0.5) => {
        let totalLen = 0;
        const segs = [];
        for (let i = 1; i < path.length; i++) {
          const sdx = path[i].x - path[i - 1].x;
          const sdy = path[i].y - path[i - 1].y;
          const slen = Math.sqrt(sdx * sdx + sdy * sdy);
          segs.push({ dx: sdx, dy: sdy, len: slen });
          totalLen += slen;
        }
        let rem = totalLen * frac;
        for (let i = 0; i < segs.length; i++) {
          if (rem <= segs[i].len && segs[i].len > 0) {
            const f = rem / segs[i].len;
            return {
              x: path[i].x + segs[i].dx * f,
              y: path[i].y + segs[i].dy * f,
              dx: segs[i].dx / segs[i].len,
              dy: segs[i].dy / segs[i].len,
            };
          }
          rem -= segs[i].len;
        }
        const last = segs[segs.length - 1] || { dx: 1, dy: 0, len: 1 };
        return {
          x: path[path.length - 1].x,
          y: path[path.length - 1].y,
          dx: last.dx / (last.len || 1),
          dy: last.dy / (last.len || 1),
        };
      };

      // Draw edges in 2 passes: dim first, bright on top
      for (let pass = 0; pass < 2; pass++) {
        visibleEdges.forEach(({ src, trg, link }, idx) => {
          const isBright = hasHighlight && highlightedEdgeSet.has(idx);
          if (pass === 0 && isBright) return;
          if (pass === 1 && !isBright) return;
          if (pass === 1 && !hasHighlight) return;

          // Backbone-aware edge dimming
          const bbEdgeMatch = hasBackbone
            ? (backboneMatchIds.has(src.id) && backboneMatchIds.has(trg.id))
            : true;
          const bbEdgeDim = hasBackbone && !bbEdgeMatch;

          let alpha = isBright ? brightAlpha : dimAlpha;
          if (bbEdgeDim) alpha = Math.min(alpha, 0.04);

          // Clean muted color
          const edgeR = dark ? 140 : 160;
          const edgeG = dark ? 160 : 170;
          const edgeB = dark ? 190 : 185;

          ctx.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${alpha})`;
          ctx.lineWidth = isBright
            ? Math.max(1.4 / t.k, 0.9)
            : Math.max(0.5 / t.k, 0.35);
          ctx.setLineDash([]);

          // Parallel edge offset
          const pKey = [src.id, trg.id].sort().join('||');
          const total = pairCount.get(pKey) || 1;
          const myIdx = pairIdx.get(idx) || 0;
          const offset = total === 1 ? 0 : (myIdx - (total - 1) / 2) * G;

          // Label midpoint (computed per-mode)
          let labelX, labelY;

          if (isOrtho) {
            // ── Orthogonal grid routing: 4 cardinal ports, full node avoidance ──
            const R = R_COMPOUND;
            const dx_raw = trg.x - src.x;
            const dy_raw = trg.y - src.y;
            const sId = src.id, tId = trg.id;

            // Choose cardinal ports based on primary direction
            let sp, tp, routeType;
            if (Math.abs(dx_raw) >= Math.abs(dy_raw)) {
              if (dx_raw >= 0) {
                sp = { x: src.x + R, y: src.y };
                tp = { x: trg.x - R, y: trg.y };
              } else {
                sp = { x: src.x - R, y: src.y };
                tp = { x: trg.x + R, y: trg.y };
              }
              routeType = 'h';
            } else {
              if (dy_raw >= 0) {
                sp = { x: src.x, y: src.y + R };
                tp = { x: trg.x, y: trg.y - R };
              } else {
                sp = { x: src.x, y: src.y - R };
                tp = { x: trg.x, y: trg.y + R };
              }
              routeType = 'v';
            }

            // Try to find a collision-free 3-segment route.
            // For H routing: sp →(chX, sp.y)→(chX, tp.y)→ tp
            //   Segments: H1 at y=sp.y from sp.x..chX, V at x=chX from sp.y..tp.y, H2 at y=tp.y from chX..tp.x
            // For V routing: sp →(sp.x, chY)→(tp.x, chY)→ tp
            //   Segments: V1 at x=sp.x from sp.y..chY, H at y=chY from sp.x..tp.x, V2 at x=tp.x from chY..tp.y

            let path;

            if (routeType === 'h') {
              if (Math.abs(sp.y - tp.y) < 2 && Math.abs(offset) < 2
                  && !hSegBlocked(sp.y, sp.x, tp.x, sId, tId)) {
                // Same row, no obstacles: straight horizontal
                path = [sp, tp];
              } else {
                // Search for a clear vertical channel
                const baseChX = snap((sp.x + tp.x) / 2) + offset;
                let bestChX = baseChX;
                let found = false;
                for (let a = 0; a < 12; a++) {
                  const testX = a === 0 ? baseChX : baseChX + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snX = snap(testX);
                  // Check all 3 segments
                  if (!hSegBlocked(sp.y, sp.x, snX, sId, tId)
                      && !vSegBlocked(snX, sp.y, tp.y, sId, tId)
                      && !hSegBlocked(tp.y, snX, tp.x, sId, tId)) {
                    bestChX = snX; found = true; break;
                  }
                }
                if (!found) {
                  // Fallback: just check the vertical channel alone
                  for (let a = 0; a < 12; a++) {
                    const testX = a === 0 ? baseChX : baseChX + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                    const snX = snap(testX);
                    if (!vSegBlocked(snX, sp.y, tp.y, sId, tId)) {
                      bestChX = snX; break;
                    }
                  }
                }
                path = [sp, { x: bestChX, y: sp.y }, { x: bestChX, y: tp.y }, tp];
              }
            } else {
              if (Math.abs(sp.x - tp.x) < 2 && Math.abs(offset) < 2
                  && !vSegBlocked(sp.x, sp.y, tp.y, sId, tId)) {
                // Same column, no obstacles: straight vertical
                path = [sp, tp];
              } else {
                const baseChY = snap((sp.y + tp.y) / 2) + offset;
                let bestChY = baseChY;
                let found = false;
                for (let a = 0; a < 12; a++) {
                  const testY = a === 0 ? baseChY : baseChY + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snY = snap(testY);
                  if (!vSegBlocked(sp.x, sp.y, snY, sId, tId)
                      && !hSegBlocked(snY, sp.x, tp.x, sId, tId)
                      && !vSegBlocked(tp.x, snY, tp.y, sId, tId)) {
                    bestChY = snY; found = true; break;
                  }
                }
                if (!found) {
                  for (let a = 0; a < 12; a++) {
                    const testY = a === 0 ? baseChY : baseChY + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                    const snY = snap(testY);
                    if (!hSegBlocked(snY, sp.x, tp.x, sId, tId)) {
                      bestChY = snY; break;
                    }
                  }
                }
                path = [sp, { x: sp.x, y: bestChY }, { x: tp.x, y: bestChY }, tp];
              }
            }

            // Draw with rounded corners
            const bR = Math.min(G * 0.35, 8);
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let pi = 1; pi < path.length - 1; pi++) {
              ctx.arcTo(path[pi].x, path[pi].y, path[pi + 1].x, path[pi + 1].y, bR);
            }
            ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y);
            ctx.stroke();

            // Arrow at 35%-65% along path, offset by edge index to avoid overlap
            const arrowFrac = total <= 1 ? 0.5 : 0.3 + (myIdx / Math.max(total - 1, 1)) * 0.4;
            const mid = pathPointAtFrac(path, arrowFrac);
            drawMidArrow(mid.x, mid.y, mid.dx, mid.dy, alpha);

            // Label at channel midpoint
            if (path.length >= 4) {
              labelX = (path[1].x + path[2].x) / 2;
              labelY = (path[1].y + path[2].y) / 2 - 9;
            } else {
              labelX = (sp.x + tp.x) / 2;
              labelY = Math.min(sp.y, tp.y) - 9;
            }

          } else {
            // ── Curved mode ──
            const dx = trg.x - src.x;
            const dy = trg.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const s0 = surfacePoint(src, dx, dy);
            const s1 = surfacePoint(trg, -dx, -dy);
            const nx = dist > 0 ? -dy / dist : 0;
            const ny = dist > 0 ? dx / dist : 0;

            const curveOff = total === 1 ? 0 : (myIdx - (total - 1) / 2) * 18;
            const curveBase = Math.min(dist * 0.15, 30);
            const curvature = curveBase + curveOff;

            const mx = (s0.x + s1.x) / 2;
            const my = (s0.y + s1.y) / 2;
            const cpx = mx + nx * curvature;
            const cpy = my + ny * curvature;

            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.quadraticCurveTo(cpx, cpy, s1.x, s1.y);
            ctx.stroke();

            // Mid-curve arrow: bezier at t=0.5 and tangent
            const midBx = 0.25 * s0.x + 0.5 * cpx + 0.25 * s1.x;
            const midBy = 0.25 * s0.y + 0.5 * cpy + 0.25 * s1.y;
            const tDx = (cpx - s0.x) * 0.5 + (s1.x - cpx) * 0.5;
            const tDy = (cpy - s0.y) * 0.5 + (s1.y - cpy) * 0.5;
            const tLen = Math.sqrt(tDx * tDx + tDy * tDy) || 1;
            drawMidArrow(midBx, midBy, tDx / tLen, tDy / tLen, alpha);

            labelX = cpx + nx * 7;
            labelY = cpy + ny * 7;
          }

          // Reaction name — only on HIGHLIGHTED edges (hover/pin) to avoid clutter
          if (isBright) {
            const rxLabel = link.label || link.reactionId || '';
            if (rxLabel && t.k >= 0.25) {
              ctx.save();
              const fs = Math.max(5, Math.min(7, 6 / t.k * t.k));
              ctx.font = `500 ${fs}px "Inter", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              // Background pill
              const tw = ctx.measureText(rxLabel).width + 6;
              ctx.fillStyle = dark ? "rgba(30,41,59,0.75)" : "rgba(255,255,255,0.8)";
              const pillH = fs + 3;
              ctx.beginPath();
              ctx.roundRect(labelX - tw / 2, labelY - pillH / 2, tw, pillH, 3);
              ctx.fill();
              ctx.fillStyle = dark
                ? "rgba(200,210,230,0.92)"
                : "rgba(60,70,90,0.88)";
              ctx.fillText(rxLabel, labelX, labelY);
              ctx.restore();
            }
          }
        });
      }

      /* ── Path overlay (pair highlighting) ── */
      if (showOverlay) {
        graph.links.forEach(l => {
          if (!l.pairIndices || l.pairIndices.length === 0) return;
          const srcId = l.source?.id || l.source;
          const trgId = l.target?.id || l.target;
          const src = nodeMap.get(srcId);
          const trg = nodeMap.get(trgId);
          if (!src || !trg) return;
          if (!inView(src.x, src.y) && !inView(trg.x, trg.y)) return;
          l.pairIndices.forEach(pi => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(5 / t.k, 2.5);
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

        nodes.forEach(n => {
          if (!n.pairIndices || n.pairIndices.length === 0) return;
          if (!inView(n.x, n.y)) return;
          n.pairIndices.forEach(pi => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(3 / t.k, 1.5);
            ctx.beginPath();
            ctx.arc(n.x, n.y, R_COMPOUND + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          });
        });
      }

      /* ── KEGG ortho edges (polylines from KGML, filtered to graph reactions) ── */
      if (keggOrthoEdges && keggOrthoEdgesRef.current) {
        // Collect reaction IDs present in the current graph
        const graphRxnIds = new Set();
        graph.links.forEach(l => {
          if (l.reactionId) graphRxnIds.add(l.reactionId);
          if (l.reactions) l.reactions.forEach(r => { if (r.id) graphRxnIds.add(r.id); });
        });

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1.5 / t.k, 0.8);
        ctx.globalAlpha = 0.55;
        let drawnCount = 0;
        keggOrthoEdgesRef.current.forEach(edge => {
          // Filter: only draw if this edge's reaction is in the graph
          // edge.reaction is like "rn:R02253" — extract R-id(s)
          const rxnField = edge.reaction || "";
          const rxnIds = rxnField.split(/\s+/).map(r => r.replace(/^rn:/, ""));
          if (!rxnIds.some(rid => graphRxnIds.has(rid))) return;

          const pts = edge.points;
          if (!pts || pts.length < 2) return;
          // Quick viewport test
          let eMinX = Infinity, eMinY = Infinity, eMaxX = -Infinity, eMaxY = -Infinity;
          for (const p of pts) {
            if (p[0] < eMinX) eMinX = p[0];
            if (p[0] > eMaxX) eMaxX = p[0];
            if (p[1] < eMinY) eMinY = p[1];
            if (p[1] > eMaxY) eMaxY = p[1];
          }
          if (eMaxX < viewMinX || eMinX > viewMaxX || eMaxY < viewMinY || eMinY > viewMaxY) return;
          ctx.strokeStyle = edge.color || "#F06292";
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i][0], pts[i][1]);
          }
          ctx.stroke();
          drawnCount++;
        });
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      /* ── Nodes ── */
      const degMap = new Map();
      if (colorMode === "degree") {
        graph.links.forEach(l => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          degMap.set(sId, (degMap.get(sId) || 0) + 1);
          degMap.set(tId, (degMap.get(tId) || 0) + 1);
        });
      }
      const maxDeg = degMap.size > 0 ? Math.max(1, ...degMap.values()) : 1;
      const MAX_BUCKET = 100;

      const nodeColor = (n) => {
        if (colorMode === "type") {
          return getTypeColor(n.type, dark);
        }
        if (colorMode === "degree") {
          const deg = degMap.get(n.id) || 0;
          const bucket = Math.round((deg / maxDeg) * MAX_BUCKET);
          return getSchemeColor(colorScheme, bucket / MAX_BUCKET, dark);
        }
        const gen = n.generation || 0;
        const bucket = maxGeneration > 0
          ? Math.round((gen / maxGeneration) * MAX_BUCKET)
          : 0;
        return getSchemeColor(colorScheme, bucket / MAX_BUCKET, dark);
      };

      // Structures: fixed world HEIGHT, width adapts per molecule's aspect ratio
      const useStructures = nodeDisplay === 'structure';
      const SH = STRUCT_WORLD_H; // world height
      const halfH = SH / 2;

      nodes.forEach(n => {
        if (!inView(n.x, n.y)) return;
        const isHighlighted = highlightIds.has(n.id);
        const dimmed = hasHighlight && !isHighlighted;
        const bbMatch = hasBackbone ? backboneMatchIds.has(n.id) : false;
        const bbDim = hasBackbone && !bbMatch;
        const { fill, stroke } = nodeColor(n);
        const tex = useStructures ? structTexRef.current.get(n.id) : null;

        if (bbDim) ctx.globalAlpha = 0.12;
        else if (dimmed) ctx.globalAlpha = 0.4;

        // Subtle glow behind backbone-matched molecules
        if (bbMatch && !bbDim) {
          ctx.save();
          const glowR = tex ? (SH * (tex._aspect || 1) / 2 + 8) : (R_COMPOUND + 8);
          ctx.shadowColor = dark ? 'rgba(167,139,250,0.55)' : 'rgba(124,58,237,0.4)';
          ctx.shadowBlur = 18;
          ctx.fillStyle = 'rgba(0,0,0,0)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        if (tex) {
          const aspect = tex._aspect || 1;
          const drawW = SH * aspect;
          const halfW = drawW / 2;
          ctx.drawImage(tex, n.x - halfW, n.y - halfH, drawW, SH);
        } else {
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, R_COMPOUND, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Backbone match ring indicator
        if (bbMatch && !bbDim) {
          ctx.save();
          ctx.strokeStyle = dark ? 'rgba(167,139,250,0.7)' : 'rgba(124,58,237,0.6)';
          ctx.lineWidth = Math.max(2 / t.k, 1.2);
          ctx.setLineDash([]);
          ctx.beginPath();
          if (tex) {
            const aspect = tex._aspect || 1;
            const hw = SH * aspect / 2 + 4;
            const hh = halfH + 4;
            ctx.roundRect(n.x - hw, n.y - hh, hw * 2, hh * 2, 6);
          } else {
            ctx.arc(n.x, n.y, R_COMPOUND + 4, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.restore();
        }

        if (bbDim || dimmed) ctx.globalAlpha = 1;
      });

      /* ── Labels (below nodes for readability) ── */
      if (t.k >= 0.3) {
        const fontSize = Math.max(5, Math.min(8, 7 / t.k * t.k));
        ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelOffset = useStructures ? halfH + 3 : R_COMPOUND + 3;
        nodes.forEach(n => {
          if (!inView(n.x, n.y)) return;
          const isHl = highlightIds.has(n.id);
          const dimLabel = hasHighlight && !isHl;
          const bbLabelDim = hasBackbone && !backboneMatchIds.has(n.id);
          const bbLabelMatch = hasBackbone && backboneMatchIds.has(n.id);
          if (bbLabelDim) ctx.globalAlpha = 0.1;
          else if (dimLabel) ctx.globalAlpha = 0.4;
          ctx.fillStyle = bbLabelMatch
            ? (dark ? "#c4b5fd" : "#7c3aed")
            : isHl
              ? (dark ? "#93C5FD" : "#2563EB")
              : (dark ? "#94A3B8" : "#64748B");
          ctx.fillText(n.label ?? n.id, n.x, n.y + labelOffset);
          if (bbLabelDim || dimLabel) ctx.globalAlpha = 1;
        });
      }

      ctx.restore();
    }, [dark, graph, maxGeneration, showOverlay, pairColorMap, edgeOpacity, spacingScale, colorMode, colorScheme, bgColor, gridColor, edgeStyle, nodeDisplay, keggOrthoEdges, backboneMatchIds]);

    drawRef.current = draw;
    syncSelectionRef.current = syncSelection;

    // Prune stale pins on graph change
    useEffect(() => {
      hoveredNodeRef.current = null;
      const nodeIds = new Set(graph.nodes.map(n => n.id));
      const pinned = pinnedNodesRef.current;
      for (const id of pinned) {
        if (!nodeIds.has(id)) pinned.delete(id);
      }
      syncSelection();
    }, [graph, syncSelection]);

    useEffect(() => {
      draw(graph.nodes);
    }, [showOverlay, graph, draw]);

    // Fetch KEGG ortho edges on first toggle-on, then redraw
    useEffect(() => {
      if (!keggOrthoEdges) {
        drawRef.current?.(nodesRef.current);
        return;
      }
      if (keggOrthoEdgesRef.current) {
        drawRef.current?.(nodesRef.current);
        return;
      }
      fetch('/api/kegg-ortho-edges')
        .then(r => r.json())
        .then(data => {
          keggOrthoEdgesRef.current = data.edges || [];
          console.log(`[NEBULA] KEGG ortho edges: ${keggOrthoEdgesRef.current.length} polylines loaded`);
          drawRef.current?.(nodesRef.current);
        })
        .catch(e => console.warn('[NEBULA] Failed to fetch KEGG ortho edges:', e));
    }, [keggOrthoEdges]);

    /* ── Helper: fit view to nodes ── */
    const fitViewToNodes = useCallback((nodesCopy) => {
      if (!nodesCopy.length || !canvasRef.current || !zoomRef.current) return;
      const canvas = canvasRef.current;
      const cw = canvas.clientWidth || 800;
      const ch = canvas.clientHeight || 600;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodesCopy.forEach(n => {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
      });
      const pad = 60;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      const gw = maxX - minX || 1;
      const gh = maxY - minY || 1;
      const scale = Math.min(cw / gw, ch / gh, 1.5);
      const tx = (cw - gw * scale) / 2 - minX * scale;
      const ty = (ch - gh * scale) / 2 - minY * scale;
      const tr = d3.zoomIdentity.translate(tx, ty).scale(scale);
      transformRef.current = tr;
      d3.select(canvas).call(zoomRef.current.transform, tr);
    }, []);

    /* ── Layout ── */
    useEffect(() => {
      if (!graph.nodes.length) return;

      const ch = typeof height === "string" ? parseInt(height) : height;
      const cw = containerRef.current?.clientWidth || 800;
      const centerX = cw / 2;
      const centerY = ch / 2;
      const nodesCopy = graph.nodes.map(n => ({ ...n }));
      const linksCopy = graph.links.map(l => ({ ...l }));

      // Detect KEGG layout toggle change
      const keggJustToggled = keggLayout !== prevKeggLayoutRef.current;
      prevKeggLayoutRef.current = keggLayout;

      if (keggLayout) {
        // ── KEGG layout mode: fetch positions (once), apply to matching nodes ──

        // Shared helper: place nodes at KEGG coords, spread unplaced, resolve collisions
        const applyKegg = (nds, lks, positions, cx, cy) => {
          let matched = 0;
          nds.forEach(n => {
            const pos = positions[n.id];
            if (pos) { n.x = pos.x; n.y = pos.y; matched++; }
          });

          // Place unplaced nodes near their positioned neighbors
          const nodeMap = new Map(nds.map(n => [n.id, n]));
          const unplaced = nds.filter(n => !positions[n.id]);
          const MIN_SEP = 30; // minimum distance between any two nodes

          unplaced.forEach((n, idx) => {
            const neighbors = [];
            lks.forEach(l => {
              const sId = l.source?.id || l.source;
              const tId = l.target?.id || l.target;
              if (sId === n.id) { const nb = nodeMap.get(tId); if (nb && positions[tId]) neighbors.push(nb); }
              if (tId === n.id) { const nb = nodeMap.get(sId); if (nb && positions[sId]) neighbors.push(nb); }
            });
            if (neighbors.length > 0) {
              const avgX = neighbors.reduce((s, nb) => s + nb.x, 0) / neighbors.length;
              const avgY = neighbors.reduce((s, nb) => s + nb.y, 0) / neighbors.length;
              // Spread unplaced nodes in a circle around the avg neighbor position
              const angle = (idx / Math.max(unplaced.length, 1)) * Math.PI * 2;
              const radius = MIN_SEP * (1 + Math.floor(idx / 6));
              n.x = avgX + Math.cos(angle) * radius;
              n.y = avgY + Math.sin(angle) * radius;
            } else {
              n.x = cx + (Math.random() - 0.5) * 200;
              n.y = cy + (Math.random() - 0.5) * 200;
            }
          });

          // Collision resolution: push overlapping nodes apart
          for (let iter = 0; iter < 10; iter++) {
            let moved = false;
            for (let i = 0; i < nds.length; i++) {
              for (let j = i + 1; j < nds.length; j++) {
                const dx = nds[j].x - nds[i].x;
                const dy = nds[j].y - nds[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MIN_SEP && dist > 0) {
                  const push = (MIN_SEP - dist) / 2 + 1;
                  const ux = dx / dist, uy = dy / dist;
                  // Only push nodes that aren't pinned to KEGG positions
                  const iFixed = !!positions[nds[i].id];
                  const jFixed = !!positions[nds[j].id];
                  if (!iFixed && !jFixed) {
                    nds[i].x -= ux * push; nds[i].y -= uy * push;
                    nds[j].x += ux * push; nds[j].y += uy * push;
                    moved = true;
                  } else if (!iFixed) {
                    nds[i].x -= ux * push * 2; nds[i].y -= uy * push * 2;
                    moved = true;
                  } else if (!jFixed) {
                    nds[j].x += ux * push * 2; nds[j].y += uy * push * 2;
                    moved = true;
                  }
                } else if (dist === 0) {
                  // Exactly same position — nudge randomly
                  nds[j].x += MIN_SEP * (0.5 + Math.random());
                  nds[j].y += MIN_SEP * (0.5 + Math.random());
                  moved = true;
                }
              }
            }
            if (!moved) break;
          }
          return matched;
        };

        const finalize = (nds, matched) => {
          nds.forEach(n => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
          nodesRef.current = nds;
          needsFitRef.current = false;
          fitViewToNodes(nds);
          drawRef.current?.(nds);
          console.log(`[NEBULA] KEGG layout: ${matched}/${nds.length} compounds placed`);
        };

        if (keggPositionsRef.current) {
          const matched = applyKegg(nodesCopy, linksCopy, keggPositionsRef.current, centerX, centerY);
          finalize(nodesCopy, matched);
        } else {
          fetch('/api/kegg-layout')
            .then(r => r.json())
            .then(data => {
              keggPositionsRef.current = data.positions || {};
              const freshCopy = graph.nodes.map(n => ({ ...n }));
              const freshLinks = graph.links.map(l => ({ ...l }));
              const matched = applyKegg(freshCopy, freshLinks, keggPositionsRef.current, centerX, centerY);
              finalize(freshCopy, matched);
            })
            .catch(e => console.warn('[NEBULA] Failed to fetch KEGG layout:', e));
        }
        return;
      }

      // ── Normal force-directed layout ──
      // If toggling OFF kegg, clear position cache so force layout starts fresh
      if (keggJustToggled) {
        positionCacheRef.current = {};
        nodesCopy.forEach(n => { n.x = undefined; n.y = undefined; });
        needsFitRef.current = true;
      } else {
        // Snapshot current positions
        nodesRef.current.forEach(n => {
          positionCacheRef.current[n.id] = { x: n.x, y: n.y };
        });
      }

      applySimpleLayout(
        nodesCopy, linksCopy, centerX, centerY, positionCacheRef.current, spacingScale
      );

      // Grid-snap nodes when orthogonal edge style is active
      if (edgeStyle === 'orthogonal') {
        const G = 48; // must match gridSpacing
        nodesCopy.forEach(n => {
          n.x = Math.round(n.x / G) * G;
          n.y = Math.round(n.y / G) * G;
        });
        // Resolve collisions: no two nodes on the same grid point
        const occupied = new Map();
        nodesCopy.forEach(n => {
          const key = `${n.x},${n.y}`;
          if (occupied.has(key)) {
            // Nudge to nearest free grid cell
            for (let r = 1; r < 20; r++) {
              const offsets = [
                [r * G, 0], [-r * G, 0], [0, r * G], [0, -r * G],
                [r * G, r * G], [-r * G, r * G], [r * G, -r * G], [-r * G, -r * G],
              ];
              let placed = false;
              for (const [ox, oy] of offsets) {
                const nk = `${n.x + ox},${n.y + oy}`;
                if (!occupied.has(nk)) {
                  n.x += ox; n.y += oy;
                  occupied.set(nk, n.id);
                  placed = true;
                  break;
                }
              }
              if (placed) break;
            }
          } else {
            occupied.set(key, n.id);
          }
        });
      }

      nodesCopy.forEach(n => {
        positionCacheRef.current[n.id] = { x: n.x, y: n.y };
      });

      nodesRef.current = nodesCopy;

      // Auto-fit on new data
      if (data !== prevDataRef.current) {
        prevDataRef.current = data;
        needsFitRef.current = true;
      }

      if (needsFitRef.current && nodesCopy.length > 0) {
        needsFitRef.current = false;
        fitViewToNodes(nodesCopy);
      }

      drawRef.current?.(nodesCopy);
    }, [graph, height, spacingScale, data, edgeStyle, keggLayout, fitViewToNodes]);

    /* ── Canvas & Zoom setup ── */
    useEffect(() => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: true });

      const handleResize = () => {
        const cw = isFullscreen ? window.innerWidth : containerRef.current?.clientWidth || 800;
        const ch = isFullscreen
          ? window.innerHeight
          : typeof height === "string" ? parseInt(height) : height;
        canvas.width = cw * window.devicePixelRatio;
        canvas.height = ch * window.devicePixelRatio;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
        context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
        drawRef.current?.(nodesRef.current);
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      const zoom = d3
        .zoom()
        .scaleExtent([0.1, 10])
        .filter(ev => {
          if (ev.type !== "mousedown" && ev.type !== "pointerdown") return true;
          const rect = canvas.getBoundingClientRect();
          const mx = (ev.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const my = (ev.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          const useStruct = nodeDisplayRef.current === 'structure';
          const hitNode = nodesRef.current.find(n => {
            if (useStruct && structTexRef.current.has(n.id)) {
              const tex = structTexRef.current.get(n.id);
              const halfH = STRUCT_WORLD_H / 2;
              const halfW = halfH * (tex._aspect || 1);
              return Math.abs(mx - n.x) <= halfW && Math.abs(my - n.y) <= halfH;
            }
            return (mx - n.x) ** 2 + (my - n.y) ** 2 <= (R_COMPOUND + 4) ** 2;
          });
          return !hitNode;
        })
        .on("zoom", ev => {
          transformRef.current = ev.transform;
          drawRef.current?.(nodesRef.current);
        });
      d3.select(canvas).call(zoom);
      zoomRef.current = zoom;

      return () => {
        window.removeEventListener("resize", handleResize);
        d3.select(canvas).on(".zoom", null);
      };
    }, [containerRef, height, isFullscreen]);

    /* ── Pointer interactions ── */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let dragging = null;
      let didDrag = false;

      const hitTest = (mx, my) => {
        const nodes = nodesRef.current;
        const useStruct = nodeDisplayRef.current === 'structure';
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          if (useStruct && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const halfH = STRUCT_WORLD_H / 2;
            const halfW = halfH * (tex._aspect || 1);
            if (Math.abs(mx - n.x) <= halfW && Math.abs(my - n.y) <= halfH) return n;
          } else {
            if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (R_COMPOUND + 4) ** 2) return n;
          }
        }
        return null;
      };

      const worldCoords = e => {
        const rect = canvas.getBoundingClientRect();
        return {
          mx: (e.clientX - rect.left - transformRef.current.x) / transformRef.current.k,
          my: (e.clientY - rect.top - transformRef.current.y) / transformRef.current.k,
        };
      };

      const pointerdown = e => {
        const { mx, my } = worldCoords(e);
        const node = hitTest(mx, my);
        if (node) { dragging = node; didDrag = false; canvas.style.cursor = "grabbing"; }
      };

      const pointermove = e => {
        const { mx, my } = worldCoords(e);
        if (dragging) {
          dragging.x = mx; dragging.y = my; didDrag = true;
          drawRef.current?.(nodesRef.current);
          return;
        }
        const hit = hitTest(mx, my);
        const found = hit ? hit.id : null;
        if (found !== hoveredNodeRef.current) {
          hoveredNodeRef.current = found;
          canvas.style.cursor = found ? "pointer" : "grab";
          drawRef.current?.(nodesRef.current);
        }
      };

      const pointerup = () => {
        if (dragging) {
          const MIN_DIST = R_COMPOUND * 3;
          for (const other of nodesRef.current) {
            if (other === dragging) continue;
            const dx = dragging.x - other.x;
            const dy = dragging.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST && dist > 0) {
              const push = (MIN_DIST - dist) / 2 + 1;
              dragging.x += (dx / dist) * push;
              dragging.y += (dy / dist) * push;
            }
          }
          positionCacheRef.current[dragging.id] = { x: dragging.x, y: dragging.y };
          drawRef.current?.(nodesRef.current);
          dragging = null;
          canvas.style.cursor = "grab";
        }
      };

      const handleClick = evt => {
        if (didDrag) { didDrag = false; return; }
        const { mx, my } = worldCoords(evt);
        const hit = hitTest(mx, my);

        if (evt.shiftKey && hit) {
          const pinned = pinnedNodesRef.current;
          if (pinned.has(hit.id)) pinned.delete(hit.id);
          else pinned.add(hit.id);
          drawRef.current?.(nodesRef.current);
          syncSelectionRef.current?.();
          return;
        }

        if (hit && !evt.ctrlKey) {
          const pinned = pinnedNodesRef.current;
          if (pinned.size === 1 && pinned.has(hit.id)) pinned.clear();
          else { pinned.clear(); pinned.add(hit.id); }
          drawRef.current?.(nodesRef.current);
          syncSelectionRef.current?.();
          return;
        }

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

    /* ── Imperative API ── */
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        d3.select(canvasRef.current).transition().call(zoomRef.current.scaleBy, 1.5);
      },
      zoomOut: () => {
        d3.select(canvasRef.current).transition().call(zoomRef.current.scaleBy, 0.75);
      },
      resetView: () => {
        const canvas = canvasRef.current;
        if (!canvas || !zoomRef.current) return;
        const nodes = nodesRef.current;
        const cw = canvas.clientWidth || 800;
        const ch = canvas.clientHeight || 600;
        if (!nodes.length) {
          d3.select(canvas).transition().call(zoomRef.current.transform, d3.zoomIdentity);
          return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
          minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
        });
        const pad = 60;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const gw = maxX - minX || 1;
        const gh = maxY - minY || 1;
        const scale = Math.min(cw / gw, ch / gh, 1.5);
        const tx = (cw - gw * scale) / 2 - minX * scale;
        const ty = (ch - gh * scale) / 2 - minY * scale;
        const tr = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(canvas).transition().duration(400).call(zoomRef.current.transform, tr);
      },
      resetLayout: () => {
        const ch = typeof height === "string" ? parseInt(height) : height;
        const cw = canvasRef.current?.clientWidth || 800;
        positionCacheRef.current = {};
        const nodes = nodesRef.current;
        nodes.forEach(n => { n.x = undefined; n.y = undefined; });
        applySimpleLayout(nodes, graph.links, cw / 2, ch / 2, {}, spacingScale);
        // Grid-snap if orthogonal
        if (edgeStyle === 'orthogonal') {
          const G = 48;
          nodes.forEach(n => {
            n.x = Math.round(n.x / G) * G;
            n.y = Math.round(n.y / G) * G;
          });
          const occ = new Map();
          nodes.forEach(n => {
            const k = `${n.x},${n.y}`;
            if (occ.has(k)) {
              for (let r = 1; r < 20; r++) {
                for (const [ox, oy] of [[r*G,0],[-r*G,0],[0,r*G],[0,-r*G],[r*G,r*G],[-r*G,r*G],[r*G,-r*G],[-r*G,-r*G]]) {
                  const nk = `${n.x+ox},${n.y+oy}`;
                  if (!occ.has(nk)) { n.x += ox; n.y += oy; occ.set(nk, n.id); break; }
                }
                if (occ.has(`${n.x},${n.y}`) && occ.get(`${n.x},${n.y}`) === n.id) break;
              }
            } else { occ.set(k, n.id); }
          });
        }
        nodes.forEach(n => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
        draw(nodes);
      },
      downloadSVG: () => {
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        const useStruct = nodeDisplayRef.current === 'structure';
        const SH = STRUCT_WORLD_H;
        const halfH = SH / 2;
        const isOrtho = edgeStyle === 'orthogonal';
        const G = 48;
        const R = R_COMPOUND;
        const hasPinned = pinnedNodesRef.current.size > 0;

        // ── Bounding box ──
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
          if (useStruct && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const hw = halfH * (tex._aspect || 1);
            minX = Math.min(minX, n.x - hw); maxX = Math.max(maxX, n.x + hw);
            minY = Math.min(minY, n.y - halfH); maxY = Math.max(maxY, n.y + halfH);
          } else {
            minX = Math.min(minX, n.x - R); maxX = Math.max(maxX, n.x + R);
            minY = Math.min(minY, n.y - R); maxY = Math.max(maxY, n.y + R);
          }
        });
        const pad = 80;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const svgW = maxX - minX;
        const svgH = maxY - minY;

        // ── Highlight set (only if pinned) ──
        let highlightIds = null;
        if (hasPinned) {
          const sel = new Set(pinnedNodesRef.current);
          highlightIds = new Set(sel);
          graph.links.forEach(l => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            if (sel.has(sId)) highlightIds.add(tId);
            if (sel.has(tId)) highlightIds.add(sId);
          });
        }
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        // ── Node color helper ──
        const degMap = new Map();
        if (colorMode === 'degree') {
          graph.links.forEach(l => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            degMap.set(sId, (degMap.get(sId) || 0) + 1);
            degMap.set(tId, (degMap.get(tId) || 0) + 1);
          });
        }
        const maxDeg = degMap.size > 0 ? Math.max(1, ...degMap.values()) : 1;
        const nodeColor = (n) => {
          if (colorMode === 'type') return getTypeColor(n.type, dark);
          if (colorMode === 'degree') {
            const deg = degMap.get(n.id) || 0;
            const b = Math.round((deg / maxDeg) * 100);
            return getSchemeColor(colorScheme, b / 100, dark);
          }
          const gen = n.generation || 0;
          const b = maxGeneration > 0 ? Math.round((gen / maxGeneration) * 100) : 0;
          return getSchemeColor(colorScheme, b / 100, dark);
        };

        const svg = [];
        svg.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="${minX} ${minY} ${svgW} ${svgH}">`);


        // ── Edge routing helpers (same as draw) ──
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const snap = (v) => Math.round(v / G) * G;
        const nodeOccGrid = new Map();
        if (isOrtho) {
          nodes.forEach(n => {
            const gx = snap(n.x), gy = snap(n.y);
            for (let ox = -G; ox <= G; ox += G) {
              for (let oy = -G; oy <= G; oy += G) {
                const cx = gx + ox, cy = gy + oy;
                if (Math.abs(cx - n.x) < G * 0.8 && Math.abs(cy - n.y) < G * 0.8)
                  nodeOccGrid.set(`${cx},${cy}`, n.id);
              }
            }
          });
        }
        const hSegBlocked = (segY, x1, x2, skipA, skipB) => {
          const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
          for (let gx = snap(lo); gx <= hi + G / 2; gx += G) {
            const occ = nodeOccGrid.get(`${gx},${snap(segY)}`);
            if (occ && occ !== skipA && occ !== skipB) return true;
          } return false;
        };
        const vSegBlocked = (segX, y1, y2, skipA, skipB) => {
          const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
          for (let gy = snap(lo); gy <= hi + G / 2; gy += G) {
            const occ = nodeOccGrid.get(`${snap(segX)},${gy}`);
            if (occ && occ !== skipA && occ !== skipB) return true;
          } return false;
        };
        const surfPt = (node, dx, dy) => {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d === 0) return { x: node.x, y: node.y };
          return { x: node.x + dx / d * R, y: node.y + dy / d * R };
        };
        const pathPointAtFrac = (path, frac) => {
          let totalLen = 0; const segs = [];
          for (let i = 1; i < path.length; i++) {
            const sdx = path[i].x - path[i - 1].x, sdy = path[i].y - path[i - 1].y;
            const slen = Math.sqrt(sdx * sdx + sdy * sdy);
            segs.push({ dx: sdx, dy: sdy, len: slen }); totalLen += slen;
          }
          let rem = totalLen * frac;
          for (let i = 0; i < segs.length; i++) {
            if (rem <= segs[i].len && segs[i].len > 0) {
              const f = rem / segs[i].len;
              return { x: path[i].x + segs[i].dx * f, y: path[i].y + segs[i].dy * f, dx: segs[i].dx / segs[i].len, dy: segs[i].dy / segs[i].len };
            }
            rem -= segs[i].len;
          }
          const last = segs[segs.length - 1] || { dx: 1, dy: 0, len: 1 };
          return { x: path[path.length - 1].x, y: path[path.length - 1].y, dx: last.dx / (last.len || 1), dy: last.dy / (last.len || 1) };
        };

        // Parallel edge counting
        const pairCount = new Map();
        const pairIdx = new Map();
        const allEdges = [];
        graph.links.forEach((l, li) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          const src = nodeMap.get(sId), trg = nodeMap.get(tId);
          if (!src || !trg) return;
          const idx = allEdges.length;
          allEdges.push({ src, trg, link: l });
          const key = [src.id, trg.id].sort().join('||');
          if (!pairCount.has(key)) pairCount.set(key, 0);
          pairIdx.set(idx, pairCount.get(key));
          pairCount.set(key, pairCount.get(key) + 1);
        });

        const edgeR = dark ? 140 : 160, edgeG = dark ? 160 : 170, edgeB = dark ? 190 : 185;
        const edgeCol = `rgb(${edgeR},${edgeG},${edgeB})`;

        // ── Draw edges ──
        svg.push('<g fill="none" stroke-linecap="round" stroke-linejoin="round">');
        allEdges.forEach(({ src, trg, link }, idx) => {
          const isDimmed = highlightIds && !highlightIds.has(src.id) && !highlightIds.has(trg.id);
          const alpha = isDimmed ? 0.08 : 0.4;
          const sw = isDimmed ? 0.5 : 1;

          const pKey = [src.id, trg.id].sort().join('||');
          const total = pairCount.get(pKey) || 1;
          const myIdx = pairIdx.get(idx) || 0;
          const offset = total === 1 ? 0 : (myIdx - (total - 1) / 2) * G;

          let pathPts;
          if (isOrtho) {
            const dx_raw = trg.x - src.x, dy_raw = trg.y - src.y;
            const sId = src.id, tId = trg.id;
            let sp, tp, routeType;
            if (Math.abs(dx_raw) >= Math.abs(dy_raw)) {
              sp = dx_raw >= 0 ? { x: src.x + R, y: src.y } : { x: src.x - R, y: src.y };
              tp = dx_raw >= 0 ? { x: trg.x - R, y: trg.y } : { x: trg.x + R, y: trg.y };
              routeType = 'h';
            } else {
              sp = dy_raw >= 0 ? { x: src.x, y: src.y + R } : { x: src.x, y: src.y - R };
              tp = dy_raw >= 0 ? { x: trg.x, y: trg.y - R } : { x: trg.x, y: trg.y + R };
              routeType = 'v';
            }

            if (routeType === 'h') {
              if (Math.abs(sp.y - tp.y) < 2 && Math.abs(offset) < 2 && !hSegBlocked(sp.y, sp.x, tp.x, sId, tId)) {
                pathPts = [sp, tp];
              } else {
                const baseChX = snap((sp.x + tp.x) / 2) + offset;
                let bestChX = baseChX;
                for (let a = 0; a < 12; a++) {
                  const testX = a === 0 ? baseChX : baseChX + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snX = snap(testX);
                  if (!hSegBlocked(sp.y, sp.x, snX, sId, tId) && !vSegBlocked(snX, sp.y, tp.y, sId, tId) && !hSegBlocked(tp.y, snX, tp.x, sId, tId)) {
                    bestChX = snX; break;
                  }
                }
                pathPts = [sp, { x: bestChX, y: sp.y }, { x: bestChX, y: tp.y }, tp];
              }
            } else {
              if (Math.abs(sp.x - tp.x) < 2 && Math.abs(offset) < 2 && !vSegBlocked(sp.x, sp.y, tp.y, sId, tId)) {
                pathPts = [sp, tp];
              } else {
                const baseChY = snap((sp.y + tp.y) / 2) + offset;
                let bestChY = baseChY;
                for (let a = 0; a < 12; a++) {
                  const testY = a === 0 ? baseChY : baseChY + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snY = snap(testY);
                  if (!vSegBlocked(sp.x, sp.y, snY, sId, tId) && !hSegBlocked(snY, sp.x, tp.x, sId, tId) && !vSegBlocked(tp.x, snY, tp.y, sId, tId)) {
                    bestChY = snY; break;
                  }
                }
                pathPts = [sp, { x: sp.x, y: bestChY }, { x: tp.x, y: bestChY }, tp];
              }
            }

            // SVG path with rounded corners
            const bR = Math.min(G * 0.35, 8);
            let d = `M ${pathPts[0].x} ${pathPts[0].y}`;
            for (let pi = 1; pi < pathPts.length - 1; pi++) {
              const prev = pathPts[pi - 1], cur = pathPts[pi], next = pathPts[pi + 1];
              const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y;
              const dx2 = next.x - cur.x, dy2 = next.y - cur.y;
              const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
              const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
              const r = Math.min(bR, d1 / 2, d2 / 2);
              const ax = cur.x - (dx1 / d1) * r, ay = cur.y - (dy1 / d1) * r;
              const bx = cur.x + (dx2 / d2) * r, by = cur.y + (dy2 / d2) * r;
              d += ` L ${ax} ${ay} Q ${cur.x} ${cur.y} ${bx} ${by}`;
            }
            d += ` L ${pathPts[pathPts.length - 1].x} ${pathPts[pathPts.length - 1].y}`;
            svg.push(`<path d="${d}" stroke="${edgeCol}" stroke-opacity="${alpha}" stroke-width="${sw}"/>`);
          } else {
            // Curved
            const dx = trg.x - src.x, dy = trg.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const s0 = surfPt(src, dx, dy), s1 = surfPt(trg, -dx, -dy);
            const nx = -dy / dist, ny = dx / dist;
            const curveOff = total === 1 ? 0 : (myIdx - (total - 1) / 2) * 18;
            const curvature = Math.min(dist * 0.15, 30) + curveOff;
            const cpx = (s0.x + s1.x) / 2 + nx * curvature;
            const cpy = (s0.y + s1.y) / 2 + ny * curvature;
            svg.push(`<path d="M ${s0.x} ${s0.y} Q ${cpx} ${cpy} ${s1.x} ${s1.y}" stroke="${edgeCol}" stroke-opacity="${alpha}" stroke-width="${sw}"/>`);
            pathPts = [s0, { x: cpx, y: cpy }, s1];
          }

          // Arrow
          if (pathPts) {
            const arrowFrac = total <= 1 ? 0.5 : 0.3 + (myIdx / Math.max(total - 1, 1)) * 0.4;
            const mid = isOrtho ? pathPointAtFrac(pathPts, arrowFrac)
              : (() => {
                  const s0 = pathPts[0], cp = pathPts[1], s1 = pathPts[2];
                  const bx = 0.25 * s0.x + 0.5 * cp.x + 0.25 * s1.x;
                  const by = 0.25 * s0.y + 0.5 * cp.y + 0.25 * s1.y;
                  const tdx = (cp.x - s0.x) * 0.5 + (s1.x - cp.x) * 0.5;
                  const tdy = (cp.y - s0.y) * 0.5 + (s1.y - cp.y) * 0.5;
                  const tl = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                  return { x: bx, y: by, dx: tdx / tl, dy: tdy / tl };
                })();
            const aSize = 6;
            const p1x = mid.x + mid.dx * aSize, p1y = mid.y + mid.dy * aSize;
            const p2x = mid.x - mid.dx * aSize * 0.45 + mid.dy * aSize * 0.55;
            const p2y = mid.y - mid.dy * aSize * 0.45 - mid.dx * aSize * 0.55;
            const p3x = mid.x - mid.dx * aSize * 0.45 - mid.dy * aSize * 0.55;
            const p3y = mid.y - mid.dy * aSize * 0.45 + mid.dx * aSize * 0.55;
            svg.push(`<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}" fill="${edgeCol}" fill-opacity="${Math.min(alpha * 1.8, 0.95)}"/>`);
          }
        });
        svg.push('</g>');

        // ── Nodes ──
        svg.push('<g>');
        nodes.forEach(n => {
          const isDimmed = highlightIds && !highlightIds.has(n.id);
          const opacity = isDimmed ? 0.4 : 1;
          const { fill, stroke } = nodeColor(n);
          const tex = useStruct ? structTexRef.current.get(n.id) : null;

          if (tex) {
            const aspect = tex._aspect || 1;
            const drawW = SH * aspect;
            const hw = drawW / 2;
            // Convert canvas to base64 data URI
            const dataUrl = tex.toDataURL('image/png');
            svg.push(`<image x="${n.x - hw}" y="${n.y - halfH}" width="${drawW}" height="${SH}" href="${dataUrl}" opacity="${opacity}"/>`);
          } else {
            svg.push(`<circle cx="${n.x}" cy="${n.y}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" opacity="${opacity}"/>`);
          }
        });
        svg.push('</g>');

        // ── Labels ──
        svg.push('<g font-family="Inter, sans-serif" font-weight="500" font-size="7" text-anchor="middle">');
        const labelOff = useStruct ? halfH + 3 : R + 3;
        nodes.forEach(n => {
          const isDimmed = highlightIds && !highlightIds.has(n.id);
          const opacity = isDimmed ? 0.4 : 1;
          const col = (highlightIds && highlightIds.has(n.id))
            ? (dark ? '#93C5FD' : '#2563EB')
            : (dark ? '#94A3B8' : '#64748B');
          svg.push(`<text x="${n.x}" y="${n.y + labelOff + 6}" fill="${col}" opacity="${opacity}">${esc(n.label ?? n.id)}</text>`);
        });
        svg.push('</g>');

        svg.push('</svg>');
        const blob = new Blob(svg, { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'metabolic-map.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      getNodePositions: () => {
        const positions = {};
        nodesRef.current.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
        return positions;
      },
      setNodePositions: (positions) => {
        if (!positions) return;
        nodesRef.current.forEach(n => {
          const pos = positions[n.id];
          if (pos) { n.x = pos.x; n.y = pos.y; }
        });
        draw(nodesRef.current);
      },
      tightenEdges: () => {
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        const nodeRadius = () => R_COMPOUND * 2.5;
        const EDGE_TENSION = 0.05;
        const REPEL = 0.002;
        const DAMPING = 0.80;
        const MAX_ITERS = 400;
        const CONVERGE = 0.15;

        const edgeList = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        (graph.links || []).forEach(l => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          if (nodeMap.has(sId) && nodeMap.has(tId)) edgeList.push([sId, tId]);
        });

        const N = nodes.length;
        const radii = nodes.map(() => nodeRadius());
        const idxOf = new Map();
        nodes.forEach((n, i) => idxOf.set(n.id, i));
        const vx = new Float64Array(N);
        const vy = new Float64Array(N);

        for (let iter = 0; iter < MAX_ITERS; iter++) {
          const fx = new Float64Array(N);
          const fy = new Float64Array(N);

          for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
              const ex = nodes[i].x - nodes[j].x;
              const ey = nodes[i].y - nodes[j].y;
              const dist = Math.sqrt(ex * ex + ey * ey) || 0.1;
              const ux = ex / dist, uy = ey / dist;
              const minDist = radii[i] + radii[j];
              if (dist < minDist) {
                const push = (minDist - dist) * 1.5;
                fx[i] += ux * push; fy[i] += uy * push;
                fx[j] -= ux * push; fy[j] -= uy * push;
              } else if (dist < 200) {
                const repF = REPEL * minDist * minDist / (dist * dist);
                fx[i] += ux * repF; fy[i] += uy * repF;
                fx[j] -= ux * repF; fy[j] -= uy * repF;
              }
            }
          }

          edgeList.forEach(([sId, tId]) => {
            const si = idxOf.get(sId), ti = idxOf.get(tId);
            if (si === undefined || ti === undefined) return;
            const ex = nodes[ti].x - nodes[si].x;
            const ey = nodes[ti].y - nodes[si].y;
            const dist = Math.sqrt(ex * ex + ey * ey) || 0.1;
            const minE = radii[si] + radii[ti];
            if (dist > minE) {
              const pull = (dist - minE) * EDGE_TENSION / dist;
              fx[si] += ex * pull; fy[si] += ey * pull;
              fx[ti] -= ex * pull; fy[ti] -= ey * pull;
            }
          });

          let maxDisp = 0;
          for (let i = 0; i < N; i++) {
            vx[i] = (vx[i] + fx[i]) * DAMPING;
            vy[i] = (vy[i] + fy[i]) * DAMPING;
            const disp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
            const maxStep = 5;
            if (disp > maxStep) { vx[i] *= maxStep / disp; vy[i] *= maxStep / disp; }
            nodes[i].x += vx[i]; nodes[i].y += vy[i];
            if (disp > maxDisp) maxDisp = disp;
          }
          if (maxDisp < CONVERGE) break;
        }

        nodes.forEach(n => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
        draw(nodes);
      },
    }));

    return (
      <div className="relative w-full h-full">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />
        <NodeInfoPanel
          selectedNodes={selectedNodes}
          degreeMap={degreeMap}
          onDeselectNode={handleDeselectNode}
          nodeReactionsMap={nodeReactionsMap}
        />
      </div>
    );
  }
);

export default GraphCanvas;
