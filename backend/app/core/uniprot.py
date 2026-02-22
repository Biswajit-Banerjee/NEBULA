import requests
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
    family_id: str = ""

@dataclass
class UniProtEntry:
    primary_accession: str
    uniprot_kb_id: str
    features: List[Feature]
    organism_code: str = ""
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

def parse_uniprot_entry(entry_data: Dict, organism_code: str = "") -> UniProtEntry:
    """Parse single UniProt entry from API response"""
    name = ""
    
    if "commonName" in entry_data["organism"]:
        name = entry_data["organism"]["commonName"].strip()
    
    if not name:
        name = entry_data["organism"]["scientificName"]
    
    if 'features' not in entry_data:
        raise KeyError("Features not present in this entry")
    
    return UniProtEntry(
        primary_accession=entry_data['primaryAccession'],
        uniprot_kb_id=f"{name} ({entry_data['uniProtkbId']})",
        features=[parse_feature(f) for f in entry_data['features']],
        organism_code=organism_code
    )
    
def get_uniprot_entries(ec_id: str, min_results:int = 10) -> List[UniProtEntry]:
    """
    Fetch and parse UniProt entries for given EC number using cursor-based pagination
    to ensure at least 10 results when available
    """
    base_url = "https://rest.uniprot.org/uniprotkb/search"
    params = {
        "query": f"ec:{ec_id}",
        "size": 25
    }
    result = []
    
    while True:
        # Make request
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        
        # Parse current page of results
        data = response.json()
        for entry in data['results']:
            try:
                result.append(parse_uniprot_entry(entry))
            except KeyError:
                continue
                
        # Check if we have enough results
        if len(result) >= min_results:
            break
            
        # Check for next page
        if "link" not in response.headers:
            break
            
        # Parse next page cursor from Link header
        next_link = None
        for link in response.headers["link"].split(","):
            if 'rel="next"' in link:
                next_link = link
                break
                
        if not next_link:
            break
            
        # Extract cursor and update params for next request
        cursor = next_link.split("cursor=")[1].split("&")[0]
        params["cursor"] = cursor
        
    return result

def fetch_uniprot_by_accession(accession: str) -> Optional[Dict]:
    """Fetch a single UniProt entry by accession ID"""
    url = f"https://rest.uniprot.org/uniprotkb/{accession}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None

def list_accessions_for_ec(ec_id: str, gene_mapper: Dict) -> List[Dict]:
    """
    Instantly list all accessions for an EC number from the precomputed gene_mapper.
    No network calls — just a dictionary lookup.
    
    Returns:
        List of dicts with 'accession' and 'organism_code' keys
    """
    prefix = f"{ec_id}:"
    result = []
    for key, accessions in gene_mapper.items():
        if not key.startswith(prefix):
            continue
        organism_code = key[len(prefix):]
        for accession in accessions:
            result.append({"accession": accession, "organism_code": organism_code})
    return result

def get_single_uniprot_entry(accession: str, organism_code: str = "") -> Optional[UniProtEntry]:
    """
    Fetch and parse a single UniProt entry by accession.
    
    Returns:
        A UniProtEntry or None if fetch/parse fails
    """
    entry_data = fetch_uniprot_by_accession(accession)
    if entry_data is None:
        return None
    try:
        return parse_uniprot_entry(entry_data, organism_code=organism_code)
    except KeyError:
        return None

def get_uniprot_entries_from_mapper(ec_id: str, gene_mapper: Dict) -> List[UniProtEntry]:
    """
    Look up UniProt accessions from precomputed gene_mapper and fetch each entry
    by direct accession instead of broad EC search.
    
    Args:
        ec_id: EC number (e.g. "1.1.1.38")
        gene_mapper: dict with keys like "ec:organism" and values as list of accessions
    
    Returns:
        List of UniProtEntry objects
    """
    prefix = f"{ec_id}:"
    result = []
    
    for key, accessions in gene_mapper.items():
        if not key.startswith(prefix):
            continue
        organism_code = key[len(prefix):]
        
        for accession in accessions:
            entry_data = fetch_uniprot_by_accession(accession)
            if entry_data is None:
                continue
            try:
                entry = parse_uniprot_entry(entry_data, organism_code=organism_code)
                result.append(entry)
            except KeyError:
                continue
    
    return result

def filter_important_features(entry: UniProtEntry) -> UniProtEntry:
    """Filter only Active site and Binding site features"""
    important_types = {'Active site', 'Binding site'}
    entry.features = [f for f in entry.features if f.type in important_types]
    return entry

def integrate_ecod_data(entries: List[UniProtEntry], ecod_df: pd.DataFrame, domain_df: pd.DataFrame = None) -> List[UniProtEntry]:
    """
    Integrate ECOD domain information with UniProt entries
    
    Args:
        entries: List of UniProt entries
        ecod_df: DataFrame from ecod_domains.csv (has descriptive f_id)
        domain_df: Optional DataFrame from domains.csv (has numeric f_id)
    
    Returns:
        Updated list of UniProt entries with domain information
    """
    modified_entries = []
    
    # Process each entry
    for entry in entries:
        # Get ECOD data for this entry
        entry_domains = ecod_df[ecod_df['uniprot_id'] == entry.primary_accession]
        
        if entry_domains.empty:
            # Entry has no ECOD domains, but should still be included in results
            modified_entries.append(entry)
            continue
            
        # Convert ECOD data to domain objects
        entry.domains = []
        for _, domain in entry_domains.iterrows():
            ranges = parse_range(domain['range'])
            
            # Look up numeric family_id from domains.csv
            numeric_fid = ""
            if domain_df is not None:
                match = domain_df[
                    (domain_df['accession'] == entry.primary_accession) &
                    (domain_df['domain_id'] == domain['domain_id'])
                ]
                if not match.empty:
                    numeric_fid = str(match.iloc[0]['f_id'])
            
            entry.domains.append(EcodDomain(
                domain_id=domain['domain_id'],
                f_id=domain['f_id'],
                ranges=ranges,
                family_id=numeric_fid
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
