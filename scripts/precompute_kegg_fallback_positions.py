"""
Precompute fallback KEGG map positions for every compound that has no real
position in kegg_pos_svg.json (i.e. not drawn on the actual KEGG map01100
artwork). This replaces the old approach of building the KEGG adjacency graph
and running BFS/centroid placement in the browser on every page load
(GraphCanvas.jsx applyKegg()) — that work is now done ONCE, offline, here.

Priority cascade per unplaced compound (most connected, then similar
generation; the earlier "similar compound id / edit distance" tier was
removed — comparing raw ID strings isn't a meaningful similarity signal):

  Tier 1 - most connected: weighted centroid (BFS depth<=4, inverse-depth
           weighted) over the full KEGG compound adjacency graph (built from
           map01100.conf's shared reaction lines), using only neighbors that
           HAVE a real position.
  Tier 2 - similar generation: centroid of all real-positioned compounds that
           share the closest `modified_generation` value (generations.csv —
           this is a static, global property, not per-query).
  Tier 3 - fallback: NO connectivity or generation signal at all, so there is
           nothing to anchor these to — a single shared point (e.g. the map
           center) would just pile every one of them into one dense blob.
           Instead, spread them across several genuinely open/sparse regions
           of the map (found by scanning a density grid over the real KEGG
           positions), assigning each tier-3 compound to one region
           deterministically by hashing its id. Same anchor-based bucketing +
           phyllotaxis spiral on the frontend then spreads each region's
           members nicely — this only changes WHERE the anchor points are.

Reads:
  backend/data/kegg_pos_svg.json - real per-compound positions {cid: [x, y]}
  backend/data/map01100.conf     - KEGG line map (line + filled_circ commands)
  backend/data/generations.csv   - compound_id -> modified_generation

Writes:
  backend/data/kegg_fallback_positions.json - {cid: {"x":.., "y":.., "tier":N}}
  for every compound in the universe that lacks a real position.
"""
import json
import re
import csv
import hashlib
import bisect
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"


def load_real_positions():
    path = DATA_DIR / "kegg_pos_svg.json"
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return {cid: (float(xy[0]), float(xy[1])) for cid, xy in raw.items()}


def build_adjacency_graph():
    """Parse map01100.conf -> compound-compound adjacency graph via shared lines.

    Mirrors the grid-indexed matching logic in backend/app/main.py's
    _parse_kegg_conf_lines(), but only needs the adjacency, not colors/regions.
    """
    conf_path = DATA_DIR / "map01100.conf"
    lines = []       # [[(x,y), ...], ...]
    compounds = []    # [(cid, x, y), ...]

    for raw in conf_path.read_text(encoding="utf-8").splitlines():
        if raw.startswith("line"):
            m = re.match(r"line \(([^)]+)\) (\d+)", raw)
            if not m:
                continue
            nums = [int(x) for x in m.group(1).split(",")]
            pts = [(nums[i], nums[i + 1]) for i in range(0, len(nums) - 1, 2)]
            if pts:
                lines.append(pts)
        elif raw.startswith("filled_circ"):
            m = re.match(r"filled_circ \((\d+),(\d+)\) \d+\t/dbget-bin/www_bget\?(\w+)", raw)
            if m:
                compounds.append((m.group(3), int(m.group(1)), int(m.group(2))))

    THRESHOLD = 8  # compound circles are r=7; only match lines actually touching
    CELL = THRESHOLD
    THRESHOLD_SQ = THRESHOLD * THRESHOLD

    endpoint_grid = defaultdict(list)
    for li, pts in enumerate(lines):
        for (px, py) in (pts[0], pts[-1]):
            gx, gy = px // CELL, py // CELL
            endpoint_grid[(gx, gy)].append((li, px, py))

    cpd_lines = defaultdict(set)  # cid -> set(line idx)
    for cid, cx, cy in compounds:
        gx, gy = cx // CELL, cy // CELL
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for li, px, py in endpoint_grid.get((gx + dx, gy + dy), []):
                    if (px - cx) ** 2 + (py - cy) ** 2 <= THRESHOLD_SQ:
                        cpd_lines[cid].add(li)

    line_to_compounds = defaultdict(set)
    for cid, lidxs in cpd_lines.items():
        for li in lidxs:
            line_to_compounds[li].add(cid)

    adj = defaultdict(set)
    for cid, lidxs in cpd_lines.items():
        for li in lidxs:
            for other in line_to_compounds[li]:
                if other != cid:
                    adj[cid].add(other)

    return adj


def load_generation_map():
    path = DATA_DIR / "generations.csv"
    gen_map = {}
    universe = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid = row.get("compound_id")
            if not cid:
                continue
            universe.add(cid)
            try:
                gen_map[cid] = float(row["modified_generation"])
            except (ValueError, TypeError, KeyError):
                pass
    return gen_map, universe


def weighted_centroid_bfs(cid, adj, real_positions, max_depth=4):
    """Tier 1: BFS through the full KEGG adjacency graph, weighting positioned
    neighbors by inverse discovery-depth (closer neighbors pull harder)."""
    if cid not in adj:
        return None

    visited = {cid}
    depth_map = {}
    queue = list(adj.get(cid, ()))
    depth = 1

    while queue and depth <= max_depth:
        next_queue = []
        for nb in queue:
            if nb in visited:
                continue
            visited.add(nb)
            depth_map[nb] = depth
            for fn in adj.get(nb, ()):
                if fn not in visited:
                    next_queue.append(fn)

        total_w = 0.0
        wx = 0.0
        wy = 0.0
        for nid, d in depth_map.items():
            pos = real_positions.get(nid)
            if pos:
                w = 1.0 / d
                wx += pos[0] * w
                wy += pos[1] * w
                total_w += w

        if total_w > 0:
            return (wx / total_w, wy / total_w)

        queue = next_queue
        depth += 1

    return None


def find_sparse_regions(real_positions, num_regions=10, grid_cells=40, min_region_sep_frac=0.12):
    """Scan a density grid over the real KEGG positions' bounding box and return
    `num_regions` well-separated cell centers from the sparsest areas — i.e.
    genuinely open space on the map, not the single geometric centroid (which
    tends to sit in/near the densest part of the diagram).

    Greedy selection: sort all cells by ascending real-position density, then
    walk down that list adding a cell only if it's at least
    `min_region_sep_frac` * bounding-box-diagonal away from every region
    already chosen, so the regions read as visually distinct areas instead of
    several adjacent, effectively-identical cells.
    """
    xs = [p[0] for p in real_positions.values()]
    ys = [p[1] for p in real_positions.values()]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w, h = max_x - min_x, max_y - min_y
    diag = (w ** 2 + h ** 2) ** 0.5
    min_sep = diag * min_region_sep_frac

    cell_w, cell_h = w / grid_cells, h / grid_cells
    density = defaultdict(int)
    for x, y in real_positions.values():
        gx = min(grid_cells - 1, int((x - min_x) / cell_w)) if cell_w else 0
        gy = min(grid_cells - 1, int((y - min_y) / cell_h)) if cell_h else 0
        density[(gx, gy)] += 1

    # Smooth with a 3x3 sum so we pick areas that are sparse in their whole
    # neighborhood, not just a single lucky empty cell surrounded by density.
    def smoothed(gx, gy):
        return sum(
            density.get((gx + dx, gy + dy), 0)
            for dx in (-1, 0, 1) for dy in (-1, 0, 1)
        )

    # Restrict candidates to the interior (10%-90% of the bounding box) so we
    # don't pick blank margins/corners outside the actual pathway artwork.
    margin_lo, margin_hi = int(grid_cells * 0.1), int(grid_cells * 0.9)
    candidates = [
        (gx, gy, smoothed(gx, gy))
        for gx in range(margin_lo, margin_hi)
        for gy in range(margin_lo, margin_hi)
    ]
    candidates.sort(key=lambda c: c[2])

    def cell_center(gx, gy):
        return (min_x + (gx + 0.5) * cell_w, min_y + (gy + 0.5) * cell_h)

    regions = []
    for gx, gy, _dens in candidates:
        cx, cy = cell_center(gx, gy)
        if all(((cx - rx) ** 2 + (cy - ry) ** 2) ** 0.5 >= min_sep for rx, ry in regions):
            regions.append((cx, cy))
            if len(regions) >= num_regions:
                break

    return regions


def main():
    real_positions = load_real_positions()
    adj = build_adjacency_graph()
    gen_map, csv_universe = load_generation_map()

    # Universe = every compound referenced anywhere (generations.csv + conf
    # adjacency + real positions) — anything that could plausibly show up in
    # a search result.
    universe = set(csv_universe) | set(adj.keys()) | set(real_positions.keys())
    unplaced = sorted(cid for cid in universe if cid not in real_positions)

    print(f"Universe size: {len(universe)}, real positions: {len(real_positions)}, unplaced: {len(unplaced)}")

    # Tier 3 fallback: compounds with NO connectivity or generation signal at
    # all. Spread these across several sparse/open regions of the map instead
    # of one shared point, so they don't pile into a single dense blob.
    sparse_regions = find_sparse_regions(real_positions)
    if not sparse_regions:
        cx = sum(p[0] for p in real_positions.values()) / len(real_positions) if real_positions else 0.0
        cy = sum(p[1] for p in real_positions.values()) / len(real_positions) if real_positions else 0.0
        sparse_regions = [(cx, cy)]
    print(f"Tier 3 sparse regions found: {len(sparse_regions)} -> {[(round(x), round(y)) for x, y in sparse_regions]}")

    # Tier 2 setup: individual (generation, position) entries for every
    # real-positioned compound that has a generation value — sorted by
    # generation so we can binary-search the nearest ones. Deliberately NOT
    # grouped/averaged: averaging every same-generation compound into one
    # shared centroid collapsed 2231 tier-2 compounds onto only 87 distinct
    # points with far tighter spread than the real map (std ~630 vs ~1370),
    # which is what actually produced the "everything piles into the middle"
    # blob — centroids of scattered points regress toward the overall mean.
    # Anchoring to one of the ACTUAL nearby real compound positions instead
    # keeps the natural spread of the real map intact.
    gen_entries = sorted(
        ((gen_map[cid], pos) for cid, pos in real_positions.items() if cid in gen_map),
        key=lambda e: e[0],
    )
    sorted_gens = [e[0] for e in gen_entries]

    def nearest_gen_position(cid, target_gen):
        if target_gen is None or not gen_entries:
            return None
        idx = bisect.bisect_left(sorted_gens, target_gen)
        # Look at a small window of candidates around the insertion point —
        # closest by generation distance — instead of collapsing every
        # same-generation compound onto one averaged point.
        WINDOW = 5
        lo = max(0, idx - WINDOW)
        hi = min(len(gen_entries), idx + WINDOW)
        candidates = sorted(gen_entries[lo:hi], key=lambda e: abs(e[0] - target_gen))[:WINDOW]
        if not candidates:
            return None
        # Deterministic hash-based pick among the closest few, so compounds
        # sharing the exact same target generation still spread across
        # multiple nearby real positions instead of all picking the literal
        # single nearest one.
        pick = int(hashlib.md5(cid.encode("utf-8")).hexdigest(), 16) % len(candidates)
        return candidates[pick][1]

    result = {}
    tier_counts = {1: 0, 2: 0, 3: 0}

    for i, cid in enumerate(unplaced):
        pos = weighted_centroid_bfs(cid, adj, real_positions)
        tier = 1
        if pos is None:
            pos = nearest_gen_position(cid, gen_map.get(cid))
            tier = 2
        if pos is None:
            # Deterministic hash-based assignment across the sparse regions —
            # same compound always lands in the same region across re-runs,
            # and different compounds spread evenly across all regions.
            region_idx = int(hashlib.md5(cid.encode("utf-8")).hexdigest(), 16) % len(sparse_regions)
            pos = sparse_regions[region_idx]
            tier = 3
        tier_counts[tier] += 1
        result[cid] = {"x": pos[0], "y": pos[1], "tier": tier}

        if (i + 1) % 500 == 0:
            print(f"  ...{i + 1}/{len(unplaced)} processed")

    out_path = DATA_DIR / "kegg_fallback_positions.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f)

    print(f"Wrote {len(result)} fallback positions to {out_path}")
    print(f"Tier breakdown: {tier_counts}")


if __name__ == "__main__":
    main()
