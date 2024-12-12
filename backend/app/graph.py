import networkx as nx
import pandas as pd
from collections import deque
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional, Union
import json
import logging
from dataclasses import dataclass
import pickle

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class ReactionInfo:
    """Data class to store reaction information."""

    reactants: List[Tuple[str, float, int]]
    products: List[Tuple[str, float, int]]
    max_reactant_gen: int
    max_product_gen: int


class MetabolicNetwork:
    """
    A class to represent and analyze metabolic networks.

    Attributes:
        graph (nx.DiGraph): The directed graph representing the metabolic network
        _reaction_info (Dict): Internal cache of reaction information
    """

    def __init__(self):
        """Initialize an empty metabolic network."""
        self.graph = nx.DiGraph()
        self._reaction_info = {}

    @staticmethod
    def _validate_dataframe(df: pd.DataFrame) -> None:
        """
        Validate the input DataFrame has the required columns and data types.

        Args:
            df: DataFrame to validate

        Raises:
            ValueError: If DataFrame doesn't meet requirements
        """
        required_columns = {"compound", "reaction", "stoichiometry", "generation"}
        missing_columns = required_columns - set(df.columns)

        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        if not pd.api.types.is_numeric_dtype(df["stoichiometry"]):
            raise ValueError("Column 'stoichiometry' must be numeric")

        if not pd.api.types.is_numeric_dtype(df["generation"]):
            raise ValueError("Column 'generation' must be numeric")

    def _process_reaction_info(self, row: pd.Series) -> None:
        """
        Process a single reaction row and update reaction information.

        Args:
            row: DataFrame row containing reaction information
        """
        compound = row["compound"]
        reaction = row["reaction"]
        edge_weight = row["stoichiometry"]
        generation = row["generation"]

        if not self.graph.has_node(compound):
            self.graph.add_node(compound, type="compound", weight=1, gen=generation)

        if reaction not in self._reaction_info:
            self._reaction_info[reaction] = ReactionInfo(
                reactants=[], products=[], max_reactant_gen=-1, max_product_gen=-1
            )

        info = self._reaction_info[reaction]
        if edge_weight < 0:  # Reactant
            info.reactants.append((compound, abs(edge_weight), generation))
            info.max_reactant_gen = max(info.max_reactant_gen, generation)
        else:  # Product
            info.products.append((compound, edge_weight, generation))
            info.max_product_gen = max(info.max_product_gen, generation)

    def load_from_dataframe(self, df: pd.DataFrame) -> None:
        """
        Load metabolic network from a DataFrame.

        Args:
            df: DataFrame containing metabolic network data

        Raises:
            ValueError: If DataFrame format is invalid
        """
        try:
            self._validate_dataframe(df)

            # Reset existing data
            self.graph.clear()
            self._reaction_info.clear()

            # First pass: Process compounds and collect reaction information
            for _, row in df.iterrows():
                self._process_reaction_info(row)

            # Second pass: Add reaction nodes and edges
            self._create_reaction_edges()

            logger.info(
                f"Successfully loaded network with {self.graph.number_of_nodes()} nodes "
                f"and {self.graph.number_of_edges()} edges"
            )

        except Exception as e:
            logger.error(f"Error loading network from DataFrame: {str(e)}")
            raise

    def _create_reaction_edges(self) -> None:
        """Create reaction nodes and edges in the graph."""
        for reaction, info in self._reaction_info.items():
            reactant_node = f"{reaction}_r"
            product_node = f"{reaction}_p"

            # Add reaction nodes
            self.graph.add_node(
                reactant_node, type="reaction", weight=1, gen=info.max_reactant_gen
            )
            self.graph.add_node(
                product_node, type="reaction", weight=1, gen=info.max_product_gen
            )

            # Add edges
            self.graph.add_edge(reactant_node, product_node, style="dotted", weight=1)

            # Add reactant edges
            for compound, weight, _ in info.reactants:
                self.graph.add_edge(
                    compound, reactant_node, weight=weight, style="solid"
                )

            # Add product edges
            for compound, weight, _ in info.products:
                self.graph.add_edge(
                    product_node, compound, weight=weight, style="solid"
                )

    def save(self, filepath: Union[str, Path], format: str = "pickle") -> None:
        """
        Save the metabolic network to a file.

        Args:
            filepath: Path to save the file
            format: Format to save in ('pickle' or 'json')

        Raises:
            ValueError: If format is invalid
        """
        filepath = Path(filepath)
        try:
            if format == "pickle":
                with open(filepath, "wb") as f:
                    pickle.dump((self.graph, self._reaction_info), f)
            elif format == "json":
                data = nx.node_link_data(self.graph)
                with open(filepath, "w") as f:
                    json.dump(data, f)
            else:
                raise ValueError(f"Unsupported format: {format}")

            logger.info(f"Successfully saved network to {filepath}")

        except Exception as e:
            logger.error(f"Error saving network: {str(e)}")
            raise

    def load(self, filepath: Union[str, Path], format: str = "pickle") -> None:
        """
        Load the metabolic network from a file.

        Args:
            filepath: Path to load the file from
            format: Format to load from ('pickle' or 'json')

        Raises:
            ValueError: If format is invalid or file doesn't exist
        """
        filepath = Path(filepath)
        if not filepath.exists():
            raise ValueError(f"File not found: {filepath}")

        try:
            if format == "pickle":
                with open(filepath, "rb") as f:
                    self.graph, self._reaction_info = pickle.load(f)
            elif format == "json":
                with open(filepath, "r") as f:
                    data = json.load(f)
                self.graph = nx.node_link_graph(data)
                # Reconstruct reaction info from graph
                self._reconstruct_reaction_info()
            else:
                raise ValueError(f"Unsupported format: {format}")

            logger.info(f"Successfully loaded network from {filepath}")

        except Exception as e:
            logger.error(f"Error loading network: {str(e)}")
            raise

    def _reconstruct_reaction_info(self) -> None:
        """Reconstruct reaction information from the graph structure."""
        self._reaction_info.clear()
        reaction_nodes = [
            n for n, d in self.graph.nodes(data=True) if d["type"] == "reaction"
        ]

        for node in reaction_nodes:
            if node.endswith("_r"):  # reactant node
                reaction = node[:-2]
                if reaction not in self._reaction_info:
                    self._reaction_info[reaction] = ReactionInfo(
                        reactants=[],
                        products=[],
                        max_reactant_gen=-1,
                        max_product_gen=-1,
                    )

                # Process reactants
                for pred in self.graph.predecessors(node):
                    if self.graph.nodes[pred]["type"] == "compound":
                        edge_data = self.graph.edges[pred, node]
                        gen = self.graph.nodes[pred]["gen"]
                        self._reaction_info[reaction].reactants.append(
                            (pred, edge_data["weight"], gen)
                        )
                        self._reaction_info[reaction].max_reactant_gen = max(
                            self._reaction_info[reaction].max_reactant_gen, gen
                        )

    def backtrace_compound(self, target_compound: str) -> nx.DiGraph:
        """
        Perform backward tracing from a target compound to find all precursor compounds and reactions.

        Args:
            target_compound: The compound ID to trace back from

        Returns:
            nx.DiGraph: A subgraph containing all precursor compounds and reactions

        Raises:
            ValueError: If target compound not found in graph
        """
        if target_compound not in self.graph:
            raise ValueError(f"Target compound {target_compound} not found in graph")

        nodes_to_keep: Set[str] = set()
        edges_to_keep: Set[Tuple[str, str]] = set()
        nodes_to_process = deque([target_compound])
        processed_nodes: Set[str] = set()

        target_gen = self.graph.nodes[target_compound]["gen"]

        try:
            while nodes_to_process:
                current_node = nodes_to_process.popleft()

                if current_node in processed_nodes:
                    continue

                processed_nodes.add(current_node)
                current_gen = self.graph.nodes[current_node]["gen"]

                if current_gen <= target_gen:
                    nodes_to_keep.add(current_node)

                    for pred in self.graph.predecessors(current_node):
                        pred_gen = self.graph.nodes[pred]["gen"]

                        if pred_gen <= target_gen:
                            edges_to_keep.add((pred, current_node))

                            if self.graph.nodes[pred]["type"] == "reaction":
                                nodes_to_keep.add(pred)

                                paired_reactions = [
                                    n for n in self.graph.predecessors(pred)
                                ]
                                for paired_reaction in paired_reactions:
                                    if (
                                        self.graph.nodes[paired_reaction]["type"]
                                        == "reaction"
                                    ):
                                        nodes_to_keep.add(paired_reaction)
                                        edges_to_keep.add((paired_reaction, pred))

                                        reaction_compounds = list(
                                            self.graph.predecessors(paired_reaction)
                                        )
                                        for compound in reaction_compounds:
                                            if (
                                                compound not in processed_nodes
                                                and self.graph.nodes[compound]["gen"]
                                                <= target_gen
                                            ):
                                                nodes_to_process.append(compound)

            subgraph = self.graph.subgraph(nodes_to_keep).copy()
            generations = nx.get_node_attributes(self.graph, "gen")
            nx.set_node_attributes(subgraph, generations, "gen")

            logger.info(f"Successfully traced back from {target_compound}")
            return subgraph

        except Exception as e:
            logger.error(f"Error during backtrace: {str(e)}")
            raise

    def get_network_statistics(self) -> Dict:
        """
        Get basic statistics about the metabolic network.

        Returns:
            Dict containing network statistics
        """
        compounds = [
            n for n, d in self.graph.nodes(data=True) if d["type"] == "compound"
        ]
        reactions = [
            n for n, d in self.graph.nodes(data=True) if d["type"] == "reaction"
        ]

        return {
            "num_compounds": len(compounds),
            "num_reactions": len(reactions)
            // 2,  # Divide by 2 because each reaction has 2 nodes
            "num_edges": self.graph.number_of_edges(),
            "is_dag": nx.is_directed_acyclic_graph(self.graph),
            "num_connected_components": nx.number_weakly_connected_components(
                self.graph
            ),
            "max_generation": max(d["gen"] for _, d in self.graph.nodes(data=True)),
        }


def create_example_network() -> MetabolicNetwork:
    """Create an example metabolic network for testing."""
    data = [
        {"compound": "a", "reaction": "r1", "stoichiometry": -1, "generation": 0},
        {"compound": "b", "reaction": "r1", "stoichiometry": -1, "generation": 0},
        {"compound": "c", "reaction": "r1", "stoichiometry": 2, "generation": 1},
        {"compound": "c", "reaction": "r2", "stoichiometry": -1, "generation": 1},
        {"compound": "d", "reaction": "r2", "stoichiometry": -1, "generation": 0},
        {"compound": "e", "reaction": "r2", "stoichiometry": 1, "generation": 2},
        {"compound": "b", "reaction": "r3", "stoichiometry": -3, "generation": 0},
        {"compound": "e", "reaction": "r3", "stoichiometry": -1, "generation": 2},
        {"compound": "f", "reaction": "r3", "stoichiometry": 1, "generation": 4},
        {"compound": "c", "reaction": "r4", "stoichiometry": -2, "generation": 1},
        {"compound": "x", "reaction": "r4", "stoichiometry": -2, "generation": 0},
        {"compound": "y", "reaction": "r4", "stoichiometry": 1, "generation": 2},
        {"compound": "y", "reaction": "r5", "stoichiometry": -2, "generation": 2},
        {"compound": "y", "reaction": "r6", "stoichiometry": -2, "generation": 2},
        {"compound": "e", "reaction": "r6", "stoichiometry": -1, "generation": 2},
        {"compound": "k", "reaction": "r6", "stoichiometry": 3, "generation": 3},
    ]

    network = MetabolicNetwork()
    network.load_from_dataframe(pd.DataFrame(data))
    return network


if __name__ == "__main__":
    # Example usage
    network = create_example_network()
    print("Network statistics:", network.get_network_statistics())

    # Save and load test
    network.save("network.pickle")
    network.save("network.json", format="json")

    # Backtrace test
    subgraph = network.backtrace_compound("e")
    print("Backtrace nodes:", list(subgraph.nodes()))
