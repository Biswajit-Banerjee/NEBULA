from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Union
import networkx as nx
from graph import MetabolicNetwork
import pandas as pd
from pathlib import Path
import json

app = FastAPI(title="Metabolic Network API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the network
network = MetabolicNetwork()

class NetworkStats(BaseModel):
    num_compounds: int
    num_reactions: int
    num_edges: int
    is_dag: bool
    num_connected_components: int
    max_generation: int

class CompoundInfo(BaseModel):
    id: str
    generation: int
    incoming_reactions: List[Dict[str, Union[str, float]]]
    outgoing_reactions: List[Dict[str, Union[str, float]]]

class GraphData(BaseModel):
    nodes: List[Dict]
    edges: List[Dict]

@app.post("/load-network")
async def load_network(file_path: str):
    """Load network from a file."""
    try:
        network.load(file_path)
        return {"message": "Network loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/network-stats", response_model=NetworkStats)
async def get_network_stats():
    """Get network statistics."""
    if network.graph.number_of_nodes() == 0:
        raise HTTPException(status_code=404, detail="Network not loaded")
    return network.get_network_statistics()

@app.get("/compound/{compound_id}", response_model=CompoundInfo)
async def get_compound_info(compound_id: str):
    """Get detailed information about a compound."""
    if compound_id not in network.graph:
        raise HTTPException(status_code=404, detail=f"Compound {compound_id} not found")
    
    node_data = network.graph.nodes[compound_id]
    
    # Get incoming reactions
    incoming = []
    for pred in network.graph.predecessors(compound_id):
        if network.graph.nodes[pred]["type"] == "reaction":
            reaction_id = pred[:-2]  # Remove '_p' suffix
            edge_data = network.graph.edges[pred, compound_id]
            incoming.append({
                "reaction_id": reaction_id,
                "stoichiometry": edge_data["weight"]
            })
    
    # Get outgoing reactions
    outgoing = []
    for succ in network.graph.successors(compound_id):
        if network.graph.nodes[succ]["type"] == "reaction":
            reaction_id = succ[:-2]  # Remove '_r' suffix
            edge_data = network.graph.edges[compound_id, succ]
            outgoing.append({
                "reaction_id": reaction_id,
                "stoichiometry": edge_data["weight"]
            })
    
    return CompoundInfo(
        id=compound_id,
        generation=node_data["gen"],
        incoming_reactions=incoming,
        outgoing_reactions=outgoing
    )

@app.get("/subgraph/{compound_id}", response_model=GraphData)
async def get_subgraph(compound_id: str):
    """Get subgraph traced back from a compound."""
    try:
        subgraph = network.backtrace_compound(compound_id)
        
        # Convert networkx graph to a format suitable for frontend visualization
        nodes = []
        edges = []
        
        for node, data in subgraph.nodes(data=True):
            nodes.append({
                "id": node,
                "type": data["type"],
                "generation": data["gen"]
            })
        
        for source, target, data in subgraph.edges(data=True):
            edges.append({
                "source": source,
                "target": target,
                "weight": data.get("weight", 1),
                "style": data.get("style", "solid")
            })
        
        return GraphData(nodes=nodes, edges=edges)
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search/{query}")
async def search_compounds(query: str):
    """Search for compounds by prefix."""
    if network.graph.number_of_nodes() == 0:
        raise HTTPException(status_code=404, detail="Network not loaded")
    
    compounds = [
        node for node, data in network.graph.nodes(data=True)
        if data["type"] == "compound" and node.lower().startswith(query.lower())
    ]
    
    return {"compounds": compounds}

# Optional: Add an endpoint to load example network for testing
@app.post("/load-example")
async def load_example():
    """Load example network for testing."""
    try:
        network = MetabolicNetwork.create_example_network()
        return {"message": "Example network loaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)