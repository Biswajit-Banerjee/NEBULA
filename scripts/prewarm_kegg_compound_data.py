"""
Pre-warm the app's compound data caches (name_cache.json, smiles_cache.json,
mol_cache.json) for every compound that appears on the global KEGG map
(backend/data/kegg_pos_svg.json) — not just the ones a user happens to search
for. This ensures "Show all compounds" ghost dots (and anything built on top
of them later) have real names/structures ready instead of being blank the
first time they're requested.

Reuses the exact same fetch/cache functions the live API endpoints use
(get_compound_names_batch, get_smiles_batch, get_mol_batch) so results land
in the same cache files the app already reads from.

Reads:
  backend/data/kegg_pos_svg.json - {compoundId: [x, y]}

Writes (via backend.app.utils.smiles_cache):
  backend/data/name_cache.json
  backend/data/smiles_cache.json
  backend/data/mol_cache.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.utils.smiles_cache import (
    get_compound_names_batch,
    get_smiles_batch,
    get_mol_batch,
)

DATA = Path("backend/data")


def main():
    pos = json.load(open(DATA / "kegg_pos_svg.json"))
    cids = sorted(pos.keys())
    print(f"Total KEGG map compounds: {len(cids)}")

    print("\n--- Fetching names ---")
    names = get_compound_names_batch(cids)
    print(f"Names resolved: {len(names)}/{len(cids)}")

    print("\n--- Fetching SMILES (PubChem) ---")
    smiles = get_smiles_batch(cids)
    have_smiles = sum(1 for v in smiles.values() if v)
    print(f"SMILES resolved: {have_smiles}/{len(cids)}")

    missing = [c for c in cids if not smiles.get(c)]
    print(f"\n--- Fetching MOL fallback (KEGG) for {len(missing)} compounds without SMILES ---")
    mol = get_mol_batch(missing)
    have_mol = sum(1 for v in mol.values() if v)
    print(f"MOL resolved: {have_mol}/{len(missing)}")

    have_structure = have_smiles + have_mol
    print(f"\nDONE. {have_structure}/{len(cids)} compounds now have a structure (SMILES or MOL). "
          f"{len(names)}/{len(cids)} have a name.")


if __name__ == "__main__":
    main()
