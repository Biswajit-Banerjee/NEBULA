# Pathway Search (AND-OR Hyperpath Enumeration)

> Developer notes. For the user-facing explanation (Path Finder, symbols, route modes) see [`docs/guide/concept-and-or-paths.md`](guide/concept-and-or-paths.md) and [`docs/guide/view-path-finder.md`](guide/view-path-finder.md). Terminology follows the NEBULA manuscript: seed compounds (generation 0), source compounds, Paths.

## Overview

NEBULA models the metabolic network as a **directed B-hypergraph** (compounds are
nodes, reactions are hyperedges from a *set* of substrates to a *set* of products).
Read as an AND-OR graph, **compounds are OR-nodes** (any one producing reaction is
enough) and **reactions are AND-nodes** (all substrates are required).

A *pathway* from the starting compounds to a target is a **minimal, cycle-free
hyperpath** (Carbonell et al., *BMC Syst Biol* 2012; Gallo et al. 1993):

- every compound on it is produced by exactly one reaction of the path (or is a
  starting compound),
- every reaction's substrates are all available before it fires,
- no reaction can be removed without the target becoming unreachable.

Implementation: [`backend/app/core/hypergraph.py`](../backend/app/core/hypergraph.py) → `find_pathways()`.

---

## 1. Why the previous algorithm was replaced

The earlier backward AND-OR tree + cross-product enumeration returned paths that
were neither complete nor accurate. An audit (forward-simulating every returned
path) found:

| Defect | Effect |
|---|---|
| Any leaf (dead end, unknown compound, depth limit) counted as "resolved" | paths that cannot actually produce the target |
| When the solution cap was hit, partially-merged AND branches were still emitted | Incomplete paths (0 of 288 paths for C00251 and 0 of 374 for C00064 were valid) |
| Same compound resolved independently in different branches | Redundant, non-minimal reaction sets (every path for C00064 was non-minimal) |
| Memoisation depended on the DFS ancestor context and on Python's per-process hash seed | Results differed between runs; routes were silently lost |
| Source pruning kept shared references and treated gen-0 leaves as reachable | The source filter had almost no effect |

---

## 2. The algorithm

### 2.1 Forward pass: network expansion (`forward_expansion`)

Starting set `S = seeds (generation 0) ∪ cofactors ∪ user sources`. Reactions fire
in layers: a reaction fires at layer `1 + max(layer of its non-cofactor
substrates)`, and its products get that layer if they are new. This is the
standard scope / network-expansion computation. A reaction that never fires can
never be part of a real pathway, so it is discarded. The layers it computes are
the same as the simulation generations in `generations.csv`.

### 2.2 Backward pass: route pruning (`backward_relevance`, `prune_producers`)

Starting from the target, we walk backwards over producing reactions that fired.
Which producers are allowed for a compound `c` depends on the mode:

| Mode (API `mode`) | Rule | Meaning |
|---|---|---|
| `parallel` (default) | substrates reached **no later** than `c` | Every route, including **parallel** reactions and same-generation (lateral) conversions |
| `earliest` | substrates reached **strictly before** `c` | Only strictly generation-increasing routes |

Producers that consume `c` itself or the target are always circular, so they are
dropped. A fixpoint (Friedler-style) pruning then alternately removes reactions
that cannot fire using only the remaining route reactions, and compounds that are
no longer needed for the target. The result is the **route graph**. Everything
that branches away from the target is cut off here.

### 2.3 Enumeration (`enumerate_hyperpaths`)

This is a best-first search over partial solutions. A state assigns **one**
producing reaction to every compound required so far:

1. Pick the open compound closest to the target (highest layer).
2. If a reaction already in the path also yields it (a side product), re-use that
   reaction. This is where branches **merge**: shared intermediates are produced
   once.
3. Otherwise branch over its admissible producers, ordered by an additive cost
   estimate so that short routes come first. A producer is skipped if any of its
   substrates depends, through reactions already chosen, on the compound itself
   (cycle check).
4. With sources: states that can no longer consume a source are pruned, and only
   paths that consume at least one source are kept.

Every finished path is then **reduced to an inclusion-minimal reaction set**. Any
removal candidate is checked by forward simulation. paths are deduplicated and
sorted by length. The search is deterministic.

Enumeration stops at `max_paths` (default 2 000, up to 20 000 via "Search
deeper") or at the time budget. When it stops early, `stats.truncated = true`,
and the route graph still includes **every** admissible parallel reaction (those
outside the listed paths have `pathCount = 0`).

### 2.4 Validation

Every path returned by the current implementation passed an independent
forward-simulation test: it produces the target from the starting compounds, and
removing any one reaction breaks it. This held for C00258, C00037, C00025, C00064
(with and without source C00025), C00002 and C00251, in both modes.

---

## 3. API

`GET /api/backtrace/tree?target=C00064&source=C00025&mode=parallel&max_paths=2000`

```json
{
  "target": "C00064",
  "graph": {
    "compounds": [{"id", "level", "generation", "role", "pathCount", "producerCount"}],
    "reactions": [{"id", "reaction", "direction", "equation", "ecList", "level",
                   "reactants", "products", "sideProducts", "cofactors", "pathCount"}]
  },
  "solutions": [{"id", "reactionCount", "depth", "reactionIds", "steps", "precursorCount"}],
  "stats": {"total_solutions", "truncated", "relevant_reactions", "target_level", "message", ...},
  "data": [ ...flat reaction rows for Table / 2D / 3D / Map... ]
}
```

- `role` is one of `target | source | seed | intermediate`.
- `reactionIds` are listed in firing order; `steps` gives the step at which each fires.
- `products` lists only the compounds a reaction actually supplies on some route.
- `data` always contains every reaction of every listed path, so focusing a path in
  another viewer never leaves gaps.

---

## 4. Complexity

The forward and backward passes are O(V + E). Counting hyperpaths is #P-hard and
their number grows combinatorially (C00064 already has more than 10 000 minimal
paths in `parallel` mode). That is why enumeration is capped and ordered
shortest-first, while the route graph always shows every parallel option.
