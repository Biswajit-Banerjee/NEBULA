from fastapi import HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
import pandas as pd
import numpy as np
from typing import Dict, Optional, List
import json
import tempfile
import os
from pathlib import Path

from app.utils.helpers import create_backtrack_df, parse_ec_list, add_compound_generation
from app.core.uniprot import get_uniprot_entries_from_mapper, integrate_ecod_data, filter_important_features, list_accessions_for_ec, get_single_uniprot_entry

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
        
        with open(DATA_DIR / "gene_mapper.json", "r") as f:
            self.gene_mapper = json.load(f)
        
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
            entries = get_uniprot_entries_from_mapper(ec_number, self.gene_mapper)
            entries = [filter_important_features(entry) for entry in entries]
            return {"data": entries}
        except Exception as e:
            return {"error": str(e)}
        
    async def get_ec_domains(self, ec_number: str) -> Dict:
        """Get integrated domain data for an EC number"""
        try:
            entries = get_uniprot_entries_from_mapper(ec_number, self.gene_mapper)
            entries = [filter_important_features(entry) for entry in entries]
            entries = integrate_ecod_data(entries, self.ecod_df, self.domain_df)
            return {"data": entries}
        except Exception as e:
            return {"error": str(e)}

    def list_ec_accessions(self, ec_number: str) -> Dict:
        """Instantly list all accessions for an EC number (no network calls)"""
        try:
            accessions = list_accessions_for_ec(ec_number, self.gene_mapper)
            return {"data": accessions}
        except Exception as e:
            return {"error": str(e)}

    async def get_single_accession_domains(self, accession: str, organism_code: str = "") -> Dict:
        """Fetch domain data for a single accession"""
        try:
            entry = get_single_uniprot_entry(accession, organism_code=organism_code)
            if entry is None:
                return {"error": f"Could not fetch entry for {accession}"}
            entry = filter_important_features(entry)
            entries = integrate_ecod_data([entry], self.ecod_df, self.domain_df)
            return {"data": entries[0] if entries else None}
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
            })
            
            self.current_df = display_df.copy()
            
            # drop duplicate reaction entry
            display_df.drop_duplicates(["equation"], inplace=True)
            
            # aggrigate data
            agg_df = {col: 'first' for col in display_df.columns if col != "reaction"}
            agg_df['target'] = lambda x: ', '.join(x)
            display_df = display_df.groupby("reaction").agg(agg_df).reset_index()
            display_df = display_df.sort_values(['transition'])
            # add product generation
            display_df.loc[:, "compound_generation"] = display_df.equation.apply(lambda x: add_compound_generation(x, self.gen_mapper))
            display_df.loc[:, "max_generation"] = display_df["compound_generation"].apply(lambda x: max(x.values()))
            display_df = display_df.sort_values("max_generation") 
            
            return {"data": display_df.to_dict('records')}
        except Exception as e:
            return {"data": [], "error": str(e)}

    async def get_reaction_backtrace(self, reaction_id: str, skip_cofactor=True) -> Dict:
        """
        Given a reaction ID, show that reaction and backtrace its source
        (reactant) compounds to find their upstream origins.
        Returns the reaction itself plus all upstream backtrace results.
        """
        try:
            import re as _re
            # Match rows where reaction_id column equals the given ID
            reaction_rows = self.df[self.df['reaction_id'] == reaction_id]
            if reaction_rows.empty:
                return {"data": []}

            if skip_cofactor:
                cofactors = set(self.cofactors)
            else:
                cofactors = set()

            # ── Build result rows for the reaction itself ──
            rx_df = reaction_rows.copy()
            rx_df = rx_df.replace([np.inf, -np.inf], None).fillna('N/A')
            rx_df['ec_list'] = rx_df['ec_list'].apply(parse_ec_list)

            display_df = pd.DataFrame({
                'reaction': rx_df['reaction'],
                'source': rx_df['source'],
                'coenzyme': rx_df['coenzyme'],
                'equation': rx_df['equation'],
                'transition': rx_df.apply(
                    lambda row: f"{int(row['reactant_gen']) if row['reactant_gen'] not in (None, 'N/A') else 0} -> {int(row['product_gen']) if row['product_gen'] not in (None, 'N/A') else 0}",
                    axis=1
                ),
                'target': rx_df['products'],
                'ec_list': rx_df['ec_list'],
            })
            display_df.drop_duplicates(["equation"], inplace=True)
            agg_df = {col: 'first' for col in display_df.columns if col != "reaction"}
            agg_df['target'] = lambda x: ', '.join(x)
            display_df = display_df.groupby("reaction").agg(agg_df).reset_index()
            display_df = display_df.sort_values(['transition'])
            display_df.loc[:, "compound_generation"] = display_df.equation.apply(
                lambda x: add_compound_generation(x, self.gen_mapper)
            )
            display_df.loc[:, "max_generation"] = display_df["compound_generation"].apply(
                lambda x: max(x.values()) if x else 0
            )
            display_df = display_df.sort_values("max_generation")
            reaction_self_rows = display_df.to_dict('records')

            # ── Collect reactant compounds and backtrace them ──
            reactant_compounds = set()
            for _, row in reaction_rows.iterrows():
                reactants_str = str(row.get('reactants', ''))
                reactant_compounds.update(_re.findall(r'[CZ]\d{5}', reactants_str))

            compounds_to_trace = reactant_compounds - cofactors

            all_results = list(reaction_self_rows)
            seen = {row.get('reaction', '') for row in all_results}

            for compound in compounds_to_trace:
                result = await self.get_backtrace(compound, skip_cofactor=skip_cofactor)
                if result.get('data'):
                    for row in result['data']:
                        key = row.get('reaction', '')
                        if key not in seen:
                            seen.add(key)
                            all_results.append(row)

            return {"data": all_results}
        except Exception as e:
            return {"data": [], "error": str(e)}

    async def get_ec_reactions(self, ec_number: str) -> Dict:
        """
        Given an EC number, find all reactions that reference it and return
        them in the same format as compound backtrace results.
        """
        try:
            import re as _re
            # Filter rows where ec_list contains the exact EC number
            escaped = _re.escape(ec_number)
            pattern = rf'(?:^|[,\s]){escaped}(?:[,\s]|$)'
            ec_rows = self.df[self.df['ec_list'].str.contains(pattern, na=False, regex=True)].copy()
            if ec_rows.empty:
                return {"data": []}

            # Replace NaN/inf
            ec_rows = ec_rows.replace([np.inf, -np.inf], None)
            ec_rows = ec_rows.fillna('N/A')

            # Parse EC list
            ec_rows['ec_list'] = ec_rows['ec_list'].apply(parse_ec_list)

            # Build display DataFrame in the same format as backtrace
            display_df = pd.DataFrame({
                'reaction': ec_rows['reaction'],
                'source': ec_rows['source'],
                'coenzyme': ec_rows['coenzyme'],
                'equation': ec_rows['equation'],
                'transition': ec_rows.apply(
                    lambda row: f"{int(row.get('reactant_gen', 0)) if row.get('reactant_gen') not in (None, 'N/A') else 0} -> {int(row.get('product_gen', 0)) if row.get('product_gen') not in (None, 'N/A') else 0}",
                    axis=1
                ),
                'target': ec_rows.get('products', 'N/A'),
                'ec_list': ec_rows['ec_list'],
            })

            # Deduplicate by equation
            display_df.drop_duplicates(["equation"], inplace=True)

            # Aggregate by reaction
            agg_df = {col: 'first' for col in display_df.columns if col != "reaction"}
            agg_df['target'] = lambda x: ', '.join(x)
            display_df = display_df.groupby("reaction").agg(agg_df).reset_index()
            display_df = display_df.sort_values(['transition'])

            # Add compound generation info
            display_df.loc[:, "compound_generation"] = display_df.equation.apply(
                lambda x: add_compound_generation(x, self.gen_mapper)
            )
            display_df.loc[:, "max_generation"] = display_df["compound_generation"].apply(
                lambda x: max(x.values()) if x else 0
            )
            display_df = display_df.sort_values("max_generation")

            return {"data": display_df.to_dict('records')}
        except Exception as e:
            return {"data": [], "error": str(e)}

    async def download_csv(self, background_tasks: BackgroundTasks) -> FileResponse:
        """Generate and return a CSV file of the current dataframe"""
        if self.current_df is None:
            raise HTTPException(status_code=400, detail="No data available for download")
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as tmp_file:
                self.current_df.to_csv(tmp_file.name, index=False)
                tmp_file_path = tmp_file.name

            filename = f"metabolic_pathway_{self.current_target or 'data'}.csv"
            
            # Schedule cleanup task
            background_tasks.add_task(os.unlink, tmp_file_path)
            
            return FileResponse(
                path=tmp_file_path,
                filename=filename,
                media_type='text/csv'
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating CSV file: {str(e)}")