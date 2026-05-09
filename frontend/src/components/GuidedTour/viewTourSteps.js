import {
  Table2, Filter, Settings2, ChevronDown, MousePointer,
  Layers, Play, SlidersHorizontal, Maximize, Download, RotateCcw, Palette,
  Network, Search, Move, Eye,
  MapPin, Spline, Hexagon,
  Undo2, Route, GitBranch, TreePine,
} from 'lucide-react';

/**
 * Per-view in-depth tour steps.
 *
 * Each view has an array of steps. Each step has:
 *   - target:    CSS selector for the element to spotlight (optional)
 *   - icon:      lucide icon component
 *   - title:     short heading
 *   - body:      explanation text
 *   - placement: tooltip position relative to target
 */

export const tableTourSteps = [
  {
    icon: Table2,
    title: 'Reaction Table Overview',
    body: 'Each row represents a biochemical reaction that produces your target metabolite. The table shows the reaction ID, substrates, products, equation, and EC classification.',
    placement: 'center',
  },
  {
    icon: ChevronDown,
    title: 'Expand Reaction Details',
    body: 'Click the arrow on any row to expand it. You\'ll see the full KEGG reaction definition and a diagram of the reaction mechanism fetched directly from KEGG.',
    placement: 'center',
  },
  {
    icon: MousePointer,
    title: 'Row Selection',
    body: 'Use the checkboxes to select rows. Selected reactions can be kept or removed to refine your dataset. Selected rows are also highlighted in the network views.',
    placement: 'center',
  },
  {
    icon: Filter,
    title: 'Filter Menu',
    body: 'Click the filter icon in the toolbar to open the filter panel. Search by any column using text or regex — great for finding reactions involving a specific substrate or EC class.',
    placement: 'center',
  },
  {
    icon: Settings2,
    title: 'Column Visibility',
    body: 'Click the gear icon to show or hide table columns. Toggle off columns you don\'t need to reduce visual clutter and focus on the data that matters.',
    placement: 'center',
  },
];

export const network2dTourSteps = [
  {
    icon: Layers,
    title: '2D Network Overview',
    body: 'This is a force-directed metabolic network. Large circles are compounds, small diamonds are reactions, and edges connect substrates to products. Colour encodes generation depth from your target.',
    placement: 'center',
  },
  {
    icon: Play,
    title: 'Generation Timeline',
    body: 'The timeline at the bottom controls which generations are visible. Press Play to animate through generations, or drag the slider to explore specific depths. The range slider lets you show only a window of generations.',
    placement: 'center',
  },
  {
    icon: SlidersHorizontal,
    title: 'Settings Panel',
    body: 'Click the gear icon on the right edge to open the settings panel. Adjust edge opacity, node spacing, colour mode (generation/type/degree), colour scheme, and background colours.',
    placement: 'center',
  },
  {
    icon: RotateCcw,
    title: 'Layout Controls',
    body: 'Press R to re-run the spiral layout from scratch. Use the tighten button to pull edges closer. Drag any node to reposition it — the layout will adapt around it.',
    placement: 'center',
  },
  {
    icon: Maximize,
    title: 'Fullscreen & Export',
    body: 'Press F for fullscreen mode. Use the download button in settings to export the current view as an SVG — perfect for publications and presentations.',
    placement: 'center',
  },
  {
    icon: Palette,
    title: 'Keyboard Shortcuts',
    body: 'Press H to see all shortcuts. Key ones: +/- to zoom, Space to play/pause, Arrow keys to step through generations, 0 to reset the view.',
    placement: 'center',
  },
];

export const network3dTourSteps = [
  {
    icon: Network,
    title: '3D Network Overview',
    body: 'The same metabolic network rendered in 3D using WebGL. The extra dimension helps separate clusters that overlap in 2D. Nodes float in 3D space with force-directed positioning.',
    placement: 'center',
  },
  {
    icon: Move,
    title: 'Navigation',
    body: 'Click and drag to rotate the view. Scroll to zoom. Right-click and drag to pan. The camera orbits around the centre of the network.',
    placement: 'center',
  },
  {
    icon: Search,
    title: 'Node Search',
    body: 'Use the search bar at the top to find a specific node by ID. Press Enter and the camera will fly to that node. Great for locating specific compounds in large networks.',
    placement: 'center',
  },
  {
    icon: Eye,
    title: 'Node Details',
    body: 'Click any node to see its details — compound name, formula, molecular weight, or reaction definition. The info panel appears on the right side.',
    placement: 'center',
  },
  {
    icon: SlidersHorizontal,
    title: 'Options & Generation',
    body: 'Toggle labels, EC nodes, and grid visibility. Choose between force-directed, tornado, or globe layouts. The generation timeline at the bottom works just like in the 2D view.',
    placement: 'center',
  },
];

export const mapTourSteps = [
  {
    icon: MapPin,
    title: 'Metabolic Map Overview',
    body: 'The Map view renders a clean, publication-ready graph. Compound names are displayed directly on the canvas. The layout is optimised for readability with minimal edge crossings.',
    placement: 'center',
  },
  {
    icon: Spline,
    title: 'Layout & Edge Styles',
    body: 'Open settings to switch between curved and grid edge styles. Toggle KEGG layout mode to position nodes according to the official KEGG metabolic map coordinates when available.',
    placement: 'center',
  },
  {
    icon: Hexagon,
    title: 'Molecular Structures',
    body: 'Toggle "Structures" in settings to render compounds as their 2D molecular structures instead of simple circles. This is powered by KEGG\'s MOL data.',
    placement: 'center',
  },
  {
    icon: Download,
    title: 'Export as SVG',
    body: 'Click the download button in the settings panel to export the current map as a high-resolution SVG. The exported image preserves all node labels, colours, and layout.',
    placement: 'center',
  },
];

export const treeTourSteps = [
  {
    icon: Undo2,
    title: 'Backtrace Tree Overview',
    body: 'This AND-OR tree traces the biosynthetic lineage of your target metabolite. Each compound node (OR) shows alternative reactions that can produce it. Each reaction node (AND) shows all required substrates.',
    placement: 'center',
  },
  {
    icon: TreePine,
    title: 'Expand & Collapse',
    body: 'Click any node to expand or collapse its subtree. The tree auto-expands the root and first level. Deeper branches can be explored on demand to avoid information overload.',
    placement: 'center',
  },
  {
    icon: Route,
    title: 'Minimal Pathways',
    body: 'The "Minimal Pathways" panel on the right lists the shortest complete biosynthetic routes. Click a pathway to highlight its reactions in the tree. Each pathway shows numbered reaction steps with equations.',
    placement: 'center',
  },
  {
    icon: GitBranch,
    title: 'Node Types',
    body: 'Teal nodes are metabolites. Indigo nodes are reaction steps with their equations shown below. "Primordial" leaf nodes are basic building blocks (like water, ATP). "Dead end" means the trace couldn\'t go further.',
    placement: 'center',
  },
];

export const VIEW_TOUR_MAP = {
  table: tableTourSteps,
  network2d: network2dTourSteps,
  network3d: network3dTourSteps,
  map: mapTourSteps,
  tree: treeTourSteps,
};
