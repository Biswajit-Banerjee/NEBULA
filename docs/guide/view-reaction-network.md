# Reaction Network

**Reaction Network** draws your results as a **hypergraph** with the network-expansion order as its coordinate system. Compounds and reactions are placed by the **generation** at which they become reachable from the seed compounds, so you can see how the network grows step by step and where it branches [[9]](references#ref-9).

If you have not met the idea of complexes and stoichiometry, read [Hypergraphs and stoichiometry](concept-hypergraph) first. It is short.

---

## The screen

![Reaction Network overview](images/rn-overview.png "Reaction Network for (R)-Lactate (C00256), a generation-3 compound, with the timeline at its last generation. Numbered items are explained below.")

1. **Generation headers**: `Seed`, `Gen 1`, `Gen 2` … (one per band, at the top of the canvas; zoom in to read them)
2. **Compound** (circle).
3. **Reactant complex** (rounded rectangle, left of the enzyme).
4. **Enzyme** (ellipse showing the EC number).
5. **Product complex** (rounded rectangle, right of the enzyme).
6. **Generation timeline** (bottom).
7. **Settings** arrow on the right edge.

---

## How to read the graph

Every reaction is drawn the same way, left to right:

> compound circles → **reactant complex** → **enzyme (EC)** → **product complex** → compound circles

and each generation owns a **band of four columns** in this order: compound, reactant complex, EC, product complex. The first band is labelled **Seed** (generation 0). Generations with nothing in them are skipped, so there are no empty gaps. The longest chain through the graph (the "backbone") is placed along the horizontal centre line and everything else is arranged above and below it.

### Shapes

| Symbol | Meaning |
|---|---|
| ![](sym:rn-compound) | **Circle: compound.** A metabolite or cofactor. With **Structures** on, it becomes the compound's 2D chemical drawing. |
| ![](sym:rn-reaction) | **Rounded rectangle: reaction complex.** All reactants together (left) or all products together (right). |
| ![](sym:rn-ec) | **Ellipse: EC number.** The enzyme class. Right-click it, or click the EC in Metabolome Records, to open the [Protein Domain Viewer](view-protein-domains). |

### Lines

| Symbol | Meaning |
|---|---|
| ![](sym:rn-edge-solid) | **Solid line.** Joins a compound to a complex: this compound takes part. |
| ![](sym:rn-stoich) | **Number on a solid line.** How many molecules (2, 3 …) when above 1. No number means 1. Shown once you zoom in a little. |
| ![](sym:rn-edge-dashed) | **Dashed line.** The reaction itself: reactant complex to product complex. |
| ![](sym:rn-edge-dotted) | **Dotted violet line.** Joins a complex to its enzyme. The enzyme is not consumed. |

> **Note:** A reaction with two enzymes has two ellipses; one enzyme that serves two reactions is a single ellipse shared by both.

### Colour

The default colour mode is **Gen** (generation): a rainbow from red (early) to violet (late) so you can see the generation of any node at a glance. Switch it in *Settings > Colors*:

| Mode | Colours nodes by |
|---|---|
| **Gen** | Generation (rainbow, default). |
| **Type** | Shape: one colour each for compounds, reactions and EC ovals (colours come from the theme). |
| **Degree** | Number of connections (rainbow from few to many). |

<nebula-key view="reaction-network"></nebula-key>

---

## Generation timeline

![The generation timeline and Settings panel](images/rn-timeline-settings.png "The generation timeline (bottom) and the Settings panel (right).")

1. **Step back / Play / Step forward.**
2. **`Gen 3–9/12`** label: the visible window of generations and the maximum.
3. **Two-handle slider.** The left handle is the earliest generation shown, the right handle the latest. Drag both to show a window.
4. **Speed** (1× to 10×) for Play.
5. **Collapse** arrow: turns the bar into a small pill.
6. **Settings** panel (the arrow on the right edge).

Play animates the expansion from the seed outward. Use it to teach, or to see which reactions appear when. Space plays and pauses; Left and Right arrows step one generation.

---

## Selecting and rings

| Action | Result |
|---|---|
| **Hover** a node | Its connections are emphasised and the rest is dimmed. |
| **Click** a node | Pins it (the highlight stays) and adds it to the **Selection** panel (bottom right), which lists the node's ID, name, generation, number of reactions and, for a reaction, its equation, transition, coenzyme, source and EC. Click again to unpin. |
| **Shift + click** | Pin several nodes. |
| **Ctrl / Cmd + drag** on empty space | Draw a selection box. |
| **Drag** a node | Move it. Positions stick. |
| **Middle-click** a node | Lock or unlock its position (amber dashed ring). |
| **Ctrl / Cmd + click** a reaction rectangle | Collapse or expand everything beyond it. A collapsed reaction has a heavier border. |
| **Right-click** a node | Context menu (below). |
| **Text mode** (Settings > Text) | Click a node label, subtitle or text box to select it, edit its words in the panel, and drag it to reposition it. |

### Right-click menu

- **Colour** (fill and border), **border style** (solid, dashed, dotted, none) and **opacity** for the node (or all selected nodes), with **Reset colors & border**.
- **Hide this node.** **Show all hidden (n)** brings them back.
- **Protein Viewer** (EC ellipses only): opens the [Protein Domain Viewer](view-protein-domains).
- **Collapse subtree / Expand subtree** (reaction rectangles).
- **Align / Distribute** (when two or more nodes are selected).

### Overlay: which search made this?

With **Overlay** on (Settings > Graph), nodes and lines get coloured outlines in the colours of the search queries that produced them. A node found by several queries has several outlines. See [Multi-search](feature-multi-search).

---

## Settings panel

Open it with the arrow on the right edge. The header has quick buttons: zoom in, zoom out, fit, fullscreen, help, and **Key**. Drag the panel's left edge to resize it.

### Graph

| Control | What it does |
|---|---|
| **Graph spread** | Scales the distance between bands and nodes. |
| **Node size**, **Font scale** | Size of shapes and labels. |
| **Node opacity** | Transparency of all nodes. |
| **Edge width**, **Edge opacity** | Thickness and transparency of lines. |
| **Overlay** | Search-membership outlines (see above). |
| **Structures** | Draw compounds as 2D chemical structures instead of circles. |
| **Curved** | Smooth curved lines (on) or straight lines (off). |
| **Avoid overlap** | When you drag a node, push others out of the way. |

### Colors

Colour mode (**Gen**, **Type**, **Degree**); click a stop in the palette bar to edit it; **Colour tuning** sliders for hue shift, saturation and brightness (with **Reset**); **Paint edges** brush with a colour picker and a bin to clear all painted edges.

### Canvas

**Grid** and **Snap to grid** toggles, grid size, grid-line colour and background colour.

### Text

**Text mode** lets you select and move text; **Add text box** places a free annotation at the centre of the view; **Labels** shows each node's ID; **Subtitles** shows compound names under the ID. Select a text item to edit its words and change its font, size, colour, opacity and alignment, or use **Bulk format** to restyle all labels, subtitles or text boxes at once. Free text boxes can be deleted with <kbd>Delete</kbd>.

### Export & Import

| Button | What it does |
|---|---|
| **SVG** | Exports the figure as editable vector graphics (colours, opacity, annotations and hidden or collapsed state are kept). |
| **PNG** | Exports a high-resolution picture. |
| **Import** | Loads positions (and optionally colours and labels) from an SVG exported by NEBULA, or edited in a vector editor such as Illustrator. |
| **Import positions only** | When on, only node positions are used and the current colours and labels are kept. |
| **Reset layout** | Recomputes the generation-band layout and discards manual positions. |
| **Tighten** | Pulls connected nodes closer together. |

---

## Keyboard shortcuts

Press <kbd>H</kbd> in the viewer for the same list.

| Key | Action |
|---|---|
| <kbd>+</kbd> / <kbd>-</kbd> | Zoom in / out |
| <kbd>0</kbd> | Fit to view |
| <kbd>Space</kbd> | Play / pause the generations |
| <kbd>←</kbd> / <kbd>→</kbd> | Step one generation |
| <kbd>R</kbd> | Re-run the layout |
| <kbd>G</kbd> | Show / hide the grid |
| <kbd>F</kbd> | Fullscreen |
| <kbd>H</kbd> | Help |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> or <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Redo |
| <kbd>Delete</kbd> | Delete the selected text box |
| <kbd>Esc</kbd> | Leave text mode / deselect |

---

## Tips

- Too dense? Turn on [cofactor hiding](feature-cofactors) (eye icon in the top bar), or use the timeline to show a window of generations.
- Pair it with Metabolome Records in [Split view](feature-split-view): select rows on one side and see them on the other.
- Exported SVGs can be re-imported, so you can arrange a figure once and reuse the layout. See [Export and import](feature-export-import).
