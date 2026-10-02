import {
  Compass, Search, Table2, Route, MapPin, Waypoints, Dna, Columns2, HelpCircle,
} from 'lucide-react';

/**
 * Main guided tour (first visit, landing-page button, Help menu).
 *
 * Each step can carry:
 *   action        token the GuidedTour component turns into real app behaviour
 *   placement     center | top-right | bottom-right | bottom-left | top-left | bottom (anchored to `target`)
 *   waitForResults pause until results load
 *   features      short bullet list
 *   glyphs        ids from Key/keyData.js, drawn as a mini symbol key inside the card
 *   docSlug       documentation page opened by "Learn more"
 *
 * Names follow the manuscript: Metabolome Records, Path Finder, Metabolic Map,
 * Reaction Network, Protein Domain Viewer. Gen-0 compounds are "seed compounds".
 */
const tourSteps = [
  {
    id: 'welcome',
    icon: Compass,
    title: 'Welcome to NEBULA',
    body: `NEBULA links metabolism to the enzymes that run it. Every reaction keeps all of its substrates and products, every compound is placed in a generation of the network expansion, and every enzyme leads to its protein domains and 3D structure. We will trace L-Glutamate (C00025), a generation-9 compound, and visit each viewer on the way.`,
    placement: 'center',
    docSlug: 'introduction',
  },

  {
    id: 'search-dock',
    icon: Search,
    target: '[data-tour="dock-bar"]',
    title: 'The search dock',
    body: `Click the bar to open it. Four search modes: Cmpd (find the Paths that make a compound, with an optional Source), Rxn (a KEGG reaction), EC (an enzyme class) and Cmpds (reactions that contain a set of compounds, Any or All). Use Add query to compare several searches; each gets its own colour.`,
    placement: 'bottom',
    expandDock: true,
    features: [
      'Ctrl/Cmd+K opens the dock, Esc closes it',
      'Eye icon: hide or show cofactors everywhere',
      'Stacked-layers icon: combine all searches',
      'Arrows: import or export a whole session',
    ],
    docSlug: 'feature-search',
  },

  {
    id: 'searching',
    icon: Search,
    title: 'Searching for L-Glutamate…',
    body: `NEBULA is expanding the network from the seed compounds (generation 0) and then tracing back from C00025, collecting every reaction that can contribute to making it.`,
    placement: 'center',
    action: 'search-c00025',
    waitForResults: true,
  },

  {
    id: 'view-table',
    icon: Table2,
    title: 'Metabolome Records',
    body: `One row per reaction: its ID, whether it comes from KEGG, the equation, the generation transition (for example 3 -> 4) and its EC numbers. Click a blue EC button to see the enzyme's protein domains.`,
    placement: 'top-right',
    action: 'view-table',
    features: [
      'Tick rows, then Keep or Delete the selection',
      'Funnel icon: select by text or regular expression',
      'Chevron: KEGG definition and reaction drawing',
    ],
    glyphs: ['mr-stripe', 'mr-ec'],
    docSlug: 'view-metabolome-records',
  },

  {
    id: 'view-tree',
    icon: Route,
    title: 'Path Finder',
    body: `Every minimal way to make your target from the seed compounds, laid out left to right by generation. Circles are compounds, squares are reactions, and a reaction needs ALL of its inputs. Click anything to highlight every Path through it, and pin up to four Paths to compare them.`,
    placement: 'top-right',
    action: 'view-tree',
    features: [
      'Left list: Paths, shortest first',
      'Right panel: ordered steps with equations and EC numbers',
      'Linked: your selection filters the other views',
      'Export SVG for publication figures',
    ],
    glyphs: ['pf-intermediate', 'pf-target', 'pf-reaction', 'pf-reaction-unlisted', 'pf-branch', 'pf-line-width'],
    docSlug: 'view-path-finder',
  },

  {
    id: 'view-map',
    icon: MapPin,
    title: 'Metabolic Map',
    body: `Your compounds placed on the familiar KEGG global metabolism map (ko01100), coloured by generation. Reactions are arrows between compounds. Edges start hidden: open the settings arrow on the right and set Edges to Pruned or All.`,
    placement: 'top-right',
    action: 'view-map',
    features: [
      'Show all map compounds: grey dots for orientation',
      'Find Compound jumps to any compound',
      'SMILES backbone search highlights matching molecules',
      'Download SVG or PNG',
    ],
    glyphs: ['mm-compound', 'mm-ghost', 'mm-edge'],
    docSlug: 'view-metabolic-map',
  },

  {
    id: 'view-2d',
    icon: Waypoints,
    title: 'Reaction Network',
    body: `The full hypergraph. Each reaction is a reactant complex (rectangle), an enzyme (ellipse) and a product complex (rectangle) between compound circles. One band per generation, from Seed on the left. Use the timeline at the bottom to play through the generations.`,
    placement: 'top-right',
    action: 'view-network2d',
    features: [
      'Scroll to zoom, drag to move, Shift+click to pin several nodes',
      'Right-click a node for colour, hide, collapse and Protein Viewer',
      'R re-runs the layout, F is fullscreen, H shows all shortcuts',
    ],
    glyphs: ['rn-compound', 'rn-reaction', 'rn-ec', 'rn-edge-solid', 'rn-edge-dashed', 'rn-edge-dotted'],
    docSlug: 'view-reaction-network',
  },

  {
    id: 'view-protein',
    icon: Dna,
    title: 'Protein Domain Viewer',
    body: `Click any EC button (Metabolome Records) or right-click an EC ellipse (Reaction Network) to open it. Pick an organism's protein, see its ECOD domains along the sequence, red binding sites and amber active sites, and the AlphaFold structure in 3D.`,
    placement: 'top-right',
    action: 'view-table',
    glyphs: ['pv-domain', 'pv-binding', 'pv-active'],
    docSlug: 'view-protein-domains',
  },

  {
    id: 'split-view',
    icon: Columns2,
    title: 'Split view',
    body: `Show two viewers side by side, for example Metabolome Records and Reaction Network. The Split button is in the view switcher at the bottom of the screen.`,
    placement: 'top-right',
    action: 'split-table-2d',
    features: [
      'Each side has its own controls',
      'Selections and filters stay in sync',
      'Click Single to go back to one view',
    ],
    docSlug: 'feature-split-view',
  },

  {
    id: 'finish',
    icon: HelpCircle,
    target: '[data-tour="help-btn"]',
    title: 'You are all set',
    body: `The Help button opens the full documentation, short Quick Help for the view you are in, this tour, and the Text size control. Every viewer also has a Key button that explains each symbol it draws.`,
    placement: 'top-left',
    action: 'unsplit',
    docSlug: 'symbols-cheat-sheet',
  },
];

export default tourSteps;
