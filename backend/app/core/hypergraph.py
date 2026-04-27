"""
Directed B-Hypergraph data structure and AND-OR backward reachability algorithm
for metabolic network pathway analysis.

A metabolic network is naturally a directed B-hypergraph where:
  - Nodes = metabolites (compounds C/Z)
  - Hyperedges = reactions, each mapping a SET of reactants -> SET of products

This maps to an AND-OR graph:
  - OR-nodes = compounds (can be produced by ANY of several reactions)
  - AND-nodes = reactions (require ALL reactants simultaneously)
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

        for idx, row in df.iterrows():
            reactants_str = str(row.get("reactants", ""))
            products_str = str(row.get("products", ""))

            reactant_set = frozenset(COMPOUND_RE.findall(reactants_str))
            product_set = frozenset(COMPOUND_RE.findall(products_str))

            if not reactant_set and not product_set:
                continue

            # Parse EC list
            ec_raw = row.get("ec_list", "")
            if pd.isna(ec_raw) or ec_raw == "":
                ec_list = []
            else:
                ec_list = [e.strip() for e in str(ec_raw).split(",") if e.strip()]

            # Unique edge key: reaction name + direction + row index for uniqueness
            reaction_name = str(row.get("reaction", f"R_{idx}"))
            direction = str(row.get("direction", "forward"))
            edge_id = f"{reaction_name}_{direction}_{idx}"

            coenzyme = row.get("coenzyme", "")
            if pd.isna(coenzyme):
                coenzyme = ""

            source = row.get("source", "")
            if pd.isna(source):
                source = ""

            edge = HyperEdge(
                id=edge_id,
                reaction=reaction_name,
                reaction_id=str(row.get("reaction_id", "")),
                reactants=reactant_set,
                products=product_set,
                reactant_gen=float(row.get("reactant_gen", 0) or 0),
                product_gen=float(row.get("product_gen", 0) or 0),
                generation=float(row.get("generation", 0) or 0),
                ec_list=ec_list,
                equation=str(row.get("equation", "")),
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
# AND-OR Tree node types
# ---------------------------------------------------------------------------

@dataclass
class CompoundNode:
    """OR-node: a compound that can be produced by any of its `producers`."""
    id: str
    generation: float
    is_leaf: bool = False
    is_shared: bool = False          # True when this compound was already expanded elsewhere
    leaf_reason: str = ""            # "source" | "cofactor" | "gen0" | "no_producers" | ""
    producers: List["ReactionNode"] = field(default_factory=list)


@dataclass
class ReactionNode:
    """AND-node: a reaction that requires all of its `reactants`."""
    id: str                          # HyperEdge.id
    reaction: str                    # display name
    reaction_id: str
    equation: str
    ec_list: List[str]
    generation: float
    source: str
    coenzyme: str
    reactants: List[CompoundNode] = field(default_factory=list)


# ---------------------------------------------------------------------------
# AND-OR Backward Reachability
# ---------------------------------------------------------------------------

def backward_reachability(
    graph: HyperGraph,
    target: str,
    gen_mapper: Dict[str, float],
    cofactors: Set[str] | None = None,
    sources: Set[str] | None = None,
    skip_cofactor: bool = True,
) -> Tuple[Optional[CompoundNode], Dict[str, Any]]:
    """
    Build a complete AND-OR DAG rooted at `target` by backward expansion.

    Args:
        graph: The HyperGraph to traverse.
        target: Target compound ID.
        gen_mapper: compound_id -> generation mapping.
        cofactors: Set of cofactor compound IDs (treated as leaves).
        sources: Optional set of source compounds. If provided, a post-pass
                 prunes branches that don't reach any source.
        skip_cofactor: Whether to treat cofactors as leaves.

    Returns:
        (root CompoundNode or None, stats dict)
    """
    if cofactors is None:
        cofactors = set()
    if sources is None:
        sources = set()

    cofactor_set = cofactors if skip_cofactor else set()

    # Memoization: compound_id -> CompoundNode (fully expanded)
    memo: Dict[str, CompoundNode] = {}
    # Track which compounds are currently on the ancestor path (cycle detection)
    # Using a set for the iterative stack-based approach won't work cleanly,
    # so we pass ancestor_path through recursion.
    stats = {
        "total_compounds": 0,
        "total_reactions": 0,
        "shared_compounds": 0,
        "max_depth": 0,
    }

    def _is_leaf(compound: str) -> Tuple[bool, str]:
        """Determine if a compound is a leaf node and why."""
        if compound in cofactor_set:
            return True, "cofactor"
        if sources and compound in sources:
            return True, "source"
        gen = gen_mapper.get(compound, -1)
        if gen == 0:
            return True, "gen0"
        if gen == -1:
            # Unknown compound — treat as leaf
            return True, "unknown"
        return False, ""

    def expand_compound(compound: str, ancestor_path: FrozenSet[str], depth: int) -> CompoundNode:
        """Recursively expand a compound (OR-node) by finding all producing reactions."""
        stats["max_depth"] = max(stats["max_depth"], depth)

        gen = gen_mapper.get(compound, -1)

        # Check leaf conditions
        leaf, reason = _is_leaf(compound)
        if leaf:
            node = CompoundNode(
                id=compound,
                generation=gen,
                is_leaf=True,
                leaf_reason=reason,
            )
            stats["total_compounds"] += 1
            return node

        # Memoization: if already fully expanded, return a shared reference
        if compound in memo:
            stats["shared_compounds"] += 1
            shared = CompoundNode(
                id=compound,
                generation=gen,
                is_leaf=False,
                is_shared=True,
            )
            return shared

        # Create the OR-node
        node = CompoundNode(id=compound, generation=gen)
        stats["total_compounds"] += 1

        # Register in memo BEFORE recursion to handle cycles via memoization
        memo[compound] = node

        new_ancestor = ancestor_path | frozenset({compound})

        # Find all hyperedges that produce this compound
        producing_edges = graph.produced_by.get(compound, [])

        # Deduplicate by reaction name — multiple rows for same reaction
        # (e.g. same reaction producing multiple products) should merge
        seen_reactions: Dict[str, List[HyperEdge]] = defaultdict(list)
        for edge in producing_edges:
            seen_reactions[edge.reaction].append(edge)

        for reaction_name, edges in seen_reactions.items():
            # Use the first edge as representative (they share the same reactants/equation)
            edge = edges[0]

            # Generation monotonicity: reaction generation must be <= compound generation
            if gen >= 0 and edge.generation > gen:
                continue

            # Expand all non-cofactor reactants
            reactant_children: List[CompoundNode] = []
            skip_reaction = False

            for reactant in edge.reactants:
                if reactant in cofactor_set:
                    continue  # skip cofactors as reactants

                if reactant in ancestor_path:
                    # Cycle detected — skip this entire reaction branch
                    skip_reaction = True
                    break

                child = expand_compound(reactant, new_ancestor, depth + 1)
                reactant_children.append(child)

            if skip_reaction:
                continue

            rxn_node = ReactionNode(
                id=edge.id,
                reaction=edge.reaction,
                reaction_id=edge.reaction_id,
                equation=edge.equation,
                ec_list=edge.ec_list,
                generation=edge.generation,
                source=edge.source,
                coenzyme=edge.coenzyme,
                reactants=reactant_children,
            )
            stats["total_reactions"] += 1
            node.producers.append(rxn_node)

        # If no producers were found, mark as leaf
        if not node.producers:
            node.is_leaf = True
            node.leaf_reason = "no_producers"

        return node

    # --- Main entry ---
    if target not in graph.all_compounds and target not in gen_mapper:
        return None, stats

    root = expand_compound(target, frozenset(), 0)

    # --- Post-pass: prune branches that don't reach any source ---
    if sources:
        root = _prune_unreachable(root, sources)

    return root, stats


def _prune_unreachable(
    node: CompoundNode,
    sources: Set[str],
) -> Optional[CompoundNode]:
    """
    Post-pass: remove reaction branches that cannot reach any source compound.
    A branch "reaches" a source if any leaf in the subtree is a source.
    Returns None if the entire subtree is unreachable.
    """
    if node.is_shared:
        # Shared nodes are placeholders — keep them (they reference a reachable node)
        return node

    if node.is_leaf:
        # Leaf reaches a source if it IS a source or is gen0/cofactor (always valid)
        if node.leaf_reason in ("source", "gen0", "cofactor", "unknown"):
            return node
        return None  # "no_producers" leaf that isn't a source → prune

    # For OR-node: keep only reactions where ALL reactants are reachable
    surviving_producers: List[ReactionNode] = []

    for rxn in node.producers:
        pruned_reactants: List[CompoundNode] = []
        all_reachable = True

        for child in rxn.reactants:
            pruned = _prune_unreachable(child, sources)
            if pruned is None:
                all_reachable = False
                break
            pruned_reactants.append(pruned)

        if all_reachable:
            rxn.reactants = pruned_reactants
            surviving_producers.append(rxn)

    if not surviving_producers:
        return None

    node.producers = surviving_producers
    return node


# ---------------------------------------------------------------------------
# Serialization: AND-OR tree → JSON-ready dict
# ---------------------------------------------------------------------------

def tree_to_dict(node: CompoundNode) -> Dict[str, Any]:
    """Convert an AND-OR tree to a JSON-serializable dictionary."""
    result: Dict[str, Any] = {
        "type": "compound",
        "id": node.id,
        "generation": node.generation,
        "isLeaf": node.is_leaf,
        "isShared": node.is_shared,
        "leafReason": node.leaf_reason,
    }

    if node.is_shared:
        result["producers"] = []
        return result

    producers = []
    for rxn in node.producers:
        rxn_dict: Dict[str, Any] = {
            "type": "reaction",
            "id": rxn.id,
            "reaction": rxn.reaction,
            "reactionId": rxn.reaction_id,
            "equation": rxn.equation,
            "ecList": rxn.ec_list,
            "generation": rxn.generation,
            "source": rxn.source,
            "coenzyme": rxn.coenzyme,
            "reactants": [tree_to_dict(child) for child in rxn.reactants],
        }
        producers.append(rxn_dict)

    result["producers"] = producers
    return result


# ---------------------------------------------------------------------------
# Solution enumeration
# ---------------------------------------------------------------------------

def enumerate_solutions(
    root: CompoundNode,
    max_solutions: int = 1000,
) -> List[List[Dict[str, Any]]]:
    """
    Enumerate all minimal AND-OR solutions rooted at `root`.

    A *solution* is a subtree of the AND-OR DAG where:
      - At every OR-node (compound) exactly ONE producing reaction is chosen.
      - At every AND-node (reaction) ALL non-cofactor reactants are included.
      - Every leaf is a valid terminal (source, gen-0, cofactor, etc.).

    Each solution is returned as a list of reaction dicts (the edges used).

    Args:
        root: The CompoundNode root of the AND-OR tree.
        max_solutions: Hard cap to avoid combinatorial explosion.

    Returns:
        List of solutions.  Each solution is a list of
        ``{"reaction", "reaction_id", "equation", "ec_list", "generation"}``.
    """
    # Memo: compound_id -> list of partial solutions (each a frozenset of reaction names)
    memo: Dict[str, List[FrozenSet[str]]] = {}
    # Map reaction name -> detail dict (for output)
    rxn_detail: Dict[str, Dict[str, Any]] = {}
    hit_limit = False

    def _solve_compound(node: CompoundNode) -> List[FrozenSet[str]]:
        """Return list of possible reaction-sets that fully resolve this compound."""
        nonlocal hit_limit
        if hit_limit:
            return []

        # Leaf or shared → trivially resolved (no reactions needed)
        if node.is_leaf or node.is_shared:
            return [frozenset()]

        # Memoization on compound id
        if node.id in memo:
            return memo[node.id]

        # Guard: register empty first to break infinite loops
        memo[node.id] = []

        compound_solutions: List[FrozenSet[str]] = []

        # OR-choice: pick exactly one producer
        for rxn in node.producers:
            if hit_limit:
                break

            # Store reaction detail for later output
            if rxn.reaction not in rxn_detail:
                rxn_detail[rxn.reaction] = {
                    "reaction": rxn.reaction,
                    "reaction_id": rxn.reaction_id,
                    "equation": rxn.equation,
                    "ec_list": rxn.ec_list,
                    "generation": rxn.generation,
                    "source": rxn.source,
                    "coenzyme": rxn.coenzyme,
                }

            # AND-combination: need solutions for ALL reactants
            # Start with just this reaction
            partial: List[FrozenSet[str]] = [frozenset([rxn.reaction])]

            for child in rxn.reactants:
                if hit_limit:
                    break
                child_solutions = _solve_compound(child)
                if not child_solutions:
                    # This AND-branch is unsatisfiable
                    partial = []
                    break

                # Cross-product: merge each partial with each child solution
                new_partial: List[FrozenSet[str]] = []
                for p in partial:
                    for c in child_solutions:
                        merged = p | c
                        new_partial.append(merged)
                        if len(new_partial) + len(compound_solutions) >= max_solutions:
                            hit_limit = True
                            break
                    if hit_limit:
                        break
                partial = new_partial

            compound_solutions.extend(partial)
            if len(compound_solutions) >= max_solutions:
                compound_solutions = compound_solutions[:max_solutions]
                hit_limit = True
                break

        memo[node.id] = compound_solutions
        return compound_solutions

    raw_solutions = _solve_compound(root)

    # Convert frozensets to ordered reaction lists
    result: List[List[Dict[str, Any]]] = []
    seen_sigs: Set[FrozenSet[str]] = set()

    for sol in raw_solutions:
        if sol in seen_sigs:
            continue
        seen_sigs.add(sol)
        # Sort reactions by generation for readability
        rxn_list = sorted(
            [rxn_detail[name] for name in sol if name in rxn_detail],
            key=lambda r: r.get("generation", 0),
        )
        result.append(rxn_list)

    return result


# ---------------------------------------------------------------------------
# Flat reaction list extraction (backward compat with existing backtrace)
# ---------------------------------------------------------------------------

def tree_to_flat_reactions(node: CompoundNode) -> List[Dict[str, Any]]:
    """
    Extract a flat list of unique reactions from the AND-OR tree.
    Each reaction is represented as a dict compatible with the existing
    display_df format used by get_backtrace.
    """
    seen: Set[str] = set()
    reactions: List[Dict[str, Any]] = []

    def _walk(n: CompoundNode):
        if n.is_shared or n.is_leaf:
            return
        for rxn in n.producers:
            if rxn.reaction not in seen:
                seen.add(rxn.reaction)
                reactions.append({
                    "reaction": rxn.reaction,
                    "reaction_id": rxn.reaction_id,
                    "equation": rxn.equation,
                    "ec_list": rxn.ec_list,
                    "generation": rxn.generation,
                    "source": rxn.source,
                    "coenzyme": rxn.coenzyme,
                })
            for child in rxn.reactants:
                _walk(child)

    _walk(node)
    return reactions


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
