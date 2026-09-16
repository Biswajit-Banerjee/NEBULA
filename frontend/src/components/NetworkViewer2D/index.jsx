import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import GraphRenderer from "./GraphRendererCanvas";
import GenerationControls from "./GenerationControls";
import SettingsPanel from "./SettingsPanel";
import useGraphData from "./hooks/useGraphData";
import useAnimation from "./hooks/useAnimation";
import useFullscreen from "./hooks/useFullscreen";
import HelpOverlay from "./HelpOverlay";
import { isReservedGroupId, normalizeColor } from "./utils/svgLayout";
import { RAINBOW_PALETTE } from "./utils/colorSchemes";
import { createTextBox } from "../CanvasText/textSystem";

const SHAPE_TAGS = new Set(['circle', 'ellipse', 'rect', 'image']);

// Parse node positions, colors and labels plus edge colors out of an exported
// (or externally re-touched, e.g. Illustrator) SVG.
//
// Elements are visited with querySelectorAll('*') so shapes/text nested inside
// the exporter's <g id="Nodes"><g id="Generation_N"><g id="nodeId">...groups
// are found regardless of nesting depth.
//
// Returns:
//   byId:    Map<safeNodeId, { pos, fill, stroke, label }>  — preferred match
//   byLabel: Map<label, entry[]>                            — fallback match
//   edgeColors: { edgeKey: color }                          — only colors that
//                                                              differ from the
//                                                              type-based default
const parseSVGLayout = (svgText) => {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const root = doc.querySelector('svg');
  const byId = new Map();
  const byLabel = new Map();
  const edgeColors = {};
  const textItems = [];
  if (!root) return { byId, byLabel, edgeColors, annotations: [], textItems };

  // ── Resolve CSS <style> classes to inline properties ──
  // Illustrator moves all fills/strokes into CSS classes (.st0, .st1, ...)
  const classStyles = {};
  const styleEl = root.querySelector('style');
  if (styleEl) {
    const css = styleEl.textContent || '';
    // Parse .className { prop: value; ... } blocks
    const ruleRe = /\.([\w-]+)\s*\{([^}]*)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRe.exec(css))) {
      const cls = ruleMatch[1];
      const body = ruleMatch[2];
      const props = {};
      const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
      let propMatch;
      while ((propMatch = propRe.exec(body))) {
        props[propMatch[1].trim()] = propMatch[2].trim();
      }
      classStyles[cls] = props;
    }
  }

  // Read a color from an element: check inline attr/style first, then CSS classes
  const styleProp = (el, prop) => {
    const style = el.getAttribute('style');
    if (!style) return null;
    const m = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`));
    return m ? m[1].trim() : null;
  };
  const readColor = (el, prop) => {
    // 1. Direct attribute
    const attr = el.getAttribute(prop);
    if (attr && attr !== 'none') return attr;
    // 2. Inline style
    const inl = styleProp(el, prop);
    if (inl && inl !== 'none') return inl;
    // 3. CSS class
    const classes = (el.getAttribute('class') || '').split(/\s+/);
    for (const cls of classes) {
      if (classStyles[cls] && classStyles[cls][prop]) return classStyles[cls][prop];
    }
    return null;
  };

  // Walk up from a shape to find the nearest ancestor group id that isn't one
  // of the exporter's structural layers — that's the node's own group id.
  const ownerNodeId = (el) => {
    let p = el.parentElement;
    while (p && p !== root) {
      if (p.id && !isReservedGroupId(p.id)) return p.id;
      p = p.parentElement;
    }
    return null;
  };

  let pendingEntry = null;
  let labelConsumed = false;
  let lineEntries = null; // Collected <line> elements for edge matching by geometry
  const annotations = []; // Extra text/lines added by the user in Illustrator

  for (const el of root.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (SHAPE_TAGS.has(tag)) {
      let pos;
      if (tag === 'circle' || tag === 'ellipse') {
        pos = { x: parseFloat(el.getAttribute('cx')), y: parseFloat(el.getAttribute('cy')) };
      } else {
        const x = parseFloat(el.getAttribute('x')) || 0;
        const y = parseFloat(el.getAttribute('y')) || 0;
        const w = parseFloat(el.getAttribute('width')) || 0;
        const h = parseFloat(el.getAttribute('height')) || 0;
        pos = { x: x + w / 2, y: y + h / 2 };
      }
      pendingEntry = {
        pos,
        fill: readColor(el, 'fill'),
        stroke: readColor(el, 'stroke'),
        label: null,
      };
      labelConsumed = false;
      const idSafe = ownerNodeId(el);
      if (idSafe) byId.set(idSafe, pendingEntry);
    } else if (tag === 'path' || tag === 'line') {
      // Don't reset pendingEntry for <line> elements that are edges —
      // Illustrator interleaves lines and shapes, so only reset for <path>
      if (tag === 'path') pendingEntry = null;
      const edgeKey = el.getAttribute('data-edge-key');
      if (edgeKey) {
        const stroke = readColor(el, 'stroke');
        if (stroke) {
          const dash = el.getAttribute('stroke-dasharray') || styleProp(el, 'stroke-dasharray') || '';
          const cls = el.getAttribute('class') || '';
          // Check for dash from CSS class too
          let hasDash = dash.trim().startsWith('2');
          if (!hasDash) {
            for (const c of cls.split(/\s+/)) {
              const sd = classStyles[c]?.['stroke-dasharray'] || '';
              if (sd.trim().startsWith('2')) { hasDash = true; break; }
            }
          }
          const expectedDefault = normalizeColor(hasDash ? '#8B5CF6' : '#9CA3AF');
          if (normalizeColor(stroke) !== expectedDefault) edgeColors[edgeKey] = stroke;
        }
      }
      // Collect <line> geometry + stroke for later edge matching by coordinates
      if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1'));
        const y1 = parseFloat(el.getAttribute('y1'));
        const x2 = parseFloat(el.getAttribute('x2'));
        const y2 = parseFloat(el.getAttribute('y2'));
        const stroke = readColor(el, 'stroke');
        if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && stroke) {
          if (!lineEntries) lineEntries = [];
          lineEntries.push({ x1, y1, x2, y2, stroke });
        }
      }
    } else if (tag === 'text') {
      // Illustrator wraps text in <tspan> — extract full textContent
      const label = el.textContent.trim();
      if (!label) continue;

      // First, restore text exported by NEBULA's canonical canvas text layer.
      const nebulaKind = el.getAttribute('data-nebula-text-kind');
      if (nebulaKind) {
        const attrOrStyle = (prop, fallback = null) => el.getAttribute(prop) || styleProp(el, prop) || (() => {
          const classes = (el.getAttribute('class') || '').split(/\s+/);
          for (const cls of classes) if (classStyles[cls]?.[prop]) return classStyles[cls][prop];
          return fallback;
        })();
        const tspans = el.querySelectorAll('tspan');
        const content = tspans.length ? Array.from(tspans).map(span => span.textContent).join('\n') : label;
        const anchor = el.getAttribute('data-nebula-anchor-node');
        const anchorText = attrOrStyle('text-anchor', 'start');
        textItems.push({
          id: el.getAttribute('data-nebula-text-id') || `imported-text:${textItems.length}`,
          kind: nebulaKind,
          content,
          position: { x: parseFloat(el.getAttribute('x')) || 0, y: parseFloat(el.getAttribute('y')) || 0 },
          anchor: anchor ? { nodeId: anchor } : null,
          offset: anchor ? {
            x: parseFloat(el.getAttribute('data-nebula-offset-x')) || 0,
            y: parseFloat(el.getAttribute('data-nebula-offset-y')) || 0,
          } : null,
          autoPosition: false,
          contentEdited: true,
          visible: true,
          fontSize: parseFloat(attrOrStyle('font-size', '14')) || 14,
          fontFamily: attrOrStyle('font-family', 'Inter, Arial, sans-serif'),
          fontWeight: attrOrStyle('font-weight', '400'),
          fontStyle: attrOrStyle('font-style', 'normal'),
          fill: attrOrStyle('fill', '#374151'),
          opacity: parseFloat(attrOrStyle('opacity', '1')) || 1,
          underline: (attrOrStyle('text-decoration', '') || '').includes('underline'),
          textAlign: anchorText === 'middle' ? 'center' : anchorText === 'end' ? 'right' : 'left',
        });
        continue;
      }

      // Detect annotation text: larger font size or different class than node labels.
      // Node labels use small font (e.g. st16 = 9px). Annotations use larger font (st14/st15 = 18px).
      const classes = (el.getAttribute('class') || '').split(/\s+/);
      let fontSize = null;
      let fontWeight = null;
      let fillColor = null;
      for (const cls of classes) {
        const cs = classStyles[cls];
        if (cs) {
          if (cs['font-size']) fontSize = parseFloat(cs['font-size']);
          if (cs['font-weight']) fontWeight = cs['font-weight'];
          if (cs['fill']) fillColor = cs['fill'];
        }
      }

      // Extract position from transform="translate(x y)"
      const transformAttr = el.getAttribute('transform') || '';
      const tMatch = transformAttr.match(/translate\(([\d.e+-]+)[,\s]+([\d.e+-]+)\)/);
      const tx = tMatch ? parseFloat(tMatch[1]) : null;
      const ty = tMatch ? parseFloat(tMatch[2]) : null;

      // If this is a node label (small font, right after a shape), associate with pendingEntry
      const isNodeLabel = fontSize && fontSize <= 12;
      if (isNodeLabel && pendingEntry && !labelConsumed) {
        pendingEntry.label = label;
        labelConsumed = true;
        if (!byLabel.has(label)) byLabel.set(label, []);
        byLabel.get(label).push(pendingEntry);
      } else if (!isNodeLabel && tx !== null && ty !== null) {
        // This is an annotation text — collect it
        // Handle multi-line <tspan> content
        const lines = [];
        const tspans = el.querySelectorAll('tspan');
        if (tspans.length > 0) {
          tspans.forEach(ts => {
            const dy = parseFloat(ts.getAttribute('y')) || 0;
            lines.push({ text: ts.textContent.trim(), dy });
          });
        } else {
          lines.push({ text: label, dy: 0 });
        }
        annotations.push({
          type: 'text',
          x: tx, y: ty,
          lines,
          fontSize: fontSize || 14,
          bold: fontWeight === '700' || fontWeight === 'bold',
          fill: fillColor || '#000',
        });
      } else if (pendingEntry && !labelConsumed) {
        // Fallback: associate with pending entry if no font size info
        pendingEntry.label = label;
        labelConsumed = true;
        if (!byLabel.has(label)) byLabel.set(label, []);
        byLabel.get(label).push(pendingEntry);
      }
    }
  }
  // ── Match <line> elements to node pairs by endpoint proximity ──
  // This handles Illustrator SVGs where data-edge-key is stripped.
  if (lineEntries && lineEntries.length > 0) {
    // Build a spatial index of node positions from byLabel entries
    const nodePositions = [];
    byLabel.forEach((entries, label) => {
      entries.forEach(e => {
        if (e.pos) nodePositions.push({ label, x: e.pos.x, y: e.pos.y });
      });
    });
    byId.forEach((e, id) => {
      if (e.pos && !nodePositions.find(p => p.x === e.pos.x && p.y === e.pos.y)) {
        nodePositions.push({ label: id, x: e.pos.x, y: e.pos.y });
      }
    });

    const SNAP = 30; // max distance to snap a line endpoint to a node center
    const findNearest = (px, py) => {
      let best = null, bestD = SNAP * SNAP;
      for (const n of nodePositions) {
        const d = (n.x - px) ** 2 + (n.y - py) ** 2;
        if (d < bestD) { bestD = d; best = n; }
      }
      return best;
    };

    for (const { x1, y1, x2, y2, stroke } of lineEntries) {
      const src = findNearest(x1, y1);
      const trg = findNearest(x2, y2);
      if (src && trg && src.label !== trg.label) {
        // Build edge key using `--` separator to match renderer format
        const key1 = `${src.label}--${trg.label}`;
        const key2 = `${trg.label}--${src.label}`;
        if (!edgeColors[key1] && !edgeColors[key2]) {
          edgeColors[key1] = stroke;
        }
      } else if (!src || !trg) {
        // Line not connected to any node — it's an annotation line (legend, etc.)
        annotations.push({
          type: 'line',
          x1, y1, x2, y2,
          stroke,
          strokeWidth: 4,
        });
      }
    }
  }

  return { byId, byLabel, edgeColors, annotations, textItems };
};

const NetworkViewer2D = forwardRef(({ results, searchPairs = [], height = "600px" }, ref) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const graphRendererRef = useRef(null);
  const importFileRef = useRef(null);

  // Help overlay
  const [showHelp, setShowHelp] = useState(false);
  // Overlay visibility state
  const [showOverlay, setShowOverlay] = useState(false);

  // User customization
  const [edgeOpacity, setEdgeOpacity] = useState(0.7);
  const [edgeThickness, setEdgeThickness] = useState(1.0);
  const [spacingScale, setSpacingScale] = useState(1.0);
  const [nodeScale, setNodeScale] = useState(1.0);
  const [fontScale, setFontScale] = useState(1.0);
  const [nodeAvoidance, setNodeAvoidance] = useState(false);

  // Label settings
  const [showNodeNames, setShowNodeNames] = useState(false);
  const [showStructures, setShowStructures] = useState(false);
  const [curvedEdges, setCurvedEdges] = useState(true);

  // Edge brush tool
  const [brushMode, setBrushMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#e11d48');

  // Text tools and the current canvas selection.
  const [textMode, setTextMode] = useState(false);
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [selectedText, setSelectedText] = useState(null);
  // Snapshot of the text item at the moment it was selected (for Cancel revert)
  const textEditOriginalRef = useRef(null);

  const handleTextSelectionChange = useCallback((item) => {
    setSelectedText(item);
    if (item) {
      textEditOriginalRef.current = {
        ...item,
        position: item.position ? { ...item.position } : null,
        offset: item.offset ? { ...item.offset } : null,
        anchor: item.anchor ? { ...item.anchor } : null,
      };
    } else {
      textEditOriginalRef.current = null;
    }
  }, []);

  // Live-preview: update canvas item without touching undo stack
  const handlePreviewText = useCallback((id, patch) => {
    graphRendererRef.current?.previewTextItem?.(id, patch);
  }, []);

  // Save: commit to undo stack; update the "original" so Cancel now reverts to post-save state
  const handleSaveText = useCallback((id) => {
    graphRendererRef.current?.commitTextItem?.();
    const current = graphRendererRef.current?.getTextItem?.(id);
    if (current) {
      textEditOriginalRef.current = current;
      setSelectedText({ ...current });
    }
  }, []);

  // Cancel: revert canvas item to state captured at selection time
  const handleCancelText = useCallback((id) => {
    const original = textEditOriginalRef.current;
    if (original && original.id === id) {
      graphRendererRef.current?.revertTextItem?.(id, original);
      setSelectedText({ ...original });
    }
  }, []);

  const handleUpdateText = useCallback((id, patch) => {
    graphRendererRef.current?.updateTextItem?.(id, patch);
  }, []);

  const handleDeleteText = useCallback((id) => {
    graphRendererRef.current?.deleteTextItem?.(id);
    setSelectedText(null);
    textEditOriginalRef.current = null;
  }, []);

  const handleAddText = useCallback(() => {
    setBrushMode(false);
    setTextMode(true);
    graphRendererRef.current?.addTextBox?.();
  }, []);

  // Grid controls
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(48);
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Global node opacity
  const [nodeOpacity, setNodeOpacity] = useState(1.0);

  // Layout import options
  const [importPositionsOnly, setImportPositionsOnly] = useState(true);

  const handleClearEdgeColors = () => {
    if (graphRendererRef.current) graphRendererRef.current.clearEdgeColors();
  };

  // Color settings
  const [colorMode, setColorMode] = useState('generation'); // 'generation' | 'type' | 'degree'
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [customRainbow, setCustomRainbow] = useState(RAINBOW_PALETTE);
  const [bgColor, setBgColor] = useState(''); // empty = default theme bg
  const [gridColor, setGridColor] = useState(''); // empty = default theme grid

  // HSV global color adjustment
  const [hueShift, setHueShift] = useState(0);      // -180 to 180 degrees
  const [satScale, setSatScale] = useState(1.0);     // 0 to 2 (1 = no change)
  const [valScale, setValScale] = useState(1.0);     // 0 to 2 (1 = no change)

  // Mask slider: lower bound of visible generation range
  const [minVisibleGeneration, setMinVisibleGeneration] = useState(0);

  // Use custom hooks for state management
  const { 
    graphData, 
    currentGeneration, 
    setCurrentGeneration, 
    maxGeneration,
    minGeneration,
    populatedGens
  } = useGraphData(results);

  // Reset mask slider when data changes
  React.useEffect(() => {
    setMinVisibleGeneration(minGeneration);
  }, [minGeneration]);
  
  const { 
    isPlaying, 
    togglePlay, 
    stepForward: rawStepForward, 
    stepBackward: rawStepBackward,
    transitionSpeed,
    setTransitionSpeed
  } = useAnimation(currentGeneration, setCurrentGeneration, maxGeneration, minGeneration, populatedGens);

  // Wrapped step callbacks that maintain minVisibleGeneration <= currentGeneration
  const stepBackward = React.useCallback(() => {
    rawStepBackward();
    // After stepping back, ensure minVisibleGeneration doesn't exceed currentGeneration
    setCurrentGeneration((prev) => {
      if (minVisibleGeneration > prev) setMinVisibleGeneration(prev);
      return prev;
    });
  }, [rawStepBackward, minVisibleGeneration, setCurrentGeneration, setMinVisibleGeneration]);

  const stepForward = React.useCallback(() => {
    rawStepForward();
  }, [rawStepForward]);
  
  const { 
    isFullscreen, 
    toggleFullscreen 
  } = useFullscreen(wrapperRef);

  // Handle visualization controls
  const handleZoomIn = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.zoomOut();
    }
  };

  const handleReset = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.resetView();
    }
  };

  const handleDownloadSVG = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.downloadSVG();
    }
  };

  const handleDownloadPNG = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.downloadPNG();
    }
  };

  const handleImportSVG = () => {
    importFileRef.current?.click();
  };

  const onImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { byId, byLabel, edgeColors, annotations, textItems } = parseSVGLayout(ev.target.result);
      if (graphRendererRef.current) {
        if (importPositionsOnly) {
          // Strip colors and labels — keep only positions
          const stripColors = (map) => {
            const stripped = new Map();
            map.forEach((entry, key) => {
              stripped.set(key, { pos: entry.pos, fill: null, stroke: null, label: null });
            });
            return stripped;
          };
          const strippedById = stripColors(byId);
          const strippedByLabel = new Map();
          byLabel.forEach((entries, key) => {
            strippedByLabel.set(key, entries.map(e => ({ pos: e.pos, fill: null, stroke: null, label: null })));
          });
          // Clear any previously imported node colors so current scheme applies
          graphRendererRef.current.clearNodeColors?.();
          graphRendererRef.current.importLayout(strippedById, strippedByLabel);
        } else {
          // Full import: positions + colors + labels
          graphRendererRef.current.importLayout(byId, byLabel);
        }
        // Edge colors and annotations are always imported (user-added decorations)
        if (Object.keys(edgeColors).length > 0)
          graphRendererRef.current.importEdgeColors(edgeColors);
        const legacyText = annotations.filter(annotation => annotation.type === 'text').map(annotation =>
          createTextBox(annotation.x, annotation.y, {
            content: (annotation.lines || []).map(line => line.text).join('\n'),
            fontSize: annotation.fontSize || 14,
            fontWeight: annotation.bold ? '700' : '400',
            fontStyle: annotation.italic ? 'italic' : 'normal',
            fill: annotation.fill || '#374151',
            opacity: annotation.opacity ?? 1,
            textAlign: 'left',
          })
        );
        if (textItems.length || legacyText.length) {
          graphRendererRef.current.importTextItems([...textItems, ...legacyText]);
        }
        const lineAnnotations = annotations.filter(annotation => annotation.type === 'line');
        if (lineAnnotations.length > 0) {
          graphRendererRef.current.importAnnotations(lineAnnotations);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSpiral = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.resetSpiral();
    }
  };

  const tightenEdges = () => {
    if (graphRendererRef.current) {
      graphRendererRef.current.tightenEdges();
    }
  };

  const startRotate = () => {
    if (!graphRendererRef.current) return;
    rotateIntervalRef.current = setInterval(() => {
      graphRendererRef.current.rotateGraph(-Math.PI / 90); // 2° per frame
    }, 30);
  };

  const stopRotate = () => {
    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
      rotateIntervalRef.current = null;
    }
  };

  const rotateIntervalRef = useRef(null);

  // Make sure we have array data to pass to the GraphRenderer
  const safeResults = Array.isArray(results) ? results : [];

  // Map pair index to rgba color string
  const pairColorMap = React.useMemo(() => {
    const map = {};
    searchPairs.forEach((p, idx) => {
      const hex = p.color || '#94a3b8';
      const alpha = p.alpha !== undefined ? p.alpha : 1;
      const aHex = Math.round(alpha*255).toString(16).padStart(2,'0');
      map[idx] = `${hex}${aHex}`;
    });
    return map;
  }, [searchPairs]);

  // Keyboard shortcuts for common actions
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      // Don't intercept browser shortcuts (Ctrl+F, Cmd+F, etc.)
      if (e.ctrlKey || e.metaKey) return;
      
      switch (e.key) {
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
        case '_':
          handleZoomOut();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          stepForward();
          break;
        case 'ArrowLeft':
          stepBackward();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          setShowHelp((prev) => !prev);
          break;
        case 'g':
          setShowGrid(prev => !prev);
          break;
        case 'r':
        case 'R':
          resetSpiral();
          break;
        case '0':
          handleReset();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, stepForward, stepBackward, toggleFullscreen, setShowHelp, resetSpiral, handleReset, handleZoomIn, handleZoomOut]);

  // Expose imperative handlers for exporting/importing positions
  useImperativeHandle(ref, () => ({
    getNodePositions: () => graphRendererRef.current?.getNodePositions?.(),
    setNodePositions: (positions) => graphRendererRef.current?.setNodePositions?.(positions),
  }));

  const toggleOverlay = () => {
    setShowOverlay(prev => !prev);
  };

  return (
    <div className="relative rounded-xl border border-brd/40 shadow-sm bg-surface-secondary overflow-hidden" ref={containerRef}>
      {/* Main container */}
      <div 
        ref={wrapperRef}
        className={`relative flex flex-col bg-surface transition-all duration-300 ${
          isFullscreen ? 'min-h-screen' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : height }}
      >
        {/* Help overlay */}
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

        {/* Main Visualization Area */}
        <div className="flex-1 relative">
          <GraphRenderer
            ref={graphRendererRef}
            data={safeResults}
            currentGeneration={currentGeneration}
            minVisibleGeneration={minVisibleGeneration}
            maxGeneration={maxGeneration}
            containerRef={containerRef}
            height={height}
            isFullscreen={isFullscreen}
            pairColorMap={pairColorMap}
            showOverlay={showOverlay}
            edgeOpacity={edgeOpacity}
            edgeThickness={edgeThickness}
            spacingScale={spacingScale}
            nodeScale={nodeScale}
            fontScale={fontScale}
            nodeAvoidance={nodeAvoidance}
            colorMode={colorMode}
            colorScheme={colorScheme}
            customPalette={customRainbow}
            hueShift={hueShift}
            satScale={satScale}
            valScale={valScale}
            bgColor={bgColor}
            gridColor={gridColor}
            showNodeNames={showNodeNames}
            showStructures={showStructures}
            curvedEdges={curvedEdges}
            brushMode={brushMode}
            brushColor={brushColor}
            textMode={textMode}
            setTextMode={setTextMode}
            showNodeLabels={showNodeLabels}
            onTextSelectionChange={handleTextSelectionChange}
            showGrid={showGrid}
            gridSize={gridSize}
            snapToGrid={snapToGrid}
            nodeOpacity={nodeOpacity}
          />

          {/* Right-side settings panel (arrow toggle) */}
          <SettingsPanel
            edgeOpacity={edgeOpacity}
            setEdgeOpacity={setEdgeOpacity}
            edgeThickness={edgeThickness}
            setEdgeThickness={setEdgeThickness}
            spacingScale={spacingScale}
            setSpacingScale={setSpacingScale}
            nodeScale={nodeScale}
            setNodeScale={setNodeScale}
            fontScale={fontScale}
            setFontScale={setFontScale}
            nodeAvoidance={nodeAvoidance}
            setNodeAvoidance={setNodeAvoidance}
            showOverlay={showOverlay}
            toggleOverlay={toggleOverlay}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleReset={handleReset}
            handleDownloadSVG={handleDownloadSVG}
            handleDownloadPNG={handleDownloadPNG}
            handleImportSVG={handleImportSVG}
            brushMode={brushMode}
            setBrushMode={setBrushMode}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            clearEdgeColors={handleClearEdgeColors}
            importPositionsOnly={importPositionsOnly}
            setImportPositionsOnly={setImportPositionsOnly}
            resetSpiral={resetSpiral}
            tightenEdges={tightenEdges}
            toggleHelp={() => setShowHelp(prev => !prev)}
            colorMode={colorMode}
            setColorMode={setColorMode}
            colorScheme={colorScheme}
            setColorScheme={setColorScheme}
            customPalette={customRainbow}
            setCustomPalette={setCustomRainbow}
            hueShift={hueShift}
            setHueShift={setHueShift}
            satScale={satScale}
            setSatScale={setSatScale}
            valScale={valScale}
            setValScale={setValScale}
            bgColor={bgColor}
            setBgColor={setBgColor}
            gridColor={gridColor}
            setGridColor={setGridColor}
            showNodeNames={showNodeNames}
            setShowNodeNames={setShowNodeNames}
            showStructures={showStructures}
            setShowStructures={setShowStructures}
            curvedEdges={curvedEdges}
            setCurvedEdges={setCurvedEdges}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            gridSize={gridSize}
            setGridSize={setGridSize}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            nodeOpacity={nodeOpacity}
            setNodeOpacity={setNodeOpacity}
            textMode={textMode}
            setTextMode={setTextMode}
            showNodeLabels={showNodeLabels}
            setShowNodeLabels={setShowNodeLabels}
            selectedText={selectedText}
            onUpdateText={handleUpdateText}
            onPreviewText={handlePreviewText}
            onSaveText={handleSaveText}
            onCancelText={handleCancelText}
            onDeleteText={handleDeleteText}
            onAddText={handleAddText}
          />
          {/* Hidden file input for SVG layout import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={onImportFileChange}
          />
        </div>

        {/* Slim generation timeline (collapsible) */}
        <GenerationControls
          currentGeneration={currentGeneration}
          setCurrentGeneration={setCurrentGeneration}
          maxGeneration={maxGeneration}
          minGeneration={minGeneration}
          minVisibleGeneration={minVisibleGeneration}
          setMinVisibleGeneration={setMinVisibleGeneration}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          stepForward={stepForward}
          stepBackward={stepBackward}
          transitionSpeed={transitionSpeed}
          setTransitionSpeed={setTransitionSpeed}
          populatedGens={populatedGens}
        />
      </div>
    </div>
  );
});

export default NetworkViewer2D;