# NEBULA: Network of Enzymatic Biochemical Units, Links, and Associations

NEBULA is a web server for exploring metabolism together with the enzymes that run it. It keeps every reaction whole (all substrates and products, with stoichiometry) as a hypergraph, orders compounds by the generation of a network expansion from a seed set, finds every minimal route to a compound, and links each reaction to enzymes, protein domains and 3D structures (KEGG, UniProt, ECOD, AlphaFold).

- **Public server:** https://apollo2.chemistry.gatech.edu/NEBULA/
- **Preprint (not peer reviewed):** Banerjee, B., Smith, D. E., Goldford, J., Williams, L. D. & Petrov, A. S. *NEBULA: A webserver to analyze protein function and domain structure in stoichiometric metabolic contexts.* SSRN 7549379, https://ssrn.com/abstract=7549379
- **Source code:** https://github.com/Biswajit-Banerjee/NEBULA (MIT licence)

## Viewers

| Viewer | Use it to |
|---|---|
| **Metabolome Records** | Read exact reactions with equations, generation transitions and EC numbers; select, filter and delete. |
| **Path Finder** | See every minimal Path to a compound, with branch points, shared steps and a full symbol key. |
| **Metabolic Map** | Place results on the KEGG global metabolism map, coloured by generation. |
| **Reaction Network** | Explore the hypergraph generation by generation: complexes, enzymes and stoichiometry. |
| **Protein Domain Viewer** | Go from an EC number to proteins, ECOD domains, active and binding sites, and the AlphaFold structure. |

## Documentation

The user guide is in [`docs/guide/`](docs/guide/introduction.md) (Markdown with images) and is built into the application: press the **Help** button, then **Documentation**. Every viewer also has a **Key** button that explains each symbol it draws, and a guided tour and Quick Help are available from the Help menu. The documentation and tour follow the active theme and have a **text size** control (Aa − +).

Technical notes for developers: [`docs/nebula_scientific_description.md`](docs/nebula_scientific_description.md), [`docs/and_or_graph_traversal.md`](docs/and_or_graph_traversal.md), [`docs/color-system-inventory.md`](docs/color-system-inventory.md).

## Running locally

Requirements: Python 3 (packages in `requirements.txt`) and Node.js with npm.

```bash
git clone https://github.com/Biswajit-Banerjee/NEBULA.git
cd NEBULA

# Backend (FastAPI, port 8020)
pip install -r requirements.txt
cd backend
python -m uvicorn app.main:app --port 8020

# Frontend (Vite dev server, port 5173; proxies /api to the backend)
cd ../frontend
npm install
npm run dev
```

`run.sh` and `run.ps1` start and stop both services. To serve the built interface from the backend, run `npm run build` in `frontend/` (it writes to `backend/static`).

## Maintaining the documentation

- Pages live in `docs/guide/*.md` and are listed in `docs/guide/manifest.json`. Images go in `docs/guide/images/`.
- Symbols are defined once in `frontend/src/components/Key/keyData.js` (meanings) and `Glyphs.jsx` (drawings). Pages show them with `<nebula-key view="path-finder"></nebula-key>` or `![](sym:pf-seed)`, and the in-app **Key** buttons use the same data.
- Citations use `[[9]](references#ref-9)`; the numbered list is `docs/guide/references.md`.
- `npm run check:docs` checks links, anchors, images, glyph ids, citations and legacy names. `npm run check:docs-contrast` checks text contrast in all six themes.
- Screenshots: start the backend and the dev server, then run `node scripts/capture-docs-screenshots.mjs` in `frontend/` (uses the installed Chrome or Edge through `playwright-core`; needs internet for the protein and KEGG scenes). Pass scene names to capture only some, for example `pf rn`.

## Data

Reactions, compounds, generations and the cofactor list are bundled in `backend/data` and loaded at start-up, so results are reproducible for a given release. KEGG reaction definitions, UniProt records and AlphaFold structures are fetched on demand. See [Data sources](docs/guide/reference-data-sources.md).

## Licence

MIT. See [LICENSE](LICENSE).
