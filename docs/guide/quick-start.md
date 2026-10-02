# Quick start (5 minutes)

This walk-through traces **L-Glutamate** (KEGG `C00025`). In NEBULA's data it first becomes reachable in **generation 9**, so its routes are long enough to be interesting but small enough to read.

---

## 1. Search

1. Click the search bar at the top (or press <kbd>Ctrl</kbd>+<kbd>K</kbd>).
2. Leave the mode on **Cmpd** (compound).
3. In **Target**, start typing `glutamate` and choose **L-Glutamate**.
4. Wait a second, or press **Explore**. NEBULA expands the network from the seed compounds and traces back from your target.

> **Tip:** Choose several targets with **Add query**. Each query gets its own colour, used in every viewer. See [Multi-search](feature-multi-search).

---

## 2. Read the reactions: Metabolome Records

The first viewer lists every reaction involved, one per row. The **transition** column says, for example, `3 -> 4`: the reactants were available at generation 3 and the product first appears at generation 4. See [Metabolome Records](view-metabolome-records).

---

## 3. See the routes: Path Finder

Click **Path Finder** in the switcher. You now see every *minimal* way to make L-Glutamate from seed compounds, drawn left to right by generation.

- **Squares** are reactions. A reaction needs *all* its inputs.
- **Circles** are compounds. Hollow = intermediate, large and filled = your target.
- **Dashed rings** mark compounds that more than one reaction can make: this is where routes branch.
- Click a **Path** in the left list to highlight it; click a **compound** or **reaction** to highlight every Path through it.

Press **Key** in the toolbar any time to see all symbols. Full guide: [Path Finder](view-path-finder).

---

## 4. See the whole network: Reaction Network

Switch to **Reaction Network**. Each reaction is drawn as a reactant box, an enzyme oval and a product box between compound circles, one band per generation. Use the timeline at the bottom to play through generations. See [Reaction Network](view-reaction-network).

---

## 5. Place it on the map: Metabolic Map

Switch to **Metabolic Map** to see your compounds on the KEGG global metabolism map. Open the settings arrow on the right and set **Edges** to **Pruned** to draw the reactions. See [Metabolic Map](view-metabolic-map).

---

## 6. Go to the enzyme

Back in Metabolome Records, click a blue **EC** button. The Protein Domain Viewer shows the proteins that carry out that reaction, their domains, the active and binding sites, and the 3D structure. See [Protein Domain Viewer](view-protein-domains).

---

## 7. Save your work

Use the download arrow in the top bar to export the whole session as a `.json` file, and the upload arrow to load it again. See [Sessions](feature-sessions).

---

## If something looks wrong

- **Path Finder is empty:** it is only available for **Cmpd** searches.
- **Metabolic Map shows dots but no arrows:** edges are hidden by default; set **Edges** to **Pruned** or **All**.
- **Text too small?** Use the **Aa − +** control in the Help menu or at the top of this page. It applies to the docs, tour, Quick Help and Key pop-ups.
- More answers: [FAQ and limitations](reference-limitations-faq).
