/**
 * Single source of truth for every symbol NEBULA draws.
 * Used by the on-canvas Key popovers, the documentation (<nebula-key>) and the
 * guided tour. Each entry: [glyphId, label, meaning].
 * Glyphs themselves live in Glyphs.jsx and follow the active theme.
 */
export const KEY_VIEWS = {
  'path-finder': {
    title: 'Path Finder key',
    docSlug: 'view-path-finder',
    intro: 'Read the graph left to right: seed compounds on the left, your target on the right, one column per generation.',
    groups: [
      {
        title: 'Compounds (circles)',
        items: [
          ['pf-intermediate', 'Hollow circle: intermediate', 'A compound made on the way to the target. Its outline colour is the intermediate colour.'],
          ['pf-target', 'Large filled circle: target', 'The compound you searched for. With several targets, each keeps its own search colour.'],
          ['pf-source', 'Filled green circle: source', 'A compound you entered in the Source field. Every Path must use at least one source.'],
          ['pf-seed', 'Filled grey circle: seed (generation 0)', 'A compound assumed available from the start. By default seeds are not drawn as nodes (see the italic text below).'],
          ['pf-seed-inline', 'Italic grey text under a reaction', 'Seed compounds that reaction consumes, listed inline to keep the graph readable. Choose Display, Seed compounds, As nodes to draw them.'],
          ['pf-branch', 'Dashed ring: branch point', 'More than one reaction can make this compound (OR). Alternative Paths split here.'],
          ['pf-shared', 'Multi-coloured ring segments', 'Several targets need this compound. One arc per target, in that target\'s colour.'],
          ['pf-tag', 'Italic label: diverges / merges', 'Several targets only. Diverges: routes to different targets split here. Merges: different targets reach it by different reactions.'],
          ['pf-selected', 'Highlight-coloured outer ring: selected', 'The compound or reaction you clicked.'],
        ],
      },
      {
        title: 'Reactions (squares)',
        items: [
          ['pf-reaction', 'Filled square: reaction on a listed Path', 'A reaction used by at least one listed Path. It needs ALL of its inputs (AND). The ID (R#####) is printed above it.'],
          ['pf-reaction-unlisted', 'Hollow square: parallel reaction', 'Chemically valid on a route to the target but not part of any listed Path. Appears when the Path list is capped. Can be hidden in Display.'],
          ['pf-reaction-deleted', 'Dashed red square, struck-through ID', 'You deleted this reaction in Metabolome Records. Paths that use it are marked "broken".'],
          ['pf-reaction-highlight', 'Highlight-coloured square', 'Part of the Path (or set of Paths) you are hovering or have selected. The highlight colour depends on the theme.'],
        ],
      },
      {
        title: 'Lines',
        items: [
          ['pf-line-width', 'Line width', 'Share of the listed Paths that use this step: thicker means more Paths. Direction is always left to right.'],
          ['pf-line-dashed', 'Dashed line', 'Belongs to a parallel reaction outside the listed Paths.'],
          ['pf-line-highlight', 'Highlight-coloured line', 'Part of the current highlight; everything else is dimmed.'],
          ['pf-pin', 'Four overlay colours: pinned Paths', 'Pin up to four Paths to overlay and compare them; earlier pins are drawn thicker.'],
          ['pf-line-target', 'Coloured line (several targets)', 'Used only by the target of that colour.'],
          ['pf-line-shared', 'Dark line (several targets)', 'Shared by more than one target.'],
        ],
      },
      {
        title: 'Columns',
        items: [
          ['pf-gen-header', 'SEED, GEN 3, GEN 4-5 ...', 'Generation of the compounds in that column. SEED (generation 0) shows only when seeds are drawn as nodes. A range such as 4-5 means the column merges two generations to keep every edge pointing right.'],
        ],
      },
    ],
  },

  'reaction-network': {
    title: 'Reaction Network key',
    docSlug: 'view-reaction-network',
    intro: 'Every reaction is drawn as a reactant complex, optional enzyme (EC), and product complex, laid out in one band per generation.',
    groups: [
      {
        title: 'Nodes',
        items: [
          ['rn-compound', 'Circle: compound (species)', 'A metabolite or cofactor. With Structures on it becomes its 2D chemical drawing. Colour follows the colour mode (generation by default).'],
          ['rn-reaction', 'Rounded rectangle: reaction complex', 'The left rectangle is the reactant complex (all substrates together); the right rectangle is the product complex.'],
          ['rn-ec', 'Ellipse: EC number', 'The enzyme class that catalyses the reaction. Click it in Metabolome Records, or right-click it here, to open the Protein Domain Viewer.'],
        ],
      },
      {
        title: 'Lines',
        items: [
          ['rn-edge-solid', 'Solid line: stoichiometry', 'Joins a compound to a complex. A number on the line (2, 3 ...) is how many molecules take part; an unlabelled line means 1.'],
          ['rn-edge-dashed', 'Dashed line: the reaction', 'Joins the reactant complex to the product complex.'],
          ['rn-edge-dotted', 'Dotted violet line: enzyme', 'Joins a complex to its EC number. The enzyme takes part but is not consumed.'],
          ['rn-stoich', 'Number on a line', 'Stoichiometric coefficient, shown when above 1 and zoomed in enough.'],
        ],
      },
      {
        title: 'Columns and colour',
        items: [
          ['rn-band-header', 'Seed, Gen 1, Gen 2 ...', 'Each generation is a band of four columns: compound, reactant complex, EC, product complex. Empty generations are skipped. "Seed" is generation 0.'],
          ['rn-gen-colors', 'Rainbow bar: generation colour', 'Early generations are red, late ones violet. Other modes: Node Type and Degree (number of connections).'],
        ],
      },
      {
        title: 'Node states',
        items: [
          ['rn-hover', 'Glow ring: hovered or pinned', 'Its connections are emphasised and the rest is dimmed. Click to pin, Shift+click to pin several.'],
          ['rn-locked', 'Amber dashed ring: locked', 'Position is fixed (middle-click toggles).'],
          ['rn-collapsed', 'Heavier rectangle border: collapsed', 'Ctrl/Cmd+click on a reaction hides everything beyond it. Repeat to expand.'],
          ['rn-overlay', 'Coloured outline: search membership', 'With Overlay on, outlines show which search chip(s) produced the node.'],
        ],
      },
    ],
  },

  'metabolic-map': {
    title: 'Metabolic Map key',
    docSlug: 'view-metabolic-map',
    intro: 'Compounds are dots, reactions are arrows between them, placed on the KEGG global metabolism map (ko01100) or on a custom layout.',
    groups: [
      {
        title: 'Compounds',
        items: [
          ['mm-compound', 'Coloured dot: compound in your results', 'Colour is the generation (rainbow, red early to violet late). Turn on Structures for 2D drawings and Compound names for labels.'],
          ['mm-ghost', 'Small grey dot: other map compound', 'Shown by "Show all map compounds" for orientation. Not part of your results.'],
          ['mm-backbone', 'Glowing ring: substructure match', 'Matches your SMILES backbone search; every other compound fades.'],
          ['mm-locked', 'Red dashed ring: locked', 'Position is fixed.'],
        ],
      },
      {
        title: 'Reactions (edges)',
        items: [
          ['mm-edge', 'Line with a triangle', 'One reaction from a substrate to a product. The triangle points in the direction of the reaction. The reaction ID appears when you hover or pin.'],
          ['mm-edge-merged', 'Pill "3 rxns"', 'Edges mode Pruned merges parallel reactions between the same two compounds into one edge.'],
          ['mm-edge-bridge', 'Dashed edge', 'A bridge created when you hide a node, joining its neighbours.'],
        ],
      },
      {
        title: 'Map layers',
        items: [
          ['mm-gen-colors', 'Rainbow bar: generation colour', 'The same generation colours as the Reaction Network.'],
          ['mm-pathway-region', 'Grey region names', 'Pathway regions of the KEGG map (for example "Glycolysis").'],
        ],
      },
    ],
  },

  protein: {
    title: 'Protein Domain Viewer key',
    docSlug: 'view-protein-domains',
    intro: 'The sequence bar, the domain cards and the 3D structure all use the same colours.',
    groups: [
      {
        title: 'Sequence bar and 3D structure',
        items: [
          ['pv-domain', 'Coloured block: ECOD domain', 'An independently folded region, positioned by residue number. Each domain keeps one colour in the bar, the card and the 3D cartoon.'],
          ['pv-binding', 'Red bar: binding site', 'Residues UniProt annotates as binding a ligand: a substrate, product, cofactor or metal ion.'],
          ['pv-active', 'Amber bar: active site (catalytic)', 'Residues that take part directly in the chemistry.'],
          ['pv-segments', 'Several residue chips', 'The domain is made of disconnected segments of the chain; click a chip to focus one.'],
        ],
      },
      {
        title: "ECOD hierarchy badges (each shows that level's ECOD name)",
        items: [
          ['pv-ecod-A', 'A: architecture', 'Top level of the ECOD hierarchy: the overall arrangement of secondary structure, for example "a/b three-layered sandwiches".'],
          ['pv-ecod-X', 'X: possible homology group', 'Domains that may share an ancestor, grouped by topology. The manuscript refers to folds by X-group, for example X-group 2003 (Rossmann-like).'],
          ['pv-ecod-H', 'H: homology group', 'Domains with evidence of common ancestry.'],
          ['pv-ecod-T', 'T: topology group', 'Domains with the same overall fold topology.'],
          ['pv-ecod-F', 'F: family', 'Closest relatives. The family id (for example 2003.1.1.49) is also shown as a yellow-orange tag.'],
        ],
      },
    ],
  },

  records: {
    title: 'Metabolome Records key',
    docSlug: 'view-metabolome-records',
    intro: 'One row per reaction. The coloured stripe tells you which search produced it.',
    groups: [
      {
        title: 'Rows',
        items: [
          ['mr-stripe', 'Coloured left stripe and tint', 'Row came from the search chip of that colour.'],
          ['mr-multi', 'Several small colour bars', 'Combined view only: the reaction was found by several searches.'],
          ['ui-expand', 'Chevron', 'Expand the row to see the KEGG definition and reaction drawing.'],
          ['mr-ec', 'Blue EC button', 'Open the Protein Domain Viewer for that enzyme class.'],
        ],
      },
      {
        title: 'Toolbar',
        items: [
          ['ui-filter', 'Funnel: Filter and Select', 'Select rows by text or regular expression in one column or all columns.'],
          ['ui-columns', 'Gear: column visibility', 'Show or hide reaction, source, coenzyme, equation, transition, target and EC.'],
        ],
      },
    ],
  },

  dock: {
    title: 'Top bar key',
    docSlug: 'interface-overview',
    intro: 'The icons in the top bar and on each search row.',
    groups: [
      {
        title: 'Top bar',
        items: [
          ['ui-combined', 'Stacked layers: combined view', 'Merge all searches so each reaction appears once.'],
          ['ui-eye', 'Eye: cofactors shown', 'Click to hide cofactors (all Z compounds) in every view.'],
          ['ui-eye-off', 'Closed eye: cofactors hidden', 'Click to show them again.'],
          ['ui-upload', 'Upload arrow: import session', 'Load a session .json exported earlier.'],
          ['ui-download', 'Download arrow: export session', 'Save searches, results and view state to a .json file.'],
          ['ui-theme', 'Palette: theme', 'Switch between the six NEBULA themes.'],
        ],
      },
      {
        title: 'Each search row',
        items: [
          ['dock-dot', 'Coloured dot', 'The colour of this search in every view. Click to change it.'],
          ['ui-eye', 'Eye on a row', 'Hide or show the results of just that search.'],
        ],
      },
    ],
  },
};

export const KEY_VIEW_IDS = Object.keys(KEY_VIEWS);

/** All glyph ids referenced by the key (used by the docs checker). */
export const ALL_GLYPH_IDS = new Set(
  KEY_VIEW_IDS.flatMap((v) => KEY_VIEWS[v].groups.flatMap((g) => g.items.map((i) => i[0]))),
);

/** glyphId -> { label, meaning } for mini keys inside tour cards. */
export const KEY_ITEM_BY_ID = Object.fromEntries(
  KEY_VIEW_IDS.flatMap((v) => KEY_VIEWS[v].groups.flatMap((g) => g.items.map(([id, label, meaning]) => [id, { label, meaning }]))),
);

/** Map the app's internal view ids to key ids. */
export const VIEW_TO_KEY = {
  table: 'records',
  tree: 'path-finder',
  network2d: 'reaction-network',
  map: 'metabolic-map',
};
