from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import numpy as np
from typing import Dict, Optional, List
from helpers import create_backtrack_df
import tempfile
import os
import requests
from time import sleep

# def get_uniprot_from_ec(ec_number: str, organism_id: Optional[str] = "83333") -> List[Dict[str, str]]:
#     """
#     Query UniProt API for proteins based on organism and EC number.
    
#     Args:
#         organism (str): Organism name or taxonomy ID
#         ec_number (str, optional): EC number to filter by
        
#     Returns:
#         List[Dict]: List of protein entries matching the query criteria
#     """
#     base_url = "https://rest.uniprot.org/uniprotkb/search"
    
#     query = f"((organism_id:83333) OR (organism_id:9606) OR (organism_id:266)) AND (ec:{ec_number})" 

#     # Parameters
#     params = {
#         "query": query,
#         "format": "json",
#         "fields": "accession,gene_names,ec,protein_name,organism_name,length",
#         # "fields": "accession,id,protein_name,gene_names,organism_name,ec,length",
#         "size": 500
#     }
    
#     all_results = []
    
#     while True:
#         # Make request
#         response = requests.get(base_url, params=params)
#         response.raise_for_status()  # Raise exception for bad status codes
        
#         # Parse response
#         data = response.json()
        
#         # Add results
#         if "results" in data:
#             for entry in data["results"]:
#                 protein_name = ""
#                 if "proteinDescription" in entry:
#                     if "recommendedName" in entry["proteinDescription"]:
#                         protein_name = entry["proteinDescription"]["recommendedName"]["fullName"]["value"]
#                     elif "submissionNames" in entry["proteinDescription"] and entry["proteinDescription"]["submissionNames"]:
#                         protein_name = entry["proteinDescription"]["submissionNames"][0]["fullName"]["value"]

#                 gene_names = []
#                 if "genes" in entry and entry["genes"]:
#                     for gene in entry["genes"]:
#                         if "geneName" in gene and "value" in gene["geneName"]:
#                             gene_names.append(gene["geneName"]["value"])

#                 organism = ""
#                 if "organism" in entry:
#                     organism = entry['organism']['scientificName']

#                 length = ""
#                 if "sequence" in entry:
#                     length = entry['sequence']['length'] 

#                 all_results.append({
#                     "primary_accession": entry["primaryAccession"],
#                     'organism': organism,
#                     "protein_name": protein_name,
#                     "gene_names": " ".join(gene_names),
#                     "length": int(length)
#                 })
        
#         # Check for next page
#         if "link" not in response.headers:
#             break
            
#         # Get cursor for next page
#         links = response.headers["link"].split(",")
#         next_link = None
#         for link in links:
#             if 'rel="next"' in link:
#                 next_link = link
#                 break
                
#         if not next_link:
#             break
            
#         # Extract cursor from next link
#         cursor = next_link.split("cursor=")[1].split("&")[0]
#         params["cursor"] = cursor

#     return all_results

def get_uniprot_from_ec(ec_number, domains_df):
    """
    Get domain information from domains.csv based on EC number
    """
    try:
        # Clean the EC number (remove any whitespace and ensure proper format)
        ec_number = ec_number.strip()
        
        # Filter based on EC number and select only the required columns
        result_df = domains_df[domains_df['ec'].str.contains(ec_number, na=False)][
            ['organism_name', 'domain_id', 'A', 'X', 'H', 'T', 'F', 'range', 'length']
        ]
        
        # Fill any NaN values with empty strings
        # result_df = result_df.fillna('')
        
        # Convert to list of dictionaries
        results = result_df.to_dict('records')
        
        if len(results) > 3:
            results = results[:3]
        
        return results
        
    except Exception as e:
        print(f"Error reading domains data: {e}")
        return []

def parse_ec_list(ec_string: str) -> List[str]:
    """Parse EC list string into a list of EC numbers"""
    if pd.isna(ec_string):
        return []
    return [ec.strip() for ec in str(ec_string).split(',') if ec.strip()]

class MetabolicViewer:
    def __init__(self):
        """Initialize the MetabolicViewer with required data files"""
        self.df = pd.read_csv("./data/simulations.csv")
        self.generation_df = pd.read_csv("./data/generations.csv")
        self.domain_df = pd.read_csv("./data/domains.csv")
        self.generation_df.set_index("compound_id", inplace=True)
        self.gen_mapper = self.generation_df["modified_generation"].dropna().to_dict()
        self.current_df: Optional[pd.DataFrame] = None
        self.current_target: Optional[str] = None

    async def get_ec_data(self, ec_number: str) -> Dict:
        """Get UniProt data for an EC number"""
        try:
            uniprot_data = get_uniprot_from_ec(ec_number, self.domain_df)
            return {"data": uniprot_data}
        except Exception as e:
            return {"error": str(e)}

    async def get_backtrace(self, target: str) -> Dict:
        """
        Perform backtrace analysis for a target compound
        Returns reaction pathway data including EC numbers
        """
        try:
            self.current_target = target
            backtrack_df = create_backtrack_df(self.df, target, self.gen_mapper)
            
            if backtrack_df.empty:
                return {"data": []}
            
            # Replace NaN/inf values before creating transition
            backtrack_df = backtrack_df.replace([np.inf, -np.inf], None)
            backtrack_df = backtrack_df.fillna('N/A')
            
            # Parse EC list into proper list format
            backtrack_df['ec_list'] = backtrack_df['ec_list'].apply(parse_ec_list)
            
            # Create display DataFrame with all required columns
            display_df = pd.DataFrame({
                'reaction': backtrack_df['reaction'],
                'source': backtrack_df['source'],
                'coenzyme': backtrack_df['coenzyme'],
                'equation': backtrack_df['equation'],
                'transition': backtrack_df.apply(
                    lambda row: f"{int(row.get('reactant_gen'))} -> {int(row.get('product_gen'))}", 
                    axis=1
                ),
                'target': backtrack_df['target'],
                'ec_list': backtrack_df['ec_list'],
                # 'fgroups': backtrack_df['fgroups'],
                # 'fgroups2': backtrack_df['fgroups2']
            })
            
            self.current_df = display_df.copy()
            
            # Add reaction links for KEGG database
            display_df['reaction_link'] = display_df['reaction'].apply(
                lambda x: f"https://www.genome.jp/entry/{x.split('_')[0]}" if '_' in x else f"https://www.genome.jp/entry/{x}"
            )
            
            return {"data": display_df.to_dict('records')}
        except Exception as e:
            return {"data": [], "error": str(e)}

    async def download_csv(self) -> FileResponse:
        """Generate and return a CSV file of the current dataframe"""
        if self.current_df is None:
            raise HTTPException(status_code=400, detail="No data available for download")
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as tmp_file:
                self.current_df.to_csv(tmp_file.name, index=False)
                tmp_file_path = tmp_file.name

            filename = f"metabolic_pathway_{self.current_target or 'data'}.csv"
            
            return FileResponse(
                path=tmp_file_path,
                filename=filename,
                media_type='text/csv',
                background=lambda: os.unlink(tmp_file_path)
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating CSV file: {str(e)}")