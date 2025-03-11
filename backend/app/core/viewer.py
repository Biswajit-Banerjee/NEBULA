from fastapi import HTTPException
from fastapi.responses import FileResponse
import pandas as pd
import numpy as np
from typing import Dict, Optional, List
import tempfile
import os
import requests
from pathlib import Path

from app.utils.helpers import create_backtrack_df, parse_ec_list, add_compound_generation
from app.core.uniprot import get_uniprot_entries, integrate_ecod_data, filter_important_features

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
        BASE_DIR = Path(__file__).parent.parent.parent
        DATA_DIR = BASE_DIR / "data"
        
        # data file
        self.df = pd.read_csv(DATA_DIR / "simulations.csv")
        self.generation_df = pd.read_csv(DATA_DIR / "generations.csv")
        self.domain_df = pd.read_csv(DATA_DIR / "domains.csv")
        self.ecod_df = pd.read_csv(DATA_DIR / "ecod_domains.csv")
        self.cof_df = pd.read_csv(DATA_DIR / "cofactors.csv")
        self.cofactors = self.cof_df.loc[:, 'Compound ID'].tolist()
        
        # processing the data
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
        
    async def get_ec_uniprot_data(self, ec_number: str) -> Dict:
        """Get UniProt data for an EC number"""
        try:
            entries = get_uniprot_entries(ec_number)
            entries = [filter_important_features(entry) for entry in entries]
            return {"data": entries}
        except Exception as e:
            return {"error": str(e)}
        
    async def get_ec_domains(self, ec_number: str) -> Dict:
        """Get integrated domain data for an EC number"""
        try:
            entries = get_uniprot_entries(ec_number)
            entries = [filter_important_features(entry) for entry in entries]
            entries = integrate_ecod_data(entries, self.ecod_df)
            return {"data": entries}
        except Exception as e:
            return {"error": str(e)}

    async def get_backtrace(self, target: str, source: str=None, skip_cofactor=True) -> Dict:
        """
        Perform backtrace analysis for a target compound
        Returns reaction pathway data including EC numbers
        """
        try:
            self.current_target = target
            
            if skip_cofactor:
                cofactors = self.cofactors
            else:
                cofactors = []
            
            backtrack_df = create_backtrack_df(self.df, target, self.gen_mapper, cofactors, source)
            
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
            # display_df['reaction_link'] = display_df['reaction'].apply(
            #     lambda x: f"https://www.genome.jp/entry/{x.split('_')[0]}" if '_' in x else f"https://www.genome.jp/entry/{x}"
            # )
            
            # drop duplicate reaction entry
            display_df.drop_duplicates(["equation"], inplace=True)
            
            # aggrigate data
            agg_df = {col: 'first' for col in display_df.columns if col != "reaction"}
            agg_df['target'] = lambda x: ', '.join(x)
            # agg_df['ec_list'] = set
            display_df = display_df.groupby("reaction").agg(agg_df).reset_index()
            display_df = display_df.sort_values(['transition'])
            # add product generation
            display_df.loc[:, "compound_generation"] = display_df.equation.apply(lambda x: add_compound_generation(x, self.gen_mapper))
            
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