# 3D Network

The **3D Network** view renders your metabolic network as a fully rotatable three-dimensional force graph using Three.js. It is ideal for large or densely connected networks where the 2D layout becomes too crowded.

---

## Controls

| Action          | How                             |
| --------------- | ------------------------------- |
| **Rotate**      | Left-click and drag             |
| **Pan**         | Right-click and drag            |
| **Zoom**        | Mouse wheel or pinch gesture    |
| **Select node** | Click on a node                 |
| **Hover**       | Tooltip with node details       |

---

## When to Use 3D

The extra spatial dimension helps when:

- The 2D layout is **too dense** — overlapping clusters separate naturally in 3D.
- You are exploring a **large compound search** with hundreds of reactions.
- You want to visually identify distinct metabolic sub-networks.

For smaller or sparse networks, the [2D Network](view-network-2d) is usually sufficient and lighter on resources.

---

## Node Coloring

Same as the 2D view:

- Color-coded by search chip.
- Selected rows from the Table view are highlighted.
- Primordial compounds carry a visual indicator.

---

## Performance

- The 3D view uses WebGL and may take a moment to stabilize on large networks.
- Cofactor filtering dramatically reduces rendering load — enable it via the top bar.
- On low-powered devices, prefer the 2D view for networks with 500+ nodes.

---

## Tips

- Rotate slowly to find the angle that best reveals your network's structure.
- Combine with the table in [Split View](feature-split-view) for interactive drill-down.
- All selections sync across views — a node clicked in 3D is highlighted everywhere.
