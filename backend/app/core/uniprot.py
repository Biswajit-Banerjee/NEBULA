import requests
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import pandas as pd

@dataclass
class FeatureLocation:
    start: int
    end: int

@dataclass
class Feature:
    type: str
    location: FeatureLocation
    description: str
    domain_id: Optional[str] = None  
    f_id: Optional[str] = None      

@dataclass
class DomainRange:
    start: int
    end: int

@dataclass
class EcodDomain:
    domain_id: str
    f_id: str
    ranges: List[DomainRange]

@dataclass
class UniProtEntry:
    primary_accession: str
    uniprot_kb_id: str
    features: List[Feature]
    domains: List[EcodDomain] = None

def parse_range(range_str: str) -> List[DomainRange]:
    """Parse ECOD range string into list of DomainRange objects"""
    ranges = []
    range_pairs = range_str.split(',')
    for pair in range_pairs:
        start, end = map(int, pair.split('-'))
        ranges.append(DomainRange(start, end))
    return ranges

def is_feature_in_range(feature: Feature, domain_range: DomainRange) -> bool:
    """Check if feature falls within a domain range"""
    return (feature.location.start >= domain_range.start and 
            feature.location.end <= domain_range.end)

def parse_location(location_data: Dict) -> FeatureLocation:
    """Parse location data from feature"""
    return FeatureLocation(
        start=location_data['start']['value'],
        end=location_data['end']['value']
    )

def parse_feature(feature_data: Dict) -> Feature:
    """Parse single feature from API response"""
    return Feature(
        type=feature_data['type'],
        location=parse_location(feature_data['location']),
        description=feature_data.get('description', '')
    )

def parse_uniprot_entry(entry_data: Dict) -> UniProtEntry:
    """Parse single UniProt entry from API response"""
    name = ""
    
    if "commonName" in entry_data["organism"]:
        name = entry_data["organism"]["commonName"].strip()
    
    if not name:
        name = entry_data["organism"]["scientificName"]
    
    return UniProtEntry(
        primary_accession=entry_data['primaryAccession'],
        uniprot_kb_id=name,#entry_data['uniProtkbId'],
        features=[parse_feature(f) for f in entry_data['features']]
    )

def get_uniprot_entries(ec_id: str) -> List[UniProtEntry]:
    """
    Fetch and parse UniProt entries for given EC number
    """
    url = f"https://rest.uniprot.org/uniprotkb/search?query=ec:{ec_id}&size=25"
    response = requests.get(url)
    response.raise_for_status()
    
    data = response.json()
    return [parse_uniprot_entry(entry) for entry in data['results']]

def filter_important_features(entry: UniProtEntry) -> UniProtEntry:
    """Filter only Active site and Binding site features"""
    important_types = {'Active site', 'Binding site'}
    entry.features = [f for f in entry.features if f.type in important_types]
    return entry

def integrate_ecod_data(entries: List[UniProtEntry], ecod_df: pd.DataFrame) -> List[UniProtEntry]:
    """
    Integrate ECOD domain information with UniProt entries
    
    Args:
        entries: List of UniProt entries
        ecod_file: Path to ECOD domains CSV file
    
    Returns:
        Updated list of UniProt entries with domain information
    """
    modified_entries = []
    
    # Process each entry
    for entry in entries:
        # Get ECOD data for this entry
        entry_domains = ecod_df[ecod_df['uniprot_id'] == entry.primary_accession]
        
        if entry_domains.empty:
            continue
            
        # Convert ECOD data to domain objects
        entry.domains = []
        for _, domain in entry_domains.iterrows():
            ranges = parse_range(domain['range'])
            entry.domains.append(EcodDomain(
                domain_id=domain['domain_id'],
                f_id=domain['f_id'],
                ranges=ranges
            ))
        
        # Match features to domains
        for feature in entry.features:
            for domain in entry.domains:
                for domain_range in domain.ranges:
                    if is_feature_in_range(feature, domain_range):
                        feature.domain_id = domain.domain_id
                        feature.f_id = domain.f_id
                        break
                if feature.domain_id:  # Stop checking other domains if we found a match
                    break
        
        modified_entries.append(entry)
    
    return modified_entries

def print_integrated_results(entries: List[UniProtEntry]):
    """Print results in a readable format"""
    for entry in entries:
        print(f"\nEntry: {entry.primary_accession} ({entry.uniprot_kb_id})")
        if entry.domains:
            print("Domains:")
            for domain in entry.domains:
                print(f"  - {domain.domain_id} (Family: {domain.f_id})")
                print("    Ranges:", ", ".join([f"{r.start}-{r.end}" for r in domain.ranges]))
        
        print("Features:")
        for feature in entry.features:
            domain_info = f" [Domain: {feature.domain_id}, Family: {feature.f_id}]" if feature.domain_id else " [No matching domain]"
            print(f"  - {feature.type} at positions {feature.location.start}-{feature.location.end}: "
                  f"{feature.description}{domain_info}")
