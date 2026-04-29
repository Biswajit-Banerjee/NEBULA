# Search Modes

NEBULA supports three search modes, each designed for a different entry point into the metabolic network. Switch modes using the dropdown in the search panel.

---

## Compound Search

The primary mode. Given a **target compound** (KEGG ID like `C00025`), NEBULA performs a backward reachability analysis to find every reaction that can produce the compound from primordial metabolites.

### How It Works

1. Enter a KEGG compound ID in the **Target** field (e.g. `C00025` for L-Glutamate).
2. Click **Search**.
3. NEBULA traces all biosynthetic routes backward from the target to generation-0 seed compounds.
4. Results include all intermediate reactions and compounds along the way.

### What You Get

- **Reactions** — every reaction involved in producing the target
- **Compounds** — all metabolites encountered along the trace
- **Solutions** — minimal pathway sets (AND-OR tree solutions)
- **Tree** — full AND-OR backward reachability tree (visible in the [Backtrace](view-backtrace) view)

> **Example:** Searching for `C00025` (L-Glutamate).

---

## Example: 
Reaction Search - Look up a specific reaction by its **KEGG reaction ID** (e.g. `R01713`).
EC Number Search - Search by **Enzyme Commission number** (e.g. `4.2.3.1`) to find all reactions catalyzed by that enzyme class.

## Autocomplete

All search fields support **autocomplete**. Start typing a KEGG ID or name and NEBULA will suggest matching entries. Select from the dropdown to fill in the field.

---

## See Also

- [Multi-Search & Chips](feature-multi-search) — running multiple queries and comparing them
- [Table View](view-table) — browsing your results
