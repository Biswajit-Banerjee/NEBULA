"""Pre-build SMILES cache for all compounds in the dataset."""
import sys, os, re, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pandas as pd
from app.utils.smiles_cache import get_smiles_batch, _load_cache, _cache, _save_cache

# Collect all unique compound IDs from the dataset
df = pd.read_csv(os.path.join(os.path.dirname(__file__), '..', 'backend', 'data', 'simulations.csv'))
compounds = set()
for col in ['reactants', 'products']:
    for val in df[col].dropna():
        for c in str(val).split(','):
            c = c.strip()
            if re.match(r'^C\d{5}$', c):
                compounds.add(c)

all_ids = sorted(compounds)
print(f"Total unique compounds in dataset: {len(all_ids)}")

# Load existing cache to skip already-fetched
_load_cache()
already = [c for c in all_ids if c in _cache]
to_fetch = [c for c in all_ids if c not in _cache]
print(f"Already cached: {len(already)}")
print(f"Need to fetch: {len(to_fetch)}")

if not to_fetch:
    print("\nAll compounds already cached!")
else:
    # Fetch in batches of 50 for progress reporting
    BATCH = 50
    total_hits = sum(1 for c in already if _cache.get(c) is not None)
    total_misses = sum(1 for c in already if _cache.get(c) is None)
    
    for i in range(0, len(to_fetch), BATCH):
        batch = to_fetch[i:i+BATCH]
        result = get_smiles_batch(batch)
        hits = sum(1 for v in result.values() if v is not None)
        misses = len(batch) - hits
        total_hits += hits
        total_misses += misses
        done = min(i + BATCH, len(to_fetch))
        print(f"  [{done}/{len(to_fetch)}] batch: {hits} hits, {misses} misses | cumulative: {total_hits} hits, {total_misses} misses")

# Final stats
_load_cache()
hits = sum(1 for v in _cache.values() if v is not None)
misses = sum(1 for v in _cache.values() if v is None)
total = len(_cache)
print(f"\n{'='*50}")
print(f"SMILES Cache Statistics")
print(f"{'='*50}")
print(f"Total compounds:  {total}")
print(f"Hits (SMILES):    {hits}  ({100*hits/total:.1f}%)")
print(f"Misses (no data): {misses}  ({100*misses/total:.1f}%)")
print(f"{'='*50}")
