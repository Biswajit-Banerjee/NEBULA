# What is NEBULA?

**NEBULA** (**N**etwork of **E**nzymatic **B**iochemical **U**nits, **L**inks, and **A**ssociations) is an interactive metabolic network explorer built for anyone studying metabolism.

Given a compound, reaction, or enzyme, NEBULA traces the full metabolic context — every reaction that can produce it, every substrate it needs, and every enzyme that catalyzes it — then lets you explore the results through multiple synchronized views.

---

## Interface Layout

The interface is organized into three areas:

- **Top Bar** — The search dock where you enter queries, manage search chips, toggle cofactor filtering, and import/export sessions.
- **View Area** — The main canvas that displays your results in whichever view mode is active.
- **View Switcher** — The bottom pill bar that lets you switch between Table, 2D, 3D, Map, and Backtrace views.

---

## Quick Workflow

1. **Pick a search mode** — Compound, Reaction, or EC number.
2. **Enter your query** — type a KEGG ID (e.g. `C00025` for L-Glutamate) and select from autocomplete.
3. **Hit Search** — results load into the active view.
4. **Switch views** — use the bottom bar to see the same data as a table, network graph, metabolic map, or reachability tree.
5. **Compare** — add more search chips with the **+** button to overlay multiple queries.

> **Tip:** Click the **?** help button from any view to jump straight to that view's documentation.

---

## What Can You Do?

- **Trace biosynthetic origins** — find every route from seed/source compounds to your target compound including all intermidates and enzymes.
- **Look up reactions** — see substrates, products, enzymes, and generation data for any KEGG reaction.
- **Search by enzyme** — find all reactions catalyzed by a given EC number.
- **Visualize** — explore results as interactive 2D/3D networks, KEGG metabolic maps, or AND-OR reachability trees.
- **Compare** — run multiple searches and overlay them with color-coded queries.
- **Filter** — hide common cofactors to focus on core metabolic transformations.
- **Export** — save and restore your entire session for later.

---

## Next Steps

- [Table View](view-table) — The default results display
- [Search Modes](feature-search) — Compound, reaction, and EC searches explained
- [Multi-Search & Queries](feature-multi-search) — Running and comparing multiple queries
