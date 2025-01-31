import pandas as pd
import numpy as np
import re
from typing import Set, Dict

def get_first_occurance(df: pd.DataFrame, target: str) -> pd.DataFrame:
    target_df = df[df.products.str.contains(target)]
    target_df = target_df[target_df.product_gen <= target_df.product_gen.min()]
    target_df.loc[:, "target"] = target_df.shape[0] * [target]
    return target_df

def create_backtrack_df(df, target_compound, gen_mapper):
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
        pdf = relevant_reactions[relevant_reactions.reactant_gen > 0]
        
        # if not pdf.empty:
        #     print(current_compound, "\n---", pdf.to_string())
        
        if not relevant_reactions.empty:
            result = pd.concat([result, relevant_reactions])
            
            # Add new reactants to process
            for reactants in relevant_reactions['reactants']:
                reactants = re.findall("([CZ][0-9]{5})", reactants)
                compounds_to_process.update(reactants)
                
        processed_compounds.add(current_compound)
    
    if not result.empty:
        result = result.sort_values('generation').reset_index(drop=True)
    
    return result