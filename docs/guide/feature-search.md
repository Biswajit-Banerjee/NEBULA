# Search modes

Open the search dock (click the bar or press <kbd>Ctrl</kbd>+<kbd>K</kbd>) and choose a **mode** from the drop-down on the left of each row. NEBULA has four.

| Mode | Label | You give | You get |
|---|---|---|---|
| Compound | **Cmpd** | A **Target** compound, and optionally a **Source** | Every reaction involved in making the target, and the minimal [Paths](concept-and-or-paths) to it. |
| Reaction | **Rxn** | A KEGG reaction ID (`R00217`) | The reaction's products, traced back like a compound search. |
| Enzyme | **EC** | An EC number (`1.1.1.1`) | Every reaction that carries that EC number. |
| Compound set | **Cmpds** | Several compounds, and **Any** or **All** | Every reaction that involves those compounds. |

Changing the mode clears the row so you start fresh.

---

## Cmpd: find how a compound is made

This is the main mode and the only one that fills [Path Finder](view-path-finder).

1. Choose **Cmpd**.
2. **Target \*:** type a name (`glutamate`) or ID (`C00025`) and pick from the list.
3. **Source (optional):** a compound you want every route to start from.
4. Press **Explore**, or wait a second after choosing the target.

NEBULA expands the network from the seed compounds (generation 0) plus any source, traces back from the target, and keeps only complete routes. See [Generations](concept-generations) and [AND-OR logic and Paths](concept-and-or-paths).

**What the Source does.** With no source, Paths may start from any seed compound. With a source, **every Path must consume it**, and compounds that are not seeds can be starting points. This is useful when your starting material is not in the seed set, for example "how is L-Glutamate made from pyruvate?"

You can use compound names or IDs. `C` IDs are KEGG compounds; `Z` IDs are NEBULA's cofactor and metal pseudo-compounds ([Identifiers](concept-identifiers)).

---

## Rxn: start from a reaction

Enter a KEGG reaction ID (`R` followed by five digits), for example `R00217`. NEBULA finds the reaction's products and backtraces them, giving results in the same form as a compound search.

---

## EC: start from an enzyme

Enter an EC number in the form `N.N.N.N` (for example `4.2.3.1`). You get every reaction in NEBULA's data annotated with that EC number. Click an EC button in [Metabolome Records](view-metabolome-records) to continue to the [Protein Domain Viewer](view-protein-domains).

---

## Cmpds: start from a set of compounds

1. Choose **Cmpds**.
2. In **Add a compound…**, pick compounds one at a time. Each appears as a small tag with an **×** to remove it.
3. Choose how to combine them:
   - **Any:** a reaction qualifies if it involves **at least one** of the compounds.
   - **All:** a reaction qualifies only if it involves **every** one of them.

A compound "involved" means it is a reactant or a product.

---

## Autocomplete

Every field suggests matches as you type, by name or ID. Pick one from the list to fill the field. Invalid IDs (for example a reaction ID in a compound field) are rejected.

---

## What a search returns

All four modes fill [Metabolome Records](view-metabolome-records), [Reaction Network](view-reaction-network) and [Metabolic Map](view-metabolic-map). **Only Cmpd** fills [Path Finder](view-path-finder).

The green number on a query row is how many reactions it returned. A query with no results shows no number.

---

## Searching several things at once

Press **Add query** to add a row. Each row has its own mode and its own colour. See [Multi-search](feature-multi-search).

---

## Examples to try

| Goal | Search |
|---|---|
| How is L-Glutamate made? | **Cmpd**, target `C00025` |
| ... starting from pyruvate | **Cmpd**, source `C00022`, target `C00025` |
| Compare two amino acids | Two **Cmpd** rows: `C00025` and `C00041` (L-Alanine) |
| What does a given enzyme class do? | **EC** `2.6.1.2` |
| Reactions involving both pyruvate and glutamate | **Cmpds**, `C00022` and `C00025`, **All** |
