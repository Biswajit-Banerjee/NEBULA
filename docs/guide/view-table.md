# Table View

The **Table** view is the default results display. Every reaction from your search appears in a sortable, scrollable data table — the quickest way to scan and filter your results.

---

## Columns

| Column       | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| **Reaction** | KEGG reaction ID (e.g. R01713)                                   |
| **Equation** | Full reaction equation showing substrates → products             |
| **EC**       | Enzyme Commission classification                                 |
| **Gen**      | The generation at which this reaction first appears in the trace |
| **Pair**     | Which search chip produced this result                           |

---

## Selecting Rows

- **Click** a row to select it — the corresponding reaction is highlighted in all other views.
- **Shift+Click** to select a range.
- Selections are **synced across views**: a row selected here lights up in the 2D/3D network and on the KEGG map.

---

## Sorting and Browsing

Click any column header to sort. The table loads all results at once, so you can also use your browser's built-in search (`Ctrl+F` / `Cmd+F`) for quick text lookup.

---

## Tips

- Pair the table with a network in [Split View](feature-split-view) to browse data while seeing the graph.
- Use [Cofactor Filtering](feature-cofactors) to hide ubiquitous metabolites and focus on the core transformations.
- Row selection carries across every view — select in the table, see it highlighted in 2D, 3D, Map, or Backtrace.
