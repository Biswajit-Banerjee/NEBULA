"""
Structure cache — fetch SMILES from PubChem, MOL files from KEGG,
and cofactor names for Z compounds.
Results are cached locally so each compound is fetched at most once.
"""

import csv
import json
import logging
import time
from pathlib import Path
from typing import Dict, Optional

import requests

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_CACHE_FILE = _DATA_DIR / "smiles_cache.json"
_MOL_CACHE_FILE = _DATA_DIR / "mol_cache.json"
_COFACTORS_FILE = _DATA_DIR / "cofactors.csv"
_PUBCHEM_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{}/property/CanonicalSMILES/JSON"
_KEGG_MOL_URL = "https://rest.kegg.jp/get/{}/mol"
_KEGG_GET_URL = "https://rest.kegg.jp/get/{}"
_NAME_CACHE_FILE = _DATA_DIR / "name_cache.json"

# In-memory caches
_cache: Dict[str, Optional[str]] = {}
_mol_cache: Dict[str, Optional[str]] = {}
_cofactors: Dict[str, str] = {}  # Z00001 -> "Iron sulfur (2Fe2S)"
_name_cache: Dict[str, str] = {}  # C00001 -> "H2O"
_loaded = False


def _load_cache():
    global _cache, _mol_cache, _cofactors, _name_cache, _loaded
    if _loaded:
        return
    if _CACHE_FILE.exists():
        try:
            _cache = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            logger.info(f"SMILES cache loaded: {len(_cache)} entries")
        except Exception as e:
            logger.warning(f"Could not load SMILES cache: {e}")
            _cache = {}
    if _MOL_CACHE_FILE.exists():
        try:
            _mol_cache = json.loads(_MOL_CACHE_FILE.read_text(encoding="utf-8"))
            logger.info(f"MOL cache loaded: {len(_mol_cache)} entries")
        except Exception as e:
            logger.warning(f"Could not load MOL cache: {e}")
            _mol_cache = {}
    if _COFACTORS_FILE.exists():
        try:
            with open(_COFACTORS_FILE, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cid = row.get("Compound ID", "").strip()
                    name = row.get("Name", "").strip()
                    if cid and name:
                        _cofactors[cid] = name
            logger.info(f"Cofactors loaded: {len(_cofactors)} entries")
        except Exception as e:
            logger.warning(f"Could not load cofactors: {e}")
    if _NAME_CACHE_FILE.exists():
        try:
            _name_cache = json.loads(_NAME_CACHE_FILE.read_text(encoding="utf-8"))
            logger.info(f"Name cache loaded: {len(_name_cache)} entries")
        except Exception as e:
            logger.warning(f"Could not load name cache: {e}")
            _name_cache = {}
    _loaded = True


def _save_cache():
    try:
        _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(json.dumps(_cache, indent=2, sort_keys=True), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not persist SMILES cache: {e}")


def _save_mol_cache():
    try:
        _MOL_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _MOL_CACHE_FILE.write_text(json.dumps(_mol_cache, indent=2, sort_keys=True), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not persist MOL cache: {e}")


def _fetch_smiles_pubchem(compound_id: str) -> Optional[str]:
    """Fetch SMILES from PubChem by KEGG compound ID (recognized as a name)."""
    try:
        resp = requests.get(_PUBCHEM_URL.format(compound_id), timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            props = data.get("PropertyTable", {}).get("Properties", [])
            if props:
                p = props[0]
                return (p.get("CanonicalSMILES")
                        or p.get("IsomericSMILES")
                        or p.get("ConnectivitySMILES"))
    except Exception as e:
        logger.debug(f"PubChem lookup failed for {compound_id}: {e}")
    return None


def _fetch_mol_kegg(compound_id: str) -> Optional[str]:
    """Fetch MOL file from KEGG REST API."""
    try:
        resp = requests.get(_KEGG_MOL_URL.format(compound_id), timeout=10)
        if resp.status_code == 200:
            text = resp.text.strip()
            if text and "M  END" in text:
                return text
    except Exception as e:
        logger.debug(f"KEGG MOL lookup failed for {compound_id}: {e}")
    return None


def get_smiles(compound_id: str) -> Optional[str]:
    """Return cached SMILES or fetch from PubChem. Returns None if unavailable."""
    _load_cache()
    if compound_id in _cache:
        return _cache[compound_id]

    smiles = _fetch_smiles_pubchem(compound_id)
    _cache[compound_id] = smiles
    _save_cache()
    return smiles


def get_smiles_batch(compound_ids: list) -> Dict[str, Optional[str]]:
    """
    Return SMILES for a list of compound IDs.
    Fetches missing ones from PubChem (rate-limited to avoid 429s).
    """
    _load_cache()
    result: Dict[str, Optional[str]] = {}
    to_fetch = []

    for cid in compound_ids:
        if cid in _cache:
            result[cid] = _cache[cid]
        else:
            to_fetch.append(cid)

    if to_fetch:
        logger.info(f"Fetching SMILES for {len(to_fetch)} compounds from PubChem...")
        for i, cid in enumerate(to_fetch):
            smiles = _fetch_smiles_pubchem(cid)
            _cache[cid] = smiles
            result[cid] = smiles
            # Rate limit: PubChem allows 5 req/sec
            if i < len(to_fetch) - 1:
                time.sleep(0.22)

        _save_cache()
        fetched = sum(1 for c in to_fetch if _cache.get(c) is not None)
        logger.info(f"Fetched {fetched}/{len(to_fetch)} SMILES successfully")

    return result


def get_mol_batch(compound_ids: list) -> Dict[str, Optional[str]]:
    """
    Return MOL file text for compounds. Only fetches for IDs not already cached.
    Rate-limited for KEGG API.
    """
    _load_cache()
    result: Dict[str, Optional[str]] = {}
    to_fetch = []

    for cid in compound_ids:
        if cid in _mol_cache:
            result[cid] = _mol_cache[cid]
        else:
            to_fetch.append(cid)

    if to_fetch:
        logger.info(f"Fetching MOL files for {len(to_fetch)} compounds from KEGG...")
        for i, cid in enumerate(to_fetch):
            mol = _fetch_mol_kegg(cid)
            _mol_cache[cid] = mol
            result[cid] = mol
            # KEGG rate limit: ~3 req/sec
            if i < len(to_fetch) - 1:
                time.sleep(0.35)

        _save_mol_cache()
        fetched = sum(1 for c in to_fetch if _mol_cache.get(c) is not None)
        logger.info(f"Fetched {fetched}/{len(to_fetch)} MOL files successfully")

    return result


def get_cofactor_names(compound_ids: list) -> Dict[str, str]:
    """Return cofactor display names for Z compound IDs."""
    _load_cache()
    return {cid: _cofactors[cid] for cid in compound_ids if cid in _cofactors}


def _save_name_cache():
    try:
        _NAME_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _NAME_CACHE_FILE.write_text(json.dumps(_name_cache, indent=2, sort_keys=True), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not persist name cache: {e}")


def _fetch_kegg_names_batch(compound_ids: list) -> Dict[str, str]:
    """Fetch compound names from KEGG in batches of 10."""
    result = {}
    BATCH = 10
    for i in range(0, len(compound_ids), BATCH):
        batch = compound_ids[i:i + BATCH]
        query = '+'.join(batch)
        try:
            resp = requests.get(_KEGG_GET_URL.format(query), timeout=15)
            if resp.status_code != 200:
                continue
            for entry in resp.text.split('///'):
                entry = entry.strip()
                if not entry:
                    continue
                entry_id = None
                name = None
                for line in entry.split('\n'):
                    if line.startswith('ENTRY') and entry_id is None:
                        parts = line.split()
                        if len(parts) >= 2:
                            entry_id = parts[1]
                    elif line.startswith('NAME') and name is None:
                        name = line[4:].strip().rstrip(';')
                if entry_id and name:
                    result[entry_id] = name
            if i + BATCH < len(compound_ids):
                time.sleep(0.35)
        except Exception as e:
            logger.debug(f"KEGG name fetch failed for batch starting {batch[0]}: {e}")
    return result


def get_compound_names_batch(compound_ids: list) -> Dict[str, str]:
    """
    Return display names for a list of C and Z compound IDs.
    Z compounds: always resolved from cofactors.csv (never cached in name_cache).
    C compounds: name_cache.json first, then fetched from KEGG and cached.
    """
    _load_cache()
    result: Dict[str, str] = {}
    c_to_fetch = []

    for cid in compound_ids:
        if cid.startswith('Z'):
            # Z compounds live only in _cofactors — check directly every time
            if cid in _cofactors:
                result[cid] = _cofactors[cid]
        elif cid.startswith('C'):
            if cid in _name_cache:
                if _name_cache[cid]:  # skip empty-string sentinels (known misses)
                    result[cid] = _name_cache[cid]
            else:
                c_to_fetch.append(cid)

    if c_to_fetch:
        logger.info(f"Fetching names for {len(c_to_fetch)} compounds from KEGG...")
        fetched = _fetch_kegg_names_batch(c_to_fetch)
        result.update(fetched)
        for cid in c_to_fetch:
            _name_cache[cid] = fetched.get(cid, '')  # '' = not found, avoid re-fetching
        _save_name_cache()
        found = sum(1 for c in c_to_fetch if fetched.get(c))
        logger.info(f"Fetched {found}/{len(c_to_fetch)} names successfully")

    return result
