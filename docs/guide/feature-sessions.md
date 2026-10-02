# Sessions

A **session** is a snapshot of your searches and results saved to a file, so you can come back to it, share it, or attach it to a paper or notebook.

---

## Exporting a session

1. Run one or more searches.
2. Click the **download arrow** in the top bar.
3. A file named `nebula-session-YYYY-MM-DD.json` is saved.

### What is saved

| Saved | Not saved |
|---|---|
| Your queries (modes, IDs, colours) | The viewer you were on, and Split view |
| All result rows (reactions with equations, EC, generations) | **Path Finder data** (see below) |
| **Combined view** on or off | Cofactor hiding |
| **Reaction Network** node positions | Selections, filters and **deleted reactions** |
| | Viewer settings (colours, text, sizes) and your theme |

---

## Importing a session

1. Click the **upload arrow** in the top bar.
2. Choose a session `.json` file.
3. NEBULA restores the queries, the results and the Reaction Network layout. **It does not run the searches again**, so it works offline.

> **Note:** Importing **replaces** your current session. Export first if you want to keep it.

### Getting Path Finder back

Sessions do not carry the Path Finder route graphs. After importing, Path Finder is empty until you press **Explore** again on the Cmpd queries. The other viewers work straight away.

---

## Good uses

- **Save progress.** Export at the end of a work session; import next time.
- **Share.** Send the file to a colleague; they see the same results and layout.
- **Reproducibility.** Attach the file to a paper or lab notebook as supplementary data. Results come from NEBULA's fixed local data, so the same query on the same release gives the same answer.

---

## Tips

- Session files are plain JSON. They can be kept in version control.
- Size depends on how many results you have; a few hundred kilobytes is typical.
- To save a **figure** rather than a session, use [Export and import](feature-export-import).
