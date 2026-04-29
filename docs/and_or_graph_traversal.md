# AND-OR Graph Traversal Algorithm

## Overview

NEBULA models metabolic networks as **directed B-hypergraphs** and performs backward reachability analysis using an **AND-OR graph traversal**. Given a target metabolite, the algorithm traces every possible biosynthetic route back to primordial (generation-0) seed compounds, building a tree that encodes all minimal pathways.

The core implementation lives in [`backend/app/core/hypergraph.py`](../backend/app/core/hypergraph.py).

---

## 1. Metabolic Networks as Directed B-Hypergraphs

A standard graph edge connects one node to one node. A **hyperedge** connects a *set* of nodes to another *set* of nodes. Metabolic reactions are naturally hyperedges:

```
Reaction R00479:  {C00311, Z00029}  ──→  {C00042, C00048, Z00029}
                   (reactants)              (products)
```

### Data Structures

| Concept | Class | Location |
|---------|-------|----------|
| Hyperedge (reaction) | `HyperEdge` | `hypergraph.py:32-47` |
| Hypergraph (full network) | `HyperGraph` | `hypergraph.py:50-126` |
| OR-node (compound) | `CompoundNode` | `hypergraph.py:133-141` |
| AND-node (reaction) | `ReactionNode` | `hypergraph.py:144-155` |

#### `HyperEdge` (frozen dataclass)

Each row in `simulations.csv` becomes one `HyperEdge`:

```python
@dataclass(frozen=True)
class HyperEdge:
    id: str                     # unique key, e.g. "R00479_v1_forward_123"
    reaction: str               # display name, e.g. "R00479_v1"
    reaction_id: str            # base KEGG reaction ID
    reactants: FrozenSet[str]   # e.g. frozenset({"C00311", "Z00029"})
    products: FrozenSet[str]    # e.g. frozenset({"C00042", "C00048", "Z00029"})
    reactant_gen: float
    product_gen: float
    generation: float           # (reactant_gen + product_gen) / 2
    ec_list: List[str]
    equation: str
    source: str
    coenzyme: str
    direction: str
```

#### `HyperGraph`

Built once at server startup via `HyperGraph.from_dataframe(df)`. Provides **O(1) adjacency lookups** through two indexes:

```python
produced_by[compound] -> List[HyperEdge]   # reactions that produce this compound
consumed_by[compound] -> List[HyperEdge]   # reactions that consume this compound
```

These indexes are populated during construction (`hypergraph.py:118-124`) by iterating every edge and registering each product/reactant.

---

## 2. The AND-OR Mapping

The metabolic hypergraph maps directly to an AND-OR graph:

| Network Concept | AND-OR Role | Semantics |
|-----------------|-------------|-----------|
| **Compound** (metabolite) | **OR-node** | Can be produced by *any one* of several reactions |
| **Reaction** | **AND-node** | Requires *all* of its reactants simultaneously |

This means:
- To produce compound C, pick **any one** reaction that yields C (OR-choice).
- To execute reaction R, you must supply **all** non-cofactor reactants of R (AND-requirement).

A **solution** (minimal pathway) is a subtree where exactly one producer is chosen at every OR-node, and all reactants are satisfied at every AND-node, terminating at valid leaves.

---

## 3. Backward Reachability Algorithm

**Entry point:** `backward_reachability()` at `hypergraph.py:162-323`

**Called by:** `MetabolicViewer.get_backtrace_tree()` in `viewer.py:304-372`

**API endpoint:** `GET /api/backtrace/tree?target=C00258&source=C00022,C00036`

### 3.1 Inputs

| Parameter | Type | Description |
|-----------|------|-------------|
| `graph` | `HyperGraph` | The pre-built hypergraph index |
| `target` | `str` | Target compound to trace (e.g. `"C00258"`) |
| `gen_mapper` | `Dict[str, float]` | Maps compound ID → generation number |
| `cofactors` | `Set[str]` | Compounds treated as ubiquitous (leaf nodes) |
| `sources` | `Set[str]` | Optional source compounds for pruning |
| `skip_cofactor` | `bool` | Whether cofactors are treated as leaves |

### 3.2 Algorithm: Recursive Expansion with Memoization

The traversal is a **depth-first recursive expansion** starting from the target compound, expanding backward through producing reactions.

#### Pseudocode

```
function expand_compound(compound, ancestor_path, depth):
    1. CHECK LEAF CONDITIONS
       - Is it a cofactor?        → return leaf node ("cofactor")
       - Is it a source compound? → return leaf node ("source")
       - Is it generation 0?      → return leaf node ("gen0")
       - Is it unknown?           → return leaf node ("unknown")

    2. CHECK MEMOIZATION
       - Already fully expanded?  → return shared reference node (is_shared=True)

    3. CREATE OR-NODE
       - Register in memo BEFORE recursion (breaks cycles via memoization)
       - Add compound to ancestor_path

    4. FIND PRODUCING REACTIONS
       - Lookup: graph.produced_by[compound]  (O(1))
       - Deduplicate by reaction name

    5. FOR EACH PRODUCING REACTION:
       a. GENERATION MONOTONICITY CHECK
          - Skip if reaction.generation > compound.generation
          (reactions must not come from a later generation than their product)

       b. CYCLE DETECTION
          - For each non-cofactor reactant:
            - If reactant is in ancestor_path → skip entire reaction
            (prevents infinite loops in cyclic pathways)

       c. RECURSIVE EXPANSION
          - For each non-cofactor reactant:
            - child = expand_compound(reactant, new_ancestor_path, depth+1)

       d. CREATE AND-NODE (ReactionNode)
          - Attach all expanded reactant children

    6. ATTACH PRODUCERS to OR-node
       - If no producers survived → mark as leaf ("no_producers")

    7. RETURN the OR-node
```

#### Concrete Code Walkthrough

**Step 1 — Leaf classification** (`hypergraph.py:204-216`):

```python
def _is_leaf(compound: str) -> Tuple[bool, str]:
    if compound in cofactor_set:    return True, "cofactor"
    if sources and compound in sources: return True, "source"
    gen = gen_mapper.get(compound, -1)
    if gen == 0:                    return True, "gen0"
    if gen == -1:                   return True, "unknown"
    return False, ""
```

**Step 2 — Memoization** (`hypergraph.py:237-245`):

When a compound has already been fully expanded, we return a lightweight `CompoundNode` with `is_shared=True`. This prevents re-expanding shared subgraphs (the DAG may converge at common intermediates). The shared node acts as a pointer — the frontend renders it as a dashed "reference" link.

```python
if compound in memo:
    stats["shared_compounds"] += 1
    return CompoundNode(id=compound, generation=gen, is_leaf=False, is_shared=True)
```

**Step 3 — Pre-registration** (`hypergraph.py:248-254`):

The node is added to `memo` *before* recursion begins. This is critical: if a descendant eventually references this compound, it will hit the memoization check (Step 2) instead of recursing infinitely.

```python
node = CompoundNode(id=compound, generation=gen)
memo[compound] = node
new_ancestor = ancestor_path | frozenset({compound})
```

**Step 4 — Producer lookup** (`hypergraph.py:257-263`):

Reactions are looked up via the O(1) `produced_by` index and deduplicated by reaction name (multiple DataFrame rows for the same reaction are merged).

```python
producing_edges = graph.produced_by.get(compound, [])
seen_reactions: Dict[str, List[HyperEdge]] = defaultdict(list)
for edge in producing_edges:
    seen_reactions[edge.reaction].append(edge)
```

**Step 5a — Generation monotonicity** (`hypergraph.py:270-271`):

The simulation model assigns each compound a generation number (the epoch at which it first appears). A reaction that belongs to a later generation than the compound it produces cannot be a valid backward step.

```python
if gen >= 0 and edge.generation > gen:
    continue
```

**Step 5b — Cycle detection** (`hypergraph.py:277-284`):

The `ancestor_path` is a `FrozenSet` of all compounds on the current DFS path from root to here. If a reactant is already on this path, expanding it would create a cycle — so the entire reaction branch is abandoned.

```python
for reactant in edge.reactants:
    if reactant in cofactor_set:
        continue  # cofactors are leaves, not expanded
    if reactant in ancestor_path:
        skip_reaction = True
        break
    child = expand_compound(reactant, new_ancestor, depth + 1)
```

> **Note:** Cycle-abandoned branches mean the AND-OR tree may miss some reactions that a plain BFS would find. This is by design — the tree is for *solution enumeration*, not exhaustive reaction listing. The separate `collect_flat_reactions()` BFS (see Section 6) provides the complete set.

### 3.3 Output

Returns `(root: CompoundNode, stats: dict)` where stats contains:

| Key | Description |
|-----|-------------|
| `total_compounds` | Number of compound nodes created |
| `total_reactions` | Number of reaction nodes created |
| `shared_compounds` | Compounds that were memoized (shared refs) |
| `max_depth` | Maximum recursion depth reached |

---

## 4. Post-Pass: Source Pruning

**Function:** `_prune_unreachable()` at `hypergraph.py:326-367`

When `sources` are specified, an optional post-pass removes branches that cannot reach any source compound. This is useful for answering "how can compound X be made *from* compounds Y and Z?"

### Pruning Rules

1. **Shared nodes** → always kept (they reference already-validated subtrees)
2. **Leaf nodes** → kept if `leaf_reason` is `source`, `gen0`, `cofactor`, or `unknown`; pruned if `no_producers`
3. **OR-nodes** → for each producing reaction (AND-node), *all* reactant subtrees must be reachable. If any reactant subtree is unreachable, the entire reaction is removed. If no reactions survive, the compound itself is pruned (returns `None`).

```python
for rxn in node.producers:
    all_reachable = True
    for child in rxn.reactants:
        pruned = _prune_unreachable(child, sources)
        if pruned is None:
            all_reachable = False
            break
    if all_reachable:
        surviving_producers.append(rxn)
```

---

## 5. Solution Enumeration

**Function:** `enumerate_solutions()` at `hypergraph.py:413-529`

Once the AND-OR tree is built, we enumerate all **minimal pathways** — distinct subsets of reactions that fully resolve the target compound down to valid leaves.

### Definition of a Solution

A solution is a subtree of the AND-OR DAG where:
- At every **OR-node** (compound): exactly **one** producing reaction is chosen
- At every **AND-node** (reaction): **all** non-cofactor reactants are included
- Every leaf is a valid terminal (source, gen-0, cofactor, etc.)

### Algorithm: Cross-Product Enumeration

Each solution is represented as a `FrozenSet[str]` of reaction names.

```
function solve_compound(node):
    if leaf or shared → return [{∅}]         # trivially satisfied
    if memoized      → return memo[node.id]

    memo[node.id] = []   # guard against infinite loops

    for each producing reaction rxn:          # OR-choice
        partial = [{rxn.reaction}]            # start with this reaction

        for each reactant child:              # AND-requirement
            child_solutions = solve_compound(child)
            if empty → this AND-branch fails, break

            # Cross-product: merge every partial with every child solution
            partial = [p ∪ c  for p in partial  for c in child_solutions]

        extend compound_solutions with partial

    memo[node.id] = compound_solutions
    return compound_solutions
```

### Combinatorial Explosion Guard

The cross-product can grow exponentially. A hard cap (`max_solutions`, default 500) terminates enumeration early:

```python
if len(new_partial) + len(compound_solutions) >= max_solutions:
    hit_limit = True
    break
```

### Output

Solutions are deduplicated by their reaction-name frozenset, then each solution's reactions are sorted by generation for readability. Returned as:

```json
[
  {
    "id": 0,
    "reactionCount": 5,
    "reactions": [
      {"reaction": "R00479_v1", "equation": "...", "ec_list": [...], ...},
      ...
    ]
  },
  ...
]
```

---

## 6. Flat Reaction Collection (BFS Complement)

**Function:** `collect_flat_reactions()` at `hypergraph.py:567-649`

The AND-OR tree may miss reactions in cycle-abandoned branches. For the table, 2D-network, and 3D views, a **complete** reaction set is needed. This function provides it via a simple BFS that does not build a tree structure.

### Algorithm

```
queue = {target}
processed = cofactors  (pre-mark cofactors as visited)

while queue not empty:
    compound = queue.pop()
    if processed or gen==0 or gen==-1 or gen > target_gen → skip

    producing = graph.produced_by[compound]  (O(1))
    deduplicate by reaction name, keep minimum product_gen
    filter to minimum product_gen batch

    for each reaction:
        record reaction
        enqueue all non-cofactor reactants
```

### Key Differences from AND-OR Tree

| Aspect | AND-OR Tree (`backward_reachability`) | Flat BFS (`collect_flat_reactions`) |
|--------|---------------------------------------|-------------------------------------|
| **Purpose** | Solution enumeration + tree view | Complete reaction list for table/graph views |
| **Cycle handling** | Skips entire reaction if any reactant is an ancestor (breaks logical cycles) | Skips already-visited compounds (standard BFS) |
| **Scope** | Only acyclic pathways — excludes reactions that would create circular dependencies (correct for solution enumeration) | All transitively reachable reactions regardless of cycles (correct for neighborhood exploration) |
| **Output** | Nested `CompoundNode`/`ReactionNode` tree | Flat list of reaction dicts |
| **Complexity** | Can be exponential in tree size (memoization helps) | O(V + E) BFS |

> **Why the difference in scope?** The AND-OR tree excludes reactions involved in cycles
> because they cannot participate in any valid acyclic biosynthetic pathway. For example,
> if producing compound A requires reaction R1 which needs compound B, and the only way to
> produce B is reaction R2 which itself requires A, then R2 is correctly excluded — using it
> would be circular reasoning. The flat BFS still records R2 because the table and graph
> views show the full connected reaction neighborhood, not just valid pathways.

---

## 7. Serialization & API Response

### Tree → JSON

**Function:** `tree_to_dict()` at `hypergraph.py:374-406`

Recursively converts the `CompoundNode`/`ReactionNode` tree into a JSON-serializable dict. Key conventions:
- `type: "compound"` or `type: "reaction"` discriminator
- `isLeaf`, `isShared`, `leafReason` on compound nodes
- `producers` array on compounds, `reactants` array on reactions
- Shared nodes have an empty `producers` array

### Unified Endpoint

**`GET /api/backtrace/tree`** (`viewer.py:304-372`, `main.py:78-107`)

A single API call returns everything the frontend needs:

```json
{
  "target": "C00258",
  "sources": [],
  "tree": { ... },           // AND-OR tree JSON (for Backtrace view)
  "stats": {                  // summary statistics
    "total_compounds": 129,
    "total_reactions": 120,
    "shared_compounds": 15,
    "max_depth": 12,
    "total_solutions": 91
  },
  "solutions": [ ... ],      // minimal pathways (for solutions panel)
  "data": [ ... ]            // flat reaction list (for table/2D/3D views)
}
```

---

## 8. Frontend Rendering

The AND-OR tree is rendered as an interactive collapsible tree in:
- **`HypergraphTreeView/index.jsx`** — container with header, stats, legend, expand/collapse controls, and the Minimal Pathways side panel
- **`HypergraphTreeView/TreeNode.jsx`** — recursive rendering of `CompoundNode` (OR) and `ReactionNode` (AND)

### Visual Mapping

| Node Type | Color | Shape | Expandable |
|-----------|-------|-------|------------|
| Metabolite (OR) | Cyan/teal | Circle dot | Yes — shows producing reactions |
| Reaction (AND) | Violet | Square dot | Yes — shows required reactants |
| Root compound | Cyan with ring | Circle dot (larger) | Yes |
| Leaf: Seed (gen-0) | Blue | Circle dot | No |
| Leaf: Source | Green | Circle dot | No |
| Leaf: Cofactor | Stone/gray | Circle dot | No |
| Leaf: Dead end | Orange | Circle dot | No |
| Shared reference | Dashed border | Link icon | No |

### Solution Highlighting

When a user selects a minimal pathway from the side panel, the tree:
1. Computes the set of reaction names in that solution
2. Walks the tree to find all nodes on the solution's path
3. Expands only those nodes
4. Dims (opacity 20%) all reactions *not* in the active solution
5. Highlights active reactions with a green color scheme

---

## 9. Complexity Analysis

| Phase | Time Complexity | Space Complexity |
|-------|-----------------|------------------|
| **Hypergraph construction** | O(E) where E = rows in simulations.csv | O(E + V) |
| **Backward reachability** | O(V × E) worst case, memoization avoids re-expansion | O(V) for memo + O(D) for ancestor path |
| **Source pruning** | O(T) where T = tree size | O(D) recursion depth |
| **Solution enumeration** | O(S × R) where S = solutions, R = avg reactions/solution; capped at 500 | O(S × R) |
| **Flat BFS** | O(V + E) standard BFS | O(V) |

Where V = compounds, E = reactions, D = max depth, T = tree nodes, S = solution count.

---

## 10. Worked Example

Tracing **C00258** (glycerate):

```
C00258 (gen 4)                         ← OR-node: target
├── R01513_v1 (gen 3.5)                ← AND-node: reaction choice 1
│   ├── C00631 (gen 3)                 ← OR-node: must supply this reactant
│   │   ├── R00658_v1 (gen 2.5)        ← AND-node
│   │   │   ├── C00074 (gen 2)         ← OR-node
│   │   │   │   └── ...                ← continues backward
│   │   │   └── C00001 (gen 0)         ← LEAF: seed (gen-0)
│   │   └── R01518_v1 (gen 2.5)        ← AND-node: alternative reaction
│   │       └── ...
│   └── Z00029 [cofactor]              ← LEAF: cofactor (skipped)
├── R00014_v2 (gen 3.0)                ← AND-node: reaction choice 2
│   ├── C00197 (gen 2)                 ← continues...
│   └── ...
└── R01514_v1 (gen 3.5)                ← AND-node: reaction choice 3
    └── C00258 [cycle → SKIP]          ← cycle detected, reaction abandoned
```

**Reading the tree:**
- C00258 is an **OR-node** — it can be produced by R01513, R00014, or R01514 (any one suffices)
- R01513 is an **AND-node** — it requires *both* C00631 and Z00029
- Z00029 is a cofactor → treated as a leaf, not traced further
- R01514 references C00258 itself → cycle detected, branch abandoned

**A minimal pathway** would be one path from C00258 down to all-leaf terminals, choosing exactly one reaction at each compound.
