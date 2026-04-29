# Multi-Search 

NEBULA lets you run multiple searches and overlay them in every view. Each search is represented as a **query** with its own color, making it easy to compare results visually and highlight shared regions.

---

## Adding to Search

1. After your first search, click the **+** button in the search panel to add a new query.
2. Each query can use a different search mode (Compound, Reaction, or EC).
3. Enter your query and hit **Search** — results are added alongside existing ones.

---

## query Colors

Every query gets a unique color from NEBULA's palette. This color is used consistently across all views:

- **Table** — a colored dot next to each row indicates which query produced it.
- **2D / 3D Network** — nodes can be highlighted by their membership in a query.
- **Map** — dots on the map are highlighted by query.
- **Backtrace** — tree data corresponds to the first compound query.

---

## Toggling Visibility

Click the **eye icon** on a query to show or hide its results. Hidden queries are temporarily excluded from all views without deleting the data and can be restored at any point.

---

## Combined Mode

Enable **Combined mode** (the stacked cards icon) to merge results from all queries into a single unified view where each reaction is only represented once. This is useful when you want to see how reuse or overlap present in the metabolic network.

When combined mode is off, only the active query's results are shown.

---

## Removing Queries

Click the **×** on a query to remove it and its results. The remaining queries re-render automatically.

---

## Tips

- Compare biosynthetic origins of related metabolites (e.g. `C00025` vs `C00064`) by running both as compound searches.
- Use combined mode + cofactor filtering for the cleanest merged view.
- Each query's color persists across all views — easy to track which results came from where.
