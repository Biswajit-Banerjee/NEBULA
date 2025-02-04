import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import DomainVisualization from '../DomainVisualization';

const DomainDetails = ({ domain, range, proteinData }) => {
    if (!domain || !range || !proteinData) return null;
  
    const bindingSites = proteinData.features?.filter(feature => 
      feature.location.start >= range.start && 
      feature.location.end <= range.end
    ).length || 0;
  
    const hierarchy = domain.f_id.split('.');
  
    return (
      <div className="bg-white rounded p-2 text-sm">
        <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1">
          <span className="text-gray-500">Domain:</span>
          <span className="font-medium">{domain.domain_id}</span>
          <span className="text-gray-500">Range:</span>
          <span>{range.start}-{range.end}</span>
          <span className="text-gray-500">Architecture:</span>
          <span className="truncate">{hierarchy[0]}</span>
          <span className="text-gray-500">X:</span>
          <span className="truncate">{hierarchy[1]}</span>
          <span className="text-gray-500">H:</span>
          <span className="truncate">{hierarchy[2]}</span>
          <span className="text-gray-500">T:</span>
          <span className="truncate">{hierarchy[3]}</span>
          <span className="text-gray-500">F:</span>
          <span className="truncate">{hierarchy[4]}</span>
          <span className="text-gray-500">Binding Sites:</span>
          <span>{bindingSites}</span>
          <span className="text-gray-500 col-span-2">
            <a 
              href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600"
            >
              View in ECOD →
            </a>
          </span>
        </div>
      </div>
    );
  };

  
  const ProteinViewer = ({ ecNumber }) => {
    const [data, setData] = useState(null);
    const [selectedId, setSelectedId] = useState('');
    const [proteinData, setProteinData] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [selectedRange, setSelectedRange] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
  
    useEffect(() => {
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const response = await fetch(`/api/ec/${ecNumber}/domains`);
          if (!response.ok) {
            throw new Error('Failed to fetch protein data');
          }
          
          const parsedData = await response.json();
          setData(parsedData.data);
          if (parsedData.data.length > 0) {
            setSelectedId(parsedData.data[0].uniprot_kb_id);
          }
        } catch (error) {
          console.error('Error loading data:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
      };
  
      if (ecNumber) {
        fetchData();
      }
    }, [ecNumber]);
  
    useEffect(() => {
      if (data && selectedId) {
        const selected = data.find(item => item.uniprot_kb_id === selectedId);
        setProteinData(selected);
      }
    }, [data, selectedId]);
  
    if (loading) return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div>Loading protein data...</div>
        </CardContent>
      </Card>
    );
  
    if (error) return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-red-500">Error: {error}</div>
        </CardContent>
      </Card>
    );
  
    if (!data || data.length === 0) return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div>No protein data available for EC number: {ecNumber}</div>
        </CardContent>
      </Card>
    );
  
    return (
      <Card className="w-full">
        <CardHeader className="space-y-0 pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle>Protein Domain Viewer - EC {ecNumber}</CardTitle>
              <div className="flex gap-2 items-center">
                <label className="text-sm font-medium">Select UniProt KB ID:</label>
                <select 
                  className="border rounded p-1 text-sm"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {data?.map(item => (
                    <option key={item.uniprot_kb_id} value={item.uniprot_kb_id}>
                      {item.uniprot_kb_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedDomain && selectedRange ? (
              <div className="w-96">
                <DomainDetails 
                  domain={selectedDomain} 
                  range={selectedRange}
                  proteinData={proteinData}
                />
              </div>
            ) : null}
          </div>
          
          {proteinData && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500">Primary Accession:</span>
                <span className="font-medium">{proteinData.primary_accession}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">UniProt KB ID:</span>
                <span className="font-medium">{proteinData.uniprot_kb_id}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">Number of Features:</span>
                <span className="font-medium">{proteinData.features?.length || 0}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">Number of Domains:</span>
                <span className="font-medium">{proteinData.domains?.length || 0}</span>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {proteinData && (
            <DomainVisualization 
              proteinData={proteinData}
              selectedDomain={selectedDomain}
              setSelectedDomain={setSelectedDomain}
              selectedRange={selectedRange}
              setSelectedRange={setSelectedRange}
              containerRef={containerRef}
              scale={scale}
              setScale={setScale}
            />
          )}
        </CardContent>
      </Card>
    );
  };
  
  export default ProteinViewer;