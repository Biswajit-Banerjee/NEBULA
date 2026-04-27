import pandas as pd
import numpy as np
import re
from typing import Set, Dict, List

def parse_ec_list(ec_string: str) -> List[str]:
    """Parse EC list string into a list of EC numbers"""
    if pd.isna(ec_string):
        return []
    return [ec.strip() for ec in str(ec_string).split(',') if ec.strip()]

def create_backtrack_df(df, target_compound, gen_mapper, cofactors=None, src_compound=""):
    # Initialize result collection (avoid O(n²) pd.concat in loop)
    result_parts = []
    compounds_to_process = {target_compound}
    processed_compounds = set(cofactors) if cofactors else set()

    # Upper bound: never trace into compounds with generation > target
    target_gen = gen_mapper.get(target_compound, np.inf)
    
    if src_compound:
        processed_compounds.add(src_compound)
        stop_gen = gen_mapper.get(src_compound, 0)
    else:
        stop_gen = 0
        
    while compounds_to_process:
        current_compound = compounds_to_process.pop()
        current_gen = gen_mapper.get(current_compound, np.inf)
        
        # Skip if already processed, below source gen, or ABOVE target gen
        if current_compound in processed_compounds or current_gen < stop_gen:
            continue
        if current_gen > target_gen and current_compound != target_compound:
            continue
        # Gen-0 compounds are seeds — no need to trace further
        if current_gen == 0 and current_compound != target_compound:
            processed_compounds.add(current_compound)
            continue
        
        relevant_reactions = get_first_occurance(df, current_compound)
        
        if not relevant_reactions.empty:
            result_parts.append(relevant_reactions)
            
            # Add new reactants to process
            for _, row in relevant_reactions.iterrows():
                reactants = set(re.findall("([CZ][0-9]{5})", row['reactants']))
                compounds_to_process.update(reactants)
                
        processed_compounds.add(current_compound)
    
    if result_parts:
        result = pd.concat(result_parts, ignore_index=True)
        result = result.sort_values('generation').reset_index(drop=True)
    else:
        result = pd.DataFrame()
    
    return result

def get_first_occurance(df: pd.DataFrame, target: str) -> pd.DataFrame:
    # Use word-boundary regex to avoid substring false positives
    # (e.g. searching C0001 should not match C00011)
    pattern = r'(?:^|\+|\s)' + re.escape(target) + r'(?:$|\+|\s)'
    target_df = df[df.products.str.contains(pattern, regex=True, na=False)]
    if target_df.empty:
        return target_df
    target_df = target_df[target_df.product_gen <= target_df.product_gen.min()]
    target_df = target_df.copy()
    target_df.loc[:, "target"] = target
    return target_df

def add_compound_generation(eqn, gen_mapper):
    compound_list = re.findall("([CZ][0-9]{5})", eqn)
    
    gen_dict = {c : gen_mapper.get(c, -1) for c in compound_list}
    
    return gen_dict