# Identifiers and data sources

Short guide to the codes you will meet in NEBULA, and where the information behind them comes from.

---

## Compounds

| Pattern | Example | Meaning |
|---|---|---|
| `C#####` | `C00025` (L-Glutamate) | A KEGG compound [[1]](references#ref-1). |
| `Z#####` | `Z00070` (Copper), `Z00032` (NAD/NADP) | A NEBULA **cofactor-role compound**; there are 69 in the data. Metal centres and iron-sulfur clusters (for example *Copper*, *Divalent Metal*, *4Fe4S*) are generation 0. Conserved coenzymes (for example *NAD/NADP*, *CoA*, *FAD*, *PLP*, *Heme*) enter the network at the generation where their own synthesis completes. They are not KEGG compounds. |

You can search compounds by name or by ID; the search box suggests matches as you type.

---

## Reactions

| Pattern | Example | Meaning |
|---|---|---|
| `R#####` | `R00243` | A KEGG reaction [[1]](references#ref-1). |
| `R#####_v1`, `_v2` … | `R00470_v1` | A **variant** of a KEGG reaction in which a cofactor or metal that KEGG leaves implicit is written out (for example `+ Z00029` for magnesium). The *coenzyme* column names it. Variants have the same reaction number as their parent. |
| `RZ_#` | `RZ_515` (`C00070 => Z00070`) | A NEBULA-defined **renaming reaction** that turns a KEGG compound into its cofactor-role pseudo-compound (here copper). It is bookkeeping, not KEGG chemistry. |

Every reaction can appear in **both directions** (`forward` and `reverse`). Path Finder marks reverse steps with `(reverse)`.

### The *source* column

| Value | Meaning |
|---|---|
| `KEGG` | A reaction as curated in KEGG. |
| `KEGG (Modified)` | A KEGG reaction rewritten with explicit cofactors (the `_v` variants). |
| `Manual` | A reaction added by hand to NEBULA. |

---

## Enzymes

| Code | Meaning |
|---|---|
| **EC number** (`1.4.1.2`) | The Enzyme Commission class. The four numbers describe the reaction class from broad to specific. EC classifies the *reaction*, not a particular gene or structure. |
| **KO** (KEGG Orthology) | A group of genes treated as functionally equivalent in KEGG. It connects functions to genes. Several KOs can share an EC number [[1]](references#ref-1). |
| **UniProt accession** (`P23368`) | A specific protein sequence record, with residue-level annotations [[2]](references#ref-2). |
| **ECOD domain** (`nD1`, family `2003.1.1.49`) | An independently folded region of a protein, classified by evolutionary relationships [[5]](references#ref-5). The first number of a numeric family id is the X-group (2003 is the Rossmann-like X-group mentioned in the manuscript). |

The hierarchy is: **reaction → EC → KO → genes → UniProt proteins → ECOD domains**. The manuscript explains why none of these alone is enough: EC does not specify sequence, KO does not resolve domain architecture, and domains alone do not say which reaction is catalysed.

The ECOD levels are **A** (architecture), **X** (possible homology), **H** (homology), **T** (topology) and **F** (family). See [Protein Domain Viewer](view-protein-domains).

---

## Where each kind of data comes from

| Layer | Source | When it is read |
|---|---|---|
| Compounds and reactions | KEGG-derived tables shipped with NEBULA [[1]](references#ref-1) | Loaded at start-up; every search uses this fixed copy. |
| Generations | Network expansion of Goldford *et al.* [[9]](references#ref-9) | Loaded at start-up. |
| Cofactor list | NEBULA configuration | Loaded at start-up. |
| Reaction definitions and drawings (expanded rows) | KEGG website | On demand, when you expand a row. Needs internet access. |
| EC → proteins | NEBULA's EC-to-UniProt mapping | On demand. |
| Protein records, active and binding sites | UniProt [[2]](references#ref-2) | On demand. |
| Domains | ECOD [[5]](references#ref-5) | Read from NEBULA tables. |
| 3D structure | AlphaFold Database [[4]](references#ref-4), shown with Mol\* [[14]](references#ref-14) | On demand. |

Because the metabolic layer is a fixed local copy, results are reproducible for a given NEBULA release.

---

## Where these codes appear

- [Metabolome Records](view-metabolome-records) shows `reaction`, `source`, `coenzyme`, `transition` and `ec`.
- [Path Finder](view-path-finder) prints reaction IDs above each square.
- [Cofactor filtering](feature-cofactors) hides the cofactor set.
