# Backtrace

The **Backtrace** view displays the AND-OR backward reachability tree for a compound search. It answers the question: *"How can this metabolite be synthesized from primordial compounds?"*

> This view is only available for **compound searches**. For the first compound chip searched, tree data loads automatically.

---

## What is Backward Reachability?

Given a target compound, NEBULA traces backward through the metabolic network:

1. Find all reactions that **produce** the target.
2. For each reaction, identify its **substrates** (required inputs).
3. Recursively trace each substrate until reaching **source** or **seed** compounds (generation-0).

The result is a tree encoding every possible biosynthetic route.

---

## AND-OR Tree Structure

The tree uses AND-OR logic to represent metabolic dependencies:

| Node Type       | Meaning                                                                    | Color   |
| --------------- | -------------------------------------------------------------------------- | ------- |
| **Metabolite**  | A compound that can be produced by **any one** of its child reactions (OR) | Teal    |
| **Reaction**    | A reaction that requires **all** of its substrates (AND)                   | Indigo  |
| **Primordial**  | A generation-0 seed compound — leaf node, no further tracing               | Labeled |
| **Dead end**    | A compound that cannot be traced further in the network                    | Labeled |

### Reading the Tree

- **Metabolite nodes (OR):** The compound can be made by *any* of the reactions below it — these represent alternative biosynthetic routes.
- **Reaction nodes (AND):** *All* substrates listed below a reaction must be available for it to proceed.

---

## Minimal Pathways Panel

The right-side panel lists **Minimal Pathways** — the smallest sets of reactions that can produce the target from primordial compounds:

- Each pathway is numbered and shows its reaction steps with equations.
- Click a pathway to highlight its reactions in the tree.
- Solutions are capped at **500** to keep the UI responsive.

---

## Stats Bar

The header shows key metrics:

- **Metabolites** — unique compounds in the tree
- **Reactions** — unique reactions in the tree
- **Depth** — maximum tree depth (longest pathway)

---

## Tips

- Large trees (e.g. `C00251` with 890+ reactions) may take a few seconds to render.
- Use the Minimal Pathways panel to focus on specific biosynthetic routes rather than the full tree.
- The tree is for understanding biosynthetic logic; the [Table](view-table) and [Network](view-network-2d) views show the complete flat reaction set.
