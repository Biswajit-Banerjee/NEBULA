import {
  Compass, Search, Table2, Layers, Network, MapPin, Undo2, Columns2, HelpCircle,
} from 'lucide-react';

/**
 * Each step can carry an `action` key — a string token that the GuidedTour
 * component interprets to trigger real app behaviour (search, view switch, etc.)
 *
 * `placement` controls where the tooltip card appears:
 *   center | top-right | bottom-right | bottom-left | top-left
 *
 * `waitForResults` — if true, the tour pauses on this step until results load.
 */
const tourSteps = [
  /* ── 0  Welcome ── */
  {
    id: 'welcome',
    icon: Compass,
    title: 'Welcome to NEBULA',
    body: `Let's explore together. We'll trace the biosynthetic origins of L-Glutamate (C00025) — one of the most connected metabolites in biochemistry — and walk through each tool NEBULA offers.`,
    placement: 'center',
  },

  /* ── 1  Search dock intro ── */
  {
    id: 'search-dock',
    icon: Search,
    target: '[data-tour="dock-bar"]',
    title: 'The Search Dock',
    body: `This bar is your starting point. You can search by compound, reaction ID, or EC number. Type a KEGG ID or metabolite name and NEBULA traces every reaction that can produce it.`,
    placement: 'bottom',
    expandDock: true,
  },

  /* ── 2  Trigger the search ── */
  {
    id: 'searching',
    icon: Search,
    title: 'Searching for L-Glutamate…',
    body: `We're now running a backward trace from C00025. NEBULA is walking the entire KEGG reaction graph to find every known reaction that produces this metabolite.`,
    placement: 'center',
    action: 'search-c00025',
    waitForResults: true,
  },

  /* ── 3  Table view ── */
  {
    id: 'view-table',
    icon: Table2,
    title: 'Reaction Table',
    body: `Each row is a reaction that produces L-Glutamate. You can sort by any column, expand a row for enzyme details, and use the filter menu to narrow results by EC class, generation depth, or specific substrates.`,
    placement: 'top-right',
    action: 'view-table',
    features: [
      'Click a reaction ID to see its KEGG entry',
      'Expand rows for enzyme & protein details',
      'Filter by EC class, generation, or substrate',
      'Select rows to highlight them in other views',
    ],
  },

  /* ── 4  2D Network ── */
  {
    id: 'view-2d',
    icon: Layers,
    title: '2D Network Graph',
    body: `This is a force-directed metabolic network. Compounds are circles and reactions are smaller nodes linking them. Colour encodes generation depth — how many reaction steps from your target.`,
    placement: 'top-right',
    action: 'view-network2d',
    features: [
      'Drag nodes to rearrange the layout',
      'Scroll to zoom, use generation slider to reveal layers',
      'Ctrl-click a reaction node to collapse/expand branches',
      'Press R to re-run layout, F for fullscreen',
    ],
  },

  /* ── 5  3D Network ── */
  {
    id: 'view-3d',
    icon: Network,
    title: '3D Network Graph',
    body: `The same network, rendered in 3D. Rotate by dragging, zoom with the scroll wheel. This view is useful for large networks where 2D becomes crowded — the extra dimension helps separate clusters.`,
    placement: 'top-right',
    action: 'view-network3d',
    features: [
      'Click and drag to rotate the view',
      'Scroll to zoom in and out',
      'Hover over nodes to see compound/reaction info',
    ],
  },

  /* ── 6  Map ── */
  {
    id: 'view-map',
    icon: MapPin,
    title: 'Metabolic Map',
    body: `The Map view gives a simplified, publication-ready graph of your results. It uses a spring layout optimised for readability, with compound names displayed directly on the canvas.`,
    placement: 'top-right',
    action: 'view-map',
    features: [
      'Drag nodes to reposition them',
      'Zoom with scroll wheel',
      'Download as SVG for publications',
    ],
  },

  /* ── 7  Backtrace tree ── */
  {
    id: 'view-tree',
    icon: Undo2,
    title: 'Backtrace Tree',
    body: `This AND-OR tree shows the biosynthetic lineage of your target. Each branch is a reaction that can produce it, and sub-branches trace further back. The "Minimal Paths" panel lists the shortest complete routes.`,
    placement: 'top-right',
    action: 'view-tree',
    features: [
      'Click nodes to expand or collapse branches',
      'Browse minimal paths in the side panel',
      'Primordial metabolites are highlighted as leaf nodes',
    ],
  },

  /* ── 8  Split view ── */
  {
    id: 'split-view',
    icon: Columns2,
    title: 'Split-Screen Mode',
    body: `Compare two views side by side — for instance, browse the reaction table while seeing its 2D network. The split button is in the view switcher at the bottom of the screen.`,
    placement: 'top-right',
    action: 'split-table-2d',
    features: [
      'Each pane has independent view controls',
      'Click "Single" to return to full-screen',
    ],
  },

  /* ── 9  Finish ── */
  {
    id: 'finish',
    icon: HelpCircle,
    target: '[data-tour="help-btn"]',
    title: 'You\'re All Set!',
    body: `That's the core of NEBULA. Use the search dock to explore any metabolite, reaction, or EC number. The Help button at the bottom-right has detailed docs for every feature. Happy exploring!`,
    placement: 'top-left',
    action: 'unsplit',
  },
];

export default tourSteps;
