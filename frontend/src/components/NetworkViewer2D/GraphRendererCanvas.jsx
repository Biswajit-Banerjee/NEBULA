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
import SmilesDrawer from "smiles-drawer";
import { getApiUrl } from '../../config/api';
import { processData, applyHierarchicalLayout, SUB_COL_GAP, GEN_GAP, ROW_SPACING } from "./utils/graphProcessing";
import { getSchemeColor, getTypeColor } from "./utils/colorSchemes";
import { ThemeContext } from "../ThemeProvider/ThemeProvider";
import NodeInfoPanel from "./NodeInfoPanel";
import compoundMapJson from "../SearchPanel/compound_map.json";

const _compoundNameMap = new Map();
compoundMapJson.forEach(c => _compoundNameMap.set(c.compound_id, c.name));

const STRUCT_TEX = 1024;    // offscreen canvas resolution
const STRUCT_WORLD_H = 84;  // world-unit height for structure images

const _ELEM_DARK = { C:'#cbd5e1',O:'#ef4444',N:'#3b82f6',S:'#eab308',P:'#f97316',F:'#22c55e',Cl:'#14b8a6',Br:'#d97706',I:'#8b5cf6',H:'#cbd5e1' };
const _ELEM_LIGHT = { C:'#334155',O:'#dc2626',N:'#2563eb',S:'#ca8a04',P:'#ea580c',F:'#16a34a',Cl:'#0d9488',Br:'#b45309',I:'#7c3aed',H:'#334155' };

const _parseMol = (molText) => {
  const lines = molText.split('\n');
  let countsIdx = 3;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (/^\s*\d+\s+\d+/.test(lines[i]) && lines[i].includes('V2000')) { countsIdx = i; break; }
  }
  const counts = lines[countsIdx].trim().split(/\s+/);
  const nAtoms = parseInt(counts[0]) || 0;
  const nBonds = parseInt(counts[1]) || 0;
  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const p = lines[countsIdx + 1 + i]?.trim().split(/\s+/);
    if (!p || p.length < 4) continue;
    atoms.push({ x: parseFloat(p[0]), y: parseFloat(p[1]), symbol: p[3] });
  }
  const bonds = [];
  for (let i = 0; i < nBonds; i++) {
    const p = lines[countsIdx + 1 + nAtoms + i]?.trim().split(/\s+/);
    if (!p || p.length < 3) continue;
    bonds.push({ a1: parseInt(p[0]) - 1, a2: parseInt(p[1]) - 1, type: parseInt(p[2]) || 1 });
  }
  return { atoms, bonds };
};

const _renderMol = (mol, size, isDark) => {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!mol.atoms.length) return null;
  const colors = isDark ? _ELEM_DARK : _ELEM_LIGHT;
  const def = isDark ? '#cbd5e1' : '#334155';
  let axMin=Infinity,ayMin=Infinity,axMax=-Infinity,ayMax=-Infinity;
  mol.atoms.forEach(a => { axMin=Math.min(axMin,a.x);ayMin=Math.min(ayMin,a.y);axMax=Math.max(axMax,a.x);ayMax=Math.max(ayMax,a.y); });
  const aw=axMax-axMin||1,ah=ayMax-ayMin||1;
  const pad=size*0.12,usable=size-pad*2,scale=Math.min(usable/aw,usable/ah);
  const ox=(size-aw*scale)/2-axMin*scale,oy=(size-ah*scale)/2-ayMin*scale;
  const tx=a=>a.x*scale+ox,ty=a=>size-(a.y*scale+oy);
  const bw=Math.max(2,scale*0.06),bg=Math.max(3,scale*0.08);
  ctx.strokeStyle=def; ctx.lineWidth=bw; ctx.lineCap='round';
  mol.bonds.forEach(b => {
    const a1=mol.atoms[b.a1],a2=mol.atoms[b.a2]; if(!a1||!a2)return;
    const x1=tx(a1),y1=ty(a1),x2=tx(a2),y2=ty(a2);
    if(b.type===1){ ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); }
    else if(b.type===2){ const dx=x2-x1,dy=y2-y1,d=Math.sqrt(dx*dx+dy*dy)||1,nx=-dy/d*bg/2,ny=dx/d*bg/2; ctx.beginPath();ctx.moveTo(x1+nx,y1+ny);ctx.lineTo(x2+nx,y2+ny);ctx.stroke();ctx.beginPath();ctx.moveTo(x1-nx,y1-ny);ctx.lineTo(x2-nx,y2-ny);ctx.stroke(); }
    else{ const dx=x2-x1,dy=y2-y1,d=Math.sqrt(dx*dx+dy*dy)||1,nx=-dy/d*bg,ny=dx/d*bg; ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.beginPath();ctx.moveTo(x1+nx,y1+ny);ctx.lineTo(x2+nx,y2+ny);ctx.stroke();ctx.beginPath();ctx.moveTo(x1-nx,y1-ny);ctx.lineTo(x2-nx,y2-ny);ctx.stroke(); }
  });
  const fs=Math.max(14,Math.min(scale*0.32,48));
  ctx.font=`bold ${fs}px "Inter",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  mol.atoms.forEach(a => {
    if(a.symbol==='C')return;
    const ax=tx(a),ay=ty(a),lw=ctx.measureText(a.symbol).width+4;
    ctx.clearRect(ax-lw/2,ay-fs/2-2,lw,fs+4);
    ctx.fillStyle=colors[a.symbol]||def; ctx.fillText(a.symbol,ax,ay);
  });
  canvas._aspect=1; return canvas;
};

const _renderNameTex = (name, size, isDark) => {
  const canvas = document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  const fg=isDark?'#a5b4fc':'#4f46e5';
  const fs=Math.min(size*0.18,120);
  ctx.font=`600 ${fs}px "Inter",sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const words=name.split(/\s+/),lines=[]; let line='';
  words.forEach(w => { const t=line?line+' '+w:w; if(ctx.measureText(t).width>size*0.85&&line){lines.push(line);line=w;}else{line=t;} });
  if(line)lines.push(line);
  const lh=fs*1.25,totalH=lines.length*lh,startY=(size-totalH)/2+lh/2;
  ctx.fillStyle=fg;
  lines.forEach((l,i)=>ctx.fillText(l,size/2,startY+i*lh));
  canvas._aspect=1; return canvas;
};

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
      showNodeNames = false,
      showStructures = false,
      curvedEdges = true,
      brushMode = false,
      brushColor = '#ff0000',
    },
    ref
  ) => {
    const { dark, themeName } = useContext(ThemeContext);
    const canvasRef = useRef(null);
    const nodesRef = useRef([]); // static node array (no physics)
    const zoomRef = useRef(null);
    const transformRef = useRef(d3.zoomIdentity);
    const [collapsedRoots, setCollapsedRoots] = useState(new Set()); // reaction-side nodes acting as collapse pivots
    const [hiddenIds, setHiddenIds] = useState(new Set());
    const [ctrlHeld, setCtrlHeld] = useState(false);
    const [ctxMenu, setCtxMenu] = useState(null); // { x, y } screen coords
    const positionCacheRef = useRef({}); // persistent nodeId → {x,y}
    const dirtyRef = useRef(false);      // rAF batching flag
    const rafIdRef = useRef(null);       // rAF handle
    const hoveredNodeRef = useRef(null); // id of node under cursor (for edge highlight)
    const pinnedNodesRef = useRef(new Set()); // pinned node IDs (click-to-hold)
    const lockedNodesRef = useRef(new Set()); // locked (immovable) node IDs
    const smilesDataRef = useRef({});
    const structTexRef = useRef(new Map()); // Map<compoundId, canvas>
    const structTexThemeRef = useRef(null); // tracks which theme the cached textures were rendered for
    const nodeDisplayRef = useRef(showStructures);
    nodeDisplayRef.current = showStructures;
    const selBoxRef = useRef(null);           // ctrl+drag selection rect {x1,y1,x2,y2}
    const multiDragRef = useRef(null);        // [{node,offX,offY}] for group drag
    const [selectedNodes, setSelectedNodes] = useState([]);
    const drawRef = useRef(null);        // always points to latest draw fn
    const syncSelectionRef = useRef(null); // always points to latest syncSelection
    const needsFitRef = useRef(true);    // auto-fit view on first layout / new data
    const prevDataRef = useRef(null);    // track data identity for auto-fit
    const genMapRef = useRef([]);        // compact generation mapping from layout
    const edgeColorsRef = useRef(new Map()); // Map<edgeKey, cssColor> for brush tool
    const brushModeRef = useRef(brushMode);  // live refs to avoid stale closures
    brushModeRef.current = brushMode;
    const brushColorRef = useRef(brushColor);
    brushColorRef.current = brushColor;
    const graphLinksRef = useRef([]);    // kept in sync with graph.links
    const curvedEdgesRef = useRef(curvedEdges);
    curvedEdgesRef.current = curvedEdges;

    // Apply a spatial transform to all selected (pinned) non-locked nodes around their centroid
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
    graphLinksRef.current = graph.links || [];

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

    /* ── Fetch & render molecular structures when showStructures enabled ── */
    useEffect(() => {
      if (!showStructures || !graph.nodes || !graph.nodes.length) return;
      let cancelled = false;
      const abortCtrl = new AbortController();

      // Clear cache if theme changed so textures are re-rendered with correct colors
      const currentTheme = dark ? 'dark' : 'light';
      if (structTexThemeRef.current !== currentTheme) {
        structTexRef.current.clear();
        structTexThemeRef.current = currentTheme;
      }

      // Evict oldest entries if cache grows too large
      if (structTexRef.current.size > 500) structTexRef.current.clear();

      const compoundIds = graph.nodes
        .filter(n => n.type === 'compound')
        .map(n => n.id)
        .filter(id => /^[CZ]\d{5}$/.test(id));

      const needed = compoundIds.filter(id => !structTexRef.current.has(id));
      if (!needed.length) return;

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

          const drawer = new SmilesDrawer.Drawer({
            width: STRUCT_TEX, height: STRUCT_TEX,
            bondThickness: 3.5, bondLength: 32, shortBondLength: 0.85,
            bondSpacing: 9, fontSizeLarge: 14, fontSizeSmall: 6,
            padding: 30, compactDrawing: true,
            explicitHydrogens: false, terminalCarbons: false,
            themes: {
              dark:  { C:'#cbd5e1',O:'#ef4444',N:'#3b82f6',S:'#eab308',P:'#f97316',F:'#22c55e',CL:'#14b8a6',BR:'#d97706',I:'#8b5cf6',H:'#cbd5e1',BACKGROUND:'transparent' },
              light: { C:'#334155',O:'#dc2626',N:'#2563eb',S:'#ca8a04',P:'#ea580c',F:'#16a34a',CL:'#0d9488',BR:'#b45309',I:'#7c3aed',H:'#334155',BACKGROUND:'transparent' },
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
                  offscreen.width = STRUCT_TEX; offscreen.height = STRUCT_TEX;
                  drawer.draw(tree, offscreen, theme, false);
                  offscreen._aspect = 1;
                  structTexRef.current.set(cid, offscreen);
                  resolve();
                }, reject);
              });
            } catch (e) { /* fall through to MOL */ }
          }

          if (mol) {
            for (const [cid, molText] of Object.entries(mol)) {
              if (cancelled) return;
              if (structTexRef.current.has(cid) || !molText) continue;
              try {
                const parsed = _parseMol(molText);
                if (parsed.atoms.length > 0) {
                  const tex = _renderMol(parsed, STRUCT_TEX, dark);
                  if (tex) structTexRef.current.set(cid, tex);
                }
              } catch (e) { }
            }
          }

          if (names) {
            for (const [cid, name] of Object.entries(names)) {
              if (cancelled) return;
              if (structTexRef.current.has(cid)) continue;
              const tex = _renderNameTex(name, STRUCT_TEX, dark);
              if (tex) structTexRef.current.set(cid, tex);
            }
          }

          if (!cancelled) drawRef.current?.(nodesRef.current);
        } catch (e) {
          console.warn('[NEBULA] Structure fetch failed:', e);
        }
      })();

      return () => { cancelled = true; abortCtrl.abort(); };
    }, [graph.nodes, showStructures, dark]);

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

      // Read theme colors from CSS custom properties for canvas rendering
      const _cs = getComputedStyle(document.documentElement);
      const _rv = (v) => { const r = _cs.getPropertyValue(v).trim(); return r ? r.replace(/ /g, ',') : null; };
      const themeTextMuted = _rv('--text-muted') || (dark ? '148,163,184' : '100,116,139');
      const themeTextPrimary = _rv('--text-primary') || (dark ? '203,213,225' : '55,65,81');
      const themeBorderPrimary = _rv('--border-primary') || (dark ? '140,160,190' : '160,170,185');
      const themeBorderSecondary = _rv('--border-secondary') || (dark ? '148,163,184' : '100,116,139');
      const themeInfoColor = _rv('--info') || (dark ? '96,165,250' : '59,130,246');
      const themeBrandColor = _rv('--brand-primary') || (dark ? '196,181,253' : '139,92,246');

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
        : `rgba(${themeBorderSecondary},0.22)`;

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
        const colLabelColor = `rgba(${themeTextMuted},0.72)`;
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
        if (node.type === 'compound' && showStructures && structTexRef.current.has(node.id)) {
          // Rectangle intersection for structure image bounding box
          const tex = structTexRef.current.get(node.id);
          const hw = STRUCT_WORLD_H * (tex._aspect || 1) / 2 + 2;
          const hh = STRUCT_WORLD_H / 2 + 2;
          const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
          const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
          r = Math.min(tx, ty);
        } else if (node.type === 'compound') {
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

          // Custom brush color overrides type-based colour (style unchanged)
          const edgeKey = `${(link.source?.id || link.source)}--${(link.target?.id || link.target)}`;
          const customColor = edgeColorsRef.current.get(edgeKey);
          ctx.strokeStyle = customColor || `rgba(${r},${g},${b},${alpha})`;
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

          const dx = trg.x - src.x;
          const dy = trg.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          ctx.beginPath();
          if (curvedEdges) {
            const curvature = Math.min(dist * 0.12, 30);
            const mx = (src.x + trg.x) / 2;
            const my = (src.y + trg.y) / 2;
            const nx = dist > 0 ? -dy / dist : 0;
            const ny = dist > 0 ? dx / dist : 0;
            const cpx = mx + nx * curvature;
            const cpy = my + ny * curvature;
            const s0 = surfacePoint(src, cpx - src.x, cpy - src.y);
            const s1 = surfacePoint(trg, cpx - trg.x, cpy - trg.y);
            ctx.moveTo(s0.x, s0.y);
            ctx.quadraticCurveTo(cpx, cpy, s1.x, s1.y);
          } else {
            const s0 = surfacePoint(src, dx, dy);
            const s1 = surfacePoint(trg, -dx, -dy);
            ctx.moveTo(s0.x, s0.y);
            ctx.lineTo(s1.x, s1.y);
          }
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

        // Structure texture for compound nodes
        const _structTex = (showStructures && n.type === 'compound')
          ? structTexRef.current.get(n.id) : null;
        const _sHalfH = STRUCT_WORLD_H / 2;
        const _sHalfW = _structTex ? STRUCT_WORLD_H * (_structTex._aspect || 1) / 2 : 0;

        // Highlighted node (hovered or pinned) gets a soft glow ring
        if (isHighlighted) {
          ctx.save();
          ctx.strokeStyle = `rgba(${themeInfoColor},0.55)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (_structTex) {
            ctx.roundRect(n.x - _sHalfW - 4, n.y - _sHalfH - 4, (_sHalfW + 4) * 2, (_sHalfH + 4) * 2, 6);
          } else if (n.type === "compound") ctx.arc(n.x, n.y, R_COMPOUND + 4, 0, Math.PI * 2);
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
            if (_structTex) {
              ctx.drawImage(_structTex, n.x - _sHalfW, n.y - _sHalfH, _sHalfW * 2, STRUCT_WORLD_H);
            } else {
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(n.x, n.y, R_COMPOUND, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
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
        // Locked node indicator: amber dashed ring
        if (lockedNodesRef.current.has(n.id)) {
          ctx.save();
          ctx.strokeStyle = 'rgba(251,191,36,0.9)';
          ctx.lineWidth = Math.max(1.5 / t.k, 0.8);
          ctx.setLineDash([3 / t.k, 2 / t.k]);
          ctx.beginPath();
          if (_structTex) {
            ctx.roundRect(n.x - _sHalfW - 5, n.y - _sHalfH - 5, (_sHalfW + 5) * 2, (_sHalfH + 5) * 2, 6);
          } else if (n.type === 'compound') ctx.arc(n.x, n.y, R_COMPOUND + 5, 0, Math.PI * 2);
          else if (n.type === 'ec') ctx.ellipse(n.x, n.y, EC_RX + 5, EC_RY + 5, 0, 0, Math.PI * 2);
          else ctx.roundRect(n.x - RECT_W / 2 - 4, n.y - RECT_H / 2 - 4, RECT_W + 8, RECT_H + 8, RECT_R + 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      });

      /* ---------------------------------------------------------- */
      /* Draw edge stoichiometry labels (only when weight > 1)     */
      /* ---------------------------------------------------------- */
      if (t.k >= 0.6) {
        const stoichSize = Math.max(4, Math.min(6, 5 / t.k * t.k));
        ctx.save();
        ctx.font = `bold ${stoichSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        visibleEdges.forEach(({ src, trg, link }) => {
          const s = link.stoichiometry;
          if (!s || s <= 1) return;
          if (link.type !== 'substrate' && link.type !== 'product') return;

          // Recompute bezier geometry (mirrors edge drawing above)
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
          const s0 = surfacePoint(src, cpx - src.x, cpy - src.y);
          const s1 = surfacePoint(trg, cpx - trg.x, cpy - trg.y);

          // Quadratic bezier midpoint at t = 0.5
          const lx = 0.25 * s0.x + 0.5 * cpx + 0.25 * s1.x;
          const ly = 0.25 * s0.y + 0.5 * cpy + 0.25 * s1.y;

          const label = s % 1 === 0 ? String(Math.round(s)) : s.toFixed(1);
          ctx.fillStyle = `rgba(${themeTextMuted},0.9)`;
          ctx.fillText(label, lx, ly);
        });
        ctx.restore();
      }

      /* ---------------------------------------------------------- */
      /* Draw labels – progressive: only when zoomed in enough      */
      /* ---------------------------------------------------------- */
      if (t.k >= 0.45) {
        const fontSize = Math.max(5, Math.min(7, 6 / t.k * t.k));
        ctx.textAlign = "center";
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          if (!inView(n.x, n.y)) return;

          const _sTex2 = (showStructures && n.type === 'compound')
            ? structTexRef.current.get(n.id) : null;
          const _labelBaseY = _sTex2
            ? n.y + STRUCT_WORLD_H / 2 + 3
            : n.type === 'compound' ? n.y + R_COMPOUND + 3 : null;

          if (showNodeNames && n.type === 'compound') {
            if (!_sTex2) {
              // ID stays inside the node when no structure
              ctx.font = `${fontSize}px "Inter", sans-serif`;
              ctx.textBaseline = "middle";
              ctx.fillStyle = `rgb(${themeTextPrimary})`;
              ctx.fillText(n.label ?? n.id, n.x, n.y);
            }
            // Human-readable name rendered below the node/structure
            const name = _compoundNameMap.get(n.id);
            if (name) {
              ctx.font = `${Math.max(4, fontSize - 1)}px "Inter", sans-serif`;
              ctx.textBaseline = "top";
              ctx.fillStyle = `rgba(${themeTextMuted},0.9)`;
              ctx.fillText(name, n.x, _labelBaseY ?? (n.y + R_COMPOUND + 3));
            }
          } else {
            let label = n.label ?? n.id;
            if (/reaction-/.test(n.type)) label = label.split("_")[0];
            ctx.font = `${fontSize}px "Inter", sans-serif`;
            if (_sTex2) {
              ctx.textBaseline = "top";
              ctx.fillStyle = `rgba(${themeTextMuted},0.9)`;
              ctx.fillText(label, n.x, _labelBaseY);
            } else {
              ctx.textBaseline = "middle";
              ctx.fillStyle = `rgb(${themeTextPrimary})`;
              ctx.fillText(label, n.x, n.y);
            }
          }
        });
      }

      // Ctrl+drag selection box (world coords)
      if (selBoxRef.current) {
        const { x1, y1, x2, y2 } = selBoxRef.current;
        const selRx = Math.min(x1, x2), selRy = Math.min(y1, y2);
        const selRw = Math.abs(x2 - x1), selRh = Math.abs(y2 - y1);
        ctx.save();
        ctx.strokeStyle = `rgba(${themeInfoColor},0.85)`;
        ctx.fillStyle = `rgba(${themeInfoColor},0.08)`;
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
    }, [dark, themeName, graph, hiddenIds, maxGeneration, collapsedRoots, showOverlay, pairColorMap, edgeOpacity, spacingScale, colorMode, colorScheme, bgColor, gridColor, showNodeNames, showStructures, curvedEdges]);

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
        // Clear stale position cache from previous search
        positionCacheRef.current = {};
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
          if (ev.ctrlKey) return false; // ctrl reserved for selection box
          if (ev.type !== 'mousedown') return true;
          // Disable zoom if pointer is on a node (so we can drag it)
          const rect = canvas.getBoundingClientRect();
          const mx = (ev.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
          const my = (ev.clientY - rect.top - transformRef.current.y) / transformRef.current.k;
          const hitNode = nodesRef.current.find((n) => {
            if (nodeDisplayRef.current && n.type === 'compound' && structTexRef.current.has(n.id)) {
              const tex = structTexRef.current.get(n.id);
              const hh = STRUCT_WORLD_H / 2;
              const hw = hh * (tex._aspect || 1);
              return Math.abs(mx - n.x) <= hw && Math.abs(my - n.y) <= hh;
            }
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

    /* ── Right-click: group transform menu ── */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const handler = (e) => {
        e.preventDefault();
        if (pinnedNodesRef.current.size > 0) {
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }
      };
      canvas.addEventListener('contextmenu', handler);
      return () => canvas.removeEventListener('contextmenu', handler);
    }, []);

    /* ── Close context menu on outside click ── */
    useEffect(() => {
      if (!ctxMenu) return;
      const handler = () => setCtxMenu(null);
      window.addEventListener('pointerdown', handler);
      return () => window.removeEventListener('pointerdown', handler);
    }, [ctxMenu]);

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
      let didDrag = false;

      const hitTest = (mx, my) => {
        const nodes = nodesRef.current;
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          if (nodeDisplayRef.current && n.type === 'compound' && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const hh = STRUCT_WORLD_H / 2;
            const hw = hh * (tex._aspect || 1);
            if (Math.abs(mx - n.x) <= hw && Math.abs(my - n.y) <= hh) return n;
          } else if ((mx - n.x) ** 2 + (my - n.y) ** 2 < 300) return n;
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

      // ── Pointer down ──
      const pointerdown = (e) => {
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

        if (node) {
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
      const pointermove = (e) => {
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
          dragging.x = mx;
          dragging.y = my;
          didDrag = true;
          drawRef.current?.(nodesRef.current);
          return;
        }

        // Hover detection + cursor
        const hit = hitTest(mx, my);
        const found = hit ? hit.id : null;
        if (found !== hoveredNodeRef.current) {
          hoveredNodeRef.current = found;
          drawRef.current?.(nodesRef.current);
        }
        if (brushModeRef.current) {
          canvas.style.cursor = 'crosshair';
        } else if (found) {
          const isLocked = lockedNodesRef.current.has(found);
          canvas.style.cursor = isLocked ? 'not-allowed' : 'pointer';
        } else {
          canvas.style.cursor = 'grab';
        }
      };

      const pointerup = () => {
        // Finish selection box → add enclosed nodes to pinned set
        if (selBoxRef.current) {
          const { x1, y1, x2, y2 } = selBoxRef.current;
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
          if (maxX - minX > 4 || maxY - minY > 4) {
            nodesRef.current.forEach(n => {
              if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
                pinnedNodesRef.current.add(n.id);
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
          const MIN_DIST = 88;
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

      // Distance from point (px,py) to an edge (straight or quadratic bezier)
      const pointToEdgeDist = (px, py, src, trg, curved) => {
        const dx = trg.x - src.x, dy = trg.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (curved && len > 0) {
          const curvature = Math.min(len * 0.12, 30);
          const emx = (src.x + trg.x) / 2, emy = (src.y + trg.y) / 2;
          const nx = -dy / len, ny = dx / len;
          const cpx = emx + nx * curvature, cpy = emy + ny * curvature;
          let best = Infinity;
          for (let i = 0; i <= 24; i++) {
            const tp = i / 24;
            const bx = (1-tp)*(1-tp)*src.x + 2*(1-tp)*tp*cpx + tp*tp*trg.x;
            const by = (1-tp)*(1-tp)*src.y + 2*(1-tp)*tp*cpy + tp*tp*trg.y;
            const d = Math.sqrt((px-bx)**2 + (py-by)**2);
            if (d < best) best = d;
          }
          return best;
        }
        if (len === 0) return Math.sqrt((px-src.x)**2 + (py-src.y)**2);
        const tp = Math.max(0, Math.min(1, ((px-src.x)*dx + (py-src.y)*dy) / (len*len)));
        return Math.sqrt((px-(src.x+tp*dx))**2 + (py-(src.y+tp*dy))**2);
      };

      // ── Click: Ctrl+click = collapse, plain/shift click = pin ──
      const handleClick = (evt) => {
        if (didDrag) { didDrag = false; return; }

        const { mx, my } = worldCoords(evt);

        // Brush mode: colour the nearest edge
        if (brushModeRef.current) {
          const links = graphLinksRef.current;
          const nm = new Map(nodesRef.current.map(n => [n.id, n]));
          const HIT = 8; // world-unit threshold
          let bestDist = HIT, bestKey = null;
          links.forEach(l => {
            const sId = l.source?.id || l.source;
            const tId = l.target?.id || l.target;
            const src = nm.get(sId), trg = nm.get(tId);
            if (!src || !trg) return;
            const d = pointToEdgeDist(mx, my, src, trg, curvedEdgesRef.current);
            if (d < bestDist) { bestDist = d; bestKey = `${sId}--${tId}`; }
          });
          if (bestKey) {
            edgeColorsRef.current.set(bestKey, brushColorRef.current);
            drawRef.current?.(nodesRef.current);
          }
          return;
        }

        const hit = hitTest(mx, my);

        if (evt.ctrlKey && hit && /reaction-/.test(hit.type)) {
          setCollapsedRoots((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(hit.id)) newSet.delete(hit.id);
            else newSet.add(hit.id);
            return newSet;
          });
          return;
        }

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
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        const visibleLinks = graph.links.filter((l) => {
          const s = l.source?.id || l.source;
          const t = l.target?.id || l.target;
          return !hiddenIds.has(s) && !hiddenIds.has(t);
        });

        // Node size constants — scaled for print (labels need room at font-size 7)
        const SV_RC = 16, SV_ERX = 24, SV_ERY = 14;
        const SV_RW = 40, SV_RH = 24;

        // Surface-point helper (mirrors canvas surfacePoint)
        const svgSurface = (n, dx, dy) => {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d === 0) return { x: n.x, y: n.y };
          const ux = dx / d, uy = dy / d;
          let r;
          if (n.type === 'compound' && showStructures && structTexRef.current.has(n.id)) {
            const tex = structTexRef.current.get(n.id);
            const hw = STRUCT_WORLD_H * (tex._aspect || 1) / 2 + 2;
            const hh = STRUCT_WORLD_H / 2 + 2;
            const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
            const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
            r = Math.min(tx, ty);
          } else if (n.type === 'compound') {
            r = SV_RC;
          } else if (n.type === 'ec') {
            r = (SV_ERX * SV_ERY) / Math.sqrt((SV_ERY * ux) ** 2 + (SV_ERX * uy) ** 2);
          } else {
            const hw = SV_RW / 2, hh = SV_RH / 2;
            const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
            const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
            r = Math.min(tx, ty);
          }
          return { x: n.x + ux * r, y: n.y + uy * r };
        };

        // ── Print-quality export constants ──
        const EXPORT_SCALE = 3;   // physical pixel multiplier (3× = ~300 DPI usable)
        const EXPORT_PAD   = 12;  // tight whitespace around graph (world units)

        // Determine tight bounds accounting for structure images and labels
        const nameExtra = showNodeNames ? 14 : 0;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          const hasTex = showStructures && n.type === 'compound' && structTexRef.current.has(n.id);
          const hw = hasTex ? STRUCT_WORLD_H / 2 : (n.type === 'compound' ? 14 : n.type === 'ec' ? 20 : 17);
          const hh = hasTex ? STRUCT_WORLD_H / 2 : (n.type === 'compound' ? 14 : n.type === 'ec' ? 12 : 11);
          minX = Math.min(minX, n.x - hw);
          minY = Math.min(minY, n.y - hh);
          maxX = Math.max(maxX, n.x + hw);
          maxY = Math.max(maxY, n.y + hh + nameExtra);
        });
        minX -= EXPORT_PAD; minY -= EXPORT_PAD;
        maxX += EXPORT_PAD; maxY += EXPORT_PAD;
        const width = maxX - minX;
        const heightSvg = maxY - minY;

        // Resolve theme colours from CSS vars (values are "R G B" triplets)
        const _svgCs = getComputedStyle(document.documentElement);
        const _svgRv = (v) => {
          const r = _svgCs.getPropertyValue(v).trim();
          if (!r) return null;
          const p = r.split(/\s+/).map(Number);
          return p.some(isNaN) ? null : '#' + p.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
        };
        const svgBrandHex  = _svgRv('--brand-primary')  || (dark ? '#c4b5fd' : '#8B5CF6');
        const svgBorderHex = _svgRv('--border-primary')  || (dark ? '#475569' : '#9CA3AF');
        const svgTextHex   = _svgRv('--text-primary')    || (dark ? '#CBD5E1' : '#374151');
        const svgMutedHex  = _svgRv('--text-muted')      || (dark ? '#94A3B8' : '#6B7280');

        // Node style — mirrors canvas nodeColor() exactly
        const svgMaxDeg = degreeMap.size > 0 ? Math.max(1, ...degreeMap.values()) : 1;
        const SVG_MAX_BUCKET = 100;
        const getNodeStyle = (n) => {
          if (colorMode === 'type') return getTypeColor(n.type, dark);
          if (colorMode === 'degree') {
            const deg = degreeMap.get(n.id) || 0;
            const t = Math.round((deg / svgMaxDeg) * SVG_MAX_BUCKET) / SVG_MAX_BUCKET;
            return getSchemeColor(colorScheme, t, dark);
          }
          const gen = n.generation || 0;
          const t = maxGeneration > 0
            ? Math.round((gen / maxGeneration) * SVG_MAX_BUCKET) / SVG_MAX_BUCKET
            : 0;
          return getSchemeColor(colorScheme, t, dark);
        };

        // Edge opacity — mirrors canvas baseAlpha formula
        const svgEdgeCount = visibleLinks.length;
        const svgAutoAlpha = svgEdgeCount <= 50
          ? 0.35
          : svgEdgeCount <= 500
            ? 0.35 - (svgEdgeCount - 50) / 450 * 0.27
            : Math.max(0.03, 0.08 - (svgEdgeCount - 500) / 3000 * 0.05);
        const svgBaseAlpha = Math.min(1, svgAutoAlpha * (edgeOpacity * 2));

        const svgParts = [];
        // xmlns:xlink required for Illustrator compatibility with embedded images
        svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width * EXPORT_SCALE}" height="${heightSvg * EXPORT_SCALE}" viewBox="${minX} ${minY} ${width} ${heightSvg}">`);

        const svgNodeMap = new Map(nodes.map((n) => [n.id, n]));

        // ── Edges as quadratic bezier paths (mirrors canvas draw) ──
        visibleLinks.forEach((l) => {
          const sId = l.source?.id || l.source;
          const tId = l.target?.id || l.target;
          const src = svgNodeMap.get(sId);
          const trg = svgNodeMap.get(tId);
          if (!src || !trg) return;

          const dx = trg.x - src.x, dy = trg.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let dashAttr = '';
          if (l.type && l.type.startsWith('ec')) dashAttr = 'stroke-dasharray="2 4"';
          else if (l.type === 'reaction') dashAttr = 'stroke-dasharray="6 4"';

          const edgeSvgKey = `${sId}--${tId}`;
          const customStroke = edgeColorsRef.current.get(edgeSvgKey);
          const stroke = customStroke || ((l.type && l.type.startsWith('ec')) ? svgBrandHex : svgBorderHex);

          let pathD;
          let lx, ly;
          if (curvedEdges) {
            const curvature = Math.min(dist * 0.12, 30);
            const mx = (src.x + trg.x) / 2, my = (src.y + trg.y) / 2;
            const nx = dist > 0 ? -dy / dist : 0, ny = dist > 0 ? dx / dist : 0;
            const cpx = mx + nx * curvature, cpy = my + ny * curvature;
            const s0 = svgSurface(src, cpx - src.x, cpy - src.y);
            const s1 = svgSurface(trg, cpx - trg.x, cpy - trg.y);
            pathD = `M ${s0.x.toFixed(2)},${s0.y.toFixed(2)} Q ${cpx.toFixed(2)},${cpy.toFixed(2)} ${s1.x.toFixed(2)},${s1.y.toFixed(2)}`;
            lx = (0.25 * s0.x + 0.5 * cpx + 0.25 * s1.x).toFixed(2);
            ly = (0.25 * s0.y + 0.5 * cpy + 0.25 * s1.y).toFixed(2);
          } else {
            const s0 = svgSurface(src, dx, dy);
            const s1 = svgSurface(trg, -dx, -dy);
            pathD = `M ${s0.x.toFixed(2)},${s0.y.toFixed(2)} L ${s1.x.toFixed(2)},${s1.y.toFixed(2)}`;
            lx = ((s0.x + s1.x) / 2).toFixed(2);
            ly = ((s0.y + s1.y) / 2).toFixed(2);
          }
          const customColorAttr = customStroke ? ` data-custom-color="${customStroke}"` : '';
          svgParts.push(`<path d="${pathD}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="${svgBaseAlpha.toFixed(3)}" fill="none" data-edge-key="${edgeSvgKey}"${customColorAttr} ${dashAttr}/>`);

          // Stoichiometry label — offset perpendicularly so it doesn't sit on the stroke
          if (l.stoichiometry && l.stoichiometry > 1 && (l.type === 'substrate' || l.type === 'product')) {
            const sLabel = l.stoichiometry % 1 === 0 ? String(Math.round(l.stoichiometry)) : l.stoichiometry.toFixed(1);
            const perpOff = 6;
            const plx = dist > 0 ? +lx + (-dy / dist) * perpOff : +lx;
            const ply = dist > 0 ? +ly + ( dx / dist) * perpOff : +ly;
            svgParts.push(`<text x="${plx.toFixed(2)}" y="${ply.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="bold" fill="${svgMutedHex}" font-family="Arial, Helvetica, sans-serif">${sLabel}</text>`);
          }
        });

        // ── Nodes ──
        nodes.forEach((n) => {
          if (hiddenIds.has(n.id)) return;
          const { fill, stroke } = getNodeStyle(n);

          const structTex = (showStructures && n.type === 'compound')
            ? structTexRef.current.get(n.id) : null;

          if (structTex) {
            // Embed structure as base64 PNG image
            const sW = STRUCT_WORLD_H * (structTex._aspect || 1);
            const sH = STRUCT_WORLD_H;
            const dataUrl = structTex.toDataURL('image/png');
            svgParts.push(`<image xlink:href="${dataUrl}" x="${(n.x - sW / 2).toFixed(2)}" y="${(n.y - sH / 2).toFixed(2)}" width="${sW.toFixed(2)}" height="${sH.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`);

            // Label below structure
            let label = n.label ?? n.id;
            svgParts.push(`<text x="${n.x}" y="${(n.y + sH / 2 + 4).toFixed(2)}" text-anchor="middle" dominant-baseline="hanging" font-size="9" fill="${svgMutedHex}" font-family="Arial, Helvetica, sans-serif">${label}</text>`);
            if (showNodeNames) {
              const name = _compoundNameMap.get(n.id);
              if (name) svgParts.push(`<text x="${n.x}" y="${(n.y + sH / 2 + 13).toFixed(2)}" text-anchor="middle" dominant-baseline="hanging" font-size="8" fill="${svgMutedHex}" font-family="Arial, Helvetica, sans-serif">${name}</text>`);
            }
          } else {
            if (n.type === 'compound') {
              svgParts.push(`<circle cx="${n.x}" cy="${n.y}" r="${SV_RC}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
            } else if (n.type === 'ec') {
              svgParts.push(`<ellipse cx="${n.x}" cy="${n.y}" rx="${SV_ERX}" ry="${SV_ERY}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
            } else {
              svgParts.push(`<rect x="${n.x - SV_RW / 2}" y="${n.y - SV_RH / 2}" width="${SV_RW}" height="${SV_RH}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
            }

            // ID label inside node
            let label = n.label ?? n.id;
            if (/reaction-/.test(n.type)) label = label.split('_')[0];
            svgParts.push(`<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="600" fill="${svgTextHex}" font-family="Arial, Helvetica, sans-serif">${label}</text>`);

            // Compound name below node
            if (showNodeNames && n.type === 'compound') {
              const name = _compoundNameMap.get(n.id);
              if (name) {
                svgParts.push(`<text x="${n.x}" y="${n.y + SV_RC + 4}" text-anchor="middle" dominant-baseline="hanging" font-size="8" fill="${svgMutedHex}" font-family="Arial, Helvetica, sans-serif">${name}</text>`);
              }
            }
          }
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
      /**
       * Apply positions extracted from an imported SVG.
       * posMap: { label: [{x,y}, ...] } — arrays handle duplicate labels (reaction _in/_out).
       * Unmatched nodes are placed near their already-placed neighbours.
       */
      importLayout: (posMap) => {
        const nodes = nodesRef.current;
        if (!nodes.length) return;

        const getLabel = (n) => {
          let label = n.label ?? n.id;
          if (/reaction-/.test(n.type)) label = label.split('_')[0];
          return label;
        };

        // Mutable queues so duplicate labels (reaction pairs) each get their own slot
        const queue = {};
        Object.entries(posMap).forEach(([lbl, positions]) => {
          queue[lbl] = [...positions];
        });

        const placed = new Set();

        // Pass 1 – matched nodes
        nodes.forEach(n => {
          const lbl = getLabel(n);
          if (queue[lbl] && queue[lbl].length > 0) {
            const pos = queue[lbl].shift();
            n.x = pos.x; n.y = pos.y;
            positionCacheRef.current[n.id] = { x: pos.x, y: pos.y };
            placed.add(n.id);
          }
        });

        // Pass 2 – place unmatched nodes near connected neighbours (iterative until stable)
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const unmatched = nodes.filter(n => !placed.has(n.id));
        let progress = true;
        while (progress && unmatched.length > 0) {
          progress = false;
          for (let i = unmatched.length - 1; i >= 0; i--) {
            const n = unmatched[i];
            const neighbors = [];
            (graph.links || []).forEach(l => {
              const s = l.source?.id || l.source;
              const t = l.target?.id || l.target;
              const otherId = s === n.id ? t : t === n.id ? s : null;
              if (otherId && placed.has(otherId)) {
                const nb = nodeMap.get(otherId);
                if (nb) neighbors.push(nb);
              }
            });
            if (neighbors.length > 0) {
              const cx = neighbors.reduce((s, nb) => s + nb.x, 0) / neighbors.length;
              const cy = neighbors.reduce((s, nb) => s + nb.y, 0) / neighbors.length;
              const angle = (i * 2.399) % (2 * Math.PI); // golden-angle spread
              const dist = 50 + (i % 3) * 20;
              n.x = cx + Math.cos(angle) * dist;
              n.y = cy + Math.sin(angle) * dist;
              positionCacheRef.current[n.id] = { x: n.x, y: n.y };
              placed.add(n.id);
              unmatched.splice(i, 1);
              progress = true;
            }
          }
        }

        drawRef.current?.(nodesRef.current);
      },
      clearEdgeColors: () => {
        edgeColorsRef.current.clear();
        drawRef.current?.(nodesRef.current);
      },
      importEdgeColors: (colorMap) => {
        Object.entries(colorMap).forEach(([key, color]) => {
          edgeColorsRef.current.set(key, color);
        });
        drawRef.current?.(nodesRef.current);
      },
    }));

    /* ------------------------------------------------------------------ */
    /* Render                                                              */
    /* ------------------------------------------------------------------ */

    // Cleanup texture cache and refs on unmount to prevent memory leaks
    useEffect(() => {
      return () => {
        structTexRef.current.clear();
        smilesDataRef.current = {};
        positionCacheRef.current = {};
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      };
    }, []);

    const GROUP_ACTIONS = [
      { type: 'flipH',    label: 'Flip Horizontal', icon: '↔' },
      { type: 'flipV',    label: 'Flip Vertical',   icon: '↕' },
      { type: 'rot90cw',  label: 'Rotate 90° CW',   icon: '↻' },
      { type: 'rot90ccw', label: 'Rotate 90° CCW',  icon: '↺' },
      { type: 'rot180',   label: 'Rotate 180°',     icon: '⟳' },
    ];

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
        {ctxMenu && (
          <div
            className="fixed z-50 min-w-[170px] rounded-xl border border-brd/50 bg-surface-overlay/95 backdrop-blur-xl shadow-2xl py-1 text-xs"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold text-content-muted uppercase tracking-wide border-b border-brd/40">
              {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
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
          </div>
        )}
      </div>
    );
  }
);

export default GraphRendererCanvas; 