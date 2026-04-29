# 2D Network

The **2D Network** view renders your search results as an interactive force-directed graph on an HTML5 canvas. Compounds are nodes, reactions are edges (or hyperedges), and the layout self-organizes through physics simulation.

---

## Controls

| Action          | How                                 |
| --------------- | ----------------------------------- |
| **Pan**         | Click and drag on empty space       |
| **Zoom**        | Mouse wheel or pinch gesture        |
| **Select node** | Click on a compound or reaction     |
| **Hover**       | Tooltip with compound/reaction info |
| **Drag node**   | Click and drag a node to reposition |

---

## Node Coloring

- Each search chip has a **distinct color** — nodes are colored by the chip that produced them.
- Nodes appearing in multiple searches show blended or stacked color indicators.
- Primordial (generation-0) compounds may carry a special badge.
- Rows selected in the Table view are **highlighted** in the graph.

---

## Layout

The D3-based force simulation arranges nodes automatically. It stabilizes after a few seconds. You can drag individual nodes to adjust positions — they will "stick" in place.

---

## Performance

- Networks under **500 nodes** render very smoothly.
- For large result sets (1000+ reactions), enable [Cofactor Filtering](feature-cofactors) to reduce node count significantly.
- If the graph feels too dense, try the [3D Network](view-network-3d) — the extra dimension separates overlapping clusters.

---

## Tips

- Use [Split View](feature-split-view) with **Table + 2D** to browse tabular data while seeing the graph structure.
- Selections sync across views — clicking a node here selects the corresponding row in the table.
- Toggle [Cofactor Filtering](feature-cofactors) on/off to see how common metabolites connect the network.
