# Hypergraphs and stoichiometry

This page explains the idea behind NEBULA's Reaction Network and why reactions look like *two boxes joined by a dashed line*.

---

## Why not just draw arrows between compounds?

Take the reaction

> A + B → C + D

A simple graph would draw four arrows (A→C, A→D, B→C, B→D). That throws away the most important fact: **A and B are needed together, at the same time, to make C and D together.** A route that supplies A but never B cannot work, yet a simple graph cannot tell the difference.

The standard way to keep this information comes from chemical reaction network theory [[7]](references#ref-7)[[8]](references#ref-8). In a **hypergraph**:

- the **vertices** are chemical species (compounds),
- each **hyperedge** is a reaction, and it connects *two sets* of vertices: the set of reactants and the set of products.

NEBULA stores every reaction this way, with its full reactant and product sets and their direction [[9]](references#ref-9).

---

## Complexes

In this vocabulary a **complex** is the set of species on one side of a reaction, with their stoichiometric coefficients. Every reaction has a **reactant complex** and a **product complex**.

In the Reaction Network, a complex is a **rounded rectangle**:

![A reaction drawn as a hypergraph](images/concept-hypergraph.png "One reaction (R00217) pinned in the Reaction Network. Numbered items are explained below.")

1. **Circle:** a compound (species).
2. **Solid line** from a compound to a complex: that compound takes part. A number on the line (2, 3 …) is how many molecules; no number means 1.
3. **Left rectangle:** the reactant complex (all reactants together).
4. **Dotted line:** joins a complex to its enzyme.
5. **Ellipse:** the enzyme (EC number). An enzyme takes part in the reaction but is not consumed, so it is not in the equation. This reaction has several possible enzymes, one ellipse each.
6. **Dashed line:** joins the reactant complex to the product complex. It *is* the reaction.
7. **Right rectangle:** the product complex (all products together).

---

## Why enzymes are in the graph

NEBULA adds a second layer to the stoichiometric one: **catalysis**. The enzyme (an EC number) is linked to the reactant and product complex of each reaction it catalyses. In turn each EC links to proteins, domains and structures. This makes the whole thing an *enzyme-annotated, stoichiometrically valid hypergraph* [[9]](references#ref-9).

Because one reaction can have several EC numbers, and one EC number can serve many reactions, these links are many-to-many. The [Protein Domain Viewer](view-protein-domains) is the way to explore them.

---

## One reaction, several rows

In the data, each reaction can appear in **both directions** (forward and reverse), and some reactions have **variants** that write a cofactor or metal explicitly (`R00470_v1`). See [Identifiers and data sources](concept-identifiers).

---

## Where you meet this in NEBULA

| Viewer | How hypergraph ideas show up |
|---|---|
| [Reaction Network](view-reaction-network) | The hypergraph itself: complexes, enzymes, stoichiometry. |
| [Path Finder](view-path-finder) | A reaction is a single square that needs *all* its inputs (the "AND" in [AND-OR logic](concept-and-or-paths)). |
| [Metabolic Map](view-metabolic-map) | A simplified projection: each reaction is shown as arrows between individual compounds, as KEGG does. |
| [Metabolome Records](view-metabolome-records) | The equation column lists all reactants and products of each reaction. |

**Further reading:** Feinberg, Horn and Jackson's formalism for reaction networks [[7]](references#ref-7)[[8]](references#ref-8); the NEBULA manuscript, "Representing Metabolic Spaces as Hypergraphs".
