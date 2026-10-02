# Linked selection

Path Finder can **drive the other viewers**. Select a Path (or a compound or reaction) there, and Metabolome Records, Reaction Network and Metabolic Map show only the reactions involved. This lets you take one route out of a big network and study it everywhere.

---

## How to use it

1. Open [Path Finder](view-path-finder).
2. Make sure **Linked** is on in the toolbar (the default).
3. Click a Path card, a compound, or a reaction.
4. Switch to another viewer, or use [Split view](feature-split-view) to see both.

The other viewers now show **only the reactions of the selection**:

- a **Path:** exactly its reactions;
- a **compound or reaction:** every reaction on any Path through it.

A chip at the top of the screen says what is being shown:

> **Showing Path 3 → L-Glutamate · 7 reactions**   [Open in Path Finder]  [×]

- **Open in Path Finder** jumps back.
- **×** (or <kbd>Esc</kbd> in Path Finder) removes the filter and shows everything again.

The Inspector in Path Finder carries a matching banner: *Table, Network and Map views are filtered to this selection*.

---

## Turning it off

Click **Linked** to switch to **Unlinked**. Selections in Path Finder then stay in Path Finder.

---

## Deleted reactions and "broken" Paths

If you delete reactions in [Metabolome Records](view-metabolome-records):

- Path Finder draws them as **dashed red squares with a struck-through ID**.
- Any Path that uses one is marked **broken** in the list.
- Restore them from the red **N deleted** badge to repair the Paths.

---

## Why every reaction of a Path is available elsewhere

When NEBULA searches, it sends every reaction of every listed Path to the other viewers, so focusing a Path never leaves gaps. (If you switch route mode or press *Search deeper*, the rows refresh.)

---

## Tips

- Combine with **Metabolic Map** to see where a route runs in the global map.
- Combine with **Reaction Network** and the generation timeline to watch a single route unfold generation by generation.
- Use **Isolate** and **Export SVG** in Path Finder when you want a clean figure of a single route.
