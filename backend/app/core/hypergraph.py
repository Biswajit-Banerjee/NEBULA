"""
Directed B-Hypergraph data structure and pathway (hyperpath) search
for metabolic network pathway analysis.

A metabolic network is naturally a directed B-hypergraph where:
  - Nodes = metabolites (compounds C/Z)
  - Hyperedges = reactions, each mapping a SET of reactants -> SET of products

This maps to an AND-OR graph:
  - OR-nodes = compounds (can be produced by ANY of several reactions)
  - AND-nodes = reactions (require ALL reactants simultaneously)

A pathway is a minimal, cycle-free hyperpath from the available compounds
(seeds / sources / cofactors) to the target — see ``find_pathways``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from collections import defaultdict
from typing import Dict, List, Set, FrozenSet, Optional, Any, Tuple

import pandas as pd
import numpy as np


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

COMPOUND_RE = re.compile(r"[CZ]\d{5}")


@dataclass(frozen=True)
class HyperEdge:
    """A single directed hyperedge (reaction) in the metabolic hypergraph."""
    id: str                     # unique row key, e.g. "R00479_v1_forward"
    reaction: str               # display name, e.g. "R00479_v1"
    reaction_id: str            # base reaction ID, e.g. "R00479"
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


class HyperGraph:
    """
    Directed B-hypergraph built from simulations.csv.

    Provides O(1) adjacency lookups:
      - produced_by[compound] -> list of HyperEdges that produce compound
      - consumed_by[compound] -> list of HyperEdges that consume compound
    """

    def __init__(self):
        self.edges: Dict[str, HyperEdge] = {}
        self.produced_by: Dict[str, List[HyperEdge]] = defaultdict(list)
        self.consumed_by: Dict[str, List[HyperEdge]] = defaultdict(list)
        self.all_compounds: Set[str] = set()

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame) -> "HyperGraph":
        """Build the hypergraph from a simulations DataFrame."""
        graph = cls()

        for row in df.itertuples(index=True):
            reactants_str = str(getattr(row, "reactants", ""))
            products_str = str(getattr(row, "products", ""))

            reactant_set = frozenset(COMPOUND_RE.findall(reactants_str))
            product_set = frozenset(COMPOUND_RE.findall(products_str))

            if not reactant_set and not product_set:
                continue

            # Parse EC list
            ec_raw = getattr(row, "ec_list", "")
            if pd.isna(ec_raw) or ec_raw == "":
                ec_list = []
            else:
                ec_list = [e.strip() for e in str(ec_raw).split(",") if e.strip()]

            # Unique edge key: reaction name + direction + row index for uniqueness
            idx = row.Index
            reaction_name = str(getattr(row, "reaction", f"R_{idx}"))
            direction = str(getattr(row, "direction", "forward"))
            edge_id = f"{reaction_name}_{direction}_{idx}"

            coenzyme = getattr(row, "coenzyme", "")
            if pd.isna(coenzyme):
                coenzyme = ""

            source = getattr(row, "source", "")
            if pd.isna(source):
                source = ""

            edge = HyperEdge(
                id=edge_id,
                reaction=reaction_name,
                reaction_id=str(getattr(row, "reaction_id", "")),
                reactants=reactant_set,
                products=product_set,
                reactant_gen=float(getattr(row, "reactant_gen", 0) or 0),
                product_gen=float(getattr(row, "product_gen", 0) or 0),
                generation=float(getattr(row, "generation", 0) or 0),
                ec_list=ec_list,
                equation=str(getattr(row, "equation", "")),
                source=source,
                coenzyme=coenzyme,
                direction=direction,
            )

            graph.edges[edge_id] = edge

            for compound in product_set:
                graph.produced_by[compound].append(edge)
                graph.all_compounds.add(compound)

            for compound in reactant_set:
                graph.consumed_by[compound].append(edge)
                graph.all_compounds.add(compound)

        return graph


# ---------------------------------------------------------------------------
# Pathway search
#
#   1. Forward pass  — network expansion from the available compounds
#                      (seeds / sources / cofactors). A reaction can only
#                      participate in a real pathway if ALL its substrates
#                      are producible, so everything that never fires is
#                      discarded, and each compound/reaction gets a layer.
#   2. Backward pass — from the target, walk producers that fired in the
#                      forward pass. Anything not on a route to the target
#                      is cut off.
#   3. Enumeration   — best-first search for minimal, cycle-free hyperpaths
#                      in the pruned sub-hypergraph. Every compound in a
#                      path has exactly ONE producing reaction (shared
#                      intermediates are produced once and re-used, which is
#                      where branches merge), and every path is re-validated
#                      by forward simulation before it is returned.
# ---------------------------------------------------------------------------

INF = float("inf")


@dataclass
class Expansion:
    """Result of the forward network-expansion pass."""
    base: FrozenSet[str]
    compound_level: Dict[str, int]
    reaction_level: Dict[str, int]  # edge id -> layer at which it first fires


def forward_expansion(
    graph: HyperGraph,
    base: Set[str],
    cofactors: Set[str],
) -> Expansion:
    """Layered network expansion (scope computation) from ``base``.

    Layer 0 = base compounds. A reaction fires at layer ``1 + max(layer of
    its non-cofactor substrates)`` and its products receive that layer if
    they have not been reached yet.
    """
    level: Dict[str, int] = {c: 0 for c in base}
    rxn_level: Dict[str, int] = {}
    need: Dict[str, int] = {}
    ready: List[HyperEdge] = []
    for eid, e in graph.edges.items():
        n = len(e.reactants - cofactors)
        need[eid] = n
        if n == 0:
            ready.append(e)

    frontier = [c for c in base if c not in cofactors]
    layer = 0
    while True:
        for c in frontier:
            for e in graph.consumed_by.get(c, ()):
                need[e.id] -= 1
                if need[e.id] == 0:
                    ready.append(e)
        if not ready:
            break
        layer += 1
        new: List[str] = []
        for e in ready:
            if e.id in rxn_level:
                continue
            rxn_level[e.id] = layer
            for p in e.products:
                if p not in level:
                    level[p] = layer
                    new.append(p)
        ready = []
        frontier = new

    return Expansion(frozenset(base), level, rxn_level)


def backward_relevance(
    graph: HyperGraph,
    target: str,
    expansion: Expansion,
    cofactors: Set[str],
    rule: str = "monotone",
) -> Dict[str, List[HyperEdge]]:
    """Collect, for every compound on some route to ``target``, the fired
    reactions that can produce it.

    ``rule`` controls which producers are admissible for a compound ``c``:
      - "strict":   all substrates reached strictly before ``c`` (earliest
                    routes only)
      - "monotone": all substrates reached no later than ``c`` — also admits
                    parallel / lateral same-generation reactions
      - "any":      every fired producer, including detours through
                    later-generation compounds
    Cycles are resolved during enumeration.
    """
    level = expansion.compound_level
    rxn_level = expansion.reaction_level
    base = expansion.base
    producers: Dict[str, List[HyperEdge]] = {}
    stack = [target]
    seen = {target}
    while stack:
        c = stack.pop()
        if c in base:
            continue
        cands: List[HyperEdge] = []
        for e in graph.produced_by.get(c, ()):
            if e.id not in rxn_level:
                continue
            inputs = e.reactants - cofactors
            # Needs itself or the final target to be made → always circular.
            if c in inputs or target in inputs:
                continue
            if rule == "strict" and rxn_level[e.id] > level[c]:
                continue
            if rule == "monotone" and rxn_level[e.id] > level[c] + 1:
                continue
            cands.append(e)
            for r in inputs:
                if r not in seen:
                    seen.add(r)
                    stack.append(r)
        producers[c] = cands
    return producers


def prune_producers(
    target: str,
    producers: Dict[str, List[HyperEdge]],
    base: FrozenSet[str],
    cofactors: Set[str],
) -> Dict[str, List[HyperEdge]]:
    """Fixpoint pruning of the backward route graph (cf. Friedler et al.):
    repeatedly drop reactions that cannot fire using only the remaining
    route reactions (forward), and compounds/reactions no longer needed to
    reach the target (backward), until nothing changes."""
    edges = {e.id: e for es in producers.values() for e in es}
    while True:
        avail = set(base)
        fired: Set[str] = set()
        changed = True
        while changed:
            changed = False
            for eid, e in edges.items():
                if eid not in fired and (e.reactants - cofactors) <= avail:
                    fired.add(eid)
                    avail |= e.products
                    changed = True
        needed = {target}
        keep: Set[str] = set()
        stack = [target]
        while stack:
            c = stack.pop()
            for e in producers.get(c, ()):
                if e.id in fired and e.id in edges:
                    keep.add(e.id)
                    for r in e.reactants - cofactors:
                        if r not in needed and r not in base:
                            needed.add(r)
                            stack.append(r)
        if keep == set(edges):
            break
        edges = {eid: edges[eid] for eid in keep}
    return {
        c: [e for e in es if e.id in edges]
        for c, es in producers.items()
        if c in needed
    }


def _hyperpath_costs(
    producers: Dict[str, List[HyperEdge]],
    base: FrozenSet[str],
    cofactors: Set[str],
    rxn_level: Dict[str, int],
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """Additive (Knuth-style) cost estimate: cost(c) = min over producers of
    1 + Σ cost(substrates). Used only to order the search so that short
    routes are found first."""
    edges = sorted({e.id: e for es in producers.values() for e in es}.values(),
                   key=lambda e: (rxn_level[e.id], e.id))
    cost: Dict[str, float] = {c: 0.0 for c in base}
    ecost: Dict[str, float] = {}
    for _ in range(64):
        changed = False
        for e in edges:
            ec = 1.0 + sum(cost.get(r, INF) for r in e.reactants - cofactors)
            ec = min(ec, 1e9)
            if ec < ecost.get(e.id, INF):
                ecost[e.id] = ec
            for p in e.products:
                if p in producers and ec < cost.get(p, INF):
                    cost[p] = ec
                    changed = True
        if not changed:
            break
    return cost, ecost


def _simulate(
    edges: List[HyperEdge],
    available: Set[str],
    cofactors: Set[str],
) -> Tuple[Set[str], Dict[str, int]]:
    """Forward-simulate a set of reactions. Returns (reachable compounds,
    edge id -> step at which it fires)."""
    avail = set(available)
    step_of: Dict[str, int] = {}
    pending = list(edges)
    step = 0
    while pending:
        step += 1
        fired = [e for e in pending if (e.reactants - cofactors) <= avail]
        if not fired:
            break
        for e in fired:
            step_of[e.id] = step
            avail |= e.products
        pending = [e for e in pending if e.id not in step_of]
    return avail, step_of


def _cluster_solutions(
    results: List[List[HyperEdge]],
    edge_by_id: Dict[str, HyperEdge],
) -> List[Dict[str, Any]]:
    """Group minimal hyperpaths that only differ by swapping a single
    reaction for another producing the same compound(s) ("one-node
    alternates" — e.g. two ways to make a common precursor). Everything
    else in the path is identical, so these combinations are the same
    biological route and would otherwise multiply combinatorially when
    several such swaps are independent.

    Two solutions are linked when their reaction-id sets differ by exactly
    one reaction on each side (found via a leave-one-out hash so this is
    O(n · path length) instead of O(n²)); linked solutions are merged into
    a cluster via union-find, which also transitively collapses whole
    families of independent swaps into a single group.
    """
    n = len(results)
    sigs: List[FrozenSet[str]] = [frozenset(e.id for e in edges) for edges in results]

    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    by_len: Dict[int, List[int]] = defaultdict(list)
    for i, sig in enumerate(sigs):
        by_len[len(sig)].append(i)

    swap_pairs: List[Tuple[int, int, str, str]] = []
    for idxs in by_len.values():
        loo: Dict[FrozenSet[str], List[Tuple[int, str]]] = defaultdict(list)
        for i in idxs:
            sig = sigs[i]
            for rid in sig:
                loo[sig - {rid}].append((i, rid))
        for entries in loo.values():
            if len(entries) < 2:
                continue
            base_i, base_rid = entries[0]
            for i, rid in entries[1:]:
                if rid == base_rid:
                    continue  # identical signature, not a real swap
                union(base_i, i)
                swap_pairs.append((base_i, i, base_rid, rid))

    groups: Dict[int, List[int]] = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)

    cluster_swap_reactions: Dict[int, Set[str]] = defaultdict(set)
    for a, _b, rid_a, rid_b in swap_pairs:
        root = find(a)
        cluster_swap_reactions[root].add(rid_a)
        cluster_swap_reactions[root].add(rid_b)

    clusters: List[Dict[str, Any]] = []
    for root, members in groups.items():
        members_sorted = sorted(members, key=lambda i: (len(sigs[i]), sorted(sigs[i])))
        rep = members_sorted[0]
        # Group the swapped reactions by the compound(s) they produce, so
        # the UI can say "N ways to make X" instead of listing raw ids.
        slot_map: Dict[FrozenSet[str], Set[str]] = defaultdict(set)
        for rid in cluster_swap_reactions.get(root, ()):
            slot_map[frozenset(edge_by_id[rid].products)].add(rid)
        swaps_out = [
            {"compounds": sorted(prods), "reactions": sorted(rids)}
            for prods, rids in slot_map.items() if len(rids) > 1
        ]
        clusters.append({
            "members": members_sorted,
            "representative": rep,
            "swaps": swaps_out,
        })

    clusters.sort(key=lambda c: (len(sigs[c["representative"]]), c["representative"]))
    return clusters


def enumerate_hyperpaths(
    target: str,
    producers: Dict[str, List[HyperEdge]],
    expansion: Expansion,
    cofactors: Set[str],
    sources: Set[str] | None = None,
    max_solutions: int = 200,
    max_expansions: int = 150_000,
    time_limit: float = 6.0,
) -> Tuple[List[List[HyperEdge]], Dict[str, Any]]:
    """Best-first enumeration of minimal cycle-free hyperpaths to ``target``.

    A search state assigns ONE producing reaction to every compound that is
    required so far. The next open compound (closest to the target first)
    is branched over its producers; compounds already produced by a chosen
    reaction are re-used rather than produced again (this is what makes
    branches merge instead of duplicating sub-trees).

    If ``sources`` is given, only paths that consume at least one source
    compound are returned.
    """
    import heapq
    import itertools
    import time

    base = expansion.base
    level = expansion.compound_level
    sources = sources or set()
    info: Dict[str, Any] = {"truncated": False, "expansions": 0}

    if target in base:
        return [], info

    cost, _ = _hyperpath_costs(producers, base, cofactors, expansion.reaction_level)
    inputs_of: Dict[str, Tuple[str, ...]] = {}
    edge_by_id: Dict[str, HyperEdge] = {}
    ordered: Dict[str, List[HyperEdge]] = {}
    for c, es in producers.items():
        for e in es:
            edge_by_id[e.id] = e
            if e.id not in inputs_of:
                inputs_of[e.id] = tuple(sorted(e.reactants - cofactors))
        ordered[c] = sorted(
            es, key=lambda e: (1 + sum(cost.get(r, INF) for r in inputs_of[e.id]), e.id)
        )

    # Compounds that can be derived using at least one source (for pruning
    # states that can no longer satisfy the source constraint).
    tainted: Set[str] = set()
    if sources:
        tainted = set(sources)
        changed = True
        while changed:
            changed = False
            for c, es in producers.items():
                if c in tainted:
                    continue
                if any(any(r in tainted for r in inputs_of[e.id]) for e in es):
                    tainted.add(c)
                    changed = True
        if target not in tainted:
            return [], info

    def _h(open_set) -> float:
        return sum(min(cost.get(r, 1e9), 1e6) for r in open_set)

    counter = itertools.count()
    # state = (priority, tiebreak, n_edges, chain, open, uses_source)
    # chain is a persistent linked list ((compound, edge_id), parent)
    heap = [(_h((target,)), next(counter), 0, None, frozenset((target,)), False)]
    solutions: List[Tuple[FrozenSet[str], Dict[str, str]]] = []
    seen_solutions: Set[FrozenSet[str]] = set()
    t0 = time.monotonic()

    while heap:
        if (len(solutions) >= max_solutions or info["expansions"] >= max_expansions
                or time.monotonic() - t0 > time_limit):
            info["truncated"] = True
            break
        _, _, n_edges, chain, open_set, uses = heapq.heappop(heap)
        info["expansions"] += 1

        chosen: Dict[str, str] = {}
        node = chain
        while node is not None:
            (cpd, eid), node = node
            chosen[cpd] = eid

        if not open_set:
            sig = frozenset(chosen.values())
            if sig not in seen_solutions and (not sources or uses):
                seen_solutions.add(sig)
                solutions.append((sig, chosen))
            continue

        c = max(open_set, key=lambda x: (level.get(x, 0), x))
        rest = open_set - {c}
        chosen_edges = set(chosen.values())
        def _acyclic(e: HyperEdge) -> bool:
            # Does any substrate (transitively, through the reactions
            # already chosen) depend on c?
            stack = list(inputs_of[e.id])
            visited: Set[str] = set()
            while stack:
                x = stack.pop()
                if x == c:
                    return False
                if x in visited:
                    continue
                visited.add(x)
                px = chosen.get(x)
                if px is not None:
                    stack.extend(inputs_of[px])
            return True

        # Prefer re-using a reaction that is already in the path and also
        # yields c (a side product) — producing it twice is never minimal.
        cands = [edge_by_id[eid] for eid in sorted(chosen_edges)
                 if c in edge_by_id[eid].products and _acyclic(edge_by_id[eid])]
        if not cands:
            cands = [e for e in ordered.get(c, []) if _acyclic(e)]

        for e in cands:
            ins = inputs_of[e.id]
            new_open = set(rest)
            for r in ins:
                if r not in base and r not in chosen:
                    new_open.add(r)
            new_uses = uses or any(r in sources for r in ins)
            if sources and not new_uses and not any(x in tainted for x in new_open):
                continue
            new_n = n_edges + (0 if e.id in chosen_edges else 1)
            new_open_f = frozenset(new_open)
            heapq.heappush(heap, (
                new_n + _h(new_open_f), next(counter), new_n,
                ((c, e.id), chain), new_open_f, new_uses,
            ))

    info["elapsed_ms"] = round((time.monotonic() - t0) * 1000)

    # Validate + reduce every solution to an inclusion-minimal reaction set.
    # A reaction can only be redundant if every compound it was chosen for is
    # also produced by another reaction of the path; only those candidates
    # are re-checked by forward simulation.
    available = set(base) | set(cofactors)

    def _feasible(es: List[HyperEdge]) -> bool:
        reach, _ = _simulate(es, available, cofactors)
        return target in reach and (not sources or any(
            s in (x.reactants - cofactors) for x in es for s in sources))

    results: List[List[HyperEdge]] = []
    final_sigs: Set[FrozenSet[str]] = set()
    for sig, chosen in solutions:
        edges = sorted((edge_by_id[eid] for eid in sig), key=lambda e: e.id)
        assigned: Dict[str, List[str]] = defaultdict(list)
        for cpd, eid in chosen.items():
            assigned[eid].append(cpd)
        producers_of: Dict[str, int] = defaultdict(int)
        for e in edges:
            for p in e.products:
                producers_of[p] += 1
        candidates = [e for e in edges if all(producers_of[c] > 1 for c in assigned[e.id])]
        if candidates:
            if not _feasible(edges):
                continue
            for e in candidates:
                trial = [x for x in edges if x.id != e.id]
                if _feasible(trial):
                    edges = trial
        key = frozenset(e.id for e in edges)
        if key in final_sigs:
            continue
        final_sigs.add(key)
        results.append(edges)

    results.sort(key=lambda es: (len(es), sorted(e.id for e in es)))
    info["clusters"] = _cluster_solutions(results, edge_by_id)
    return results, info


def find_pathways(
    graph: HyperGraph,
    target: str,
    gen_mapper: Dict[str, float],
    cofactors: Set[str] | None = None,
    sources: Set[str] | None = None,
    max_solutions: int = 200,
    rule: str = "monotone",
    **enum_kwargs: Any,
) -> Dict[str, Any]:
    """Full pipeline: forward expansion → backward pruning → enumeration.

    Returns a JSON-ready dict with the pruned pathway graph (compounds +
    reactions), the validated paths and summary stats.
    """
    cofactors = set(cofactors or ())
    sources = set(sources or ())
    seeds = {c for c, g in gen_mapper.items() if g == 0}
    base = seeds | cofactors | sources

    expansion = forward_expansion(graph, base, cofactors)
    level = expansion.compound_level
    stats: Dict[str, Any] = {
        "seed_compounds": len(seeds),
        "reachable_compounds": len(level),
        "fireable_reactions": len(expansion.reaction_level),
        "target_level": level.get(target),
        "rule": rule,
    }

    def _role(c: str) -> str:
        if c == target:
            return "target"
        if c in sources:
            return "source"
        if c in cofactors:
            return "cofactor"
        if c in seeds:
            return "seed"
        return "intermediate"

    empty = {"graph": {"compounds": [], "reactions": []}, "solutions": [], "clusters": [], "stats": stats}
    if target not in level:
        stats["unreachable"] = True
        stats["message"] = (
            f"{target} cannot be produced from the seed compounds"
            + (" and the given sources" if sources else "")
            + " with the reactions in this network."
        )
        return empty
    if target in expansion.base:
        kind = "source" if target in sources else "cofactor" if target in cofactors else "seed"
        stats["message"] = f"{target} is itself a starting compound ({kind}); no reactions are needed."
        return empty

    producers = backward_relevance(graph, target, expansion, cofactors, rule=rule)
    producers = prune_producers(target, producers, expansion.base, cofactors)
    paths, info = enumerate_hyperpaths(
        target, producers, expansion, cofactors, sources, max_solutions=max_solutions,
        **enum_kwargs,
    )
    clusters_raw = info.pop("clusters", [])
    stats.update(info)
    stats["relevant_compounds"] = len(producers)
    stats["relevant_reactions"] = len({e.id for es in producers.values() for e in es})
    stats["total_solutions"] = len(paths)
    stats["distinct_routes"] = len(clusters_raw)
    if sources and not paths:
        stats["message"] = (
            f"No pathway to {target} that uses "
            + ", ".join(sorted(sources)) + " was found."
        )

    available = set(expansion.base)
    rxn_count: Dict[str, int] = defaultdict(int)
    cpd_count: Dict[str, int] = defaultdict(int)
    # edge id -> compounds it genuinely supplies on some route: admissible
    # production (per the rule) plus whatever it feeds in a listed path.
    supplies: Dict[str, Set[str]] = defaultdict(set)
    for c, es in producers.items():
        for e in es:
            supplies[e.id].add(c)
    solutions_out: List[Dict[str, Any]] = []
    for i, edges in enumerate(paths):
        _, step_of = _simulate(edges, available, cofactors)
        edges = sorted(edges, key=lambda e: (step_of.get(e.id, 0), e.id))
        first_need: Dict[str, int] = {target: 10**9}
        for e in edges:
            for r in e.reactants - cofactors:
                first_need[r] = min(first_need.get(r, 10**9), step_of.get(e.id, 0))
        for e in edges:
            for p in e.products:
                if p in first_need and p not in expansion.base and step_of.get(e.id, 0) < first_need[p]:
                    supplies[e.id].add(p)
        cpds: Set[str] = {target}
        precursors: Set[str] = set()
        for e in edges:
            rxn_count[e.id] += 1
            for r in e.reactants - cofactors:
                cpds.add(r)
                if r in expansion.base:
                    precursors.add(r)
        for c in cpds:
            cpd_count[c] += 1
        solutions_out.append({
            "id": i,
            "reactionCount": len(edges),
            "depth": max(step_of.values()) if step_of else 0,
            "reactionIds": [e.id for e in edges],       # in firing order
            "steps": [step_of.get(e.id, 0) for e in edges],
            "precursorCount": len(precursors),
        })

    # Pathway graph. When enumeration was exhaustive this is exactly the
    # union of all minimal pathways; when it was capped, every reaction of
    # the pruned route graph is included as well, so parallel reactions are
    # never hidden (those outside the listed paths have pathCount 0).
    used_edges: Dict[str, HyperEdge] = {}
    for edges in paths:
        for e in edges:
            used_edges[e.id] = e
    if info.get("truncated"):
        for es in producers.values():
            for e in es:
                used_edges.setdefault(e.id, e)
    graph_cpds: Set[str] = {target}
    for e in used_edges.values():
        graph_cpds |= (e.reactants - cofactors)
    reactions_out = []
    for e in sorted(used_edges.values(), key=lambda e: (expansion.reaction_level[e.id], e.id)):
        reactions_out.append({
            "id": e.id,
            "reaction": e.reaction,
            "reactionId": e.reaction_id,
            "direction": e.direction,
            "equation": e.equation,
            "ecList": e.ec_list,
            "generation": e.generation,
            "source": e.source,
            "coenzyme": e.coenzyme,
            "level": expansion.reaction_level[e.id],
            "reactants": sorted(e.reactants - cofactors),
            "products": sorted(p for p in e.products if p in graph_cpds and p in supplies[e.id]),
            "sideProducts": sorted(p for p in e.products - cofactors
                                   if not (p in graph_cpds and p in supplies[e.id])),
            "cofactors": sorted((e.reactants | e.products) & cofactors),
            "pathCount": rxn_count[e.id],
        })
    compounds_out = [{
        "id": c,
        "level": level.get(c, 0),
        "generation": gen_mapper.get(c, -1),
        "role": _role(c),
        "pathCount": cpd_count.get(c, 0),
        "producerCount": len(producers.get(c, [])),
    } for c in sorted(graph_cpds, key=lambda c: (level.get(c, 0), c))]

    stats["graph_compounds"] = len(compounds_out)
    stats["graph_reactions"] = len(reactions_out)
    stats["max_depth"] = max((s["depth"] for s in solutions_out), default=0)

    # Translate cluster member indices (== solution ids) into API shape.
    clusters_out = [{
        "id": c["representative"],
        "representativeId": c["representative"],
        "size": len(c["members"]),
        "memberIds": c["members"],
        "swaps": c["swaps"],
    } for c in clusters_raw]

    return {
        "graph": {"compounds": compounds_out, "reactions": reactions_out},
        "solutions": solutions_out,
        "clusters": clusters_out,
        "stats": stats,
    }


def collect_flat_reactions(
    graph: HyperGraph,
    target: str,
    gen_mapper: Dict[str, float],
    cofactors: Set[str],
    include_lateral: bool = True,
) -> List[Dict[str, Any]]:
    """
    Fast BFS backward collection of all reactions reachable from *target*
    using the hypergraph's O(1) ``produced_by`` index.

    Produces the same complete result set as the legacy ``create_backtrack_df``
    but avoids per-compound regex scanning of the DataFrame.

    Args:
        graph: HyperGraph instance
        target: Target compound ID
        gen_mapper: Compound generation mapping
        cofactors: Set of cofactor compound IDs
        include_lateral: If True, also include lateral reactions (reactions where
                        discovered compounds participate at the same generation level)

    Returns a list of dicts with keys matching the table-view display format:
        reaction, source, coenzyme, equation, transition, target,
        ec_list, reactant_gen, product_gen
    """
    target_gen = gen_mapper.get(target, float("inf"))

    queue: Set[str] = {target}
    processed: Set[str] = set(cofactors)
    discovered_compounds: Set[str] = set()  # Track all compounds in backward trace

    # reaction_name -> representative HyperEdge (deduplicated)
    # Also track which *target compound* triggered this reaction
    seen_rxns: Dict[str, Tuple[HyperEdge, str]] = {}

    while queue:
        compound = queue.pop()
        if compound in processed:
            continue
        processed.add(compound)
        discovered_compounds.add(compound)

        gen = gen_mapper.get(compound, -1)
        # Gen-0 compounds are seeds — don't trace further
        if gen == 0 or gen == -1:
            continue
        # Never trace above the target's generation
        if gen > target_gen and compound != target:
            continue

        # Find reactions producing this compound (O(1) lookup)
        producing = graph.produced_by.get(compound, [])

        # Deduplicate edges by reaction name, keep min product_gen
        best: Dict[str, HyperEdge] = {}
        for edge in producing:
            prev = best.get(edge.reaction)
            if prev is None or edge.product_gen < prev.product_gen:
                best[edge.reaction] = edge

        # Filter to minimum product_gen (matches get_first_occurance behaviour)
        if best:
            min_pgen = min(e.product_gen for e in best.values())
            best = {k: e for k, e in best.items() if e.product_gen <= min_pgen}

        for rxn_name, edge in best.items():
            if rxn_name not in seen_rxns:
                seen_rxns[rxn_name] = (edge, compound)

            # Enqueue non-cofactor reactants
            for reactant in edge.reactants:
                if reactant not in processed:
                    queue.add(reactant)
            
            # Also enqueue all non-cofactor products to discover side-product reactions
            # This ensures we find reactions like RZ_388 (C00022 => Z00039) even if
            # Z00039 is never a reactant in the main backward path
            for product in edge.products:
                if product not in processed and product not in cofactors:
                    queue.add(product)

    # Add lateral reactions: reactions where discovered compounds participate
    # at the same generation level (same-gen transformations only)
    if include_lateral:
        # Include the target in lateral search
        compounds_for_lateral = discovered_compounds | {target}
        
        for compound in compounds_for_lateral:
            compound_gen = gen_mapper.get(compound, -1)
            if compound_gen == -1:
                continue
            
            # Find reactions where this compound is consumed (as reactant)
            consuming = graph.consumed_by.get(compound, [])
            for edge in consuming:
                if edge.reaction not in seen_rxns:
                    # Only include lateral reactions where:
                    # 1. The reactant generation matches the compound's generation
                    # 2. The product generation equals reactant generation (same-gen only)
                    # 3. The generation doesn't exceed target generation
                    if (edge.reactant_gen == compound_gen and 
                        edge.product_gen == edge.reactant_gen and
                        edge.product_gen <= target_gen):
                        seen_rxns[edge.reaction] = (edge, compound)

    # Build output list in the same shape the table view expects
    results: List[Dict[str, Any]] = []
    for rxn_name, (edge, tgt_cpd) in seen_rxns.items():
        ec_list = edge.ec_list if edge.ec_list else []
        results.append({
            "reaction": rxn_name,
            "source": edge.source or "",
            "coenzyme": edge.coenzyme or "",
            "equation": edge.equation or "",
            "transition": f"{int(edge.reactant_gen)} -> {int(edge.product_gen)}",
            "target": tgt_cpd,
            "ec_list": ec_list,
            "reactant_gen": edge.reactant_gen,
            "product_gen": edge.product_gen,
        })

    # Sort by generation
    results.sort(key=lambda r: (r["product_gen"], r["reactant_gen"]))
    return results
