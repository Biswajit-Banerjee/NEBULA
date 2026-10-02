# Metabolic Map

The **Metabolic Map** places your results on the familiar **KEGG global metabolism map** (`ko01100`) [[1]](references#ref-1). It gives you a reference frame you may already know, with the generation of each compound as colour. This follows the idea of projecting data on a canonical layout used by RiboVision [[13]](references#ref-13).

Think of it as a *simplified* picture. KEGG maps draw reactions as arrows between individual compounds. They do not show that a reaction needs several substrates together, or how many molecules take part. For that, use [Reaction Network](view-reaction-network) or [Path Finder](view-path-finder).

---

## The screen

![Metabolic Map overview](images/mm-overview.png "Metabolic Map for (R)-Lactate (C00256), with Edges set to Pruned and Show all map compounds on. Numbered items are explained below.")

1. **Compounds** from your results (coloured dots, by generation: red are seed compounds).
2. **Reactions** (arrows between compounds; they appear once Edges is set to *Pruned* or *All*).
3. **Backbone search** button (atom icon).
4. **Settings arrow** on the right edge.
5. **Pathway region** names from the KEGG map.
6. **Grey dots**: other KEGG map compounds, shown for orientation.

> **Tip:** Edges are **hidden by default**. If you only see dots, open **Map Settings** and set **Edges** to **Pruned** or **All**.

---

## How to read the map

### Compounds

| Symbol | Meaning |
|---|---|
| ![](sym:mm-compound) | **Coloured dot: compound in your results.** The colour is its generation. |
| ![](sym:mm-gen-colors) | **Colour scale.** Red = early generation (seed compounds), violet = late. |
| ![](sym:mm-ghost) | **Small grey dot.** Another compound on the KEGG map, shown by *Show all map compounds* so you can see where your compounds sit among all of metabolism. |
| ![](sym:mm-backbone) | **Glowing ring.** Matches your SMILES backbone search; all other compounds fade. |
| ![](sym:mm-locked) | **Red dashed ring.** Locked position (middle-click toggles it). |
| ![](sym:mm-pathway-region) | **Grey text.** The KEGG map's pathway-region names (for example "Glycolysis"). |

### Reactions

| Symbol | Meaning |
|---|---|
| ![](sym:mm-edge) | **Line with a triangle.** One reaction from a substrate to a product. The triangle points the way the reaction runs. Hover or pin a compound to read the reaction IDs. |
| ![](sym:mm-edge-merged) | **Pill reading `3 rxns`.** With Edges set to **Pruned**, several reactions between the same two compounds are merged into one edge. |
| ![](sym:mm-edge-bridge) | **Dashed line.** A *bridge edge* created when you deleted a node, joining that node's neighbours. |

A reaction with several substrates and products is drawn as one edge for every substrate-product pair. This is the standard "simple graph" projection and it is why this view cannot show stoichiometry; see [Hypergraphs and stoichiometry](concept-hypergraph).

<nebula-key view="metabolic-map"></nebula-key>

---

## Layout modes

Choose in *Map Settings > Layout Mode*.

| Mode | What it does |
|---|---|
| **KEGG Layout** (default) | Compounds are placed at their positions on the KEGG global map. Compounds that are not on that map (for example NEBULA's `Z` compounds) are placed near their connected neighbours using precomputed fallback positions. Positions are fixed to the map. |
| **Custom** | Ignores KEGG positions and arranges your compounds with a force layout that keeps earlier generations on the left. You can drag compounds around. |

In **KEGG Layout** you can also switch on these layers:

| Toggle | Effect |
|---|---|
| **Show all map compounds** | Grey dots for every other compound on the KEGG map. |
| **Show map lines** | The KEGG map's own reaction lines, as a faint background. |
| **Pathway regions** | The map's region names (text). |
| **Map lines opacity** | How strong the background lines are. |

The three layers are independent of each other and of your own reaction edges.

---

## Map Settings

Open it with the arrow on the right edge. Drag its left edge to resize.

### Find Compound
Type a compound name or ID and choose it. The view jumps to it. If it is not in the current map, the panel says so.

### Display

| Control | What it does |
|---|---|
| **Edge Opacity** | Transparency of reaction lines. |
| **Spacing** | Scales distances between compounds (custom layout). |
| **Node & font size** | Size of dots and labels. |
| **Path overlay** | Coloured outlines showing which search produced each compound and edge ([Multi-search](feature-multi-search)). |
| **Edges: All / Pruned / None** | *All* draws every reaction; *Pruned* merges parallel reactions into one labelled edge (`3 rxns`); *None* hides all reaction edges (default). |
| **Layout: Curved / Grid** | *Curved* draws smooth arcs. *Grid* routes right-angled lines with rounded corners and snaps nodes to a grid. |
| **Structures** | Replace dots with 2D molecule drawings. |
| **Compound names** | Show names next to compounds. |

### Colors
The colour scheme bar shows the generation rainbow (not editable here). **Background** and **Grid lines** colours can be changed.

### Actions
**Reset layout**, **Minimize edge lengths** (pulls connected compounds together), **Download SVG**, **Download PNG**, **Fullscreen** and **Help & shortcuts**. The **Key** button opens the symbol key.

---

## Backbone (substructure) search

Click the **atom** button at the top left and type a **SMILES** pattern, for example `C(=O)O` (a carboxylic acid). Press <kbd>Enter</kbd>. NEBULA tests every compound in the current view; matching compounds glow and everything else fades. A pill tells you how many molecules matched. <kbd>Esc</kbd> clears it.

This is a quick way to answer questions like *"which of these intermediates contain an amino group?"*

---

## Mouse and keyboard

| Action | Result |
|---|---|
| Drag empty space | Pan. |
| Scroll / pinch | Zoom. |
| Drag a compound | Move it (Custom layout). |
| Click / Shift+click | Pin one / several compounds and highlight their reactions. The **Selection** panel lists them. |
| Ctrl + drag on empty space | Selection box. |
| Middle-click | Lock or unlock a compound. |
| Right-click a compound | Delete incoming edges, delete outgoing edges, or delete the node with bridge edges. |
| Right-click an edge | Delete that edge. |
| Right-click a pinned group | Flip or rotate the group. |

| Key | Action |
|---|---|
| <kbd>+</kbd> / <kbd>-</kbd> | Zoom |
| <kbd>0</kbd> | Fit to view |
| <kbd>R</kbd> | Reset layout |
| <kbd>F</kbd> | Fullscreen |
| <kbd>H</kbd> | Help |

> **Note:** Deleting a node or edge here changes only this view; it is not the same as deleting a reaction in Metabolome Records.

---

## Exporting

**Download SVG** keeps the map as editable vector layers: your reaction paths, compound dots, labels, and (when switched on) the KEGG background lines, dots and region text. **Download PNG** gives a picture. See [Export and import](feature-export-import).

---

## Tips

- Use the map to see *where* in metabolism a route lives; use [Path Finder](view-path-finder) to see *which* routes exist.
- Switch on **Show all map compounds** when your results are sparse; the grey dots give you a sense of scale.
- If the picture is crowded, hide cofactors (eye icon in the top bar). See [Cofactor filtering](feature-cofactors).
