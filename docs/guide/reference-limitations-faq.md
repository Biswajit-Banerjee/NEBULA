# FAQ and limitations

---

## Limitations

These are inherent to how NEBULA works [[9]](references#ref-9).

| Limitation | What it means for you |
|---|---|
| **Mechanistic, not thermodynamic or kinetic.** | A Path says a route is *chemically complete* given the reactions in the database. It does not say the route is energetically favourable, fast, or used by any organism. Reactions are treated as reversible and all enzymes as available during the expansion. |
| **Coverage follows KEGG.** | Gaps in KEGG's reaction annotation, and uneven residue-level curation in UniProt, carry through to NEBULA. |
| **AlphaFold models are predictions.** | They are uniform and complete, but they lack the ligand and conformational information found in experimental structures. |
| **Generation is a property of the seed set.** | Change the seed set and generations change. Generation means "distance from the seeds in the expansion", not time. |
| **The metabolic layer is a fixed copy.** | Results are reproducible, but they will not reflect KEGG updates until NEBULA is updated. |
| **Path lists can be capped.** | Some targets have more Paths than can be listed. See [AND-OR logic and Paths](concept-and-or-paths#when-the-list-is-capped). |

The manuscript names natural extensions: thermodynamic constraints, organism-specific gene content for comparative back-tracing, and phylogenetically dated fold ages.

---

## Frequently asked questions

### Which viewer should I use?

| I want to… | Use |
|---|---|
| Read exact reactions, filter, delete, find enzymes | [Metabolome Records](view-metabolome-records) |
| See every way to make a compound | [Path Finder](view-path-finder) |
| See where compounds sit in global metabolism | [Metabolic Map](view-metabolic-map) |
| See reactants, enzymes and products, generation by generation | [Reaction Network](view-reaction-network) |
| Study the enzyme, its domains and structure | [Protein Domain Viewer](view-protein-domains) |

### Why is Path Finder empty?
It only works for **Cmpd** searches. If you imported a [session](feature-sessions), press **Explore** again to rebuild it.

### The Metabolic Map shows dots but no arrows.
Edges are hidden by default. Open **Map Settings** and set **Edges** to **Pruned** or **All**.

### Why does the same reaction appear twice?
Each reaction is stored in both directions, and some reactions have `_v1`, `_v2` variants that write cofactors explicitly. Hide cofactors (eye icon) to merge variants. See [Identifiers](concept-identifiers).

### What is a "seed" compound?
A compound assumed available from the start of the network expansion (generation 0). See [Generations](concept-generations).

### What is the difference between generation, steps and depth?
- **Generation:** when the expansion first reaches a compound.
- **Steps:** how many reactions are in a Path.
- **Depth:** the longest chain of reactions in a Path that must run one after another.

### What does a hollow square in Path Finder mean?
A reaction that is valid on a route to the target but is not part of any *listed* Path. See the [Path Finder key](view-path-finder#reactions-are-squares).

### Why is my target missing or "unreachable"?
It may not be reachable from the seed set (and your Source) with the reactions in the data. A yellow card in Path Finder explains which case applies.

### Why do expanded rows or the protein viewer fail to load?
They fetch data from KEGG, UniProt or AlphaFold. Check your internet connection and try again later.

### Can I use NEBULA offline?
The metabolic viewers use only data on the NEBULA server, but the server itself fetches KEGG definitions, and your browser loads fonts and the 3D library from the internet. Protein views need UniProt and AlphaFold.

### My text is too small, or too large.
Use the **Aa − +** control in the Help menu. See [Themes and accessibility](feature-themes-accessibility).

### Can I get the data as a file?
Yes: session export (JSON) and SVG/PNG figures. See [Export and import](feature-export-import). The server also offers a CSV download endpoint ([API](reference-api)).

### How do I cite NEBULA?
See [How to cite](references#how-to-cite).

---

## Reporting a problem

Open an issue at https://github.com/Biswajit-Banerjee/NEBULA. Please include the query you ran, the viewer you were in, and, if possible, a session file.
