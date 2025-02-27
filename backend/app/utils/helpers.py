import pandas as pd
import numpy as np
import re
from typing import Set, Dict, List

def parse_ec_list(ec_string: str) -> List[str]:
    """Parse EC list string into a list of EC numbers"""
    if pd.isna(ec_string):
        return []
    return [ec.strip() for ec in str(ec_string).split(',') if ec.strip()]

def create_backtrack_df(df, target_compound, gen_mapper, skip_cofactor=True):
    # Initialize result dataframe
    result = pd.DataFrame()
    compounds_to_process = {target_compound}
    processed_compounds = set()
    
    while compounds_to_process:
        current_compound = compounds_to_process.pop()
        current_gen = gen_mapper.get(current_compound, np.inf)
        
        if current_compound in processed_compounds or current_gen == 0:
            continue
        
        relevant_reactions = get_first_occurance(df, current_compound)
        # pdf = relevant_reactions[relevant_reactions.reactant_gen > 0]
        
        if not relevant_reactions.empty:
            result = pd.concat([result, relevant_reactions])
            
            # Add new reactants to process
            for _, row in relevant_reactions.iterrows():
                reactants = set(re.findall("([CZ][0-9]{5})", row['reactants']))
                products  = set(re.findall("([CZ][0-9]{5})", row['products']))
                
                if skip_cofactor:
                    reactants -= products
                
                compounds_to_process.update(reactants)
                
        processed_compounds.add(current_compound)
    
    if not result.empty:
        result = result.sort_values('generation').reset_index(drop=True)
    
    return result

def get_first_occurance(df: pd.DataFrame, target: str) -> pd.DataFrame:
    target_df = df[df.products.str.contains(target)]
    target_df = target_df[target_df.product_gen <= target_df.product_gen.min()]
    target_df.loc[:, "target"] = target_df.shape[0] * [target]
    return target_df

def add_compound_generation(eqn, gen_mapper):
    compound_list = re.findall("([CZ][0-9]{5})", eqn)
    
    gen_dict = {c : gen_mapper.get(c, -1) for c in compound_list}
    
    return gen_dict