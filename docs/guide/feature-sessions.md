# Session Management

NEBULA lets you **export** and **import** your entire session, including search queries, results, and view state. This makes it easy to save your work, share it with colleagues, or pick up where you left off.

---

## Exporting a Session

1. Run one or more searches so you have results loaded.
2. Click the **download icon** in the top dock bar.
3. A `.json` file is saved to your downloads folder containing your full session state.

The export includes:

- All search queries (modes, queries, colors)
- All result data (reactions, compounds, tree data)
- View preferences and selections

---

## Importing a Session

1. Click the **upload icon** in the top dock bar.
2. Select a previously exported `.json` session file.
3. NEBULA restores the session — queries, results, and view state load automatically.

> **Note:** Importing replaces your current session. Export first if you want to keep your current work.

---

## Use Cases

- **Save progress** — export at the end of a session, import next time.
- **Share with colleagues** — send the JSON file; they import it and see exactly what you saw.
- **Reproducibility** — attach session files to publications or lab notebooks as supplementary data.

---

## Tips

- Session files are plain JSON — they can be version-controlled, manually edited, and stored alongside your research data.
- The file size depends on the number and complexity of your searches (typically a few hundred KB).
- After importing, all views are immediately available — switch between Table, Network, Map, and Backtrace as usual.
