# Data sources and provenance

NEBULA joins several databases. Some are bundled with the server as fixed tables so results are reproducible; others are fetched on demand. This page lists what is where, so you know what to cite and what needs an internet connection.

> **Note:** Counts below describe the data bundled with the release this guide was written for. They will change as NEBULA is updated.

---

## Metabolic layer (bundled, fixed)

| Data | Content | Source |
|---|---|---|
| **Reactions** | About 13,300 reaction rows (each direction counted separately; about 9,700 distinct reaction IDs). Each keeps its full reactant and product sets, direction, `source`, `coenzyme`, EC list and the generation of reactants and products. Row sources: `KEGG` (about 7,700), `KEGG (Modified)` (about 5,600, the `_v` variants with explicit cofactors) and `Manual` (a few dozen added by hand, for example iron-sulfur synthesis steps). | KEGG [[1]](references#ref-1) |
| **Compounds and generations** | About 4,300 compounds with a generation each (67 at generation 0): about 4,250 `C` compounds, 69 `Z` cofactor roles. | KEGG [[1]](references#ref-1); network expansion of Goldford *et al.* [[9]](references#ref-9) |
| **Cofactor list** | 20 metals and iron-sulfur clusters treated as always available in searches. | NEBULA |
| **KEGG map** | The global metabolism map (`ko01100`): compound positions, background lines and region names. | KEGG [[1]](references#ref-1) |

All reactions are treated as reversible in the expansion, and every reaction is stored in both directions. NEBULA computes **mechanistic reachability**, not thermodynamic or kinetic feasibility [[9]](references#ref-9)[[10]](references#ref-10).

---

## Enzymatic layer

| Data | How it is used | Where it comes from |
|---|---|---|
| **EC to proteins** | A table of about 2,200 EC-and-organism pairs linking about 1,500 EC numbers to about 4,900 UniProt accessions. | NEBULA mapping (built through KEGG orthology, as described in the manuscript), bundled |
| **Protein records and sites** | Protein name, organism, residue-level **Active site** and **Binding site** features, ligand identifiers. | UniProt [[2]](references#ref-2), **fetched live**; ligands use ChEBI identifiers [[15]](references#ref-15) |
| **Domains** | About 730,000 domain assignments across about 410,000 UniProt entries, with residue ranges and the ECOD hierarchy. | ECOD [[5]](references#ref-5), bundled |
| **3D structure** | The AlphaFold model for the accession. | AlphaFold Database [[4]](references#ref-4), **fetched live**, shown with Mol\* [[14]](references#ref-14) |

Other databases the manuscript connects to are the Protein Data Bank [[3]](references#ref-3) and the Mechanism and Catalytic Site Atlas (M-CSA) [[6]](references#ref-6). AlphaFold models are used as the consistent structural reference because the same protein can have many PDB entries in different constructs, assemblies and resolutions.

---

## Fetched on demand (needs internet)

| When | What | From |
|---|---|---|
| Expanding a row | KEGG reaction definition | KEGG, requested by the NEBULA server |
| Expanding a row | KEGG reaction drawing | KEGG website (genome.jp), loaded by your browser |
| Opening the Protein Domain Viewer | Protein records and features | UniProt, requested by the NEBULA server |
| Protein 3D view | Structure file | AlphaFold Database, loaded by your browser |
| Page load | Fonts and the Mol\* library | Public CDNs |

The metabolic searches, Path Finder, Reaction Network and Metabolic Map use only data on the NEBULA server.

---

## Reproducibility

- The same query on the same NEBULA release always returns the same reactions and Paths.
- Path enumeration is deterministic and ordered shortest-first.
- Save a [session](feature-sessions) as supplementary data to preserve exactly what you saw.
- Cite the release or the date of use together with the preprint ([How to cite](references#how-to-cite)).

---

## Software

The server and the code are open source under the MIT licence: https://github.com/Biswajit-Banerjee/NEBULA. The public server is at https://apollo2.chemistry.gatech.edu/NEBULA/.
