# Cofactor filtering

Many reactions need a metal ion, an iron-sulfur cluster or a coenzyme in addition to their main substrates. They matter chemically, but they appear in so many reactions that they can bury the picture. The **eye icon** in the top bar hides them.

---

## Where it is

The **eye** in the top bar (it appears once you have results):

| Icon | State | Click to |
|---|---|---|
| Open eye | Cofactors are **shown** (default). | Hide them. |
| Closed eye | Cofactors are **hidden**. | Show them. |

> **Note:** The eye on a *query row* is different: it hides one search, not cofactors. See [Multi-search](feature-multi-search).

---

## What counts as a cofactor?

NEBULA writes cofactors as **`Z` compounds** ("Z" for the cofactor *role*), as opposed to `C` compounds from KEGG. There are 69 in the current data:

| Group | Examples | When they enter the network |
|---|---|---|
| **Metals** | Copper, Iron, Zinc, Magnesium, Calcium, Cobalt, Molybdenum, Tungsten, Divalent Metal, Monovalent Metal | Generation 0 (seed). |
| **Iron-sulfur clusters** | 2Fe2S, 3Fe4S, 4Fe4S, Generic FeS | Generation 0 (seed). |
| **Coenzymes and prosthetic groups** | NAD/NADP, CoA, FAD, FMN, PLP, SAM, Heme, Biotin, Glutathione, Ubiquinone … | At the generation where their own synthesis is complete. |

Metal centres are part of the seed set. For most other cofactors NEBULA includes a synthesis route in the network; when it is complete, a single *renaming reaction* (`RZ_…`) assigns the product to its conserved cofactor role [[9]](references#ref-9). That is why some coenzymes have a generation of their own.

### Two different "cofactor" ideas

| Where | Meaning |
|---|---|
| **The eye icon** (display) | Hides **every** `Z` compound from the views. |
| **Searches** (Path Finder) | NEBULA treats the **20 metals and iron-sulfur clusters** in its cofactor list as *always available*. They are not drawn as nodes and never limit a Path. Coenzymes such as NAD/NADP are *not* in that list; a route that needs them must first reach them. They appear in the Inspector under *Cofactors (assumed available)* when relevant. |

---

## What hiding does

When cofactors are hidden:

1. `Z` compounds are **removed from every equation** (for example `C00036 + Z00030 => C00022 + C00011 + Z00030` becomes `C00036 => C00022 + C00011`), and from generation lists.
2. A reaction that is **left with nothing on one side** is dropped.
3. **Variants are merged.** Reactions with the same base ID (for example `R00470` and `R00470_v1`) and the same remaining compounds and stoichiometry become **one** reaction, with their EC numbers combined.

Variants exist only because cofactors are written out explicitly, so with cofactors hidden you see each real transformation once ([Identifiers](concept-identifiers)).

The filter is **global**: it applies to every viewer, and to both sides of a [split view](feature-split-view).

---

## Effect on each viewer

| Viewer | Effect |
|---|---|
| Metabolome Records | Fewer rows (variants merged), cleaner equations. |
| Path Finder | Reaction variants that differ only in cofactors are merged into one square. |
| Reaction Network | Far fewer nodes and lines; easier to read. |
| Metabolic Map | Cofactor dots disappear. |

---

## When to use it

- **Hide** to see the core chemistry: the carbon skeleton transformations.
- **Show** when cofactors are the point, for example when you want to see which metal or coenzyme a step needs.
- Large networks (hundreds of nodes) benefit most from hiding.
