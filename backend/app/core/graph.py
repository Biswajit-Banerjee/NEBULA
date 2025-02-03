import networkx as nx
import pandas as pd
from pathlib import Path
import json
from collections import deque
from typing import Dict, List, Set

def create_metabolic_network(df):
    G = nx.DiGraph()
    
    # Dictionary to store reaction information for generation calculation
    reaction_info = {}
    
    # First pass: Add compound nodes and collect reaction information
    for _, row in df.iterrows():
        compound = row['compound']
        reaction = row['reaction']
        edge_weight = row["stoichiometry"]
        generation = row['generation']
        
        # Add compound node if it doesn't exist
        if not G.has_node(compound):
            G.add_node(compound, type='compound', weight=1, gen=generation)
        
        # Collect reaction information
        if reaction not in reaction_info:
            reaction_info[reaction] = {
                'reactants': [],
                'products': [],
                'max_reactant_gen': -1,
                'max_product_gen': -1
            }
        
        # Store compound information for each reaction
        if edge_weight < 0:  # Reactant
            reaction_info[reaction]['reactants'].append((compound, abs(edge_weight), generation))
            reaction_info[reaction]['max_reactant_gen'] = max(
                reaction_info[reaction]['max_reactant_gen'],
                generation
            )
        else:  # Product
            reaction_info[reaction]['products'].append((compound, edge_weight, generation))
            reaction_info[reaction]['max_product_gen'] = max(
                reaction_info[reaction]['max_product_gen'],
                generation
            )
    
    # Second pass: Add reaction nodes and edges
    for reaction, info in reaction_info.items():
        # Create reactant and product nodes for the reaction
        reactant_node = f"{reaction}_r"
        product_node = f"{reaction}_p"
        
        # Add reaction nodes with their generations
        # Generation of reactant node is max generation of input compounds
        reactant_gen = info['max_reactant_gen']
        G.add_node(reactant_node, type='reaction', weight=1, gen=reactant_gen)
        
        # Generation of product node is max generation of output compounds
        product_gen = info['max_product_gen']
        G.add_node(product_node, type='reaction', weight=1, gen=product_gen)
        
        # Add dotted edge between reaction nodes
        G.add_edge(reactant_node, product_node, style='dotted', weight=1)
        
        # Add edges for reactants
        for compound, weight, _ in info['reactants']:
            G.add_edge(compound, reactant_node, weight=weight, style='solid')
        
        # Add edges for products
        for compound, weight, _ in info['products']:
            G.add_edge(product_node, compound, weight=weight, style='solid')
    
    return G

def visualize_generation_graph(G):
    # Get all nodes and their generations
    compound_nodes = [
        (node, data['gen']) 
        for node, data in G.nodes(data=True) 
        if data['type'] == 'compound'
    ]
    
    reaction_nodes = [
        (node, data['gen']) 
        for node, data in G.nodes(data=True) 
        if data['type'] == 'reaction'
    ]
    
    # Find unique generations and their compounds
    generations = {}
    for node, gen in compound_nodes + reaction_nodes:
        if gen not in generations:
            generations[gen] = {'compounds': [], 'reactions': []}
        if node in dict(compound_nodes):
            generations[gen]['compounds'].append(node)
        else:
            generations[gen]['reactions'].append(node)
    
    # Calculate positions
    pos = {}
    
    # Sort generations
    sorted_gens = sorted(generations.keys())
    
    # Calculate x-coordinates based on generation
    x_spacing = 2.0  # Increased spacing between generations
    
    # Position nodes generation by generation
    for i, gen in enumerate(sorted_gens):
        compounds = generations[gen]['compounds']
        reactions = generations[gen]['reactions']
        
        # Position compounds
        y_spacing_compounds = 2.0 / (len(compounds) + 1) if compounds else 0  # Increased vertical spacing
        for j, compound in enumerate(compounds, 1):
            pos[compound] = (i * x_spacing, j * y_spacing_compounds)
        
        # Position reactions slightly offset from compounds
        y_spacing_reactions = 2.0 / (len(reactions) + 1) if reactions else 0
        for j, reaction in enumerate(reactions, 1):
            # Offset reactions slightly to the right of their generation
            x_offset = 0.3  # Small horizontal offset
            pos[reaction] = (i * x_spacing + x_offset, j * y_spacing_reactions - 0.5)  # Vertical offset
    
    # Create the visualization
    plt.figure(figsize=(20, 12))  # Increased figure size
    
    # Draw edges with different styles
    solid_edges = [(u, v) for (u, v, d) in G.edges(data=True) if d.get('style', 'solid') == 'solid']
    dotted_edges = [(u, v) for (u, v, d) in G.edges(data=True) if d.get('style', 'solid') == 'dotted']
    
    # Draw solid edges
    nx.draw_networkx_edges(G, pos, edgelist=solid_edges, edge_color='gray', arrows=True)
    
    # Draw dotted edges
    nx.draw_networkx_edges(
        G, pos, edgelist=dotted_edges, edge_color='gray', style='dotted', arrows=True)
    
    # Draw compound nodes
    nx.draw_networkx_nodes(
        G, pos, nodelist=[n for n, d in G.nodes(data=True) if d['type']=='compound'], 
        node_color='lightblue', 
        node_size=1000
    )
    
    # Draw reaction nodes (now circular and peach colored)
    nx.draw_networkx_nodes(
        G, pos, nodelist=[n for n, d in G.nodes(data=True) if d['type']=='reaction'], 
        node_color='#FFDAB9',  # Peach color
        node_shape='o',        # Circular shape
        node_size=800
    )
    
    # Add labels with larger font
    nx.draw_networkx_labels(G, pos, font_size=10)
    
    # Add edge weights as labels
    edge_labels = nx.get_edge_attributes(G, 'weight')
    nx.draw_networkx_edge_labels(G, pos, edge_labels)
    
    plt.title('Metabolic Network - Arranged by Generation', pad=20)
    plt.axis('off')
    plt.tight_layout()
    
    return plt

def print_graph_info(G):
    print("Nodes and their attributes:")
    for node in G.nodes(data=True):
        print(f"Node: {node[0]}, Attributes: {node[1]}")
    
    print("\nEdges and their attributes:")
    for edge in G.edges(data=True):
        print(f"Edge: {edge[0]} -> {edge[1]}, Attributes: {edge[2]}")
        

def backtrace_compound(G, target_compound):
    """
    Performs backward tracing from a target compound to find all precursor compounds and reactions.
    
    Args:
        G (nx.DiGraph): The metabolic network graph
        target_compound (str): The compound ID to trace back from
    
    Returns:
        nx.DiGraph: A subgraph containing all precursor compounds and reactions
    """
    if target_compound not in G:
        raise ValueError(f"Target compound {target_compound} not found in graph")
    
    # Initialize sets to store nodes and edges for the subgraph
    nodes_to_keep = set()
    edges_to_keep = set()
    nodes_to_process = deque([target_compound])
    processed_nodes = set()
    
    # Get the target compound's generation
    target_gen = G.nodes[target_compound]['gen']
    
    while nodes_to_process:
        current_node = nodes_to_process.popleft()
        
        if current_node in processed_nodes:
            continue
            
        processed_nodes.add(current_node)
        current_gen = G.nodes[current_node]['gen']
        
        # Only process nodes with generation less than or equal to target
        if current_gen <= target_gen:
            nodes_to_keep.add(current_node)
            
            # Get all predecessor nodes (both reactions and compounds)
            predecessors = list(G.predecessors(current_node))
            
            for pred in predecessors:
                pred_gen = G.nodes[pred]['gen']
                
                # Only add predecessors with generation less than target
                if pred_gen <= target_gen:
                    # Add the edge between predecessor and current node
                    edges_to_keep.add((pred, current_node))
                    
                    # If predecessor is a reaction node
                    if G.nodes[pred]['type'] == 'reaction':
                        # Add reaction node
                        nodes_to_keep.add(pred)
                        
                        # Get the paired reaction node (reactants/products)
                        paired_reactions = [n for n in G.predecessors(pred)]
                        for paired_reaction in paired_reactions:
                            if G.nodes[paired_reaction]['type'] == 'reaction':
                                nodes_to_keep.add(paired_reaction)
                                edges_to_keep.add((paired_reaction, pred))
                                
                                # Get all compounds connected to the paired reaction
                                reaction_compounds = list(G.predecessors(paired_reaction))
                                for compound in reaction_compounds:
                                    if compound not in processed_nodes and G.nodes[compound]['gen'] <= target_gen:
                                        nodes_to_process.append(compound)
    
    # Create subgraph
    subgraph = G.subgraph(nodes_to_keep).copy()
    
    # Add generation information to the subgraph
    generations = nx.get_node_attributes(G, 'gen')
    nx.set_node_attributes(subgraph, generations, 'gen')
    
    return subgraph

def print_backtrace_info(G, subgraph, target_compound):
    """
    Prints information about the backtraced compounds and reactions.
    
    Args:
        G (nx.DiGraph): Original graph
        subgraph (nx.DiGraph): Backtraced subgraph
        target_compound (str): Target compound ID
    """
    target_gen = G.nodes[target_compound]['gen']
    print(f"\nBacktrace results for {target_compound} (Generation {target_gen}):")
    
    # Get all compounds and reactions in the subgraph
    compounds = [n for n, d in subgraph.nodes(data=True) if d['type'] == 'compound']
    reactions = [n for n, d in subgraph.nodes(data=True) if d['type'] == 'reaction']
    
    # Sort compounds by generation
    compounds_by_gen = {}
    for compound in compounds:
        gen = subgraph.nodes[compound]['gen']
        if gen not in compounds_by_gen:
            compounds_by_gen[gen] = []
        compounds_by_gen[gen].append(compound)
    
    print("\nCompounds by generation:")
    for gen in sorted(compounds_by_gen.keys()):
        if gen <= target_gen:  # Only show generations up to target
            print(f"Generation {gen}: {', '.join(sorted(compounds_by_gen[gen]))}")
    
    print(f"\nTotal number of precursor compounds: {len(compounds) - 1}")  # -1 to exclude target
    print(f"Total number of reactions: {len(reactions)//2}")  # Divide by 2 because each reaction is split into two nodes
    
    return compounds_by_gen

def strict_backtrace(G, target_compound):
    """
    Performs strict backward tracing from a target compound, only including compounds
    and reactions that are directly involved in producing the target.
    
    Args:
        G (nx.DiGraph): The metabolic network graph
        target_compound (str): The compound ID to trace back from
    
    Returns:
        nx.DiGraph: A strictly pruned subgraph containing only necessary nodes
    """
    if target_compound not in G:
        raise ValueError(f"Target compound {target_compound} not found in graph")
    
    # Initialize sets to store necessary nodes and edges
    necessary_nodes = {target_compound}
    necessary_edges = set()
    
    # Start with reactions that produce the target
    nodes_to_process = deque([target_compound])
    
    while nodes_to_process:
        current_node = nodes_to_process.popleft()
        
        # Get immediate predecessor reactions/compounds
        for pred in G.predecessors(current_node):
            if pred not in necessary_nodes:
                # Add the predecessor and the edge
                necessary_nodes.add(pred)
                necessary_edges.add((pred, current_node))
                
                # If it's a reaction node, add its paired reaction and reactants
                if G.nodes[pred]['type'] == 'reaction':
                    # Get paired reaction node
                    for paired_pred in G.predecessors(pred):
                        if G.nodes[paired_pred]['type'] == 'reaction':
                            necessary_nodes.add(paired_pred)
                            necessary_edges.add((paired_pred, pred))
                            
                            # Add all compounds that feed into this reaction
                            for compound_pred in G.predecessors(paired_pred):
                                if compound_pred not in necessary_nodes:
                                    necessary_nodes.add(compound_pred)
                                    necessary_edges.add((compound_pred, paired_pred))
                                    nodes_to_process.append(compound_pred)
    
    # Create the subgraph
    subgraph = G.subgraph(necessary_nodes).copy()
    
    # Add generation information
    generations = nx.get_node_attributes(G, 'gen')
    nx.set_node_attributes(subgraph, generations, 'gen')
    
    return subgraph

def subgraph_to_df(subgraph):
    """
    Converts a metabolic subgraph to a DataFrame with columns:
    compound, reaction, stoichiometry, generation
    
    Args:
        subgraph (nx.DiGraph): The metabolic network subgraph
        
    Returns:
        pd.DataFrame: DataFrame containing the graph information
    """
    rows = []
    
    # Iterate through all edges in the subgraph
    for source, target, data in subgraph.edges(data=True):
        source_type = subgraph.nodes[source]['type']
        target_type = subgraph.nodes[target]['type']
        
        # We're interested in edges between compounds and reactions
        if source_type == 'compound' and target_type == 'reaction':
            # This is a reactant
            compound = source
            reaction = target.replace('_reactants', '')  # Remove the suffix
            stoichiometry = -abs(data.get('weight', 1))  # Make negative for reactants
            generation = subgraph.nodes[compound]['gen']
            
            rows.append({
                'compound': compound,
                'reaction': reaction,
                'stoichiometry': stoichiometry,
                'generation': generation
            })
            
        elif source_type == 'reaction' and target_type == 'compound':
            # This is a product
            compound = target
            reaction = source.replace('_products', '')  # Remove the suffix
            stoichiometry = data.get('weight', 1)  # Positive for products
            generation = subgraph.nodes[compound]['gen']
            
            rows.append({
                'compound': compound,
                'reaction': reaction,
                'stoichiometry': stoichiometry,
                'generation': generation
            })
    
    # Create DataFrame and sort it
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values(['generation', 'reaction', 'compound'])
    
    return df

