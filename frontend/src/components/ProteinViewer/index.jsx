import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const ProteinViewer = ({ ecNumber }) => {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [proteinData, setProteinData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch data from the API using the provided EC number
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

  const renderDomainVisualization = () => {
    if (!proteinData || !proteinData.domains) return null;

    const domainColors = {
      'nD1': '#90cdf4',
      'nD2': '#9ae6b4',
      'nD3': '#fbd38d',
      'nD4': '#f687b3',
      'nD5': '#b794f4',
      'nD6': '#76e4f7',
      'nD7': '#feb2b2',
      'nD8': '#e9d8fd',
      'nD9': '#fbb6ce',
      'nD10': '#c6f6d5',
    };

    const getDomainColor = (domainId) => {
      if (domainColors[domainId]) return domainColors[domainId];
      return '#' + Math.floor(Math.random()*16777215).toString(16);
    };

    // Function to break down f_id into hierarchical components
    const renderFidBreakdown = (f_id) => {
      if (!f_id) return null;
      const parts = f_id.split('.');
      const labels = ['X', 'H', 'T', 'F'];
      
      return (
        <div className="flex flex-col text-xs bg-white rounded-lg p-2 shadow-sm">
          {parts.map((part, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="font-semibold w-4 text-gray-500">{labels[idx]}</span>
              <span className="font-mono">{part}</span>
            </div>
          ))}
        </div>
      );
    };

    const maxLength = Math.max(
      ...proteinData.domains.flatMap(d => d.ranges.map(r => r.end))
    );
    const scale = 800 / maxLength;

    // Function to create domain link
    const getDomainLink = (domain) => {
      return `http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`;
    };

    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">Domain Structure</h3>
        <div className="relative h-40 bg-gray-100 rounded">
          {/* Base protein line */}
          <div className="absolute top-12 left-0 h-1 bg-gray-300" style={{ width: `${maxLength * scale}px` }} />

          {/* Domains */}
          {proteinData.domains.map((domain, idx) => (
            <React.Fragment key={`domain-${idx}`}>
              {domain.ranges.map((range, rangeIdx) => {
                const width = (range.end - range.start) * scale;
                const left = range.start * scale;
                const color = getDomainColor(domain.domain_id);
                
                return (
                  <div key={`domain-container-${idx}-${rangeIdx}`} className="relative">
                    {/* Domain block */}
                    <div
                      className="absolute h-6 rounded cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: '10px',
                        backgroundColor: color,
                      }}
                      onClick={() => window.open(getDomainLink(domain), '_blank')}
                      title={`Click to view domain details`}
                    />
                    
                    {/* Only show ending boundary */}
                    <div
                      className="absolute text-xs"
                      style={{
                        left: `${left + width}px`,
                        top: '-4px',
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {range.end}
                    </div>

                    {/* f_id breakdown */}
                    <div
                      className="absolute"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        top: '40px',
                      }}
                    >
                      {renderFidBreakdown(domain.f_id)}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* Binding sites - moved below the ranges */}
          {proteinData.features.map((feature, idx) => {
            const width = Math.max(4, (feature.location.end - feature.location.start) * scale);
            const left = feature.location.start * scale;
            return (
              <div
                key={`feature-${idx}`}
                className="absolute w-1 h-4 bg-red-500"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  top: '28px', // Changed from '4px' to '28px' to position below the domain ranges
                }}
                title={`${feature.type}: ${feature.location.start}-${feature.location.end}`}
              />
            );
          })}
        </div>
        
        {/* Dynamic Legend */}
        <div className="flex flex-wrap gap-4 mt-6 text-sm">
          {proteinData.domains.map((domain, idx) => (
            <div 
              key={`legend-${idx}`} 
              className="flex items-center cursor-pointer hover:opacity-80"
              onClick={() => window.open(getDomainLink(domain), '_blank')}
            >
              <div 
                className="w-4 h-4 mr-2 rounded" 
                style={{ backgroundColor: getDomainColor(domain.domain_id) }}
              />
              <span>{domain.domain_id}</span>
            </div>
          ))}
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 mr-2" />
            <span>Binding Sites</span>
          </div>
        </div>
      </div>
    );
  };

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
      <CardHeader>
        <CardTitle>Protein Domain Viewer - EC {ecNumber}</CardTitle>
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Select UniProt KB ID:</label>
          <select 
            className="border rounded p-1"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {data.map(item => (
              <option key={item.uniprot_kb_id} value={item.uniprot_kb_id}>
                {item.uniprot_kb_id}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {proteinData && (
          <>
            <div className="mb-4">
              <p><strong>Primary Accession:</strong> {proteinData.primary_accession}</p>
              <p><strong>UniProt KB ID:</strong> {proteinData.uniprot_kb_id}</p>
              <p><strong>Number of Features:</strong> {proteinData.features.length}</p>
              <p><strong>Number of Domains:</strong> {proteinData.domains ? proteinData.domains.length : 0}</p>
            </div>
            {renderDomainVisualization()}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProteinViewer;