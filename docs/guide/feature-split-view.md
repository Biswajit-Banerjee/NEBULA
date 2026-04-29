# Split View

NEBULA supports a **split view** mode that displays two views side by side. This is the most effective way to cross-reference different representations of the same data.

---

## Activating Split View

1. Click the **Split** button in the view switcher bar at the bottom.
2. A secondary view selector appears — choose any view different from the primary.
3. Click **Single** to return to a single-view layout.

---

## Recommended Combinations

| Primary       | Secondary      | Use Case                                                        |
| ------------- | -------------- | --------------------------------------------------------------- |
| **Table**     | **2D Network** | Browse tabular data while seeing the graph structure             |
| **2D**        | **3D Network** | Compare 2D and 3D layouts of the same network                   |
| **Table**     | **Backtrace**  | Review reactions alongside the biosynthetic tree                 |
| **Map**       | **2D Network** | See KEGG positions next to the force-directed layout             |

---

## Synced State

Both views share the same underlying data and state:

- **Row selection** — selecting a reaction in one view highlights it in the other.
- **Cofactor filtering** — toggling cofactors applies to both views.
- **Search chips** — both views show results from all active chips.

---

## Tips

- Split view works best on screens 1440px or wider. On smaller screens, views may feel cramped.
- The view switcher prevents selecting the same view for both panels.
- You can change either panel independently without losing selections.
