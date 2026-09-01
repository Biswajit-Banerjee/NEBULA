import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
  useContext,
} from "react";
import { getApiUrl } from '../../config/api';
import * as d3 from "d3";
import { processSimpleGraph, pruneSimpleGraph } from "./utils/graphProcessing";
import { applySimpleLayout } from "./utils/layout";
import { getSchemeColor, getTypeColor } from "../NetworkViewer2D/utils/colorSchemes";
import { ThemeContext } from "../ThemeProvider/ThemeProvider";
import NodeInfoPanel from "../NetworkViewer2D/NodeInfoPanel";
import SmilesDrawer from "smiles-drawer";
import { KEGG_SCALE, R_COMPOUND, applyKeggLayout } from "./keggLayoutEngine";

const _edgeKey = (l) => {
  const s = l.source?.id || l.source;
  const t = l.target?.id || l.target;
  return `${s}||${t}||${l.reactionId || l.label || ''}`;
};

const _distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const tt = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + tt * dx), py - (ay + tt * dy));
};

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
      nodeSizeScale = 1.0,
      colorMode = "generation",
      colorScheme = "viridis",
      bgColor = "",
      gridColor = "",
      edgeStyle = "curved",
      pruneEdges = true,
      nodeDisplay = "circle",
      showNames = false,
      keggLayout = false,
      showAllKegg = false,
      showKeggLines = false,
      hideEdges = false,
      showPathways = false,
      keggBgOpacity = 0.25,
      backboneMatchIds = null,
    },
    ref
  ) => {
    const { dark, themeName } = useContext(ThemeContext);
    const canvasRef = useRef(null);
    const nodesRef = useRef([]);
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const positionCacheRef = useRef({});
    const hoveredNodeRef = useRef(null);
    const pinnedNodesRef = useRef(new Set());
    const lockedNodesRef = useRef(new Set()); // locked (immovable) node IDs
    const selBoxRef = useRef(null);           // ctrl+drag selection rect {x1,y1,x2,y2}
    const multiDragRef = useRef(null);        // [{node,offX,offY}] for group drag
    const [selectedNodes, setSelectedNodes] = useState([]);
    const drawRef = useRef(null);
    const syncSelectionRef = useRef(null);
    const needsFitRef = useRef(true);
    const prevDataRef = useRef(null);
    const prevShowAllKeggRef = useRef(showAllKegg);
    const prevShowKeggLinesRef = useRef(showKeggLines);
    const smilesDataRef = useRef({});       // { compoundId: smilesString }
    const structTexRef = useRef(new Map());  // Map<compoundId, OffscreenCanvas>
    const nodeDisplayRef = useRef(nodeDisplay);
    nodeDisplayRef.current = nodeDisplay;
    const compoundNamesRef = useRef(new Map()); // Map<compoundId, name string>
    const showNamesRef = useRef(showNames);
    showNamesRef.current = showNames;
    const nodeSizeScaleRef = useRef(nodeSizeScale);
    nodeSizeScaleRef.current = nodeSizeScale;
    const hideEdgesRef = useRef(hideEdges);
    const showAllKeggRef = useRef(showAllKegg);
    const showKeggLinesRef = useRef(showKeggLines);
    const keggBgOpacityRef = useRef(keggBgOpacity);
    const keggPositionsRef = useRef(null);   // { compoundId: {x, y} } from KEGG map
    const keggFallbackPositionsRef = useRef(null); // { compoundId: {x, y, tier} } precomputed offline (scripts/precompute_kegg_fallback_positions.py)
    const keggPosArrayRef = useRef([]);       // pre-cached [[id, {x,y}], ...] — avoids Object.entries() every frame
    const prevKeggLayoutRef = useRef(false);
    const keggLayoutRef = useRef(keggLayout);
    keggLayoutRef.current = keggLayout;
    const keggBgLinesImageRef = useRef(null);   // pre-loaded Image of map01100_bg_notext.svg (skeleton lines/ellipses)
    const keggBgTextImageRef = useRef(null);    // pre-loaded Image of map01100_bg_textonly.svg (native region-name text)
    const zoomRafRef = useRef(null);            // rAF handle to throttle zoom redraws
    const orthoRouteCacheRef = useRef({ posHash: null, routes: new Map() }); // cached orthogonal edge routes
    const localEditsRef = useRef({ deletedNodes: new Set(), deletedEdges: new Set(), addedEdges: [] });
    const localEditsVersionRef = useRef(0); // bumped whenever localEditsRef mutates — used to invalidate the per-frame draw cache below
    // Per-frame draw cache: nodeMap/drawNodes/drawLinks/pairCount/pairIdx only depend on
    // (nodes array identity, graph identity, local edits version) — NOT on pan/zoom/hover —
    // so at large scale (thousands of nodes/edges) we avoid rebuilding these Maps/arrays
    // on every single animation frame during drag/pan/zoom, which was the main jank source.
    const drawCacheRef = useRef({ nodesArr: null, graphObj: null, editsVersion: -1, nodeMap: null, drawNodes: null, drawLinks: null, pairCount: null, pairIdx: null });
    const themeColorsRef = useRef(null); // cached CSS custom-property reads — recomputed only when `dark` changes, not every draw() call
    const [ctxMenu, setCtxMenu] = useState(null); // { x, y, type:'node'|'edge', nodeId?, link? }

    const [graph, setGraph] = useState({ nodes: [], links: [] });
    const graphRef = useRef({ nodes: [], links: [] });
    graphRef.current = graph;

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

    // Apply a spatial transform to all selected (pinned) nodes around their centroid
    const applyGroupTransform = useCallback((type) => {
      const pinned = pinnedNodesRef.current;
      if (!pinned.size) return;
      const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]));
      const sel = [];
      pinned.forEach(id => { const n = nodeMap.get(id); if (n) sel.push(n); });
      if (!sel.length) return;
      const cx = sel.reduce((s, n) => s + n.x, 0) / sel.length;
      const cy = sel.reduce((s, n) => s + n.y, 0) / sel.length;
      sel.forEach(n => {
        const dx = n.x - cx, dy = n.y - cy;
        if      (type === 'flipH')    { n.x = cx - dx; }
        else if (type === 'flipV')    { n.y = cy - dy; }
        else if (type === 'rot90cw')  { n.x = cx + dy; n.y = cy - dx; }
        else if (type === 'rot90ccw') { n.x = cx - dy; n.y = cy + dx; }
        else if (type === 'rot180')   { n.x = cx - dx; n.y = cy - dy; }
        positionCacheRef.current[n.id] = { x: n.x, y: n.y };
      });
      drawRef.current?.(nodesRef.current);
      setCtxMenu(null);
    }, []);

    /* ── Build graph when raw data or pruning changes ── */
    useEffect(() => {
      if (!Array.isArray(data)) return;
      const raw = processSimpleGraph(data);
      const processed = pruneEdges ? pruneSimpleGraph(raw) : raw;
      setGraph(processed);
    }, [data, pruneEdges]);

    /* ── Update hideEdges ref when prop changes ── */
    useEffect(() => {
      hideEdgesRef.current = hideEdges;
    }, [hideEdges]);

    /* ── Update KEGG refs when props change ── */
    useEffect(() => {
      showAllKeggRef.current = showAllKegg;
      showKeggLinesRef.current = showKeggLines;
      keggBgOpacityRef.current = keggBgOpacity;
    }, [showAllKegg, showKeggLines, keggBgOpacity]);

    /* ── Fetch structures & pre-render textures ── */
    const STRUCT_TEX = 1024;      // high-res offscreen canvas
    const STRUCT_WORLD_H = 56;    // fixed size in world units (square)

    // Element colors for MOL renderer
    const ELEM_COLORS_DARK = { C: '#cbd5e1', O: '#ef4444', N: '#3b82f6', S: '#eab308', P: '#f97316', F: '#22c55e', Cl: '#14b8a6', Br: '#d97706', I: '#8b5cf6', H: '#cbd5e1' };
    const ELEM_COLORS_LIGHT = { C: '#334155', O: '#dc2626', N: '#2563eb', S: '#ca8a04', P: '#ea580c', F: '#16a34a', Cl: '#0d9488', Br: '#b45309', I: '#7c3aed', H: '#334155' };

    // Renderers (renderMol, SmilesDrawer, renderNameTex) all draw into a fixed
    // SQUARE offscreen canvas, but the actual drawn content (molecule/text)
    // rarely fills the whole square — it's scaled-to-fit and centered, leaving
    // empty transparent padding on the shorter axis. Since node labels are
    // positioned at a fixed offset below the texture's own bottom EDGE (not
    // below the visible content), that empty padding used to show up as a
    // large, inconsistent gap between the structure and its label. This crops
    // the texture to the tight bounding box of its non-transparent pixels and
    // records the real content aspect ratio, so labels sit right below the
    // actual visible structure regardless of its shape.
    const cropToContent = (canvas, paddingFrac = 0.06) => {
      const w = canvas.width, h = canvas.height;
      const ctx = canvas.getContext('2d');
      let data;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        canvas._aspect = 1;
        return canvas;
      }
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        const rowOff = y * w * 4;
        for (let x = 0; x < w; x++) {
          if (data[rowOff + x * 4 + 3] > 8) { // alpha threshold
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) {
        canvas._aspect = 1;
        return canvas;
      }
      const padX = Math.max(4, (maxX - minX) * paddingFrac);
      const padY = Math.max(4, (maxY - minY) * paddingFrac);
      const sx = Math.max(0, minX - padX), sy = Math.max(0, minY - padY);
      const sw = Math.min(w, maxX + padX) - sx;
      const sh = Math.min(h, maxY + padY) - sy;
      const out = document.createElement('canvas');
      out.width = sw; out.height = sh;
      out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      out._aspect = sw / sh;
      return out;
    };

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

      return cropToContent(canvas);
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

      return cropToContent(canvas);
    };

    useEffect(() => {
      if (nodeDisplay !== 'structure' || !graph.nodes.length) return;
      let cancelled = false;
      const abortCtrl = new AbortController();

      // Collect both C and Z compound IDs
      const compoundIds = graph.nodes
        .filter(n => n.type === 'compound' || !n.type)
        .map(n => n.id)
        .filter(id => /^[CZ]\d{5}$/.test(id));

      const needed = compoundIds.filter(id => !structTexRef.current.has(id));
      if (needed.length === 0) return;

      (async () => {
        try {
          const resp = await fetch(getApiUrl('smiles'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compound_ids: needed }),
            signal: abortCtrl.signal,
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
                  if (structTexRef.current.size > 500) structTexRef.current.clear();
                  structTexRef.current.set(cid, cropToContent(offscreen));
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
                  if (tex) {
                    if (structTexRef.current.size > 500) structTexRef.current.clear();
                    structTexRef.current.set(cid, tex);
                  }
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
              if (tex) {
                if (structTexRef.current.size > 500) structTexRef.current.clear();
                structTexRef.current.set(cid, tex);
              }
            }
          }

          if (!cancelled) drawRef.current?.(nodesRef.current);
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('[NEBULA] Structure fetch failed:', e);
        }
      })();

      return () => { cancelled = true; abortCtrl.abort(); };
    }, [graph.nodes, nodeDisplay, dark]);

    /* ── Fetch compound names ── */
    useEffect(() => {
      if (!showNames || !graph.nodes.length) return;
      let cancelled = false;
      const abortCtrl = new AbortController();

      const compoundIds = graph.nodes
        .filter(n => n.type === 'compound' || !n.type)
        .map(n => n.id)
        .filter(id => /^[CZ]\d{5}$/.test(id))
        .filter(id => !compoundNamesRef.current.has(id));

      if (compoundIds.length === 0) return;

      (async () => {
        try {
          const resp = await fetch(getApiUrl('compound-names'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compound_ids: compoundIds }),
            signal: abortCtrl.signal,
          });
          if (!resp.ok || cancelled) return;
          const { names } = await resp.json();
          if (cancelled) return;
          Object.entries(names || {}).forEach(([id, name]) => {
            if (name) compoundNamesRef.current.set(id, name);
          });
          drawRef.current?.(nodesRef.current);
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('[NEBULA] Compound name fetch failed:', e);
        }
      })();

      return () => { cancelled = true; abortCtrl.abort(); };
    }, [graph.nodes, showNames]);

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

      // ── Cached per-frame data ──
      // nodeMap/drawNodes/drawLinks/pairCount/pairIdx only change when the node/edge
      // *set* changes (new data or a local edit), never on pan/zoom/hover alone — so we
      // rebuild them only when (nodes array identity, graph identity, edits version)
      // differs from last time, instead of on every single animation frame.
      const cache = drawCacheRef.current;
      const cacheHit = cache.nodesArr === nodes && cache.graphObj === graph && cache.editsVersion === localEditsVersionRef.current;
      let drawNodes, drawLinks, nodeMap, pairCount, pairIdx;
      if (cacheHit) {
        drawNodes = cache.drawNodes;
        drawLinks = cache.drawLinks;
        nodeMap = cache.nodeMap;
        pairCount = cache.pairCount;
        pairIdx = cache.pairIdx;
      } else {
        const { deletedNodes, deletedEdges, addedEdges } = localEditsRef.current;
        drawNodes = nodes.filter(n => !deletedNodes.has(n.id));
        drawLinks = [
          ...graph.links.filter(l => !deletedEdges.has(_edgeKey(l))),
          ...addedEdges,
        ];
        nodeMap = new Map(drawNodes.map(n => [n.id, n]));

        // Parallel-edge counts computed once over ALL edges (not just the
        // currently-visible ones) so offsets stay stable while panning.
        pairCount = new Map();
        pairIdx = new Map();
        drawLinks.forEach((l, idx) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          const key = [sId, tId].sort().join('||');
          const c = pairCount.get(key) || 0;
          pairIdx.set(idx, c);
          pairCount.set(key, c + 1);
        });

        cache.nodesArr = nodes;
        cache.graphObj = graph;
        cache.editsVersion = localEditsVersionRef.current;
        cache.drawNodes = drawNodes;
        cache.drawLinks = drawLinks;
        cache.nodeMap = nodeMap;
        cache.pairCount = pairCount;
        cache.pairIdx = pairIdx;
      }

      // Read theme colors from CSS custom properties for canvas rendering —
      // cached and only recomputed when `dark` changes (getComputedStyle forces a
      // style recalc, which is expensive to pay on every single animation frame).
      if (!themeColorsRef.current || themeColorsRef.current.themeName !== themeName) {
        const _cs = getComputedStyle(document.documentElement);
        const _rv = (v) => { const r = _cs.getPropertyValue(v).trim(); return r ? r.replace(/ /g, ',') : null; };
        themeColorsRef.current = {
          dark,
          themeName,
          themeTextMuted: _rv('--text-muted') || (dark ? '148,163,184' : '100,116,139'),
          themeTextSecondary: _rv('--text-secondary') || (dark ? '148,163,184' : '71,85,105'),
          themeBorderPrimary: _rv('--border-primary') || (dark ? '140,160,190' : '160,170,185'),
          themeBorderSecondary: _rv('--border-secondary') || (dark ? '148,163,184' : '100,116,139'),
          themeSurfacePrimary: _rv('--surface-primary') || (dark ? '30,41,59' : '255,255,255'),
          themeBrandPrimary: _rv('--brand-primary') || (dark ? '167,139,250' : '124,58,237'),
          themeInfo: _rv('--info') || (dark ? '147,197,253' : '37,99,235'),
        };
      }
      const {
        themeTextMuted, themeTextSecondary, themeBorderPrimary, themeBorderSecondary,
        themeSurfacePrimary, themeBrandPrimary, themeInfo,
      } = themeColorsRef.current;

      // Viewport culling
      const CULL_MARGIN = 60;
      const viewMinX = (-t.x) / t.k - CULL_MARGIN;
      const viewMinY = (-t.y) / t.k - CULL_MARGIN;
      const viewMaxX = (-t.x + w) / t.k + CULL_MARGIN;
      const viewMaxY = (-t.y + h) / t.k + CULL_MARGIN;
      const inView = (x, y) =>
        x >= viewMinX && x <= viewMaxX && y >= viewMinY && y <= viewMaxY;

      /* ── Grid (skip when zoomed out too far — lines would be sub-pixel) ── */
      const gridSpacing = 10;
      const gridScreenPx = gridSpacing * t.k;
      if (gridScreenPx >= 3) {
        const effectiveGridColor = gridColor
          ? gridColor + "18"
          : `rgba(${themeBorderSecondary},0.22)`;
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
      }

      /* ── KEGG background SVG image (show all / show lines / pathway regions mode) ──
         Two INDEPENDENT images — lines (map01100_bg_notext.svg) and text
         (map01100_bg_textonly.svg) — each loaded only when its own toggle is
         on, and drawn stacked (lines first, then text on top) rather than a
         single combined image. There is no third "both" file (see
         scripts/build_kegg_bg_native.py) — when both toggles are on, both
         images are simply drawn one after the other at the same rect. */
      const wantLinesBg = showAllKegg || showKeggLines;
      const wantTextBg = showPathways;
      if (keggLayout && ((wantLinesBg && keggBgLinesImageRef.current) || (wantTextBg && keggBgTextImageRef.current))) {
        ctx.save();
        ctx.globalAlpha = keggBgOpacity;
        if (dark) {
          ctx.filter = 'invert(1) hue-rotate(180deg) brightness(0.7)';
        }
        // map01100_bg_notext.svg / map01100_bg_textonly.svg are the ORIGINAL,
        // untouched map01100.svg artwork (native 3774x2250 coordinate space) —
        // only its pan/zoom-widget transform, white bg rect, and control icons
        // were stripped. Alignment with the app's KEGG world space
        // (kegg_pos_conf.json, 0..4961 x 0..3199) is applied here via
        // scale+translate, computed once via ICP against ko01100.kgml positions
        // (see scripts/build_kegg_bg_native.py), so the source SVG's colors/paths/
        // labels remain 100% untouched.
        if (wantLinesBg && keggBgLinesImageRef.current) {
          ctx.drawImage(keggBgLinesImageRef.current, -4.41, 12.79, 4891.49, 3195.12);
        }
        if (wantTextBg && keggBgTextImageRef.current) {
          ctx.drawImage(keggBgTextImageRef.current, -4.41, 12.79, 4891.49, 3195.12);
        }
        ctx.filter = 'none';
        ctx.restore();
      }

      /* ── Highlight active compound lines: REMOVED ──
         This used to erase+redraw conf-space lines (remapped via a per-line
         similarity transform) on top of the raster background to emphasize
         lines touching the current search's seed/neighbor nodes. Now that the
         background IS the real KEGG artwork (accurate positions/curves), this
         vector redraw only ever produced a second, slightly-differently-shaped
         copy of each "active" line on top of the correct one underneath
         (conf-space bent/multi-segment lines don't reconstruct their true
         bend position under a 2-point similarity transform) — visible as
         duplicate "weird" lines. The raster background alone is now the only
         line-skeleton renderer; conf line/compound-line data is still fetched
         for KEGG layout placement, just no longer drawn as its own layer here. */

      /* ── Surface point on compound circle ── */
      const surfacePoint = (node, dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) return { x: node.x, y: node.y };
        const ux = dx / d, uy = dy / d;
        return { x: node.x + ux * R_COMPOUND * nodeSizeScale, y: node.y + uy * R_COMPOUND * nodeSizeScale };
      };

      /* ── Pathway region labels: intentionally NOT drawn by our own overlay.
         The "Pathway regions" toggle instead loads/clears the independent
         text background image (fully separate from "KEGG layout"'s lines
         image) — see the keggBgTextImageRef/keggBgLinesImageRef loading
         effects. This avoids ugly duplicate text. */

      /* ── Edges ── */
      const visibleEdges = [];
      const linksByNode = new Map();
      drawLinks.forEach(l => {
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
        drawLinks.forEach(l => {
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
      const inKeggMode = keggLayout;
      // Edge color/visibility must respond to the edgeOpacity slider the same way
      // in KEGG mode as in normal mode — previously this force-capped alpha at
      // ~0.08 whenever KEGG layout was active, so edges stayed nearly invisible
      // no matter how high the user turned the opacity slider.
      const keggEdgeRGB = dark ? '170,170,178' : '55,60,70';
      const dimAlpha = hasHighlight
        ? Math.min(baseAlpha * 0.18, 0.035)
        : baseAlpha;
      const brightAlpha = 0.9;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // pairCount/pairIdx are now computed once in the cache block above (over ALL
      // edges, not just visible ones) — offsets stay stable while panning and we
      // avoid rebuilding these Maps on every single animation frame.

      const isOrtho = edgeStyle === 'orthogonal';
      const G = gridSpacing; // 48px grid

      // Helper: snap value to nearest grid line
      const snap = (v) => Math.round(v / G) * G;

      // ── Orthogonal route caching: only recompute when node positions change ──
      if (isOrtho) {
        // Cheap position hash: sum of all x,y + count
        let posHash = nodes.length;
        for (let ni = 0; ni < nodes.length; ni++) posHash += nodes[ni].x * 31 + nodes[ni].y * 17;
        const edgeCount_key = drawLinks.length;
        const cacheKey = `${posHash}|${edgeCount_key}`;

        if (orthoRouteCacheRef.current.posHash !== cacheKey) {
          // Rebuild occupancy grid
          const occGrid = new Map();
          nodes.forEach(n => {
            const gx = snap(n.x), gy = snap(n.y);
            for (let ox = -G; ox <= G; ox += G) {
              for (let oy = -G; oy <= G; oy += G) {
                const cx = gx + ox, cy = gy + oy;
                if (Math.abs(cx - n.x) < G * 0.8 && Math.abs(cy - n.y) < G * 0.8) {
                  occGrid.set(`${cx},${cy}`, n.id);
                }
              }
            }
          });
          const hBlk = (segY, x1, x2, sA, sB) => {
            const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
            for (let gx = snap(lo); gx <= hi + G / 2; gx += G) {
              const o = occGrid.get(`${gx},${snap(segY)}`);
              if (o && o !== sA && o !== sB) return true;
            }
            return false;
          };
          const vBlk = (segX, y1, y2, sA, sB) => {
            const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
            for (let gy = snap(lo); gy <= hi + G / 2; gy += G) {
              const o = occGrid.get(`${snap(segX)},${gy}`);
              if (o && o !== sA && o !== sB) return true;
            }
            return false;
          };

          // Compute routes for ALL edges (not just visible) so cache is complete
          const routeMap = new Map();
          const pc = new Map(); const pi = new Map();
          drawLinks.forEach((l, li) => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            const k = [sId, tId].sort().join('||');
            if (!pc.has(k)) pc.set(k, 0);
            pi.set(li, pc.get(k));
            pc.set(k, pc.get(k) + 1);
          });
          drawLinks.forEach((l, li) => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            const src = nodeMap.get(sId), trg = nodeMap.get(tId);
            if (!src || !trg) return;
            const R = R_COMPOUND * nodeSizeScale;
            const dx_raw = trg.x - src.x, dy_raw = trg.y - src.y;
            const pK = [sId, tId].sort().join('||');
            const total = pc.get(pK) || 1;
            const myIdx = pi.get(li) || 0;
            const offset = total === 1 ? 0 : (myIdx - (total - 1) / 2) * G;

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
            let path;
            if (routeType === 'h') {
              if (Math.abs(sp.y - tp.y) < 2 && Math.abs(offset) < 2 && !hBlk(sp.y, sp.x, tp.x, sId, tId)) {
                path = [sp, tp];
              } else {
                const baseChX = snap((sp.x + tp.x) / 2) + offset;
                let bestChX = baseChX, found = false;
                for (let a = 0; a < 12; a++) {
                  const testX = a === 0 ? baseChX : baseChX + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snX = snap(testX);
                  if (!hBlk(sp.y, sp.x, snX, sId, tId) && !vBlk(snX, sp.y, tp.y, sId, tId) && !hBlk(tp.y, snX, tp.x, sId, tId)) {
                    bestChX = snX; found = true; break;
                  }
                }
                if (!found) {
                  for (let a = 0; a < 12; a++) {
                    const testX = a === 0 ? baseChX : baseChX + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                    const snX = snap(testX);
                    if (!vBlk(snX, sp.y, tp.y, sId, tId)) { bestChX = snX; break; }
                  }
                }
                path = [sp, { x: bestChX, y: sp.y }, { x: bestChX, y: tp.y }, tp];
              }
            } else {
              if (Math.abs(sp.x - tp.x) < 2 && Math.abs(offset) < 2 && !vBlk(sp.x, sp.y, tp.y, sId, tId)) {
                path = [sp, tp];
              } else {
                const baseChY = snap((sp.y + tp.y) / 2) + offset;
                let bestChY = baseChY, found = false;
                for (let a = 0; a < 12; a++) {
                  const testY = a === 0 ? baseChY : baseChY + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                  const snY = snap(testY);
                  if (!vBlk(sp.x, sp.y, snY, sId, tId) && !hBlk(snY, sp.x, tp.x, sId, tId) && !vBlk(tp.x, snY, tp.y, sId, tId)) {
                    bestChY = snY; found = true; break;
                  }
                }
                if (!found) {
                  for (let a = 0; a < 12; a++) {
                    const testY = a === 0 ? baseChY : baseChY + ((a % 2 ? 1 : -1) * Math.ceil(a / 2) * G);
                    const snY = snap(testY);
                    if (!hBlk(snY, sp.x, tp.x, sId, tId)) { bestChY = snY; break; }
                  }
                }
                path = [sp, { x: sp.x, y: bestChY }, { x: tp.x, y: bestChY }, tp];
              }
            }
            const rKey = `${sId}||${tId}||${myIdx}`;
            routeMap.set(rKey, path);
          });
          orthoRouteCacheRef.current = { posHash: cacheKey, routes: routeMap };
        }
      }

      // Helper: filled triangle arrow at a point along a direction
      const drawMidArrow = (px, py, dirX, dirY, alpha) => {
        const aSize = Math.min(Math.max(8 / t.k, 6), 40);
        ctx.beginPath();
        ctx.moveTo(px + dirX * aSize, py + dirY * aSize);
        ctx.lineTo(px - dirX * aSize * 0.45 + dirY * aSize * 0.55,
                   py - dirY * aSize * 0.45 - dirX * aSize * 0.55);
        ctx.lineTo(px - dirX * aSize * 0.45 - dirY * aSize * 0.55,
                   py - dirY * aSize * 0.45 + dirX * aSize * 0.55);
        ctx.closePath();
        ctx.fillStyle = `rgba(${inKeggMode ? keggEdgeRGB : themeBorderPrimary},${Math.min(alpha * 1.8, 0.95)})`;
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

      // Draw edges in 2 passes: dim first, bright on top.
      // Edge visibility is controlled ONLY by the explicit "Hide edges" toggle —
      // it must never be force-overridden by KEGG map display settings (show-all /
      // show-lines / pathway regions), since those are independent, co-existing
      // layers, not mutually exclusive with the reaction-graph edges.
      for (let pass = 0; pass < 2; pass++) { if (hideEdges) break;
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

          // Bridge edges (from node deletion) drawn dashed
          if (link._isBridge) ctx.setLineDash([4 / t.k, 4 / t.k]);
          else ctx.setLineDash([]);

          // Clean muted color
          ctx.strokeStyle = `rgba(${inKeggMode ? keggEdgeRGB : themeBorderPrimary},${alpha})`;
          ctx.lineWidth = isBright
            ? Math.max(1.4 / t.k, 0.9)
            : Math.max(0.5 / t.k, 0.35);

          // Parallel edge info (for arrow placement + curved offset)
          const pKey = [src.id, trg.id].sort().join('||');
          const total = pairCount.get(pKey) || 1;
          const myIdx = pairIdx.get(idx) || 0;

          // Label midpoint (computed per-mode)
          let labelX, labelY;

          if (isOrtho) {
            // Look up pre-computed route from cache
            const rKey = `${src.id}||${trg.id}||${myIdx}`;
            const path = orthoRouteCacheRef.current.routes.get(rKey);
            if (!path) { /* fallback: skip this edge if not cached */ return; }

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
              const sp = path[0], tp = path[path.length - 1];
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

            const curveOff = total === 1 ? 0 : (myIdx - (total - 1) / 2) * (inKeggMode ? Math.min(dist * 0.04, 18) : 4);
            const curveBase = Math.min(dist * 0.15, inKeggMode ? 30 : 6);
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
              ctx.fillStyle = `rgba(${themeSurfacePrimary},0.8)`;
              const pillH = fs + 3;
              ctx.beginPath();
              ctx.roundRect(labelX - tw / 2, labelY - pillH / 2, tw, pillH, 3);
              ctx.fill();
              ctx.fillStyle = `rgba(${themeTextSecondary},0.92)`;
              ctx.fillText(rxLabel, labelX, labelY);
              ctx.restore();
            }
          }
        });
      }
      ctx.setLineDash([]);

      /* ── Path overlay (pair highlighting) ── */
      if (showOverlay && !inKeggMode) {
        drawLinks.forEach(l => {
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
            ctx.lineWidth = Math.min(Math.max(5 / t.k, 2.5), 20);
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

        drawNodes.forEach(n => {
          if (!n.pairIndices || n.pairIndices.length === 0) return;
          if (!inView(n.x, n.y)) return;
          n.pairIndices.forEach(pi => {
            const col = pairColorMap[pi];
            if (!col) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(3 / t.k, 1.5);
            ctx.beginPath();
            ctx.arc(n.x, n.y, R_COMPOUND * nodeSizeScale + 1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          });
        });
      }


      /* ── Nodes ──
         Per-node fill/stroke colors (and the degree map they may depend on) only
         change when the node/edge SET changes or a color-related setting changes —
         never on pan/zoom/hover/drag alone. getTypeColor() in particular calls
         getComputedStyle() internally, so recomputing per-node, per-frame was a
         severe hidden cost at large scale. Cache per-node colors in a Map keyed by
         node id, invalidated only when the relevant inputs actually change. */
      const MAX_BUCKET = 100;
      const colorKey = `${colorMode}|${colorScheme}|${themeName}|${maxGeneration}`;
      let nodeColorCache;
      if (cacheHit && cache.colorKey === colorKey) {
        nodeColorCache = cache.nodeColorCache;
      } else {
        const degMap = new Map();
        if (colorMode === "degree") {
          drawLinks.forEach(l => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            degMap.set(sId, (degMap.get(sId) || 0) + 1);
            degMap.set(tId, (degMap.get(tId) || 0) + 1);
          });
        }
        const maxDeg = degMap.size > 0 ? Math.max(1, ...degMap.values()) : 1;

        const computeColor = (n) => {
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

        nodeColorCache = new Map();
        drawNodes.forEach(n => nodeColorCache.set(n.id, computeColor(n)));
        cache.colorKey = colorKey;
        cache.nodeColorCache = nodeColorCache;
      }
      const nodeColor = (n) => nodeColorCache.get(n.id) || getSchemeColor(colorScheme, 0, dark);

      // In KEGG layout, ensure nodes are always visible at any zoom level
      const sizeScale = nodeSizeScale;
      const R_SCALED = R_COMPOUND * sizeScale;
      const nodeDrawR = keggLayout ? Math.max(R_SCALED, (3.5 * sizeScale) / t.k) : R_SCALED;

      // Structures: fixed world HEIGHT, width adapts per molecule's aspect ratio
      const useStructures = nodeDisplay === 'structure';
      const SH = STRUCT_WORLD_H * sizeScale; // world height
      const halfH = SH / 2;

      /* ── KEGG global-orientation ghost nodes ── */
      if (showAllKegg && keggLayout && keggPosArrayRef.current.length) {
        // nodeMap (cached above) already indexes every drawn node by id — reuse it
        // instead of allocating a fresh Set from drawNodes on every single frame.
        const searchNodeIds = nodeMap;
        const ghostR = Math.max(R_SCALED * 0.8, (2 * sizeScale) / t.k);
        const ghostFill = `rgb(${themeTextMuted})`;
        const ghostStroke = `rgb(${themeTextSecondary})`;
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = Math.max(0.8, 0.5 / t.k);
        ctx.fillStyle = ghostFill;
        ctx.strokeStyle = ghostStroke;
        ctx.beginPath();
        for (const [cid, pos] of keggPosArrayRef.current) {
          if (searchNodeIds.has(cid)) continue;
          const sx = pos.x * KEGG_SCALE;
          const sy = pos.y * KEGG_SCALE;
          if (!inView(sx, sy)) continue;
          ctx.moveTo(sx + ghostR, sy);
          ctx.arc(sx, sy, ghostR, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      drawNodes.forEach(n => {
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
          const glowR = tex ? (SH * (tex._aspect || 1) / 2 + 2) : (R_SCALED + 2);
          ctx.shadowColor = `rgba(${themeBrandPrimary},0.5)`;
          ctx.shadowBlur = 6;
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
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, nodeDrawR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Backbone match ring indicator
        if (bbMatch && !bbDim) {
          ctx.save();
          ctx.strokeStyle = `rgba(${themeBrandPrimary},0.65)`;
          ctx.lineWidth = Math.max(2 / t.k, 1.2);
          ctx.setLineDash([]);
          ctx.beginPath();
          if (tex) {
            const aspect = tex._aspect || 1;
            const hw = SH * aspect / 2 + 1;
            const hh = halfH + 1;
            ctx.roundRect(n.x - hw, n.y - hh, hw * 2, hh * 2, 2);
          } else {
            ctx.arc(n.x, n.y, R_SCALED + 1, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.restore();
        }

        if (bbDim || dimmed) ctx.globalAlpha = 1;

        // Locked node indicator: amber dashed ring
        if (lockedNodesRef.current.has(n.id)) {
          ctx.save();
          ctx.strokeStyle = 'rgba(251, 57, 36, 0.9)';
          ctx.lineWidth = Math.max(1.5 / t.k, 0.8);
          ctx.setLineDash([3 / t.k, 2 / t.k]);
          ctx.beginPath();
          if (tex) {
            const aspect = tex._aspect || 1;
            const hw = SH * aspect / 2 + 1, hh = SH / 2 + 1;
            ctx.roundRect(n.x - hw, n.y - hh, hw * 2, hh * 2, 2);
          } else {
            ctx.arc(n.x, n.y, R_SCALED + 1, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      });

      /* ── Labels (below nodes for readability) ──
         Real KEGG map compounds are often only a few px apart — at any zoom
         level where labels are legible, many of them would otherwise render
         fully on top of each other (unreadable stacked text). EVERY node must
         still get its name shown (never hidden) — so instead of skipping a
         colliding label, we try a small cascade of candidate positions
         (below/above at increasing vertical offsets) and use the first one
         that doesn't overlap an already-placed label; if all candidates
         collide (extremely tight cluster), we fall back to the default
         position anyway rather than hiding the label. */
      if (t.k >= 0.3) {
        const fontSizeScale = 1 + (sizeScale - 1) * 0.5;
        const fontSize = Math.max(5, Math.min(8, 7 / t.k * t.k)) * fontSizeScale;
        ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelOffset = useStructures ? halfH + 1 : R_SCALED + 1;

        const placedLabelGrid = new Map(); // "gx,gy" -> [{x0,y0,x1,y1}, ...]
        const GRID = Math.max(8, fontSize * 2);
        const labelOverlaps = (x0, y0, x1, y1) => {
          const gx0 = Math.floor(x0 / GRID), gx1 = Math.floor(x1 / GRID);
          const gy0 = Math.floor(y0 / GRID), gy1 = Math.floor(y1 / GRID);
          for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
              const cell = placedLabelGrid.get(gx + ',' + gy);
              if (!cell) continue;
              for (const r of cell) {
                if (x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0) return true;
              }
            }
          }
          return false;
        };
        const placeLabelRect = (x0, y0, x1, y1) => {
          const gx0 = Math.floor(x0 / GRID), gx1 = Math.floor(x1 / GRID);
          const gy0 = Math.floor(y0 / GRID), gy1 = Math.floor(y1 / GRID);
          for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
              const key = gx + ',' + gy;
              let cell = placedLabelGrid.get(key);
              if (!cell) { cell = []; placedLabelGrid.set(key, cell); }
              cell.push({ x0, y0, x1, y1 });
            }
          }
        };

        const priorityNodes = [];
        const normalNodes = [];
        drawNodes.forEach(n => {
          if (!inView(n.x, n.y)) return;
          const isHl = highlightIds.has(n.id);
          const bbMatch = hasBackbone && backboneMatchIds.has(n.id);
          (isHl || bbMatch ? priorityNodes : normalNodes).push(n);
        });

        // Candidate label positions: ALWAYS below the node, never above — on
        // collision we only push further down (stacked cascade), so a label's
        // vertical direction relative to its node is 100% consistent everywhere.
        // `dy` is the vertical offset added to n.y for BOTH the bbox and the
        // fillText baseline (textBaseline stays "top" throughout).
        const candidateDys = [
          labelOffset,
          labelOffset + 1 * (fontSize + 3),
          labelOffset + 2 * (fontSize + 3),
          labelOffset + 3 * (fontSize + 3),
          labelOffset + 4 * (fontSize + 3),
          labelOffset + 5 * (fontSize + 3),
        ];

        const drawLabel = (n, forceShow) => {
          const isHl = highlightIds.has(n.id);
          const dimLabel = hasHighlight && !isHl;
          const bbLabelDim = hasBackbone && !backboneMatchIds.has(n.id);
          const bbLabelMatch = hasBackbone && backboneMatchIds.has(n.id);
          const displayLabel = showNames
            ? (compoundNamesRef.current.get(n.id) ?? n.label ?? n.id)
            : (n.label ?? n.id);
          const w = ctx.measureText(displayLabel).width;
          const x0 = n.x - w / 2 - 1, x1 = n.x + w / 2 + 1;

          let chosenDy = candidateDys[0];
          if (!forceShow) {
            let found = false;
            for (const dy of candidateDys) {
              const y0 = n.y + dy - 1, y1 = n.y + dy + fontSize + 1;
              if (!labelOverlaps(x0, y0, x1, y1)) {
                chosenDy = dy;
                found = true;
                break;
              }
            }
            // All candidates collide (extremely tight cluster) — still show the
            // label at the default position rather than hiding it.
            if (!found) chosenDy = candidateDys[0];
          }
          const y0 = n.y + chosenDy - 1, y1 = n.y + chosenDy + fontSize + 1;
          placeLabelRect(x0, y0, x1, y1);
          if (bbLabelDim) ctx.globalAlpha = 0.1;
          else if (dimLabel) ctx.globalAlpha = 0.4;
          const labelColor = bbLabelMatch
            ? `rgb(${themeBrandPrimary})`
            : isHl
              ? `rgb(${themeInfo})`
              : `rgb(${themeTextMuted})`;
          ctx.fillStyle = labelColor;
          ctx.fillText(displayLabel, n.x, n.y + chosenDy);
          if (bbLabelDim || dimLabel) ctx.globalAlpha = 1;
        };

        priorityNodes.forEach(n => drawLabel(n, true));
        normalNodes.forEach(n => drawLabel(n, false));
      }

      // Ctrl+drag selection box (world coords)
      if (selBoxRef.current) {
        const { x1, y1, x2, y2 } = selBoxRef.current;
        const selRx = Math.min(x1, x2), selRy = Math.min(y1, y2);
        const selRw = Math.abs(x2 - x1), selRh = Math.abs(y2 - y1);
        ctx.save();
        ctx.strokeStyle = `rgba(${themeInfo},0.85)`;
        ctx.fillStyle = `rgba(${themeInfo},0.08)`;
        ctx.lineWidth = 1.5 / t.k;
        ctx.setLineDash([5 / t.k, 3 / t.k]);
        ctx.beginPath();
        ctx.rect(selRx, selRy, selRw, selRh);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.restore();
    }, [dark, themeName, graph, maxGeneration, showOverlay, pairColorMap, edgeOpacity, spacingScale, nodeSizeScale, colorMode, colorScheme, bgColor, gridColor, edgeStyle, nodeDisplay, showNames, keggLayout, showAllKegg, showKeggLines, hideEdges, showPathways, keggBgOpacity, backboneMatchIds]);

    drawRef.current = draw;
    syncSelectionRef.current = syncSelection;

    // Redraw canvas whenever any display setting changes.
    // Deferred to rAF so layout effects (applyKegg, simulation) finish positioning nodes first.
    useEffect(() => {
      if (!nodesRef.current?.length) return;
      const raf = requestAnimationFrame(() => {
        drawRef.current?.(nodesRef.current);
      });
      return () => cancelAnimationFrame(raf);
    }, [draw]);

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
    }, [showOverlay, graph, draw, keggBgOpacity]);

    // Load SVG background images when KEGG map background display is toggled on.
    // "KEGG layout" (showAllKegg/showKeggLines) and "Pathway regions"
    // (showPathways) are fully INDEPENDENT layers in the source art (separate
    // <g> groups — skeleton lines/ellipses vs native region-name text), backed
    // by two separate files with no combined variant — so each layer gets its
    // own ref/effect and is fetched/cleared strictly by its own toggle; the
    // two images are composited together at draw time instead.
    useEffect(() => {
      const wantLines = showAllKegg || showKeggLines;
      if (!wantLines) {
        keggBgLinesImageRef.current = null;
        drawRef.current?.(nodesRef.current);
        return;
      }
      keggBgLinesImageRef.current = null;
      const img = new Image();
      img.onload = () => {
        keggBgLinesImageRef.current = img;
        console.log('[NEBULA] KEGG map lines background SVG loaded');
        drawRef.current?.(nodesRef.current);
      };
      img.onerror = () => console.warn('[NEBULA] Failed to load KEGG map lines background SVG');
      // No cache-busting timestamp — this is a static asset (only changes when the
      // backend's source SVG changes), so let the browser cache it across toggles/
      // reloads instead of re-downloading ~650KB-1.2MB every single time.
      img.src = getApiUrl('kegg-map-bg') + '?variant=lines';
      return () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        keggBgLinesImageRef.current = null;
      };
    }, [showAllKegg, showKeggLines]);

    useEffect(() => {
      if (!showPathways) {
        keggBgTextImageRef.current = null;
        drawRef.current?.(nodesRef.current);
        return;
      }
      keggBgTextImageRef.current = null;
      const img = new Image();
      img.onload = () => {
        keggBgTextImageRef.current = img;
        console.log('[NEBULA] KEGG map text background SVG loaded');
        drawRef.current?.(nodesRef.current);
      };
      img.onerror = () => console.warn('[NEBULA] Failed to load KEGG map text background SVG');
      // No cache-busting timestamp — see comment on the lines-variant fetch above.
      img.src = getApiUrl('kegg-map-bg') + '?variant=text';
      return () => {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        keggBgTextImageRef.current = null;
      };
    }, [showPathways]);

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

    /* Fit view to an explicit world-space bounding box */
    const fitViewToBounds = useCallback((minX, minY, maxX, maxY) => {
      if (!canvasRef.current || !zoomRef.current) return;
      const canvas = canvasRef.current;
      const cw = canvas.clientWidth || 800;
      const ch = canvas.clientHeight || 600;
      const pad = 150;
      const gw = (maxX - minX) + pad * 2 || 1;
      const gh = (maxY - minY) + pad * 2 || 1;
      const scale = Math.min(cw / gw, ch / gh);
      const tx = (cw - gw * scale) / 2 - (minX - pad) * scale;
      const ty = (ch - gh * scale) / 2 - (minY - pad) * scale;
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

      // Only re-fit the camera for STRUCTURAL changes (new data, KEGG mode just
      // enabled/disabled, or the map-lines/show-all view mode changing) — cosmetic
      // changes like nodeDisplay, nodeSizeScale, spacingScale, edgeStyle should
      // never yank the user's current pan/zoom around.
      const isNewData = data !== prevDataRef.current;
      prevDataRef.current = data;
      const keggViewModeChanged = showAllKegg !== prevShowAllKeggRef.current || showKeggLines !== prevShowKeggLinesRef.current;
      prevShowAllKeggRef.current = showAllKegg;
      prevShowKeggLinesRef.current = showKeggLines;
      if (isNewData || keggJustToggled || keggViewModeChanged) {
        needsFitRef.current = true;
      }
      // Clear stale position cache from previous search
      if (isNewData) {
        positionCacheRef.current = {};
      }

      if (keggLayout) {
        // ── KEGG layout mode: fetch positions (once), apply to matching nodes ──

        // Shared helper: place nodes at KEGG coords, spread unplaced, resolve collisions
        // `cx`/`cy` here MUST be in KEGG map coordinate space (not canvas pixel space) —
        // they're only used as a last-resort fallback for nodes with zero KEGG neighbors.
        // `fallbackPositions` is precomputed OFFLINE (scripts/precompute_kegg_fallback_positions.py)
        // using a most-connected -> similar-generation -> similar-id priority cascade over the
        // FULL KEGG map + static generation/id data — no graph BFS or adjacency building happens
        // in the browser anymore, it's a straight lookup.
        const applyKegg = (nds, lks, positions, fallbackPositions, cx, cy) => applyKeggLayout(
          nds, lks, positions, fallbackPositions, cx, cy,
          { isStructureMode: nodeDisplayRef.current === 'structure', nodeSizeScale }
        );

        const finalize = (nds, matched) => {
          nds.forEach(n => { positionCacheRef.current[n.id] = { x: n.x, y: n.y }; });
          nodesRef.current = nds;
          const shouldFit = needsFitRef.current;
          needsFitRef.current = false;
          if (shouldFit) {
            if ((showAllKegg || showKeggLines) && keggPositionsRef.current) {
              // Fit to dense content region (5th–95th percentile) so map fills screen
              const allPos = Object.values(keggPositionsRef.current);
              if (allPos.length > 20) {
                const sX = allPos.map(p => p.x).sort((a, b) => a - b);
                const sY = allPos.map(p => p.y).sort((a, b) => a - b);
                const lo = Math.floor(allPos.length * 0.02);
                const hi = Math.floor(allPos.length * 0.98);
                fitViewToBounds(sX[lo], sY[lo], sX[hi], sY[hi]);
              } else {
                fitViewToBounds(0, 0, 4961, 3199);
              }
            } else {
              fitViewToNodes(nds);
            }
          }
          drawRef.current?.(nds);
          console.log(`[NEBULA] KEGG layout: ${matched}/${nds.length} compounds placed`);
        };

        // Always fetch fresh positions (never use stale cache)
        {
          keggPositionsRef.current = null;
          keggPosArrayRef.current = [];
          fetch(getApiUrl('kegg-layout') + '?t=' + Date.now())
            .then(r => r.json())
            .then(data => {
              keggPositionsRef.current = data.positions || {};
              keggFallbackPositionsRef.current = data.fallback_positions || {};
              keggPosArrayRef.current = Object.entries(keggPositionsRef.current);
              const freshCopy = graph.nodes.map(n => ({ ...n }));
              const freshLinks = graph.links.map(l => ({ ...l }));
              // Fallback center MUST be in KEGG map coordinate space, not canvas pixel
              // space — otherwise unmatched nodes cluster near the map's tiny (cw/2, ch/2)
              // pixel-sized region instead of the middle of the actual metabolic map.
              const allPos = Object.values(keggPositionsRef.current);
              const mapCx = allPos.length
                ? allPos.reduce((s, p) => s + p.x, 0) / allPos.length * KEGG_SCALE
                : centerX;
              const mapCy = allPos.length
                ? allPos.reduce((s, p) => s + p.y, 0) / allPos.length * KEGG_SCALE
                : centerY;
              const matched = applyKegg(freshCopy, freshLinks, keggPositionsRef.current, keggFallbackPositionsRef.current, mapCx, mapCy);
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
        const G = 10; // must match gridSpacing
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

      if (needsFitRef.current && nodesCopy.length > 0) {
        needsFitRef.current = false;
        fitViewToNodes(nodesCopy);
      }

      drawRef.current?.(nodesCopy);
    }, [graph, height, spacingScale, data, edgeStyle, keggLayout, showAllKegg, fitViewToNodes, fitViewToBounds]);

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
        .scaleExtent([0.01, 10])
        .filter(ev => {
          if (ev.ctrlKey) return false; // ctrl reserved for selection box
          if (ev.type !== "mousedown" && ev.type !== "pointerdown") return true;
          const rect = canvas.getBoundingClientRect();
          const mx = (ev.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const my = (ev.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          const useStruct = nodeDisplayRef.current === 'structure';
          const hitNode = nodesRef.current.find(n => {
            if (useStruct && structTexRef.current.has(n.id)) {
              const tex = structTexRef.current.get(n.id);
              const halfH = (STRUCT_WORLD_H * nodeSizeScaleRef.current) / 2;
              const halfW = halfH * (tex._aspect || 1);
              return Math.abs(mx - n.x) <= halfW && Math.abs(my - n.y) <= halfH;
            }
            return (mx - n.x) ** 2 + (my - n.y) ** 2 <= (R_COMPOUND * nodeSizeScaleRef.current + 4) ** 2;
          });
          return !hitNode;
        })
        .on("zoom", ev => {
          transformRef.current = ev.transform;
          if (!zoomRafRef.current) {
            zoomRafRef.current = requestAnimationFrame(() => {
              zoomRafRef.current = null;
              drawRef.current?.(nodesRef.current);
            });
          }
        });
      d3.select(canvas).call(zoom);
      zoomRef.current = zoom;

      return () => {
        window.removeEventListener("resize", handleResize);
        d3.select(canvas).on(".zoom", null);
        if (zoomRafRef.current) { cancelAnimationFrame(zoomRafRef.current); zoomRafRef.current = null; }
      };
    }, [containerRef, height, isFullscreen]);

    /* ── Pointer interactions ── */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let dragging = null;
      let didDrag = false;

      const hitTest = (mx, my) => {
        const nodes = nodesRef.current.filter(n => !localEditsRef.current.deletedNodes.has(n.id));
        const useStruct = nodeDisplayRef.current === 'structure';
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          if (useStruct && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const halfH = (STRUCT_WORLD_H * nodeSizeScaleRef.current) / 2;
            const halfW = halfH * (tex._aspect || 1);
            if (Math.abs(mx - n.x) <= halfW && Math.abs(my - n.y) <= halfH) return n;
          } else {
            if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (R_COMPOUND * nodeSizeScaleRef.current + 4) ** 2) return n;
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

      // ── Pointer down ──
      const pointerdown = e => {
        // Middle click: toggle node lock
        if (e.button === 1) {
          e.preventDefault();
          const { mx, my } = worldCoords(e);
          const node = hitTest(mx, my);
          if (node) {
            const locked = lockedNodesRef.current;
            if (locked.has(node.id)) locked.delete(node.id);
            else locked.add(node.id);
            drawRef.current?.(nodesRef.current);
          }
          return;
        }
        if (e.button !== 0) return;

        const { mx, my } = worldCoords(e);
        const node = hitTest(mx, my);

        // Ctrl+drag on empty space = start selection box
        if (e.ctrlKey && !node) {
          selBoxRef.current = { x1: mx, y1: my, x2: mx, y2: my };
          canvas.style.cursor = 'crosshair';
          return;
        }

        if (node && !keggLayoutRef.current) {
          const pinned = pinnedNodesRef.current;
          if (pinned.has(node.id) && pinned.size > 1) {
            // Group drag: move all pinned non-locked nodes together
            const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]));
            multiDragRef.current = [];
            pinned.forEach(id => {
              const n = nodeMap.get(id);
              if (n && !lockedNodesRef.current.has(id)) {
                multiDragRef.current.push({ node: n, offX: n.x - mx, offY: n.y - my });
              }
            });
            didDrag = false;
            canvas.style.cursor = 'grabbing';
          } else if (!lockedNodesRef.current.has(node.id)) {
            dragging = node;
            didDrag = false;
            canvas.style.cursor = 'grabbing';
          }
        }
      };

      // ── Pointer move ──
      const pointermove = e => {
        const { mx, my } = worldCoords(e);

        if (selBoxRef.current) {
          selBoxRef.current.x2 = mx;
          selBoxRef.current.y2 = my;
          drawRef.current?.(nodesRef.current);
          return;
        }

        if (multiDragRef.current) {
          multiDragRef.current.forEach(({ node, offX, offY }) => {
            node.x = mx + offX;
            node.y = my + offY;
          });
          didDrag = true;
          drawRef.current?.(nodesRef.current);
          return;
        }

        if (dragging) {
          dragging.x = mx; dragging.y = my; didDrag = true;
          drawRef.current?.(nodesRef.current);
          return;
        }

        const hit = hitTest(mx, my);
        const found = hit ? hit.id : null;
        if (found !== hoveredNodeRef.current) {
          hoveredNodeRef.current = found;
          const isLocked = found && lockedNodesRef.current.has(found);
          canvas.style.cursor = found ? (isLocked ? 'not-allowed' : 'pointer') : 'grab';
          drawRef.current?.(nodesRef.current);
        }
      };

      // ── Pointer up ──
      const pointerup = () => {
        // Finish selection box → add enclosed nodes to pinned set
        if (selBoxRef.current) {
          const { x1, y1, x2, y2 } = selBoxRef.current;
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
          if (maxX - minX > 4 || maxY - minY > 4) {
            nodesRef.current.forEach(n => {
              if (!localEditsRef.current.deletedNodes.has(n.id)) {
                if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
                  pinnedNodesRef.current.add(n.id);
                }
              }
            });
            syncSelectionRef.current?.();
          }
          selBoxRef.current = null;
          didDrag = true;
          canvas.style.cursor = 'grab';
          drawRef.current?.(nodesRef.current);
          return;
        }

        // Finish group drag
        if (multiDragRef.current) {
          multiDragRef.current.forEach(({ node }) => {
            positionCacheRef.current[node.id] = { x: node.x, y: node.y };
          });
          multiDragRef.current = null;
          didDrag = true;
          canvas.style.cursor = 'grab';
          drawRef.current?.(nodesRef.current);
          return;
        }

        if (dragging) {
          const MIN_DIST = R_COMPOUND * nodeSizeScaleRef.current * 3;
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
          canvas.style.cursor = 'grab';
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

    /* ── Right-click context menu ── */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleContextMenu = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const tr = transformRef.current;
        const mx = (e.clientX - rect.left - tr.x) / tr.k;
        const my = (e.clientY - rect.top  - tr.y) / tr.k;

        // If there's an active selection, show group transform menu regardless of hit
        if (pinnedNodesRef.current.size > 0) {
          setCtxMenu({ x: e.clientX, y: e.clientY, type: 'group' });
          return;
        }

        // Hit-test nodes first
        const nodes = nodesRef.current.filter(n => !localEditsRef.current.deletedNodes.has(n.id));
        const useStruct = nodeDisplayRef.current === 'structure';
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          let hit = false;
          if (useStruct && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const hh = (STRUCT_WORLD_H * nodeSizeScaleRef.current) / 2;
            const hw = hh * (tex._aspect || 1);
            hit = Math.abs(mx - n.x) <= hw && Math.abs(my - n.y) <= hh;
          } else {
            hit = (mx - n.x) ** 2 + (my - n.y) ** 2 < (R_COMPOUND * nodeSizeScaleRef.current + 6) ** 2;
          }
          if (hit) {
            setCtxMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId: n.id });
            return;
          }
        }

        // Hit-test edges — check straight line + L-shape + Z-shape paths
        // (orthogonal routing can place the actual drawn path far from the straight line)
        const edits = localEditsRef.current;
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const allLinks = [
          ...graphRef.current.links.filter(l => !edits.deletedEdges.has(_edgeKey(l))),
          ...edits.addedEdges,
        ];
        const threshold = 12 / tr.k; // ~12 screen-pixel tolerance in world units
        const _edgeHit = (px, py, ax, ay, bx, by) => _distToSeg(px, py, ax, ay, bx, by) < threshold;
        let bestLink = null, bestDist = Infinity;
        for (const l of allLinks) {
          const src = nodeMap.get(l.source?.id || l.source);
          const tgt = nodeMap.get(l.target?.id || l.target);
          if (!src || !tgt) continue;
          const mx2 = (src.x + tgt.x) / 2, my2 = (src.y + tgt.y) / 2;
          // Check: straight line, L-shape 1 (H then V), L-shape 2 (V then H),
          //        Z-shape 1 (H, V, H), Z-shape 2 (V, H, V)
          const hit =
            _edgeHit(mx, my, src.x, src.y, tgt.x, tgt.y) ||
            _edgeHit(mx, my, src.x, src.y, tgt.x, src.y) ||
            _edgeHit(mx, my, tgt.x, src.y, tgt.x, tgt.y) ||
            _edgeHit(mx, my, src.x, src.y, src.x, tgt.y) ||
            _edgeHit(mx, my, src.x, tgt.y, tgt.x, tgt.y) ||
            _edgeHit(mx, my, src.x, src.y, mx2, src.y) ||
            _edgeHit(mx, my, mx2, src.y, mx2, tgt.y) ||
            _edgeHit(mx, my, mx2, tgt.y, tgt.x, tgt.y);
          if (hit) {
            const d = _distToSeg(mx, my, src.x, src.y, tgt.x, tgt.y);
            if (d < bestDist) { bestDist = d; bestLink = l; }
          }
        }
        if (bestLink) {
          setCtxMenu({ x: e.clientX, y: e.clientY, type: 'edge', link: bestLink });
          return;
        }

        setCtxMenu(null);
      };

      canvas.addEventListener('contextmenu', handleContextMenu);
      return () => canvas.removeEventListener('contextmenu', handleContextMenu);
    }, []);

    /* ── Imperative API ── */
    useImperativeHandle(ref, () => ({
      // Pin + center + zoom to a compound by id (used by the compound search panel).
      // Returns true if the compound was found in the currently loaded graph.
      selectCompound: (id) => {
        const canvas = canvasRef.current;
        if (!canvas || !zoomRef.current) return false;
        const node = nodesRef.current.find(n => n.id === id);
        if (!node) return false;

        pinnedNodesRef.current.clear();
        pinnedNodesRef.current.add(id);
        syncSelectionRef.current?.();
        drawRef.current?.(nodesRef.current);

        const cw = canvas.clientWidth || 800;
        const ch = canvas.clientHeight || 600;
        const scale = Math.max(transformRef.current.k, 1.5);
        const tx = cw / 2 - node.x * scale;
        const ty = ch / 2 - node.y * scale;
        const tr = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(canvas).transition().duration(500).call(zoomRef.current.transform, tr);
        return true;
      },
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
          const G = 10;
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
      downloadSVG: async () => {
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        // ── KEGG background: lines skeleton and region text are fetched as
        // their REAL vector SVG source (map01100_bg_notext.svg /
        // map01100_bg_textonly.svg) and inlined directly as native
        // <path>/<ellipse>/<text> elements — NOT rasterized — each in its
        // own named <g> layer below, so the export stays 100% vector and
        // opens in Illustrator as independently toggleable "KEGG Map Lines"
        // / "KEGG Region Text" layers with fully editable paths.
        //
        // The source file (map01100.svg, Snap.svg output) has a chain of
        // pointless SINGLE-CHILD wrapper <g>s (<g id="viewport-...">/<desc>/
        // empty <g>) with no attributes of their own — we skip those. But
        // one level below that chain it genuinely BRANCHES into several
        // sibling groups by element type (e.g. reaction paths, compound dot
        // ellipses, legend-pill rects, legend text) — confirmed by
        // inspecting the file directly. THAT real structure is worth
        // keeping (it's what let you toggle/select e.g. just the legend
        // pills in Illustrator), so we preserve exactly that one branching
        // level as named sibling <g>s, instead of either re-emitting the
        // whole pointless wrapper chain or flattening everything into one
        // undifferentiated soup of paths.
        const KEGG_GROUP_NAMES = { path: 'Reaction_Paths', ellipse: 'Compound_Dots', rect: 'Legend_Backgrounds', text: 'Legend_Labels' };
        const fetchKeggLayerSvg = async (variant) => {
          const bgUrl = getApiUrl('kegg-map-bg') + `?variant=${variant}`;
          const res = await fetch(bgUrl);
          if (!res.ok) throw new Error('failed to fetch KEGG background SVG');
          const svgText = await res.text();
          const root = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
          const vb = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
          const nativeW = parseFloat(root.getAttribute('width')) || vb[2] || 3774;
          const nativeH = parseFloat(root.getAttribute('height')) || vb[3] || 2250;

          let cur = root.querySelector('g.svg-pan-zoom_viewport') || root;
          while (true) {
            const gKids = Array.from(cur.children).filter(c => c.tagName === 'g');
            const otherKids = Array.from(cur.children).filter(c => c.tagName !== 'g' && c.tagName !== 'desc');
            if (gKids.length === 1 && otherKids.length === 0) { cur = gKids[0]; continue; }
            break;
          }
          // If `cur`'s children are themselves non-empty <g>s, those ARE the
          // real sibling content groups (e.g. the lines file: paths /
          // ellipses / legend-rects / legend-text). But some variants (e.g.
          // the text-only file) have no further branching at all — `cur`
          // lands directly on the group that holds the leaf elements
          // (<text>, not <g>) — in that case `cur` itself IS the one and
          // only content group, so use it directly instead of filtering it
          // away to nothing.
          const gChildGroups = Array.from(cur.children).filter(c => c.tagName === 'g' && c.children.length > 0);
          const contentGroups = gChildGroups.length > 0 ? gChildGroups : [cur];
          const serializer = new XMLSerializer();
          const usedNames = new Set();
          const markup = contentGroups.map(g => {
            const firstTag = g.children[0]?.tagName || 'g';
            let name = KEGG_GROUP_NAMES[firstTag] || 'Group';
            while (usedNames.has(name)) name += '_2';
            usedNames.add(name);
            g.setAttribute('id', name);
            return serializer.serializeToString(g);
          }).join('');
          return { markup, nativeW, nativeH };
        };
        let keggLinesSvg = null;
        let keggTextSvg = null;
        const keggWantLines = showAllKegg || showKeggLines;
        const keggWantText = showPathways;
        if (keggLayout && keggWantLines) {
          try { keggLinesSvg = await fetchKeggLayerSvg('lines'); }
          catch (e) { console.warn('[NEBULA] Failed to fetch KEGG lines for SVG export:', e); }
        }
        if (keggLayout && keggWantText) {
          try { keggTextSvg = await fetchKeggLayerSvg('text'); }
          catch (e) { console.warn('[NEBULA] Failed to fetch KEGG text for SVG export:', e); }
        }

        const useStruct = nodeDisplayRef.current === 'structure';
        const SH = STRUCT_WORLD_H * nodeSizeScale;
        const halfH = SH / 2;
        const isOrtho = edgeStyle === 'orthogonal';
        const G = 10;
        const R = R_COMPOUND * nodeSizeScale;
        const hasPinned = pinnedNodesRef.current.size > 0;

        // ── Bounding box: UNION of (a) every node's actual position and
        // (b) the KEGG background's own full destination rect, WHEN a
        // background layer is enabled — NOT the current pan/zoom viewport.
        // The viewport is just ephemeral window state (however far the user
        // happens to have zoomed out) and including it caused arbitrary
        // extra blank margins. Content is exactly: the nodes, plus the
        // whole map when it's turned on (so it's never cropped, matching
        // the "map should always show whole, not cut off" requirement)
        // — nothing more, nothing tied to what the on-screen camera framed.
        const KEGG_DEST_X = -4.41, KEGG_DEST_Y = 12.79, KEGG_DEST_W = 4891.49, KEGG_DEST_H = 3195.12;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (keggLinesSvg || keggTextSvg) {
          minX = KEGG_DEST_X; minY = KEGG_DEST_Y;
          maxX = KEGG_DEST_X + KEGG_DEST_W; maxY = KEGG_DEST_Y + KEGG_DEST_H;
        }
        nodes.forEach(n => {
          if (n.x < minX) minX = n.x;
          if (n.y < minY) minY = n.y;
          if (n.x > maxX) maxX = n.x;
          if (n.y > maxY) maxY = n.y;
        });
        // Per-node padding: structures are much wider/taller than the plain
        // circle radius, and labels (when on) are drawn below each node —
        // pad generously on every side so nothing gets clipped.
        const sidePad = useStruct ? STRUCT_WORLD_H * nodeSizeScale : R_COMPOUND * nodeSizeScale * 4;
        const bottomPad = sidePad + (showNames ? 70 * nodeSizeScale : 0);
        minX -= sidePad; maxX += sidePad;
        minY -= sidePad; maxY += bottomPad;
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
        // Sanitize a string for use as an SVG group id (Illustrator layer name)
        const safeId = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_');

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
          if (colorMode === 'type') return getTypeColor(n.type, false);
          if (colorMode === 'degree') {
            const deg = degMap.get(n.id) || 0;
            const b = Math.round((deg / maxDeg) * 100);
            return getSchemeColor(colorScheme, b / 100, false);
          }
          const gen = n.generation || 0;
          const b = maxGeneration > 0 ? Math.round((gen / maxGeneration) * 100) : 0;
          return getSchemeColor(colorScheme, b / 100, false);
        };

        // ── Theme colors (export is always light mode, so use fixed light constants) ──
        const svgBorder = '160,170,185';
        const svgTextMuted = '100,116,139';
        const svgInfo = '37,99,235';
        const edgeCol = `rgb(${svgBorder})`;

        const svg = [];
        svg.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgW}" height="${svgH}" viewBox="${minX} ${minY} ${svgW} ${svgH}">`);

        // ── KEGG background: the REAL vector markup fetched above is
        // inlined directly (native <path>/<ellipse>/<text> elements, no
        // rasterization) inside a <g> whose transform maps the source SVG's
        // own native pixel space onto the exact same world-space rect the
        // on-screen canvas uses in draw()'s
        // `ctx.drawImage(img, -4.41, 12.79, 4891.49, 3195.12)` call — same
        // non-uniform scale, just expressed as an SVG transform instead of
        // a canvas draw call. Lines and text are separate named <g> groups —
        // independently visible/toggleable layers in Illustrator (or any
        // SVG editor), mirroring the app's own independent "Show map lines"
        // / "Pathway regions" toggles, with fully editable vector paths.
        // No clip-path needed: the bounding box above already always
        // expands to contain this rect in full whenever either layer is on. ──
        if (keggLinesSvg) {
          const sx = KEGG_DEST_W / keggLinesSvg.nativeW;
          const sy = KEGG_DEST_H / keggLinesSvg.nativeH;
          svg.push(`<g id="KEGG_Map_Lines" opacity="${keggBgOpacity.toFixed(2)}" transform="translate(${KEGG_DEST_X},${KEGG_DEST_Y}) scale(${sx.toFixed(6)},${sy.toFixed(6)})">`);
          svg.push(keggLinesSvg.markup);
          svg.push('</g>');
        }
        if (keggTextSvg) {
          const sx = KEGG_DEST_W / keggTextSvg.nativeW;
          const sy = KEGG_DEST_H / keggTextSvg.nativeH;
          svg.push(`<g id="KEGG_Region_Text" opacity="${keggBgOpacity.toFixed(2)}" transform="translate(${KEGG_DEST_X},${KEGG_DEST_Y}) scale(${sx.toFixed(6)},${sy.toFixed(6)})">`);
          svg.push(keggTextSvg.markup);
          svg.push('</g>');
        }

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

        // ── Layer: Edges (skip if hideEdges is enabled) ──
        if (!hideEdgesRef.current && allEdges.length > 0) {
          svg.push('<g id="Edges" fill="none" stroke-linecap="round" stroke-linejoin="round">');
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
            const bR = Math.min(G * 0.35, 2);
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
            const curveOff = total === 1 ? 0 : (myIdx - (total - 1) / 2) * 4;
            const curvature = Math.min(dist * 0.15, 6) + curveOff;
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
        }

        // ── Layer: Compounds (front-most layer) ──
        // Nested by generation, then by compound — each compound group contains
        // its shape and its text label together, named by KEGG id, for easy
        // selection/coloring/moving in Illustrator.
        const labelOff = useStruct ? halfH + 1 : R + 1;
        const fontSizeScale = 1 + (nodeSizeScale - 1) * 0.5;
        const svgFontSize = 7 * fontSizeScale;
        const getSvgLabel = (n) => nodeDisplayRef.current === 'structure'
          ? (compoundNamesRef.current.get(n.id) ?? n.label ?? n.id)
          : showNamesRef.current
            ? (compoundNamesRef.current.get(n.id) ?? n.label ?? n.id)
            : (n.label ?? n.id);

        // ── Label collision-avoidance (mirrors the on-screen cascade in
        // draw()'s drawLabel): if a label would overlap one already placed,
        // push it further down in fixed steps instead of letting them
        // overlap, so exported labels match exactly what the viewport shows
        // instead of all sitting at the same fixed offset. ──
        const measureCtx = canvasRef.current
          ? canvasRef.current.getContext('2d')
          : document.createElement('canvas').getContext('2d');
        measureCtx.font = `500 ${svgFontSize}px "Inter", sans-serif`;
        const placedLabelGrid = new Map();
        const LABEL_GRID = Math.max(8, svgFontSize * 2);
        const labelOverlaps = (x0, y0, x1, y1) => {
          const gx0 = Math.floor(x0 / LABEL_GRID), gx1 = Math.floor(x1 / LABEL_GRID);
          const gy0 = Math.floor(y0 / LABEL_GRID), gy1 = Math.floor(y1 / LABEL_GRID);
          for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
              const cell = placedLabelGrid.get(gx + ',' + gy);
              if (!cell) continue;
              for (const r of cell) {
                if (x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0) return true;
              }
            }
          }
          return false;
        };
        const placeLabelRect = (x0, y0, x1, y1) => {
          const gx0 = Math.floor(x0 / LABEL_GRID), gx1 = Math.floor(x1 / LABEL_GRID);
          const gy0 = Math.floor(y0 / LABEL_GRID), gy1 = Math.floor(y1 / LABEL_GRID);
          for (let gx = gx0; gx <= gx1; gx++) {
            for (let gy = gy0; gy <= gy1; gy++) {
              const key = gx + ',' + gy;
              let cell = placedLabelGrid.get(key);
              if (!cell) { cell = []; placedLabelGrid.set(key, cell); }
              cell.push({ x0, y0, x1, y1 });
            }
          }
        };
        const candidateDys = [
          labelOff,
          labelOff + 1 * (svgFontSize + 3),
          labelOff + 2 * (svgFontSize + 3),
          labelOff + 3 * (svgFontSize + 3),
          labelOff + 4 * (svgFontSize + 3),
          labelOff + 5 * (svgFontSize + 3),
        ];
        const labelDyById = new Map();
        const priorityNodes = [];
        const normalNodes = [];
        nodes.forEach(n => (highlightIds && highlightIds.has(n.id) ? priorityNodes : normalNodes).push(n));
        const chooseDy = (n, forceShow) => {
          const w = measureCtx.measureText(getSvgLabel(n)).width;
          const x0 = n.x - w / 2 - 1, x1 = n.x + w / 2 + 1;
          let chosenDy = candidateDys[0];
          if (!forceShow) {
            let found = false;
            for (const dy of candidateDys) {
              const y0 = n.y + dy - 1, y1 = n.y + dy + svgFontSize + 1;
              if (!labelOverlaps(x0, y0, x1, y1)) { chosenDy = dy; found = true; break; }
            }
            if (!found) chosenDy = candidateDys[0];
          }
          const y0 = n.y + chosenDy - 1, y1 = n.y + chosenDy + svgFontSize + 1;
          placeLabelRect(x0, y0, x1, y1);
          labelDyById.set(n.id, chosenDy);
        };
        priorityNodes.forEach(n => chooseDy(n, true));
        normalNodes.forEach(n => chooseDy(n, false));

        const nodesByGen = new Map();
        nodes.forEach(n => {
          const gen = n.generation || 0;
          if (!nodesByGen.has(gen)) nodesByGen.set(gen, []);
          nodesByGen.get(gen).push(n);
        });
        const sortedGens = Array.from(nodesByGen.keys()).sort((a, b) => a - b);

        svg.push('<g id="Compounds">');
        for (const gen of sortedGens) {
          svg.push(`<g id="Generation_${gen}">`);
          for (const n of nodesByGen.get(gen)) {
            const isDimmed = highlightIds && !highlightIds.has(n.id);
            const opacity = isDimmed ? 0.4 : 1;
            const { fill, stroke } = nodeColor(n);
            const tex = useStruct ? structTexRef.current.get(n.id) : null;
            const col = (highlightIds && highlightIds.has(n.id))
              ? `rgb(${svgInfo})`
              : `rgb(${svgTextMuted})`;
            const svgLabel = getSvgLabel(n);
            const labelDy = labelDyById.get(n.id) ?? labelOff;

            svg.push(`<g id="${safeId(n.id)}">`);
            if (tex) {
              const aspect = tex._aspect || 1;
              const drawW = SH * aspect;
              const hw = drawW / 2;
              // Convert canvas to base64 data URI
              const dataUrl = tex.toDataURL('image/png');
              svg.push(`<image x="${n.x - hw}" y="${n.y - halfH}" width="${drawW}" height="${SH}" xlink:href="${dataUrl}" opacity="${opacity}"/>`);
            } else {
              svg.push(`<circle cx="${n.x}" cy="${n.y}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" opacity="${opacity}"/>`);
            }
            svg.push(`<text x="${n.x}" y="${n.y + labelDy + 6}" font-family="Inter, sans-serif" font-weight="500" font-size="${svgFontSize.toFixed(2)}" text-anchor="middle" fill="${col}" opacity="${opacity}">${esc(svgLabel)}</text>`);
            svg.push('</g>');
          }
          svg.push('</g>');
        }
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

        const nodeRadius = () => R_COMPOUND * nodeSizeScale * 2.5;
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
              } else if (dist < 40) {
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

    /* ── Reset local edits when graph source data changes ── */
    useEffect(() => {
      localEditsRef.current = { deletedNodes: new Set(), deletedEdges: new Set(), addedEdges: [] };
      localEditsVersionRef.current += 1;
    }, [graph]);

    /* ── Delete handlers ── */
    const _currentLinks = () => {
      const edits = localEditsRef.current;
      return [
        ...graphRef.current.links.filter(l => !edits.deletedEdges.has(_edgeKey(l))),
        ...edits.addedEdges,
      ];
    };

    const handleDeleteEdge = (link) => {
      localEditsRef.current.deletedEdges.add(_edgeKey(link));
      localEditsVersionRef.current += 1;
      setCtxMenu(null);
      drawRef.current?.(nodesRef.current);
    };

    const handleDeleteIncoming = (nodeId) => {
      const edits = localEditsRef.current;
      _currentLinks().forEach(l => {
        if ((l.target?.id || l.target) === nodeId) edits.deletedEdges.add(_edgeKey(l));
      });
      localEditsVersionRef.current += 1;
      setCtxMenu(null);
      drawRef.current?.(nodesRef.current);
    };

    const handleDeleteOutgoing = (nodeId) => {
      const edits = localEditsRef.current;
      _currentLinks().forEach(l => {
        if ((l.source?.id || l.source) === nodeId) edits.deletedEdges.add(_edgeKey(l));
      });
      localEditsVersionRef.current += 1;
      setCtxMenu(null);
      drawRef.current?.(nodesRef.current);
    };

    const handleDeleteNode = (nodeId) => {
      const edits = localEditsRef.current;
      const currentLinks = _currentLinks();
      const preds = new Set();
      const succs = new Set();
      currentLinks.forEach(l => {
        const s = l.source?.id || l.source;
        const t = l.target?.id || l.target;
        if (t === nodeId && !edits.deletedNodes.has(s)) preds.add(s);
        if (s === nodeId && !edits.deletedNodes.has(t)) succs.add(t);
      });
      preds.forEach(p => {
        succs.forEach(s => {
          if (p === s) return;
          const bridge = { source: p, target: s, reactionId: `bridge_${p}_${s}`, label: '', _isBridge: true };
          const bKey = _edgeKey(bridge);
          const alreadyExists = edits.addedEdges.some(e => _edgeKey(e) === bKey)
            || currentLinks.some(e => (e.source?.id || e.source) === p && (e.target?.id || e.target) === s);
          if (!alreadyExists) edits.addedEdges.push(bridge);
        });
      });
      edits.deletedNodes.add(nodeId);
      localEditsVersionRef.current += 1;
      setCtxMenu(null);
      drawRef.current?.(nodesRef.current);
    };

    // Cleanup refs on unmount to prevent memory leaks
    useEffect(() => {
      return () => {
        structTexRef.current.clear();
        compoundNamesRef.current.clear();
        smilesDataRef.current = {};
        positionCacheRef.current = {};
      };
    }, []);

    const ctxNodeLabel = ctxMenu?.type === 'node'
      ? (compoundNamesRef.current.get(ctxMenu.nodeId) ?? ctxMenu.nodeId ?? '')
      : null;

    return (
      <div className="relative w-full h-full" onClick={() => setCtxMenu(null)}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />
        <NodeInfoPanel
          selectedNodes={selectedNodes}
          degreeMap={degreeMap}
          onDeselectNode={handleDeselectNode}
          nodeReactionsMap={nodeReactionsMap}
        />
        {ctxMenu && (
          <div
            className="fixed z-50 min-w-[170px] rounded-xl border border-brd/50 bg-surface-overlay/95 backdrop-blur-xl shadow-2xl py-1 text-xs"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            {ctxMenu.type === 'group' && (() => {
              const GROUP_ACTIONS = [
                { type: 'flipH',    label: 'Flip Horizontal', icon: '↔' },
                { type: 'flipV',    label: 'Flip Vertical',   icon: '↕' },
                { type: 'rot90cw',  label: 'Rotate 90° CW',   icon: '↻' },
                { type: 'rot90ccw', label: 'Rotate 90° CCW',  icon: '↺' },
                { type: 'rot180',   label: 'Rotate 180°',     icon: '⟳' },
              ];
              return (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-content-muted uppercase tracking-wide border-b border-brd/40">
                    {pinnedNodesRef.current.size} node{pinnedNodesRef.current.size !== 1 ? 's' : ''} selected
                  </div>
                  {GROUP_ACTIONS.map(a => (
                    <button
                      key={a.type}
                      onClick={() => applyGroupTransform(a.type)}
                      className="w-full text-left px-3 py-1.5 text-content hover:bg-surface-inset transition-colors flex items-center gap-2"
                    >
                      <span className="text-base leading-none text-content-muted select-none">{a.icon}</span>
                      {a.label}
                    </button>
                  ))}
                </>
              );
            })()}
            {ctxMenu.type === 'node' && (
              <>
                <div className="px-3 py-1 text-content-secondary font-medium truncate max-w-[200px]">{ctxNodeLabel}</div>
                <div className="h-px bg-brd mx-2 my-1" />
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-secondary text-content transition-colors"
                  onClick={() => handleDeleteIncoming(ctxMenu.nodeId)}
                >
                  Delete incoming edges
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-secondary text-content transition-colors"
                  onClick={() => handleDeleteOutgoing(ctxMenu.nodeId)}
                >
                  Delete outgoing edges
                </button>
                <div className="h-px bg-brd mx-2 my-1" />
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-secondary text-err hover:text-err/80 transition-colors"
                  onClick={() => handleDeleteNode(ctxMenu.nodeId)}
                >
                  Delete node + bridge edges
                </button>
              </>
            )}
            {ctxMenu.type === 'edge' && (
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-surface-secondary text-err hover:text-err/80 transition-colors"
                onClick={() => handleDeleteEdge(ctxMenu.link)}
              >
                Delete edge
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default GraphCanvas;
