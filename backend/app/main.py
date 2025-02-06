from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from pathlib import Path
import re
import requests
from typing import Optional
import os

from app.core.viewer import MetabolicViewer

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
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize viewer
viewer = MetabolicViewer()

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/api/backtrace")
async def get_backtrace(target: str):
    """
    Perform backtrace analysis for a target compound
    
    Args:
        target (str): Target compound ID
        
    Returns:
        dict: Backtrace analysis results
    """
    try:
        if not re.match(r'^C\d{5}$', target):
            raise HTTPException(
                status_code=400,
                detail="Invalid compound ID format. Must start with 'C' followed by 5 digits."
            )
            
        result = await viewer.get_backtrace(target)
        
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
        
@app.get("/api/search")
async def search(type: str, query: str):
    """
    Perform backtrace analysis for a target compound
    
    Args:
        target (str): Target compound ID
        
    Returns:
        dict: Backtrace analysis results
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
        ec_number (str): Enzyme Commission number
        
    Returns:
        dict: EC number information including domain data
    """
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
async def download_csv():
    """Download results as CSV file"""
    try:
        return await viewer.download_csv()
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
        ec_number (str): Enzyme Commission number
        
    Returns:
        dict: UniProt entries with their features
    """
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
        ec_number (str): Enzyme Commission number
        
    Returns:
        dict: EC domain information including UniProt and ECOD data
    """
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