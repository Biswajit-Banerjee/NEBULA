# Export and import

What you can save from NEBULA, and what you can bring back.

| What | From | Format | Can be re-imported? |
|---|---|---|---|
| Whole session (queries, results, layout) | Top bar, download arrow | `.json` | Yes: top bar, upload arrow ([Sessions](feature-sessions)) |
| Routes as a figure | [Path Finder](view-path-finder), **Export SVG** | `.svg` | No (figure only) |
| Network figure | [Reaction Network](view-reaction-network), Settings > Export & Import | `.svg`, `.png` | **SVG yes**: layout can be imported back |
| Map figure | [Metabolic Map](view-metabolic-map), Map Settings > Actions | `.svg`, `.png` | No |
| Protein figure | [Protein Domain Viewer](view-protein-domains), download icon | `.svg` | No |

---

## Path Finder SVG

Click **Export SVG** in the toolbar and choose:

1. **What to export:** *Whole pathway graph*, *Current view* (with the highlight and pinned Paths) or *Selection only*.
2. **Style:** *Publication* uses a colour-blind-safe palette on white; *Current theme* uses what you see.
3. **Title & caption**, **Legend**, **Background**: each optional.

The legend in the file explains every symbol, in the same terms as this guide. Each generation is a separate group, with compounds, reactions and edges in their own layers, so a figure is easy to edit in a vector editor.

> **Tip:** Make the picture you want first (highlight a Path, pin others, change labels in Display), then export *Current view*.

---

## Reaction Network SVG, PNG and layout import

In **Settings > Export & Import**:

- **SVG** is editable vector art. It keeps colours, opacity, text annotations, hidden nodes and collapsed branches, and gives every node and generation its own named group.
- **PNG** is a high-resolution picture.
- **Import** reads an SVG exported by NEBULA (or one edited in a vector editor such as Illustrator) and moves the nodes to the positions in the file. With **Import positions only** on, current colours and labels are kept; with it off, colours and labels are imported as well. Painted edge colours and text annotations are always imported.
- **Reset layout** discards manual positions and recalculates the generation-band layout.

Typical workflow: export SVG, tidy the layout, import it back, and export again.

---

## Metabolic Map SVG and PNG

**Download SVG** gives editable layers (reaction paths, compound dots, labels), plus the KEGG background lines, compound dots and region text when those layers are switched on. **Download PNG** gives a picture of the current view.

---

## Protein figure

The download icon in the Protein Domain Viewer header creates an SVG with the protein view, the sequence bar (domains, binding sites, active sites) and the domain information.

---

## Using figures in publications

- Use **Publication** style for Path Finder so colours stay distinguishable for colour-blind readers.
- Cite NEBULA and the databases it draws on; see [References](references#how-to-cite).
- Keep the session file as supplementary data so others can reproduce your view.
