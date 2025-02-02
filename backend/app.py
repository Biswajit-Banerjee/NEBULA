from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
import os
from views import MetabolicViewer
import re
import requests

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="NEBULA")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/components", StaticFiles(directory="components"), name="components")


# Initialize viewer
viewer = MetabolicViewer()

@app.get("/")
async def read_root():
    try:
        with open("templates/index.html", "r") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        logger.error("index.html not found in templates directory")
        raise HTTPException(status_code=404, detail="Template not found")
    except Exception as e:
        logger.error(f"Error reading template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/backtrace")
async def get_backtrace(target: str):
    try:
        return await viewer.get_backtrace(target)
    except Exception as e:
        logger.error(f"Error in backtrace API: {e}")
        raise HTTPException(status_code=500, detail="Failed to process backtrace request")

@app.get("/api/ec/{ec_number}")
async def get_ec_data(ec_number: str):
    try:
        return await viewer.get_ec_data(ec_number)
    except Exception as e:
        logger.error(f"Error in EC data API: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch EC data")

@app.get("/download/csv")
async def download_csv():
    try:
        return await viewer.download_csv()
    except Exception as e:
        logger.error(f"Error in CSV download: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate CSV")
    
@app.get("/api/compound/{compound_id}")
async def get_compound_data(compound_id: str):
    """Fetch compound data from KEGG API"""
    # Validate compound ID format
    if not re.match(r'^C\d{5}$', compound_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid compound ID format. Must start with 'C' followed by 5 digits."
        )
    
    try:
        # Query KEGG API
        response = requests.get(f"https://rest.kegg.jp/get/{compound_id}")
        
        if response.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail="Compound not found in KEGG database"
            )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail="Error fetching data from KEGG"
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
        
    except requests.RequestException as e:
        logger.error(f"Error fetching KEGG data: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch data from KEGG"
        )

@app.get("/api/reaction/{equation}")
async def get_reaction_data(equation: str):
    """Fetch reaction data from KEGG API"""
    try:
        # Extract base reaction ID (R followed by 5 numbers), ignoring any suffixes
        match = re.search(r'(R\d{5})', equation)
        if not match:
            return {
                "error": "No valid reaction ID found",
                "data": None
            }
            
        reaction_id = match.group(1)  # This will get just R00345 from R00345_v1
        
        # Query KEGG API
        response = requests.get(f"https://rest.kegg.jp/get/{reaction_id}")
        
        if response.status_code == 404:
            return {
                "error": "Reaction not found in KEGG database",
                "data": None
            }
        
        if response.status_code != 200:
            return {
                "error": "Error fetching data from KEGG",
                "data": None
            }
        
        # Parse the response text
        data = response.text
        result = {
            'definition': '',
            'equation': ''
        }
        
        for line in data.split('\n'):
            if line.startswith('DEFINITION'):
                result['definition'] = line.replace('DEFINITION', '').strip()
            elif line.startswith('EQUATION'):
                # Extract just the compound equation part
                equation_text = line.replace('EQUATION', '').strip()
                # Take only up to the first set of compound IDs and their relationship
                compound_match = re.match(r'([C\d\s+<=>]+)', equation_text)
                if compound_match:
                    result['equation'] = compound_match.group(1).strip()
                else:
                    result['equation'] = equation_text
        
        return {"data": result}
        
    except Exception as e:
        logger.error(f"Error fetching reaction data: {e}")
        return {
            "error": str(e),
            "data": None
        }
        
# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up NEBULA application")
    # Verify required files exist
    required_files = {
        os.path.join("templates", "index.html"): "HTML template",
        os.path.join("static", "style.css"): "CSS styles",
        os.path.join("static", "nebula.js"): "JavaScript file"
    }
    
    for file_path, description in required_files.items():
        if not os.path.exists(file_path):
            logger.warning(f"Missing {description} at {file_path}")
            
    

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8080, reload=True)