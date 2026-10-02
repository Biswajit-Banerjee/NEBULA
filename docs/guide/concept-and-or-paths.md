# AND-OR logic and Paths

Path Finder does not list "a" route to your target. It lists **every minimal route that can actually run**. This page explains what that means and how to read the numbers.

---

## AND and OR

Metabolic reachability has an **AND-OR** structure [[11]](references#ref-11):

- A **reaction is an AND**. It needs *all* of its substrates (apart from cofactors, which are assumed available). If one substrate cannot be made, the reaction cannot run.
- A **compound is an OR**. It can be supplied by *any one* of the reactions that make it. Several producers means several alternatives.

So a route to a target is not a line of compounds. It is a *reaction-centred subgraph*: each chosen reaction needs all its inputs, and each input is supplied by one of its alternative upstream reactions. Incomplete reactions are never traversed, which is how NEBULA avoids the "shortcut through ATP" problem of simple-graph pathfinders [[9]](references#ref-9).

| In the drawing | Logic |
|---|---|
| Square (reaction) | **AND**: all inputs required |
| Circle (compound) | **OR**: any producing reaction will do |
| Dashed ring on a circle | an **OR with two or more alternatives**: a **branch point** |

---

## What is a Path?

A **Path** is a *minimal, cycle-free set of reactions* that makes the target from seed compounds (and any source you gave) [[9]](references#ref-9)[[12]](references#ref-12)[[27]](references#ref-27)[[28]](references#ref-28):

1. every reaction's inputs are available before it runs (from seeds, sources, cofactors or other reactions in the Path);
2. no reaction can be removed without the target becoming unreachable;
3. there are no circular dependencies.

This is a *constructive* definition of a pathway: it does not depend on any organism's genome or on how a database labels its maps [[9]](references#ref-9).

---

## How NEBULA finds Paths

1. **Forward pass.** Network expansion from the seeds (plus sources) works out which reactions can ever fire and at which layer. Reactions that can never fire are dropped.
2. **Backward pass.** From the target, NEBULA walks back through producing reactions and prunes everything that cannot contribute. What remains is the **route graph**, drawn in Path Finder.
3. **Enumeration.** A best-first search picks one producer for every compound the route needs, shortest first. Each finished Path is reduced to a minimal set and checked by forward simulation. Results are de-duplicated and sorted.

Every Path shown has passed the independent simulation check: it makes the target from the starting compounds, and removing any reaction breaks it.

---

## Numbers you will see

| Number | Meaning |
|---|---|
| **distinct routes** (big number at the top left) | How many different Paths exist. A **+** (for example `6000+`) means the list was capped. |
| **steps** | Number of reactions in the Path. |
| **depth** | The longest chain of reactions that must run one after another. Two reactions that can run in parallel count once toward depth but twice toward steps. |
| **shortest** badge | The Path with the fewest reactions. |
| **vs path 1: +2 −1** | Compared with the shortest Path, this one adds 2 reactions and drops 1. |
| **layers badge with a number** | That many *equivalent combinations* were grouped into one card because they differ only in interchangeable steps (for example several ways to make a shared cofactor-like precursor). |
| **% of Paths** | The share of the listed Paths that use a compound or reaction. This is the *line width* in the graph. |

> **Note:** Counting every possible Path is combinatorial, and some targets have tens of thousands. NEBULA lists the shortest first, and the graph always draws every parallel reaction, even when the list is capped. See below.

---

## Route modes

The toolbar has two modes:

| Mode | Rule | Use it when |
|---|---|---|
| **All parallel routes** (default) | A producer is allowed if its substrates were reached *no later than* its product. Includes parallel and same-generation (*lateral*) reactions. | You want every real alternative. |
| **Earliest only** | Only *strictly generation-increasing* routes: every substrate exists before its product. | You want the cleanest, most "forward" routes. |

Switching mode re-runs the search for every compound query.

---

## When the list is capped

NEBULA enumerates up to 6,000 Paths at first. If there are more:

- the summary says so (the route count ends in **+**);
- the **shortest** Paths are listed;
- reactions that are not in any listed Path are still drawn, as **hollow squares with dashed lines**;
- **Search deeper** re-runs the enumeration with a larger cap (up to 20,000).

---

## Several targets

With more than one compound query, **All targets** overlays their route graphs. Two extra ideas appear:

- **Diverges:** routes to different targets split at this compound.
- **Merges:** different targets reach this compound by different reactions.

See [Path Finder](view-path-finder#several-targets).
