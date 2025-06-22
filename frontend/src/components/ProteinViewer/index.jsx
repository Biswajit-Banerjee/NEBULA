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

// Download the referenced element as a high-resolution PNG using html2canvas.
// Dynamically imports the library so the initial bundle stays lean.
const downloadAsImage = async (ref, filename) => {
  try {
    if (!ref?.current) return;

    // Lazy-load to avoid adding html2canvas into the first paint bundle.
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(ref.current, {
      scale: 2,           // increase resolution
      useCORS: true,      // allow cross-origin images where possible
      backgroundColor: null, // preserve transparent backgrounds
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (err) {
    console.error("Failed to download image", err);
  }
};

const DomainBadge = ({ type }) => {
  // Color mapping for different domain types
  const colors = {
    A: "bg-red-100 dark:bg-red-600/20 text-red-800 dark:text-red-300",
    X: "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300",
    H: "bg-green-100 dark:bg-green-600/20 text-green-800 dark:text-green-300",
    T: "bg-purple-100 dark:bg-purple-600/20 text-purple-800 dark:text-purple-300",
    F: "bg-amber-100 dark:bg-amber-600/20 text-amber-800 dark:text-amber-300",
    default: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
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
      id={`domain-cell-${domain.domain_id}-${range.start}-${range.end}`}
      className={`p-4 border rounded-lg transition-all duration-200 hover:shadow-md text-base min-w-[220px] sm:min-w-[260px] flex flex-col cursor-pointer
        ${isSelected ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-500/20" : "hover:bg-gray-50 dark:hover:bg-slate-700"}`}
      onClick={() => onClick && onClick(domain, range)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold">{domain.domain_id}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Position: {range.start}-{range.end}
          </div>
        </div>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-400 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-600/20"
          title="View in ECOD"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1">
          <span className="bg-indigo-100 dark:bg-indigo-600/20 text-indigo-800 dark:text-indigo-300 px-2 py-1 rounded text-xs">
            {bindingSites} {bindingSites === 1 ? "binding site" : "binding sites"}
          </span>
        </div>
        
        <div className="text-xs mt-1">
          <div className="text-gray-700 dark:text-gray-200 font-medium mb-1">Hierarchy:</div>
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
      <div className="text-center py-6 bg-gray-50 dark:bg-slate-700 rounded-lg border border-dashed border-gray-200 dark:border-slate-600">
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
    <div className="flex gap-3 overflow-x-auto pt-2 pb-4">
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
  
  const lengthVal = proteinData.sequence?.length || (() => {
    const ends = (proteinData.domains || []).flatMap(d => d.ranges?.map(r => r.end) || []);
    return ends.length ? Math.max(...ends) : "N/A";
  })();

  const stats = [
    { label: "Accession", value: proteinData.primary_accession },
    { label: "Length", value: lengthVal },
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
        className="border rounded-md py-1.5 px-3 text-sm bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 
                 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 focus:border-blue-400 dark:border-slate-600 outline-none
                 flex items-center justify-between gap-2 min-w-[200px] text-gray-800 dark:text-slate-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{selected.uniprot_kb_id}</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {data.map((item) => (
            <div
              key={item.uniprot_kb_id}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 dark:hover:bg-slate-700 
                        ${item.uniprot_kb_id === selectedId ? 'bg-blue-100 dark:bg-blue-600/20' : ''} text-gray-700 dark:text-slate-100`}
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
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm flex items-center divide-x divide-gray-200 dark:divide-slate-600">
        <button 
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
          className="p-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-l-lg"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <div className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          {Math.round(scale * 100)}%
        </div>
        
        <button 
          onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
          className="p-1.5 hover:bg-gray-50 dark:hover:bg-slate-700"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <button 
          onClick={onReset}
          className="p-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-r-lg"
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

  const bindingSites = (proteinData.features || []).filter(
    (f) => f.location.start >= range.start && f.location.end <= range.end
  );

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm mt-2 p-3 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-gray-800 dark:text-slate-100 text-sm">Domain Details</h4>
        <div className="text-xs bg-blue-100 dark:bg-blue-600/30 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
          {bindingSites.length}
        </div>
      </div>

      {bindingSites.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400 text-xs text-center py-4">No binding sites detected.</div>
      ) : (
        <ul className="space-y-1 text-xs max-h-[8rem] overflow-y-auto pr-1">
          {bindingSites.map((site, idx) => (
            <li key={`site-${idx}`} className="flex justify-between gap-2 p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded">
              <span className="font-medium dark:text-slate-200">{site.location.start}</span>
              <span className="text-gray-600 dark:text-gray-300 truncate flex-1">{site.type || "N/A"}</span>
              {site.description && (
                <span className="text-gray-400 dark:text-gray-400 truncate max-w-[120px]" title={site.description}>
                  {site.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
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
  const domainScrollToRef = useRef(null);

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

      // Automatically select the first domain (and its first range) if available
      if (selected?.domains?.length) {
        const firstDomain = selected.domains[0];
        const firstRange = firstDomain.ranges?.[0] || null;
        setSelectedDomain(firstDomain);
        setSelectedRange(firstRange);
        setShowDomainDetails(true);
      }
    }
  }, [data, selectedId]);

  // Auto-scroll to the selected domain card when it changes
  useEffect(() => {
    if (selectedDomain && selectedRange) {
      const el = document.getElementById(`domain-cell-${selectedDomain.domain_id}-${selectedRange.start}-${selectedRange.end}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
      }
    }
  }, [selectedDomain, selectedRange]);

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
    <Card className="w-full max-w-screen-xl mx-auto overflow-hidden border-gray-200">
      <CardContent ref={viewerRef} className="p-0">
        {/* Header Section */}
        <div className="bg-gray-100 dark:bg-slate-700 p-4 border-b dark:border-slate-600">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-100">EC {ecNumber}</h2>
                <span className="bg-blue-100 dark:bg-blue-600/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
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
                <a
                  href={`https://www.uniprot.org/uniprotkb/${proteinData?.primary_accession}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-600/20 rounded-full transition-colors"
                  title="Open in UniProt"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-600/20 
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
        {proteinData && (
          <div className="p-4 grid gap-6 md:grid-cols-2">
            {/* Left Column - Visualization */}
            {(!isSmallScreen || activeTab === "visualization") && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-800 dark:text-slate-100 text-lg">Protein Structure</h3>
                    {/* <VisualizationControls 
                      scale={scale} 
                      setScale={setScale} 
                      onReset={resetView}
                    /> */}
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
                      onDomainClick={handleSelectDomain}
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
              <div className="space-y-4 self-end">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-800 dark:text-slate-100 text-lg">Domain Information</h3>
                  <span className="text-xs text-gray-400 dark:text-slate-300 bg-gray-100 dark:bg-slate-600/40 px-2 py-1 rounded">
                    {proteinData.domains?.length || 0} domains
                  </span>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[650px] pr-1.5 pb-1 pt-1">
                  <DomainGrid 
                    domains={proteinData.domains}
                    proteinData={proteinData}
                    selectedDomain={selectedDomain}
                    selectedRange={selectedRange}
                    onSelectDomain={handleSelectDomain}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProteinViewer;