import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import DomainVisualization from "../DomainVisualization";
import html2canvas from 'html2canvas';

const DomainCell = ({ domain, range, proteinData }) => {
  if (!domain || !proteinData) return null;

  const bindingSites = proteinData.features?.filter(
    (feature) =>
      feature.location.start >= range.start &&
      feature.location.end <= range.end
  ).length || 0;

  const hierarchy = domain.f_id?.split(".") || [];

  return (
    <div className="p-2 border rounded hover:bg-gray-50 text-xs h-full">
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm">{domain.domain_id}</span>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700"
          title="View in ECOD"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div className="text-gray-500">Range:</div>
        <div>{range.start}-{range.end}</div>

        <div className="text-gray-500">Sites:</div>
        <div>{bindingSites}</div>

        <div className="col-span-2">
          <div className="text-gray-500 mb-0.5">Architecture:</div>
          <div className="truncate" title={hierarchy[0] || ""}>{hierarchy[0] || "N/A"}</div>
        </div>

        <div className="col-span-2 grid grid-cols-[1.5rem,1fr] gap-x-1 gap-y-0.5">
          <span className="text-gray-500">X:</span>
          <span className="truncate" title={hierarchy[1] || ""}>{hierarchy[1] || "N/A"}</span>
          <span className="text-gray-500">H:</span>
          <span className="truncate" title={hierarchy[2] || ""}>{hierarchy[2] || "N/A"}</span>
          <span className="text-gray-500">T:</span>
          <span className="truncate" title={hierarchy[3] || ""}>{hierarchy[3] || "N/A"}</span>
          <span className="text-gray-500">F:</span>
          <span className="truncate" title={hierarchy[4] || ""}>{hierarchy[4] || "N/A"}</span>
        </div>
      </div>
    </div>
  );
};

const DynamicDomainGrid = ({ domains = [], proteinData }) => {
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return null;
  }

  // Create a flat array of all ranges with their domain info
  const ranges = [];
  domains.forEach(domain => {
    if (domain.ranges && Array.isArray(domain.ranges)) {
      domain.ranges.forEach(range => {
        if (range && typeof range.start === 'number') {
          ranges.push({ domain, range });
        }
      });
    }
  });

  // Sort ranges by start position
  const sortedRanges = ranges.sort((a, b) => a.range.start - b.range.start);

  // Calculate number of columns based on total items
  const numColumns = Math.min(sortedRanges.length, 5); // Max 5 columns
  const gridTemplateColumns = `repeat(${numColumns}, 1fr)`;

  // Split into rows if needed
  const rows = [];
  const itemsPerRow = numColumns;
  for (let i = 0; i < sortedRanges.length; i += itemsPerRow) {
    rows.push(sortedRanges.slice(i, i + itemsPerRow));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, rowIndex) => (
        <div 
          key={`row-${rowIndex}`}
          className="grid gap-2"
          style={{ gridTemplateColumns }}
        >
          {row.map((item, index) => (
            <div key={`cell-${rowIndex}-${index}-${item.domain.domain_id}-${item.range.start}`}>
              <DomainCell
                domain={item.domain}
                range={item.range}
                proteinData={proteinData}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const ProteinViewer = ({ ecNumber, onClose }) => {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [proteinData, setProteinData] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/ec/${ecNumber}/domains`);
        if (!response.ok) throw new Error("Failed to fetch protein data");
        const parsedData = await response.json();
        setData(parsedData.data);
        if (parsedData.data?.length > 0) {
          setSelectedId(parsedData.data[0].uniprot_kb_id);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (ecNumber) fetchData();
  }, [ecNumber]);

  useEffect(() => {
    if (data && selectedId) {
      const selected = data.find((item) => item.uniprot_kb_id === selectedId);
      setProteinData(selected);
    }
  }, [data, selectedId]);

  const handleDownload = async () => {
    if (!viewerRef.current) return;
    try {
      const canvas = await html2canvas(viewerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `protein-view-${ecNumber}-${selectedId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating image:', error);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error || `No protein data available for EC number: ${ecNumber}`}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-6">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold">EC {ecNumber}</h2>
              <select
                className="border rounded p-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {data?.map((item) => (
                  <option key={item.uniprot_kb_id} value={item.uniprot_kb_id}>
                    {item.uniprot_kb_id}
                  </option>
                ))}
              </select>
            </div>

            {proteinData && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Accession:</span>
                  <span className="font-medium">{proteinData.primary_accession}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Features:</span>
                  <span className="font-medium">{proteinData.features?.length || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Domains:</span>
                  <span className="font-medium">{proteinData.domains?.length || 0}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Download View"
            >
              <Download className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6" ref={viewerRef}>
          {/* Main Content */}
          {proteinData && (
            <div className="space-y-4">
              {/* Domain Structure */}
              <div>
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
              </div>

              {/* Domain Details Grid */}
              {proteinData.domains && proteinData.domains.length > 0 && (
                <DynamicDomainGrid 
                  domains={proteinData.domains}
                  proteinData={proteinData}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProteinViewer;