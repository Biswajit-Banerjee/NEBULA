import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download, 
  X, 
  AlertCircle, 
  Info, 
  ChevronRight, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
} from "lucide-react";
import DomainVisualization from "../DomainVisualization";
import { useMediaQuery } from 'react-responsive';

// This function would be implemented in a real app with html2canvas
const downloadAsImage = (ref, filename) => {
  console.log(`Downloading ${filename} from ref`, ref);
  // Implementation would use html2canvas in a real app
};

const DomainBadge = ({ type }) => {
  // Color mapping for different domain types
  const colors = {
    A: "bg-red-100 text-red-800",
    X: "bg-blue-100 text-blue-800",
    H: "bg-green-100 text-green-800",
    T: "bg-purple-100 text-purple-800",
    F: "bg-amber-100 text-amber-800",
    default: "bg-gray-100 text-gray-800"
  };
  
  return (
    <span className={`px-2 py-1 rounded-md font-medium ${colors[type] || colors.default}`}>
      {type}
    </span>
  );
};

const DomainTag = ({ label, value, tooltip = "" }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span className="text-gray-500">{label}:</span>
    <span className="font-medium truncate" title={tooltip || value}>
      {value || "N/A"}
    </span>
  </div>
);

const DomainCell = ({ domain, range, proteinData, isSelected, onClick }) => {
  if (!domain || !proteinData) return null;

  const bindingSites = proteinData.features?.filter(
    (feature) =>
      feature.location.start >= range.start &&
      feature.location.end <= range.end
  ).length || 0;

  const hierarchy = domain.f_id?.split(".") || [];
  
  const architectureInfo = hierarchy[0] || "N/A";
  const xClassInfo = hierarchy[1] || "N/A";
  const hClassInfo = hierarchy[2] || "N/A";
  const tClassInfo = hierarchy[3] || "N/A";
  const fClassInfo = hierarchy[4] || "N/A";

  return (
    <div 
      className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-md text-sm h-full flex flex-col
        ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}
      onClick={() => onClick && onClick(domain, range)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold">{domain.domain_id}</div>
          <div className="text-xs text-gray-600 mt-1">
            Position: {range.start}-{range.end}
          </div>
        </div>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
          title="View in ECOD"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1">
          <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
            {bindingSites} {bindingSites === 1 ? "binding site" : "binding sites"}
          </span>
        </div>
        
        <div className="text-xs mt-1">
          <div className="text-gray-700 font-medium mb-1">Hierarchy:</div>
          <div className="grid grid-cols-[auto,1fr] gap-x-1 gap-y-1">
            <DomainBadge type="A" />
            <div className="truncate" title={architectureInfo}>{architectureInfo}</div>
            
            <DomainBadge type="X" />
            <div className="truncate" title={xClassInfo}>{xClassInfo}</div>
            
            <DomainBadge type="H" />
            <div className="truncate" title={hClassInfo}>{hClassInfo}</div>
            
            <DomainBadge type="T" />
            <div className="truncate" title={tClassInfo}>{tClassInfo}</div>
            
            <DomainBadge type="F" />
            <div className="truncate" title={fClassInfo}>{fClassInfo}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DomainGrid = ({ 
  domains = [], 
  proteinData, 
  selectedDomain, 
  selectedRange, 
  onSelectDomain 
}) => {
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
        <Info className="w-6 h-6 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-500">No domain information available</p>
      </div>
    );
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

  const isSelected = (domain, range) => {
    return selectedDomain?.domain_id === domain.domain_id && 
           selectedRange?.start === range.start && 
           selectedRange?.end === range.end;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
      {sortedRanges.map((item, index) => (
        <DomainCell
          key={`domain-${item.domain.domain_id}-${item.range.start}-${index}`}
          domain={item.domain}
          range={item.range}
          proteinData={proteinData}
          isSelected={isSelected(item.domain, item.range)}
          onClick={() => onSelectDomain(item.domain, item.range)}
        />
      ))}
    </div>
  );
};

const ProteinStats = ({ proteinData }) => {
  if (!proteinData) return null;
  
  const stats = [
    { label: "Accession", value: proteinData.primary_accession },
    { label: "Length", value: proteinData.sequence?.length || "N/A" },
    { label: "Features", value: proteinData.features?.length || 0 },
    { label: "Domains", value: proteinData.domains?.length || 0 }
  ];
  
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {stats.map((stat, index) => (
        <div key={`stat-${index}`} className="flex items-center gap-1.5">
          <span className="text-gray-500">{stat.label}:</span>
          <span className="font-medium">{stat.value}</span>
        </div>
      ))}
    </div>
  );
};

const ProteinSelector = ({ data, selectedId, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!data || data.length === 0) return null;
  
  const selected = data.find(item => item.uniprot_kb_id === selectedId) || data[0];
  
  return (
    <div className="relative">
      <button
        className="border rounded-md py-1.5 px-3 text-sm bg-white hover:bg-gray-50 
                 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none
                 flex items-center justify-between gap-2 min-w-[200px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{selected.uniprot_kb_id}</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {data.map((item) => (
            <div
              key={item.uniprot_kb_id}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 
                        ${item.uniprot_kb_id === selectedId ? 'bg-blue-100' : ''}`}
              onClick={() => {
                onChange(item.uniprot_kb_id);
                setIsOpen(false);
              }}
            >
              {item.uniprot_kb_id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LoadingCard = () => (
  <Card className="w-full animate-pulse">
    <CardContent className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        <span className="text-blue-600 font-medium ml-2">Loading protein data...</span>
      </div>
    </CardContent>
  </Card>
);

const ErrorCard = ({ message, ecNumber }) => (
  <Card className="w-full">
    <CardContent className="p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <h3 className="text-lg font-medium text-red-700">Data Error</h3>
        <p className="text-gray-600">{message || `No protein data available for EC number: ${ecNumber}`}</p>
      </div>
    </CardContent>
  </Card>
);

const VisualizationControls = ({ scale, setScale, onReset }) => {
  return (
    <div className="flex items-center justify-end gap-2 my-2">
      <div className="bg-white border rounded-lg shadow-sm flex items-center divide-x">
        <button 
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
          className="p-1.5 hover:bg-gray-50 rounded-l-lg"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <div className="px-3 py-1 text-xs font-medium">
          {Math.round(scale * 100)}%
        </div>
        
        <button 
          onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
          className="p-1.5 hover:bg-gray-50"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <button 
          onClick={onReset}
          className="p-1.5 hover:bg-gray-50 rounded-r-lg"
          title="Reset view"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const DomainDetailPanel = ({ domain, range, proteinData, onClose }) => {
  if (!domain || !range || !proteinData) return null;
  
  const hierarchy = domain.f_id?.split(".") || [];
  const bindingSites = proteinData.features?.filter(
    feature => feature.location.start >= range.start && feature.location.end <= range.end
  ) || [];
  
  return (
    <div className="bg-white border rounded-lg p-5 shadow-lg">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-800">Domain Details</h3>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-gray-500 text-sm mb-1">Domain ID</div>
            <div className="font-medium">{domain.domain_id}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-gray-500 text-sm mb-1">Range</div>
            <div className="font-medium">{range.start}-{range.end}</div>
            <div className="text-xs text-gray-500 mt-1">({range.end - range.start + 1} amino acids)</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-3 text-gray-800">Hierarchy Classification</h4>
          <div className="grid grid-cols-[1fr,2fr] gap-3 text-sm bg-gray-50 p-3 rounded">
            <div className="text-gray-600 font-medium">Architecture:</div>
            <div>{hierarchy[0] || "N/A"}</div>
            
            <div className="text-gray-600 font-medium">X-group:</div>
            <div>{hierarchy[1] || "N/A"}</div>
            
            <div className="text-gray-600 font-medium">H-group:</div>
            <div>{hierarchy[2] || "N/A"}</div>
            
            <div className="text-gray-600 font-medium">T-group:</div>
            <div>{hierarchy[3] || "N/A"}</div>
            
            <div className="text-gray-600 font-medium">F-group:</div>
            <div>{hierarchy[4] || "N/A"}</div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium text-gray-800">Binding Sites</h4>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
              {bindingSites.length} found
            </span>
          </div>
          
          {bindingSites.length > 0 ? (
            <div className="border rounded overflow-hidden">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left border-b text-sm font-medium text-gray-700">Position</th>
                    <th className="px-4 py-2 text-left border-b text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left border-b text-sm font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bindingSites.map((site, index) => (
                    <tr key={`site-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{site.location.start}</td>
                      <td className="px-4 py-2 text-sm">{site.type || "N/A"}</td>
                      <td className="px-4 py-2 text-sm max-w-xs truncate" title={site.description}>
                        {site.description || "No description available"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded text-center">
              No binding sites detected in this domain range
            </div>
          )}
        </div>
        
        <div className="pt-3 border-t flex justify-between items-center">
          <a
            href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm flex items-center gap-2 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View in ECOD Database
          </a>
          
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 text-sm px-3 py-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            Close details
          </button>
        </div>
      </div>
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
  const [scale, setScale] = useState(1);
  const [showDomainDetails, setShowDomainDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("visualization");
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isSmallScreen = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real implementation, this would fetch from your API
        // For now, we'll simulate a fetch with a timeout
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
      
      // Reset domain selection when protein changes
      setSelectedDomain(null);
      setSelectedRange(null);
      setShowDomainDetails(false);
    }
  }, [data, selectedId]);

  const handleSelectDomain = (domain, range) => {
    setSelectedDomain(domain);
    setSelectedRange(range);
    setShowDomainDetails(true);
  };

  const handleDownload = () => {
    if (!viewerRef.current) return;
    downloadAsImage(viewerRef.current, `protein-view-${ecNumber}-${selectedId}.png`);
  };

  const resetView = () => {
    setScale(1);
    setSelectedDomain(null);
    setSelectedRange(null);
    setShowDomainDetails(false);
  };

  if (loading) {
    return <LoadingCard />;
  }

  if (error || !data || data.length === 0) {
    return <ErrorCard message={error} ecNumber={ecNumber} />;
  }

  return (
    <Card className="w-full overflow-hidden border-gray-200">
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-800">EC {ecNumber}</h2>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium">
                  Protein View
                </span>
              </div>
              
              <ProteinStats proteinData={proteinData} />
            </div>
            
            <div className="flex items-center gap-2">
              <ProteinSelector 
                data={data} 
                selectedId={selectedId} 
                onChange={setSelectedId}
              />
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 
                          rounded-full transition-colors"
                  title="Download View"
                >
                  <Download className="w-5 h-5" />
                </button>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 
                            rounded-full transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation - For small screens */}
        {isSmallScreen && (
          <div className="bg-white border-b">
            <div className="flex divide-x">
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "visualization" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setActiveTab("visualization")}
              >
                Visualization
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "domains" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setActiveTab("domains")}
              >
                Domains
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="p-4" ref={viewerRef}>
          {proteinData && (
            // <div className={`${isSmallScreen ? 'flex-col' : 'flex-row flex'} gap-6`}>
            <div className="flex flex-col gap-3">
              {/* Left Column - Visualization */}
              {(!isSmallScreen || activeTab === "visualization") && (
                // <div className={`${isSmallScreen ? 'w-full' : 'w-1/2'} space-y-4`}>
                <div className="w-full space-y-4">
                  <div className="border rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800 text-lg">Protein Structure</h3>
                      <VisualizationControls 
                        scale={scale} 
                        setScale={setScale} 
                        onReset={resetView}
                      />
                    </div>
                    
                    <div className="relative" ref={containerRef}>
                      <DomainVisualization
                        proteinData={proteinData}
                        selectedDomain={selectedDomain}
                        setSelectedDomain={setSelectedDomain}
                        selectedRange={selectedRange}
                        setSelectedRange={setSelectedRange}
                        containerRef={containerRef}
                        scale={scale}
                        setScale={setScale}
                        onDomainClick={(domain, range) => {
                          handleSelectDomain(domain, range);
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Domain Details Panel */}
                  {showDomainDetails && (
                    <DomainDetailPanel
                      domain={selectedDomain}
                      range={selectedRange}
                      proteinData={proteinData}
                      onClose={() => setShowDomainDetails(false)}
                    />
                  )}
                </div>
              )}
              
              {/* Right Column - Domains Grid */}
              {(!isSmallScreen || activeTab === "domains") && (
                // <div className={`${isSmallScreen ? 'w-full' : 'w-1/2'}`}>
                <div className="w-full">
                  <div className="border rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-800 text-lg">Domain Information</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {proteinData.domains?.length || 0} domains
                      </span>
                    </div>
                    
                    <div className="overflow-auto max-h-[650px] pr-2">
                      <DomainGrid 
                        domains={proteinData.domains}
                        proteinData={proteinData}
                        selectedDomain={selectedDomain}
                        selectedRange={selectedRange}
                        onSelectDomain={handleSelectDomain}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProteinViewer;