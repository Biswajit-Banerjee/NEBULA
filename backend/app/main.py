from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
from pathlib import Path
import re
import requests
import xml.etree.ElementTree as ET

from app import STATIC_DIR, DATA_DIR, DOCS_DIR
from app.core.viewer import MetabolicViewer
from app.utils.smiles_cache import get_smiles_batch, get_mol_batch, get_cofactor_names

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NEBULA",
    description="Network of Enzymatic Biochemical Units, Links, and Associations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Must be False when using wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize viewer
viewer = MetabolicViewer()

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# ── KEGG global map layout (parsed once, cached) ──
_kegg_layout_cache = None

def _parse_kegg_layout():
    """Parse ko01100.kgml and return {compound_id: {x, y}} for all compound entries."""
    global _kegg_layout_cache
    if _kegg_layout_cache is not None:
        return _kegg_layout_cache

    kgml_path = DATA_DIR / "ko01100.kgml"
    if not kgml_path.exists():
        logger.warning("ko01100.kgml not found in data directory")
        return {}

    positions = {}
    tree = ET.parse(str(kgml_path))
    root = tree.getroot()
    for entry in root.findall("entry"):
        if entry.get("type") != "compound":
            continue
        # name is like "cpd:C00001" or "gl:G13352"
        raw_name = entry.get("name", "")
        cid = raw_name.split(":")[-1] if ":" in raw_name else raw_name
        graphics = entry.find("graphics")
        if graphics is not None:
            x = graphics.get("x")
            y = graphics.get("y")
            if x is not None and y is not None and cid not in positions:
                positions[cid] = {"x": float(x), "y": float(y)}

    _kegg_layout_cache = positions
    logger.info(f"Parsed KEGG layout: {len(positions)} compound positions from ko01100.kgml")
    return _kegg_layout_cache

@app.get("/api/kegg-layout")
async def get_kegg_layout():
    """Return KEGG global metabolic map (ko01100) compound positions."""
    try:
        positions = _parse_kegg_layout()
        return {"positions": positions, "count": len(positions)}
    except Exception as e:
        logger.error(f"Error parsing KEGG layout: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse KEGG layout")

# ── KEGG ortholog edges (polylines, parsed once, cached) ──
_kegg_ortho_cache = None

def _parse_kegg_ortho_edges():
    """Parse ko01100.kgml and return ortholog polylines (type='line' graphics)."""
    global _kegg_ortho_cache
    if _kegg_ortho_cache is not None:
        return _kegg_ortho_cache

    kgml_path = DATA_DIR / "ko01100.kgml"
    if not kgml_path.exists():
        logger.warning("ko01100.kgml not found in data directory")
        return []

    edges = []
    tree = ET.parse(str(kgml_path))
    root = tree.getroot()
    for entry in root.findall("entry"):
        if entry.get("type") != "ortholog":
            continue
        reaction = entry.get("reaction", "")
        name = entry.get("name", "")
        for graphics in entry.findall("graphics"):
            if graphics.get("type") != "line":
                continue
            coords_str = graphics.get("coords", "")
            if not coords_str:
                continue
            # coords is "x1,y1,x2,y2,..." — parse into list of [x, y] pairs
            nums = coords_str.split(",")
            points = []
            for i in range(0, len(nums) - 1, 2):
                try:
                    points.append([float(nums[i]), float(nums[i + 1])])
                except (ValueError, IndexError):
                    continue
            if len(points) >= 2:
                fgcolor = graphics.get("fgcolor", "#F06292")
                edges.append({
                    "name": name,
                    "reaction": reaction,
                    "points": points,
                    "color": fgcolor,
                })

    _kegg_ortho_cache = edges
    logger.info(f"Parsed KEGG ortho edges: {len(edges)} polylines from ko01100.kgml")
    return _kegg_ortho_cache

@app.get("/api/kegg-ortho-edges")
async def get_kegg_ortho_edges():
    """Return KEGG ortholog edge polylines from ko01100."""
    try:
        edges = _parse_kegg_ortho_edges()
        return {"edges": edges, "count": len(edges)}
    except Exception as e:
        logger.error(f"Error parsing KEGG ortho edges: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse KEGG ortho edges")

@app.get("/api/backtrace")
async def get_backtrace(target: str, source: str=''):
    """
    Perform backtrace analysis for a target compound
    
    Args:
        target (str): Target compound ID
        
    Returns:
        dict: Backtrace analysis results
    """
    try:
        for element in [target, source]:
            if element and not re.match(r'^C\d{5}$', element):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid compound ID format. Must start with 'C' followed by 5 digits."
                )
            
        result = await viewer.get_backtrace(target, source)
        
        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in backtrace API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process backtrace request"
        )
        
@app.get("/api/backtrace/tree")
async def get_backtrace_tree(target: str, source: str = ''):
    """
    AND-OR hypergraph backward reachability from target compound.

    Returns a nested AND-OR tree where:
      - OR-nodes = compounds (produced by any of several reactions)
      - AND-nodes = reactions (require all reactants)

    Args:
        target: Target compound ID (e.g. C00258)
        source: Optional comma-separated source compound IDs (e.g. C00022,C00036)
    """
    try:
        # Validate target
        if not re.match(r'^[CZ]\d{5}$', target):
            raise HTTPException(
                status_code=400,
                detail="Invalid compound ID format. Must start with 'C' or 'Z' followed by 5 digits."
            )

        # Parse sources
        sources = None
        if source and source.strip():
            sources = [s.strip() for s in source.split(',') if s.strip()]
            for s in sources:
                if not re.match(r'^[CZ]\d{5}$', s):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid source compound ID: {s}"
                    )

        result = await viewer.get_backtrace_tree(target, sources)

        if result.get('error'):
            raise HTTPException(status_code=500, detail=result['error'])

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in backtrace tree API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process backtrace tree request"
        )

@app.get("/api/search")
async def search(type: str, query: str):
    """
    Search for compound data by KEGG compound ID
    
    Args:
        type (str): Search type (currently only 'compound' supported)
        query (str): KEGG compound ID to search for
        
    Returns:
        dict: Search results including compound pathway data
    """
    try:
        if not re.match(r'^C\d{5}$', query):
            raise HTTPException(
                status_code=400,
                detail="Invalid compound ID format. Must start with 'C' followed by 5 digits."
            )
            
        result = await viewer.get_backtrace(query)
        
        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])
            
        return result
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in backtrace API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process backtrace request"
        )

@app.get("/api/reaction/backtrace")
async def get_reaction_backtrace(reaction: str):
    """
    Perform backtrace analysis starting from a reaction ID.
    Finds the reaction's product compounds and backtraces them.

    Args:
        reaction (str): KEGG reaction ID (e.g. R00217)

    Returns:
        dict: Backtrace results in the same format as compound backtrace
    """
    try:
        if not re.match(r'^R\d{5}$', reaction):
            raise HTTPException(
                status_code=400,
                detail="Invalid reaction ID format. Must start with 'R' followed by 5 digits."
            )

        result = await viewer.get_reaction_backtrace(reaction)

        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in reaction backtrace API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process reaction backtrace request"
        )

@app.get("/api/ec/reactions")
async def get_ec_reactions(ec: str):
    """
    List all reactions where a given EC number is present.

    Args:
        ec (str): Enzyme Commission number (format: N.N.N.N)

    Returns:
        dict: Reactions in the same format as compound backtrace results
    """
    try:
        if not re.match(r'^\d+(\.\d+){3}$', ec):
            raise HTTPException(
                status_code=400,
                detail="Invalid EC number format. Must be in format N.N.N.N (e.g., 1.1.1.1)"
            )

        result = await viewer.get_ec_reactions(ec)

        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])

        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in EC reactions API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process EC reactions request"
        )

@app.get("/api/compound/{compound_id}")
async def get_compound_data(compound_id: str):
    """
    Fetch compound data from KEGG API
    
    Args:
        compound_id (str): KEGG compound ID
        
    Returns:
        dict: Compound information
    """
    # Validate compound ID format
    if not re.match(r'^C\d{5}$', compound_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid compound ID format. Must start with 'C' followed by 5 digits."
        )
    
    try:
        # Query KEGG API
        response = requests.get(
            f"https://rest.kegg.jp/get/{compound_id}",
            timeout=10  # 10 seconds timeout
        )
        
        if response.status_code == 404:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "Compound not found in KEGG database",
                    "data": None
                }
            )
        
        if response.status_code != 200:
            logger.error(f"KEGG API error: {response.status_code} - {response.text}")
            return JSONResponse(
                status_code=response.status_code,
                content={
                    "error": "Error fetching data from KEGG",
                    "data": None
                }
            )
        
        # Parse the response text
        data = response.text
        result = {}
        
        # Extract required fields
        current_field = None
        for line in data.split('\n'):
            if line.startswith('NAME'):
                result['name'] = line.replace('NAME', '').strip().strip(';')
                current_field = 'name'
            elif line.startswith('FORMULA'):
                result['formula'] = line.replace('FORMULA', '').strip()
                current_field = 'formula'
            elif line.startswith('EXACT_MASS'):
                result['exact_mass'] = line.replace('EXACT_MASS', '').strip()
                current_field = 'exact_mass'
            elif line.startswith('MOL_WEIGHT'):
                result['mol_weight'] = line.replace('MOL_WEIGHT', '').strip()
                current_field = 'mol_weight'
            elif line.startswith(' ') and current_field == 'name':
                # Handle multi-line names
                result['name'] += ' ' + line.strip().strip(';')
        
        return {"data": result}
        
    except requests.Timeout:
        logger.error(f"Timeout while fetching compound data for {compound_id}")
        raise HTTPException(
            status_code=504,
            detail="Request to KEGG API timed out"
        )
    except requests.RequestException as e:
        logger.error(f"Error fetching KEGG data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch data from KEGG"
        )
    except Exception as e:
        logger.error(f"Unexpected error processing compound data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@app.get("/api/reaction/{reaction_id}")
async def get_reaction_data(reaction_id: str):
    """
    Fetch reaction data from KEGG API
    
    Args:
        reaction_id (str): KEGG reaction ID or equation
        
    Returns:
        dict: Reaction information
    """
    try:
        # Extract base reaction ID (R followed by 5 numbers), ignoring any suffixes
        match = re.search(r'(R\d{5})', reaction_id)
        if not match:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "No valid reaction ID found",
                    "data": None
                }
            )
            
        clean_reaction_id = match.group(1)
        
        # Query KEGG API
        response = requests.get(
            f"https://rest.kegg.jp/get/{clean_reaction_id}",
            timeout=10
        )
        
        if response.status_code == 404:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "Reaction not found in KEGG database",
                    "data": None
                }
            )
        
        if response.status_code != 200:
            logger.error(f"KEGG API error: {response.status_code} - {response.text}")
            return JSONResponse(
                status_code=response.status_code,
                content={
                    "error": "Error fetching data from KEGG",
                    "data": None
                }
            )
        
        # Parse the response text
        data = response.text
        result = {
            'definition': '',
            'equation': '',
            'enzymes': []
        }
        
        current_section = None
        for line in data.split('\n'):
            if line.startswith('DEFINITION'):
                result['definition'] = line.replace('DEFINITION', '').strip()
                current_section = 'definition'
            elif line.startswith('EQUATION'):
                equation_text = line.replace('EQUATION', '').strip()
                result['equation'] = equation_text
                current_section = 'equation'
            elif line.startswith('ENZYME'):
                enzymes = line.replace('ENZYME', '').strip()
                result['enzymes'] = [e.strip() for e in enzymes.split()]
                current_section = 'enzyme'
            elif line.startswith('BRITE'):
                brite = line.replace('BRITE', '').strip()
                result['brite'] = brite.strip()
                current_section = 'brite'
            elif line.startswith(' ') and current_section:
                # Handle multi-line content
                if current_section == 'definition':
                    result['definition'] += ' ' + line.strip()
                elif current_section == 'equation':
                    result['equation'] += ' ' + line.strip()
                elif current_section == 'brite':
                    result['brite'] += '\n' + line.strip()
                elif current_section == 'enzyme':
                    enzymes = line.strip()
                    result['enzymes'].extend([e.strip() for e in enzymes.split()])
        
        return {"data": result}
        
    except requests.Timeout:
        logger.error(f"Timeout while fetching reaction data for {reaction_id}")
        raise HTTPException(
            status_code=504,
            detail="Request to KEGG API timed out"
        )
    except Exception as e:
        logger.error(f"Error fetching reaction data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch reaction data"
        )

@app.get("/api/ec/{ec_number}")
async def get_ec_data(ec_number: str):
    """
    Get EC number data
    
    Args:
        ec_number (str): Enzyme Commission number (format: N.N.N.N)
        
    Returns:
        dict: EC number information including domain data
    """
    # Validate EC number format (e.g., 1.1.1.1)
    if not re.match(r'^\d+(\.\d+){3}$', ec_number):
        raise HTTPException(
            status_code=400,
            detail="Invalid EC number format. Must be in format N.N.N.N (e.g., 1.1.1.1)"
        )
    
    try:
        result = await viewer.get_ec_data(ec_number)
        if result.get('error'):
            raise HTTPException(
                status_code=404,
                detail=result['error']
            )
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in EC data API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch EC data"
        )

@app.get("/api/download/csv")
async def download_csv(background_tasks: BackgroundTasks):
    """Download results as CSV file"""
    try:
        return await viewer.download_csv(background_tasks)
    except Exception as e:
        logger.error(f"Error in CSV download: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate CSV"
        )
        
@app.get("/api/ec/{ec_number}/uniprot")
async def get_ec_uniprot_data(ec_number: str):
    """
    Get UniProt entries for an EC number
    
    Args:
        ec_number (str): Enzyme Commission number (format: N.N.N.N)
        
    Returns:
        dict: UniProt entries with their features
    """
    # Validate EC number format (e.g., 1.1.1.1)
    if not re.match(r'^\d+(\.\d+){3}$', ec_number):
        raise HTTPException(
            status_code=400,
            detail="Invalid EC number format. Must be in format N.N.N.N (e.g., 1.1.1.1)"
        )
    
    try:
        result = await viewer.get_ec_uniprot_data(ec_number)
        if result.get('error'):
            raise HTTPException(
                status_code=404,
                detail=result['error']
            )
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in EC UniProt API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch UniProt data"
        )

@app.get("/api/ec/{ec_number}/domains")
async def get_ec_domains(ec_number: str):
    """
    Get integrated domain data for an EC number
    
    Args:
        ec_number (str): Enzyme Commission number (format: N.N.N.N)
        
    Returns:
        dict: EC domain information including UniProt and ECOD data
    """
    # Validate EC number format (e.g., 1.1.1.1)
    if not re.match(r'^\d+(\.\d+){3}$', ec_number):
        raise HTTPException(
            status_code=400,
            detail="Invalid EC number format. Must be in format N.N.N.N (e.g., 1.1.1.1)"
        )
    
    try:
        result = await viewer.get_ec_domains(ec_number)
        if result.get('error'):
            raise HTTPException(
                status_code=404,
                detail=result['error']
            )
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in EC domains API: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch domain data"
        )

@app.get("/api/ec/{ec_number}/accessions")
async def list_ec_accessions(ec_number: str):
    """
    Instantly list all UniProt accessions for an EC number.
    No external API calls — pure local lookup from gene_mapper.
    """
    if not re.match(r'^\d+(\.\d+){3}$', ec_number):
        raise HTTPException(
            status_code=400,
            detail="Invalid EC number format. Must be in format N.N.N.N (e.g., 1.1.1.1)"
        )
    try:
        result = viewer.list_ec_accessions(ec_number)
        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error listing accessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to list accessions")

@app.get("/api/accession/{accession}/domains")
async def get_accession_domains(accession: str, organism_code: str = ""):
    """
    Fetch domain data for a single UniProt accession.
    """
    try:
        result = await viewer.get_single_accession_domains(accession, organism_code)
        if result.get('error'):
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching accession domains: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch accession domain data")

@app.post("/api/smiles")
async def get_smiles(payload: dict):
    """
    Return structure data for a list of KEGG compound IDs.
    - SMILES from PubChem (primary)
    - MOL files from KEGG (fallback for compounds missing SMILES)
    - Cofactor display names for Z compounds

    Body: { "compound_ids": ["C00001", "Z00001", ...] }
    Returns: { "smiles": {...}, "mol": {...}, "names": {...} }
    """
    try:
        compound_ids = payload.get("compound_ids", [])
        if not compound_ids or not isinstance(compound_ids, list):
            raise HTTPException(status_code=400, detail="compound_ids must be a non-empty list")
        if len(compound_ids) > 500:
            compound_ids = compound_ids[:500]
        for cid in compound_ids:
            if not re.match(r'^[CZ]\d{5}$', str(cid)):
                raise HTTPException(status_code=400, detail=f"Invalid compound ID: {cid}")

        # Split C and Z compounds
        c_ids = [c for c in compound_ids if c.startswith('C')]
        z_ids = [c for c in compound_ids if c.startswith('Z')]

        # 1) SMILES from PubChem
        smiles_result = get_smiles_batch(c_ids) if c_ids else {}

        # 2) MOL from KEGG for C compounds that have no SMILES
        missing_smiles = [cid for cid in c_ids if not smiles_result.get(cid)]
        mol_result = get_mol_batch(missing_smiles) if missing_smiles else {}

        # 3) Cofactor names for Z compounds
        names_result = get_cofactor_names(z_ids) if z_ids else {}

        return {"smiles": smiles_result, "mol": mol_result, "names": names_result}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in SMILES API: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch SMILES data")

@app.post("/api/substructure-search")
async def substructure_search(payload: dict):
    """
    Search for compounds containing a SMILES substructure (backbone).

    Body: { "smarts": "C(=O)O", "compound_ids": ["C00001", ...] }
      - smarts: SMILES or SMARTS pattern for the backbone
      - compound_ids: list of compound IDs to search within (from current graph)

    Returns: { "matches": ["C00022", ...], "query": "C(=O)O", "total": 5 }
    """
    try:
        from rdkit import Chem

        query_str = (payload.get("smarts") or "").strip()
        compound_ids = payload.get("compound_ids", [])

        if not query_str:
            raise HTTPException(status_code=400, detail="smarts query is required")
        if not compound_ids or not isinstance(compound_ids, list):
            raise HTTPException(status_code=400, detail="compound_ids must be a non-empty list")

        # Parse query — try SMARTS first, then SMILES
        query_mol = Chem.MolFromSmarts(query_str)
        if query_mol is None:
            query_mol = Chem.MolFromSmiles(query_str)
        if query_mol is None:
            raise HTTPException(status_code=400, detail=f"Invalid SMILES/SMARTS pattern: {query_str}")

        # Get cached SMILES for the requested compounds
        c_ids = [c for c in compound_ids if re.match(r'^C\d{5}$', str(c))]
        smiles_map = get_smiles_batch(c_ids) if c_ids else {}

        matches = []
        for cid, smi in smiles_map.items():
            if not smi:
                continue
            try:
                mol = Chem.MolFromSmiles(smi)
                if mol and mol.HasSubstructMatch(query_mol):
                    matches.append(cid)
            except Exception:
                continue

        logger.info(f"Substructure search '{query_str}': {len(matches)}/{len(smiles_map)} matches")
        return {"matches": matches, "query": query_str, "total": len(matches)}

    except HTTPException as he:
        raise he
    except ImportError:
        logger.error("RDKit not installed — substructure search unavailable")
        raise HTTPException(status_code=501, detail="RDKit not installed. Install rdkit-pypi.")
    except Exception as e:
        logger.error(f"Error in substructure search: {e}")
        raise HTTPException(status_code=500, detail="Failed to perform substructure search")

# ── Documentation API ──
import json as _json

@app.get("/api/docs/manifest")
async def docs_manifest():
    """Return the documentation page manifest."""
    manifest_path = DOCS_DIR / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Documentation manifest not found")
    return JSONResponse(content=_json.loads(manifest_path.read_text(encoding="utf-8")))

@app.get("/api/docs/{slug}")
async def docs_page(slug: str):
    """Return raw markdown content for a documentation page."""
    safe_slug = re.sub(r"[^a-zA-Z0-9_-]", "", slug)
    md_path = DOCS_DIR / f"{safe_slug}.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail=f"Documentation page '{slug}' not found")
    return JSONResponse(content={"slug": safe_slug, "content": md_path.read_text(encoding="utf-8")})

# Serve documentation images (GIFs, screenshots, etc.)
_docs_images_dir = DOCS_DIR / "images"
if _docs_images_dir.exists():
    app.mount("/docs-assets", StaticFiles(directory=_docs_images_dir), name="docs-images")

# Serve frontend static files
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")

# Startup Event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting NEBULA API server")
    try:
        # Verify data files exist
        required_files = [
            "simulations.csv",
            "generations.csv",
            "domains.csv",
            "ecod_domains.csv",
            "gene_mapper.json",
        ]
        
        base_dir = Path(__file__).parent.parent
        data_dir = base_dir / "data"
        
        for file in required_files:
            file_path = data_dir / file
            if not file_path.exists():
                logger.error(f"Required data file not found: {file}")
                raise FileNotFoundError(f"Missing required data file: {file}")
                
        logger.info("All required data files verified")
        
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )