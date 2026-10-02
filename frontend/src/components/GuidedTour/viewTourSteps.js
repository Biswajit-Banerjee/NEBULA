import {
  Table2, Filter, Settings2, ChevronDown, MousePointer, Hand, Dna,
  Layers, Play, SlidersHorizontal, Maximize, Palette, Shapes,
  Waypoints, Cable, Boxes,
  MapPin, Spline, Hexagon, Download, Atom, Globe2,
  Route, GitBranch, Pin, Link2, Focus, Columns3, Telescope,
} from 'lucide-react';

/**
 * Quick Help: per-view, symbol-first tour (Help button, then Quick Help).
 *
 * Step fields:
 *   icon, title, body, placement
 *   glyphs   ids from Key/keyData.js, drawn as a mini key inside the card
 *   docSlug  documentation page opened by "Learn more"
 *
 * 3D network is intentionally not covered (not shown in the view switcher).
 */

export const tableTourSteps = [
  {
    icon: Table2,
    title: 'Metabolome Records',
    body: 'Each row is one reaction found by your search. Columns: reaction (KEGG R-number, with _v1, _v2 for cofactor variants), source (KEGG, KEGG (Modified) or Manual), coenzyme, equation, transition, target and EC. Transition reads "reactant generation -> product generation".',
    placement: 'center',
    docSlug: 'view-metabolome-records',
  },
  {
    icon: Layers,
    title: 'Row colours',
    body: 'The coloured stripe and tint on a row is the colour of the search that produced it. In Combined view (stacked-layers icon, top bar) a reaction found by several searches shows several small colour bars.',
    placement: 'center',
    glyphs: ['mr-stripe', 'mr-multi'],
    docSlug: 'feature-multi-search',
  },
  {
    icon: ChevronDown,
    title: 'Expand a row',
    body: 'Click the chevron to see the KEGG definition and the KEGG reaction drawing.',
    placement: 'center',
    glyphs: ['ui-expand'],
  },
  {
    icon: Dna,
    title: 'Enzymes and proteins',
    body: 'A blue EC button opens the Protein Domain Viewer for that enzyme class: the proteins that carry it out, their ECOD domains, binding and active sites, and the AlphaFold structure.',
    placement: 'center',
    glyphs: ['mr-ec'],
    docSlug: 'view-protein-domains',
  },
  {
    icon: MousePointer,
    title: 'Select, keep or delete',
    body: 'Tick rows, then Keep Selection to narrow the dataset or Delete Selection to remove reactions. Deleted reactions are listed in the badge (with Restore) and are flagged as "broken" in Path Finder. Selected rows are highlighted in the other views.',
    placement: 'center',
  },
  {
    icon: Filter,
    title: 'Filter and Select',
    body: 'The funnel opens Filter and Select: type text or a regular expression, pick one column or all, and every matching row is selected. The gear shows or hides columns.',
    placement: 'center',
    glyphs: ['ui-filter', 'ui-columns'],
  },
];

export const treeTourSteps = [
  {
    icon: Route,
    title: 'Path Finder',
    body: 'Every minimal way to make your target from the seed compounds. A Path is a smallest set of reactions that can all run, starting only from seed (generation 0) and source compounds. Read the graph left to right.',
    placement: 'center',
    docSlug: 'view-path-finder',
  },
  {
    icon: Columns3,
    title: 'Columns are generations',
    body: 'Each column is a generation of the network expansion: GEN 1, 2, 3 … (a SEED column for generation 0 appears when seeds are drawn as nodes). A header such as 4-5 means two generations share a column so every line can point right. Reactions sit between their inputs and outputs.',
    placement: 'center',
    glyphs: ['pf-gen-header'],
    docSlug: 'concept-generations',
  },
  {
    icon: Hand,
    title: 'Compounds: circles',
    body: 'Hollow circle: intermediate. Large filled circle: the target. Green: a source you chose. Grey: a seed compound. Seeds are normally written in italics under the reaction that uses them; Display > Seed compounds > As nodes draws them as circles.',
    placement: 'center',
    glyphs: ['pf-intermediate', 'pf-target', 'pf-source', 'pf-seed', 'pf-seed-inline'],
  },
  {
    icon: Boxes,
    title: 'Reactions: squares',
    body: 'A filled square is a reaction on a listed Path; it needs ALL of its inputs. A hollow square is a valid parallel reaction that is not in any listed Path (shown when the list is capped). Dashed red with a struck-through ID means you deleted it in Metabolome Records.',
    placement: 'center',
    glyphs: ['pf-reaction', 'pf-reaction-unlisted', 'pf-reaction-deleted', 'pf-reaction-highlight'],
  },
  {
    icon: GitBranch,
    title: 'Branch points and lines',
    body: 'A dashed ring marks a branch point: more than one reaction can make that compound, so Paths split there. Line width is the share of listed Paths using the step; dashed lines belong to unlisted parallel reactions.',
    placement: 'center',
    glyphs: ['pf-branch', 'pf-line-width', 'pf-line-dashed', 'pf-line-highlight'],
  },
  {
    icon: Shapes,
    title: 'Several targets',
    body: 'With more than one compound search, All targets overlays them. Each target keeps its search colour, shared steps are dark, shared compounds get a multi-colour ring, and the labels diverges and merges show where routes split or join.',
    placement: 'center',
    glyphs: ['pf-shared', 'pf-line-target', 'pf-line-shared', 'pf-tag'],
  },
  {
    icon: Pin,
    title: 'The Path list',
    body: 'The left panel lists Paths, shortest first. Hover to preview, click to highlight, Up/Down to step through, Esc to clear. Pin up to four to compare in different colours. The layers badge means several equivalent combinations were grouped into one card.',
    placement: 'center',
    glyphs: ['pf-pin'],
  },
  {
    icon: Focus,
    title: 'Inspector and Isolate',
    body: 'The right panel shows the ordered steps of a Path, or for a compound the reactions that make it and use it, or for a reaction what it requires, produces and which cofactors it assumes. Isolate redraws only your selection.',
    placement: 'center',
  },
  {
    icon: Telescope,
    title: 'Modes and limits',
    body: 'All parallel routes includes same-generation (lateral) reactions; Earliest only keeps strictly generation-increasing routes. If a target has more Paths than the cap, the shortest are listed and Search deeper raises the cap.',
    placement: 'center',
    docSlug: 'concept-and-or-paths',
  },
  {
    icon: Link2,
    title: 'Linked views and export',
    body: 'While Linked is on, your selection filters Metabolome Records, Reaction Network and Metabolic Map; a chip at the top tells you so. Export SVG makes a publication figure of the whole graph, the current view or just the selection.',
    placement: 'center',
    docSlug: 'feature-linked-selection',
  },
];

export const mapTourSteps = [
  {
    icon: MapPin,
    title: 'Metabolic Map',
    body: 'Your compounds placed on the KEGG global metabolism map (ko01100). Each coloured dot is a compound, coloured by generation: red is early, violet is late.',
    placement: 'center',
    glyphs: ['mm-compound', 'mm-gen-colors'],
    docSlug: 'view-metabolic-map',
  },
  {
    icon: Settings2,
    title: 'Show the reactions',
    body: 'Edges are hidden at first. Open the arrow on the right edge, then Edges: Pruned merges parallel reactions between two compounds into one edge ("3 rxns"), All draws every reaction, None hides them. Triangles show direction; hover or pin to read reaction IDs.',
    placement: 'center',
    glyphs: ['mm-edge', 'mm-edge-merged'],
  },
  {
    icon: Globe2,
    title: 'Map layers',
    body: 'In KEGG Layout mode you can add small grey dots for every other map compound, the map\'s own lines, and the pathway region names. Custom layout ignores the KEGG positions and arranges your compounds with a force layout that keeps earlier generations on the left.',
    placement: 'center',
    glyphs: ['mm-ghost', 'mm-pathway-region'],
  },
  {
    icon: Spline,
    title: 'Curved or Grid edges',
    body: 'Layout: Curved draws smooth arcs, Grid routes right-angled lines with rounded corners and snaps nodes to a grid. Dashed edges are bridges created when you hide a node.',
    placement: 'center',
    glyphs: ['mm-edge-bridge'],
  },
  {
    icon: Atom,
    title: 'Structures and backbone search',
    body: 'Structures replaces dots with 2D molecule drawings. The atom button (top left) searches by SMILES substructure, for example C(=O)O for carboxylic acids; matches glow and everything else fades.',
    placement: 'center',
    glyphs: ['mm-backbone'],
  },
  {
    icon: Hexagon,
    title: 'Find and lock',
    body: 'Find Compound jumps to a compound by name or ID. Drag dots to move them; a dashed red ring marks a locked position. Reset layout and Minimize edge lengths tidy things up.',
    placement: 'center',
    glyphs: ['mm-locked'],
  },
  {
    icon: Download,
    title: 'Export',
    body: 'Download SVG keeps the map as editable layers (reaction paths, compound dots, labels); Download PNG gives a picture. Press H for shortcuts.',
    placement: 'center',
    docSlug: 'feature-export-import',
  },
];

export const network2dTourSteps = [
  {
    icon: Waypoints,
    title: 'Reaction Network',
    body: 'The complete hypergraph of your results. Reactions keep every substrate and product together, so each reaction is drawn as a reactant complex, an enzyme and a product complex between compound circles.',
    placement: 'center',
    docSlug: 'view-reaction-network',
  },
  {
    icon: Boxes,
    title: 'Circles, rectangles, ellipses',
    body: 'Circle: a compound. Rounded rectangle: a reaction complex (left = all reactants, right = all products). Ellipse: the EC number of the enzyme.',
    placement: 'center',
    glyphs: ['rn-compound', 'rn-reaction', 'rn-ec'],
  },
  {
    icon: Cable,
    title: 'Solid, dashed, dotted',
    body: 'Solid: a compound joined to a complex; a number on it is the stoichiometry (2 molecules, 3 molecules …). Dashed: the reaction itself. Dotted violet: the enzyme.',
    placement: 'center',
    glyphs: ['rn-edge-solid', 'rn-stoich', 'rn-edge-dashed', 'rn-edge-dotted'],
  },
  {
    icon: Columns3,
    title: 'Bands are generations',
    body: 'Each generation is a band of four columns: compound, reactant complex, EC, product complex. The first band is labelled Seed (generation 0). Empty generations are skipped. The longest chain runs along the middle.',
    placement: 'center',
    glyphs: ['rn-band-header'],
    docSlug: 'concept-generations',
  },
  {
    icon: Play,
    title: 'Generation timeline',
    body: 'The bar at the bottom controls which generations are drawn. Play animates the expansion, the arrows step one generation, the two handles keep only a window of generations, and 1x-10x sets the speed. Space plays, Left/Right step.',
    placement: 'center',
  },
  {
    icon: Palette,
    title: 'Colour',
    body: 'Settings > Colors: Gen colours nodes along a red-to-violet rainbow by generation, Type uses one colour per shape, Degree colours by number of connections. You can edit palette stops and tune hue, saturation and brightness.',
    placement: 'center',
    glyphs: ['rn-gen-colors'],
  },
  {
    icon: MousePointer,
    title: 'Selecting and rings',
    body: 'Click pins a node and highlights its connections; Shift+click pins several; Ctrl/Cmd+drag draws a selection box. A glow ring is pinned or hovered, a dashed amber ring is locked (middle-click), a heavy border is a collapsed branch (Ctrl/Cmd+click).',
    placement: 'center',
    glyphs: ['rn-hover', 'rn-locked', 'rn-collapsed', 'rn-overlay'],
  },
  {
    icon: SlidersHorizontal,
    title: 'Settings and layout',
    body: 'The arrow on the right edge opens Settings: spread, node and font size, edge width and opacity, Overlay, Structures, Curved, Avoid overlap, grid and snap, text tools, edge paint, and SVG/PNG export or SVG layout import. R re-runs the layout.',
    placement: 'center',
  },
  {
    icon: Maximize,
    title: 'Shortcuts and right-click',
    body: 'Right-click a node for colour, opacity, hide, collapse, and Protein Viewer on EC nodes. Press F for fullscreen, G for the grid, 0 to fit, H for every shortcut, Ctrl/Cmd+Z to undo.',
    placement: 'center',
  },
];

export const VIEW_TOUR_MAP = {
  table: tableTourSteps,
  network2d: network2dTourSteps,
  map: mapTourSteps,
  tree: treeTourSteps,
};
