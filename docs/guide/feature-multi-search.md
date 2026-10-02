# Multi-search and query colours

NEBULA can run several searches at once and show them together. Each search is a **query** (one row in the search dock) with its own colour.

---

## Adding queries

1. Open the dock and press **Add query**.
2. Choose a mode for the new row and fill it in ([Search modes](feature-search)).
3. Press **Explore**. All rows run, and their results are shown together.

Remove a row with the **×** that appears when you hover it (only when there is more than one row).

---

## Query colours

Every query gets a colour from the active theme's palette. Click the **coloured dot** at the start of the row to choose another one.

The same colour is used everywhere:

| Viewer | How the colour appears |
|---|---|
| [Metabolome Records](view-metabolome-records) | A coloured stripe and light tint on the row. |
| [Path Finder](view-path-finder) | The target's circle, its own lines, and its chip. With several targets: each target's steps use its colour; shared steps are dark. |
| [Reaction Network](view-reaction-network) | With **Overlay** on, coloured outlines on nodes and lines. |
| [Metabolic Map](view-metabolic-map) | With **Path overlay** on, coloured outlines on compounds and edges. |

---

## Showing and hiding a query

The **eye** on a row (after a search) hides or shows just that query's results in all viewers, without deleting them.

This is different from the eye in the *top bar*, which hides **cofactors**. See [Cofactor filtering](feature-cofactors).

---

## Combined view

The **stacked-layers** icon in the top bar merges all visible queries so each reaction appears **once**, even if several queries found it. In Metabolome Records, a reaction found by several queries shows several small colour bars.

Use it to see how much the routes to different compounds *overlap*; turn it off to see each query separately.

---

## Several targets in Path Finder

If two or more rows are **Cmpd** searches, Path Finder offers an **All targets** overlay and a **Shared** tab that shows where routes **diverge** and **merge**. See [Path Finder](view-path-finder#several-targets).

---

## Tips

- Compare the biosynthetic origins of related metabolites, for example `C00025` (L-Glutamate) and `C00041` (L-Alanine).
- Combined view plus [cofactor hiding](feature-cofactors) gives the cleanest overlap picture.
- Colours persist across viewers, so you can always tell which query a thing came from.
