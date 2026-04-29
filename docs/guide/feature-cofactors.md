# Cofactor Filtering

Metabolic networks include many **cofactors/metal ions** — molecules like ATP, NAD+, Fe, and CoA that participate in a huge number of reactions. While biologically important, they can visually overwhelm network graphs and tables. The cofactors are defined as **Z**-compounds while kegg based compounds starts with **C**.

NEBULA's cofactor filtering lets you toggle these common metabolites on or off.

---

## How to Use

Click the **flask icon** in the top dock bar to toggle cofactor filtering:

- **On** — common cofactors are hidden from all views.
- **Off** — all compounds are shown, including cofactors.

The filter applies globally across Table, 2D, 3D, Map, and Backtrace views.

---

## What Gets Filtered

The filter removes compounds commonly classified as currency metabolites, including:

| ID | Compound ID | Name |
|-----|-------------|------|
| 1 | Z00001 | Iron sulfur (2Fe2S) |
| 2 | Z00002 | Iron sulfur (4Fe4S) |
| 3 | Z00006 | Cobalt |
| 4 | Z00015 | Iron |
| 5 | Z00016 | Iron sulfur (ferredoxin) |
| 6 | Z00020 | Iron sulfur (generic) |
| 7 | Z00029 | Magnesium |
| 8 | Z00030 | Manganese |
| 9 | Z00033 | Sodium |
| 10 | Z00034 | Nickel |
| 11 | Z00053 | Tungsten |
| 12 | Z00054 | Zinc |
| 13 | Z00055 | Calcium |
| 14 | Z00060 | Monovalent Metal |
| 15 | Z00062 | Vanadium |
| 16 | Z00063 | Iron sulfur (generic) |
| 17 | Z00064 | Molybdenum |
| 18 | Z00067 | Iron sulfur (3Fe4S) |
| 19 | Z00069 | Divalent Metal |
| 20 | Z00070 | Copper |

The exact list is maintained in the application's cofactor configuration.

---

## Impact on Views

- **Table** — rows involving only cofactors as distinctive compounds may appear simplified.
- **2D / 3D Network** — the graph becomes dramatically sparser and easier to read.
- **KEGG Map** — cofactor dots are hidden, decluttering the map.
- **Backtrace** — the tree structure remains complete; cofactor filtering primarily affects network views.

---

## Tips

- Toggling cofactors is instant — experiment freely.
- In split view, both panels respect the same filter state.
- Large networks (500+ nodes) benefit enormously from cofactor filtering.
