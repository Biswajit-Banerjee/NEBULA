# API reference

NEBULA's viewers are built on a small HTTP API. You can call it yourself, for example to script a batch of searches. All paths below are relative to the API base (`/api` on a local server, or `https://apollo2.chemistry.gatech.edu/NEBULA/api` on the public server).

> **Note:** This API exists to serve the web interface and may change between releases. For reproducible work, record the NEBULA release you used.

---

## Searches

| Endpoint | Parameters | Returns |
|---|---|---|
| `GET /backtrace/tree` | `target` (`C#####` or `Z#####`), `source` (optional, comma-separated), `mode` (`parallel` or `earliest`), `max_paths` (1 to 20000) | The Path Finder data: the route graph (`graph.compounds`, `graph.reactions`), the listed Paths (`solutions`) and groups (`clusters`), summary `stats`, and the flat reaction rows (`data`) used by the other viewers. |
| `GET /backtrace` | `target`, `source` | Flat backtrace rows only. |
| `GET /reaction/backtrace` | `reaction` (`R#####`) | Rows for the reaction's products, traced back. |
| `GET /ec/reactions` | `ec` (`N.N.N.N`) | Rows for every reaction with that EC. |
| `GET /compounds/reactions` | `compounds` (comma-separated), `match` (`any` or `all`) | Rows for reactions involving the compounds. |
| `GET /search` | `type`, `query` | A single-record lookup. |

### Anatomy of `/backtrace/tree`

Abridged, with illustrative values:

```json
{
  "target": "C00025",
  "graph": {
    "compounds": [{ "id": "C00025", "level": 9, "role": "target", "pathCount": 120 }],
    "reactions": [{ "id": "R00243_forward", "reaction": "R00243", "direction": "forward",
                    "equation": "C00025 + ...", "ecList": ["1.4.1.2"], "level": 9,
                    "reactants": ["..."], "products": ["..."], "sideProducts": [],
                    "cofactors": [], "pathCount": 40 }]
  },
  "solutions": [{ "id": 0, "reactionCount": 7, "depth": 5, "reactionIds": ["..."], "steps": [1, 2, 3] }],
  "clusters": [],
  "stats": { "total_solutions": 120, "truncated": false, "distinct_routes": 120 },
  "data": []
}
```

- `role` is `target`, `source`, `seed`, `intermediate` or `cofactor`.
- `reactionIds` are listed in firing order.
- `pathCount` is the number of listed Paths that use the item (the *share* shown as line width).
- `products` lists only the compounds a reaction actually supplies on some route.
- `data` always contains every reaction of every listed Path, so another viewer never has gaps when you focus a Path.

---

## Records and lookups

| Endpoint | Returns |
|---|---|
| `GET /compound/{compound_id}` | Name, formula, masses (from KEGG). |
| `GET /reaction/{reaction_id}` | Definition and equation (from KEGG). |
| `GET /ec/{ec_number}` | EC information. |
| `POST /compound-names` | Names for a list of compound IDs. |
| `POST /smiles` | SMILES for compounds. |
| `POST /substructure-search` | Compounds in a list that match a SMARTS/SMILES pattern (backbone search). |
| `GET /download/csv` | The current reaction table as CSV. |

---

## Enzymes and proteins

| Endpoint | Returns |
|---|---|
| `GET /ec/{ec_number}/accessions` | UniProt accessions (with organism codes) for the EC; instant, no external calls. |
| `GET /ec/{ec_number}/uniprot` | UniProt records for the EC, filtered to *Active site* and *Binding site* features. |
| `GET /ec/{ec_number}/domains` | The same, joined with ECOD domains and residue ranges. |
| `GET /accession/{accession}/domains` | The same for one accession (`organism_code` optional). |

---

## Map data

| Endpoint | Returns |
|---|---|
| `GET /kegg-layout` | Compound positions on the KEGG global map plus precomputed fallback positions. |
| `GET /kegg-conf-lines` | Reaction line geometry of the map. |
| `GET /kegg-map-bg?variant=lines\|text` | The map background SVG (lines, or region names). |

## Documentation

| Endpoint | Returns |
|---|---|
| `GET /docs/manifest` | The list of documentation pages. |
| `GET /docs/{slug}` | A page as Markdown. |
| `GET /docs-assets/{file}` | A documentation image. |
| `GET /health` | Server status. |

---

## Example

```bash
curl "https://apollo2.chemistry.gatech.edu/NEBULA/api/backtrace/tree?target=C00025&mode=parallel&max_paths=2000"
```

See [AND-OR logic and Paths](concept-and-or-paths) for what the numbers mean.
