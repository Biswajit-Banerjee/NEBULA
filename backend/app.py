from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
import os
from views import MetabolicViewer

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