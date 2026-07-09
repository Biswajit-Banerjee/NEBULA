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
  Tier 3 - fallback: centroid of all real positions (map center). Should
           rarely trigger.

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

    # Tier 3 fallback: centroid of all real positions (map center)
    if real_positions:
        cx = sum(p[0] for p in real_positions.values()) / len(real_positions)
        cy = sum(p[1] for p in real_positions.values()) / len(real_positions)
    else:
        cx, cy = 0.0, 0.0

    # Tier 2 setup: group positioned compounds by generation
    gen_to_positioned = defaultdict(list)
    for cid, pos in real_positions.items():
        g = gen_map.get(cid)
        if g is not None:
            gen_to_positioned[g].append(pos)
    sorted_gens = sorted(gen_to_positioned.keys())

    def nearest_gen_centroid(target_gen):
        if target_gen is None or not sorted_gens:
            return None
        best_gen = min(sorted_gens, key=lambda g: abs(g - target_gen))
        pts = gen_to_positioned[best_gen]
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))

    result = {}
    tier_counts = {1: 0, 2: 0, 3: 0}

    for i, cid in enumerate(unplaced):
        pos = weighted_centroid_bfs(cid, adj, real_positions)
        tier = 1
        if pos is None:
            pos = nearest_gen_centroid(gen_map.get(cid))
            tier = 2
        if pos is None:
            pos = (cx, cy)
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
