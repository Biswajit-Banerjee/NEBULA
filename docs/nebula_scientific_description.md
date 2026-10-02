# NEBULA: An Integrated Platform for Exploring Metabolic and Enzymatic Space

> Technical description. The user guide (what each viewer, symbol and control means) is in [`guide/`](guide/introduction.md) and is also available inside the application through the Help button.

## 1. NEBULA

### Data Layer

NEBULA is an interactive computational framework for reconstructing and interrogating metabolic systems across multiple biological levels. In the current implementation, the core metabolic network is loaded from versioned local data products when `MetabolicViewer` is initialized; selected annotations and records are then retrieved from external services on demand. The backend harmonizes these inputs into tabular results and an in-memory directed B-hypergraph. This representation enables a query to be examined simultaneously as a chemical transformation, a biochemical route, an enzyme-associated activity, and a protein-domain relationship.

The data layer is organized into three interconnected categories.

#### i. Enzyme Commission and Reaction Space

The principal reaction dataset is `backend/data/simulations.csv`. Each row contains a reaction display identifier, direction, source label, coenzyme, equation, reactant and product strings, reactant and product generation values, a reaction identifier, and a comma-separated `ec_list`. The current file contains records labelled `KEGG` and `KEGG (Modified)`, so KEGG provenance is retained in the row but the graph is not rebuilt by querying KEGG for every startup or backtrace request. A compound or reaction query filters and traverses this local dataset through the FastAPI endpoints `/api/backtrace`, `/api/reaction/backtrace`, `/api/ec/reactions`, and `/api/compounds/reactions`.

Because a metabolic reaction can involve several substrates and products, each row is parsed into a directed hyperedge rather than a collection of pairwise edges. `HyperGraph.from_dataframe` extracts identifiers matching `[CZ]` followed by five digits from the `reactants` and `products` fields, stores them as frozen sets, and indexes each edge in `produced_by` and `consumed_by`. The edge retains the equation, direction, source, coenzyme, generation values, reaction identifier, and parsed EC list. Thus, the graph preserves the complete participant sets while supporting constant-time lookup of reactions that produce or consume a compound.

Network-expansion information is supplied by `backend/data/generations.csv`, which contains `compound_id`, compound name, the original generation fields, and `modified_generation`. At startup, the viewer indexes this file by `compound_id` and uses `modified_generation` as the active `gen_mapper`. The Goldford-derived expansion data therefore enter the runtime as a local compound-to-generation mapping, rather than as a separate external request. The mapping is used to impose generation bounds, identify generation-zero leaves, compute reaction transitions, and annotate every returned equation with a `compound_generation` dictionary.

#### ii. Gene and Protein Space

The current code resolves proteins from an EC number through `backend/data/gene_mapper.json`. Its keys have the form `EC:organism_code`, and each value is a list of UniProt accessions. This is an indexed association from an EC and organism context to candidate proteins; it is not a runtime KEGG KO query. Gene names and protein names are available in the local domain table when present, but the exposed EC-to-accession path is the concrete mapping implemented by `get_uniprot_entries_from_mapper` and `list_accessions_for_ec`.

For each mapped accession, the backend calls the UniProt REST API at `https://rest.uniprot.org/uniprotkb/{accession}` and parses the JSON response into a `UniProtEntry`. The entry retains the primary accession, a display identifier combining organism name and UniProtKB identifier, the supplied organism code, and parsed protein features. If the local mapper has no entries for an EC, the implementation falls back to the UniProt search endpoint with the query `ec:{EC}` and cursor pagination. In the current frontend, the 3D viewer then queries `https://alphafold.ebi.ac.uk/api/prediction/{accession}`, obtains a BCIF or CIF URL, and renders it through PDBe Mol*; this path is explicitly AlphaFold-based. A PDB structure is not currently fetched by the implemented Mol* component.

#### iii. Catalytic-Domain Space

To resolve catalytic function at the domain level, NEBULA integrates two local tables. `ecod_domains.csv` is matched to a UniProt entry by `uniprot_id == primary_accession` and supplies ECOD domain identifiers, descriptive family identifiers, and residue ranges. `domains.csv` supplies complementary local domain metadata and a numeric family identifier. The integration code matches `domains.csv` on accession and domain ID, parses ranges such as `11-275` into start/end objects, and attaches the resulting domains to the UniProt entry.

The catalytic-domain layer complements the reaction and protein layers by distinguishing the existence of an enzyme from the specific structural region responsible for its activity. In combination with residue-level and structural information, this mapping supports inspection of catalytic binding sites and comparison of functional domains across proteins.

#### Integrated Graph Representation and Session Model

The harmonized reaction data are stored as an in-memory graph during application startup. `HyperGraph` stores `HyperEdge` objects for reactions and maintains reverse indexes from compounds to producing or consuming edges. Protein and domain records are loaded through separate API paths and are returned as nested JSON records rather than inserted into the reaction hypergraph. This distinction is important: the current implementation links the views through shared identifiers and API responses, while the principal traversable graph is the compound-reaction graph.

The current backend exports the active tabular result as CSV through `/api/download/csv`; the exported filename includes the current target. The frontend also supports session-oriented import/export for the broader application state. Consequently, a session should be understood as an application-level snapshot, while the backend CSV endpoint specifically serializes the current reaction dataframe and not the complete external annotation cache.

### Concrete Data Flow and Provenance

At startup, `MetabolicViewer` reads `simulations.csv`, `generations.csv`, `domains.csv`, `ecod_domains.csv`, `cofactors.csv`, and `gene_mapper.json` from `backend/data`. It builds the generation mapper, stores the cofactor IDs from the `Compound ID` column, and constructs the hypergraph from the simulation dataframe. The application therefore has a deterministic local reaction substrate before any user request is made.

For a compound backtrace, the legacy tabular path begins with the target compound, looks up rows in which that compound appears in `products`, retains the earliest product-generation rows, and recursively adds the compounds found in the selected rows' `reactants`. It does not traverse compounds above the target generation and stops at generation-zero compounds. Cofactors listed in `cofactors.csv` are treated as already processed when cofactor filtering is enabled. The result is normalized into display columns including `reaction`, `source`, `coenzyme`, `equation`, `transition`, `target`, `ec_list`, `compound_generation`, and `max_generation`.

The tree path uses the same loaded reaction records through `HyperGraph`. A compound is an OR-node because any producing reaction may satisfy it; a reaction is an AND-node because all of its reactants are required. `backward_reachability` recursively expands producer edges, memoizes shared compounds, detects cycles through the ancestor path, and treats cofactors, explicit source compounds, generation-zero compounds, and unknown-generation compounds as leaves. The endpoint returns the nested tree, traversal statistics, up to 500 enumerated reaction solutions, and a flat reaction list used by the table and network views.

EC and protein requests follow a separate path. `/api/ec/{ec_number}/accessions` performs a local mapper lookup and returns accession/organism-code pairs without external calls. `/api/ec/{ec_number}/uniprot` resolves those pairs to live UniProt records and filters features to `Active site` and `Binding site`. `/api/ec/{ec_number}/domains` performs the same retrieval and feature filtering, then joins the results to ECOD and local domain tables. `/api/accession/{accession}/domains` performs the equivalent workflow for one accession. This separation allows the interface to show an immediate accession list before requesting potentially slower remote protein records.

### Architecture

The NEBULA backend is implemented in Python and provides the computational layer for processing, storing, and traversing the multilayer metabolic hypergraph. Its core operations include external data retrieval, identifier mapping, annotation integration, generation-aware graph construction, and AND-OR traversal of alternative biosynthetic routes. The directed hypergraph formulation is particularly suited to metabolism because a single reaction may require a conjunction of substrates while offering alternative reaction choices during route reconstruction.

The frontend presents these computations as coordinated analytical views. A common query state is propagated across the viewers so that the same metabolic result can be inspected as a reaction table, a pathway map, a generational network, or a protein and domain structure. This separation between a computational backend and synchronized visual interfaces allows complex biological relationships to remain queryable without reducing them to a single visualization format.

### Frontend Architecture

#### Interface Overview

NEBULA organizes the user interface around complementary views of the same integrated dataset. The interface is designed to support progressive movement from high-level metabolic context to reaction-level detail and finally to enzyme and protein structure.

##### a. Metabolome Records

Metabolome Records provides a compact, searchable representation of the reactions returned by a query. Each row can be interpreted as a biochemical transformation and is accompanied by its substrates, products, associated EC information, enzyme annotations, and generation metadata where available. The tabular format is intended for exact inspection, comparison, and filtering of records that may be difficult to read in a graph layout.

Because the table retains the identifiers used by the integrated data layer, it also serves as a navigational entry point. Selecting a reaction or compound can be used to follow its relationships into the metabolic map, generational network, or protein-oriented views.

##### b. Metabolic Map

The Metabolic Map places query-associated compounds and reactions in pathway space using KEGG-derived layouts or an interactive layout computed from the available network data. The KEGG layout preserves the spatial organization of curated pathway maps, whereas the interactive layout supports exploration when a query spans multiple regions or when a custom network arrangement is more informative.

This view provides pathway-scale context: it shows how the queried transformation is situated among neighboring reactions and compounds and helps users identify branches, convergent routes, and disconnected regions. Interactive navigation allows the user to inspect individual map entities while retaining the broader organization of metabolism.

##### c. Reaction Network

The Reaction Network represents the metabolic result as a network whose compounds and reactions are positioned according to their inferred generational relationships. The 2D view emphasizes overview, filtering, and direct manipulation of the network.

Generation controls allow users to restrict the visible network to a selected interval or to step through successive generations. This makes it possible to examine the expansion of metabolic space from source compounds toward a target and to distinguish direct transformations from more distant alternatives. The graph view is therefore both a visualization and an analytical aid for evaluating route depth, branching, and network connectivity.

##### d. Path Finder

Path Finder presents, for each compound query, every minimal stoichiometrically realizable route from the seed (generation-0) and any user-defined source compounds to the target, computed by AND-OR hyperpath enumeration (see [`and_or_graph_traversal.md`](and_or_graph_traversal.md)). Species are OR vertices and reactions are AND vertices; the graph is laid out by generation and a side panel ranks the routes from fewest to most steps. Selections propagate to the other viewers. A symbol-by-symbol description is in [`guide/view-path-finder.md`](guide/view-path-finder.md).

## 2. Map of Stoichiometrically Significant Metabolism

NEBULA maps stoichiometrically significant metabolism by preserving the complete reactant and product sets of each reaction. Rather than treating a reaction as an independent edge between two individual compounds, the platform models it as a directed hyperedge that records the transformation as a multicomponent event. This representation retains substrate conjunctions, coproducts, and cofactors that would otherwise be lost in a pairwise network projection.

The resulting map can be examined at several scales. At the pathway scale, the KEGG-based viewer situates reactions within curated metabolic organization. At the network scale, the interactive layout exposes connectivity across pathways and supports inspection of compounds shared between transformations. At the reaction scale, the table provides the identifiers and stoichiometric participants needed to verify the interpretation of a particular transformation.

### Reaction Network

The generational viewer adds a developmental coordinate to the stoichiometric network. Compounds are assigned generation values derived from the network-expansion data, and reactions inherit the generational context of the compounds they connect. A target compound can consequently be traced backward through alternative reactions until source or generation-zero compounds are reached.

Generation-aware rendering supports rapid comparison of route depth, branching, and local connectivity, and retains interaction with individual nodes and reactions, allowing the user to move from a global map to the biochemical records underlying a selected feature.

## 3. Linking Metabolic and Enzymatic Space

NEBULA links metabolic space to enzymatic space through the identifiers implemented in its data products and API responses: reaction and EC number, organism-qualified UniProt accession, structure record, and ECOD domain. Gene names and KO identifiers may occur in supporting annotation products, but the current runtime protein route is explicitly EC plus organism context to UniProt accession, followed by UniProt features and ECOD domain ranges. This chain connects the chemical question, “Which transformations produce or consume this compound?”, to the mechanistic question, “Which protein and catalytic region carries out the transformation?”

The linkage is intentionally multi-level. EC and reaction records describe biochemical function; the mapper supplies organism-qualified candidate accessions; UniProt records provide protein identity and residue-level features; the frontend obtains predicted coordinates from the AlphaFold Database; and ECOD describes the domain organization of the protein. Together, these implemented layers support interpretation of metabolic routes in terms of both network topology and molecular mechanism. KO and PDB remain relevant biological reference systems, but they are not queried by the current runtime protein viewer.

### Protein Domain Viewer

The protein domain viewer displays the domain composition of proteins associated with the queried enzymatic activities. It exposes domain identifiers, residue ranges, and catalytic-chain information derived from the integrated protein and ECOD annotations. This enables users to determine whether a catalytic activity is associated with a discrete domain, a particular chain, or a defined region within a multidomain protein.

### Protein Hierarchy: EC, KO, and ECOD

The protein hierarchy organizes complementary classification systems into a single navigable relationship. EC numbers describe the reaction chemistry, KO entries describe orthology-linked functional groups, and ECOD domains describe the evolutionary and structural classification of protein regions. No one of these systems is sufficient on its own: EC annotations do not specify protein sequence, KO annotations do not fully resolve domain architecture, and domain classifications do not by themselves identify the reaction performed in a given biological context.

By presenting these identifiers together, NEBULA allows users to inspect agreement and gaps between functional, orthological, and structural evidence. The hierarchy also provides a principled route for moving from a reaction-level observation to candidate proteins and then to the domains most relevant to catalysis.

### Mapping of Catalytic Binding Sites

Catalytic binding-site mapping connects annotated protein regions to the residues and structural neighborhoods that support ligand recognition or chemical transformation. When domain and structure information are available, the viewer can be used to localize the catalytic region within the protein chain and to relate that region to the associated reaction and compound records.

This mapping is useful for distinguishing a protein’s overall architecture from the smaller functional region that mediates catalysis. It also provides a basis for comparing homologous enzymes, evaluating the structural context of a predicted or experimentally determined domain, and identifying cases in which functional annotation is available but structural evidence remains incomplete.

### Interactive 3D Protein Viewer

The interactive 3D protein viewer renders the AlphaFold structure associated with a selected UniProt accession and provides a spatial context for interpreting its annotations. The frontend requests prediction metadata from the AlphaFold Database, selects the returned BCIF or CIF coordinate URL, and passes it to the PDBe Mol\* plugin. Users can inspect the protein fold, focus on domain ranges, and relate active-site or binding-site features to the overall chain architecture. If AlphaFold has no prediction for the accession, the viewer reports that no structure is available.

The viewer completes the transition from metabolic network to molecular structure. A compound or reaction selected in the metabolic views can therefore be followed to its associated enzyme and then examined as a three-dimensional object, preserving the provenance of the biological interpretation at each step.
