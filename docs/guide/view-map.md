# KEGG Map

The **Map** view overlays your search results onto the KEGG global metabolism reference map (`ko01100`). This provides biological context by showing exactly where your reactions and compounds sit within the full metabolic landscape.

---

## Controls

| Action    | How                                    |
| --------- | -------------------------------------- |
| **Pan**   | Click and drag                         |
| **Zoom**  | Mouse wheel or pinch gesture           |
| **Hover** | Tooltip with compound/reaction details |

---

## What You See

- **Colored dots** — compounds from your results, colored by search chip.
- **Edges** — reactions connecting substrates to products on the map.
- Compounds without KEGG map coordinates are omitted from this view (they still appear in Table and Network views).

---

## Tips

- Zoom into specific pathway regions to see fine-grained detail.
- Use [Split View](feature-split-view) with **Map + 2D Network** to compare KEGG positions with the force-directed layout.
- Enable [Cofactor Filtering](feature-cofactors) to declutter the map.
