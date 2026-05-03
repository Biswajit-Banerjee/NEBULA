import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from '../../config/api';
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
    A: "bg-err-subtle text-err",
    X: "bg-info-subtle text-info",
    H: "bg-ok-subtle text-ok",
    T: "bg-brand/10 text-brand",
    F: "bg-warn-subtle text-warn",
    default: "bg-surface-inset text-content"
  };
  
  return (
    <span className={`px-2 py-1 rounded-md font-medium ${colors[type] || colors.default}`}>
      {type}
    </span>
  );
};

const DomainTag = ({ label, value, tooltip = "" }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span className="text-content-secondary">{label}:</span>
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
        ${isSelected ? "ring-2 ring-brand bg-brand/10" : "hover:bg-surface-inset/50"}`}
      onClick={() => onClick && onClick(domain, range)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold">{domain.domain_id}</div>
          <div className="text-xs text-content-secondary mt-1">
            Position: {range.start}-{range.end}
          </div>
        </div>
        <a
          href={`http://prodata.swmed.edu/ecod/af2_pdb/domain/${proteinData.primary_accession}_F1_${domain.domain_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:text-info p-1 rounded-full hover:bg-info-subtle"
          title="View in ECOD"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="bg-brand/10 text-brand px-2 py-1 rounded text-xs">
            {bindingSites} {bindingSites === 1 ? "binding site" : "binding sites"}
          </span>
          {domain.family_id && (
            <span className="bg-warn-subtle text-warn px-2 py-1 rounded text-xs font-mono" title="ECOD Family ID">
              {domain.family_id}
            </span>
          )}
        </div>
        
        <div className="text-xs mt-1">
          <div className="text-content font-medium mb-1">Hierarchy:</div>
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
      <div className="text-center py-6 bg-surface-inset/70 rounded-lg border border-dashed border-brd/70">
        <Info className="w-6 h-6 mx-auto mb-2 text-content-muted" />
        <p className="text-content-secondary">No domain information available</p>
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
    { label: "Organism", value: proteinData.organism_code?.toUpperCase() || "N/A" },
    { label: "Length", value: lengthVal },
    { label: "Features", value: proteinData.features?.length || 0 },
    { label: "Domains", value: proteinData.domains?.length || 0 }
  ];
  
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {stats.map((stat, index) => (
        <div key={`stat-${index}`} className="flex items-center gap-1.5">
          <span className="text-content-muted">{stat.label}:</span>
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
        className="border border-brd/80 rounded-md py-1.5 px-3 text-sm bg-surface-inset/80 hover:bg-surface-inset 
                 focus:ring-2 focus:ring-brand/40 focus:border-brand outline-none
                 flex items-center justify-between gap-2 min-w-[280px] text-content"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col items-start">
          <span className="font-medium text-xs">{selected.uniprot_kb_id}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-content-secondary">{selected.primary_accession}</span>
            {selected.organism_code && (
              <span className="bg-ok-subtle text-ok text-[10px] px-1.5 py-0.5 rounded font-medium uppercase">
                {selected.organism_code}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface-overlay/95 border border-brd/70 rounded-md shadow-lg max-h-60 overflow-auto backdrop-blur-sm">
          {data.map((item) => (
            <div
              key={item.uniprot_kb_id}
              className={`px-3 py-2 cursor-pointer hover:bg-surface-inset/60 
                        ${item.uniprot_kb_id === selectedId ? 'bg-brand/10' : ''} text-content`}
              onClick={() => {
                onChange(item.uniprot_kb_id);
                setIsOpen(false);
              }}
            >
              <div className="text-sm font-medium">{item.uniprot_kb_id}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[11px] text-content-secondary">{item.primary_accession}</span>
                {item.organism_code && (
                  <span className="bg-ok-subtle text-ok text-[10px] px-1.5 py-0.5 rounded font-medium uppercase">
                    {item.organism_code}
                  </span>
                )}
              </div>
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
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-brand rounded-full animate-bounce"></div>
        <span className="text-brand font-medium ml-2">Loading protein data...</span>
      </div>
    </CardContent>
  </Card>
);

const ErrorCard = ({ message, ecNumber }) => (
  <Card className="w-full">
    <CardContent className="p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-err" />
        <h3 className="text-lg font-medium text-err">Data Error</h3>
        <p className="text-content-secondary">{message || `No protein data available for EC number: ${ecNumber}`}</p>
      </div>
    </CardContent>
  </Card>
);

const VisualizationControls = ({ scale, setScale, onReset }) => {
  return (
    <div className="flex items-center justify-end gap-2 my-2">
      <div className="bg-surface-inset/80 border border-brd/70 rounded-lg shadow-sm flex items-center divide-x divide-brd/70">
        <button 
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
          className="p-1.5 hover:bg-surface-inset/70 rounded-l-lg"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <div className="px-3 py-1 text-xs font-medium text-content">
          {Math.round(scale * 100)}%
        </div>
        
        <button 
          onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
          className="p-1.5 hover:bg-surface-inset/70"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <button 
          onClick={onReset}
          className="p-1.5 hover:bg-surface-inset/70 rounded-r-lg"
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
    <div className="bg-surface-inset/80 border border-brd/70 rounded-lg shadow-sm mt-2 p-3 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-content text-sm">Domain Details</h4>
        <div className="text-xs bg-info-subtle text-info px-1.5 py-0.5 rounded">
          {bindingSites.length}
        </div>
      </div>

      {bindingSites.length === 0 ? (
        <div className="text-content-secondary text-xs text-center py-4">No binding sites detected.</div>
      ) : (
        <ul className="space-y-1 text-xs max-h-[8rem] overflow-y-auto pr-1">
          {bindingSites.map((site, idx) => (
            <li key={`site-${idx}`} className="flex justify-between gap-2 p-1 hover:bg-surface-inset/70 rounded">
              <span className="font-medium text-content">{site.location.start}</span>
              <span className="text-content-secondary truncate flex-1">{site.type || "N/A"}</span>
              {site.description && (
                <span className="text-content-muted truncate max-w-[120px]" title={site.description}>
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
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isSmallScreen = useMediaQuery({ maxWidth: 768 });
  const domainScrollToRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Abort any in-flight background fetches when ecNumber changes or unmount
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(null);
        setSelectedId("");
        setLoadingProgress({ loaded: 0, total: 0 });

        // Step 1: Instantly get the accession list (no UniProt API calls)
        const accRes = await fetch(getApiUrl(`ec/${ecNumber}/accessions`), { signal: controller.signal });
        if (!accRes.ok) throw new Error("Failed to fetch accession list");
        const accData = await accRes.json();
        const accessions = accData.data || [];

        if (accessions.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        setLoadingProgress({ loaded: 0, total: accessions.length });

        // Step 2: Fetch the first accession and show it immediately
        const first = accessions[0];
        const firstRes = await fetch(
          getApiUrl(`accession/${first.accession}/domains?organism_code=${encodeURIComponent(first.organism_code || "")}`),
          { signal: controller.signal }
        );
        if (!firstRes.ok) throw new Error("Failed to fetch first entry");
        const firstData = await firstRes.json();

        if (firstData.data) {
          setData([firstData.data]);
          setSelectedId(firstData.data.uniprot_kb_id);
          setLoadingProgress({ loaded: 1, total: accessions.length });
        }
        setLoading(false);

        // Step 3: Fetch remaining accessions in the background
        for (let i = 1; i < accessions.length; i++) {
          if (controller.signal.aborted) break;
          const acc = accessions[i];
          try {
            const res = await fetch(
              getApiUrl(`accession/${acc.accession}/domains?organism_code=${encodeURIComponent(acc.organism_code || "")}`),
              { signal: controller.signal }
            );
            if (!res.ok) continue;
            const json = await res.json();
            if (json.data) {
              setData(prev => [...(prev || []), json.data]);
            }
          } catch (bgErr) {
            if (bgErr.name === 'AbortError') break;
            // Silently skip failed background fetches
          }
          setLoadingProgress(prev => ({ ...prev, loaded: i + 1 }));
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (ecNumber) fetchData();

    return () => controller.abort();
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
    <Card className="w-full max-w-screen-xl mx-auto overflow-hidden border-brd/70">
      <CardContent ref={viewerRef} className="p-0">
        {/* Header Section */}
        <div className="bg-surface-inset/80 p-4 border-b border-brd/70">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-content">EC {ecNumber}</h2>
                <span className="bg-info-subtle text-info px-2 py-0.5 rounded text-xs font-medium">
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
              {loadingProgress.total > 1 && loadingProgress.loaded < loadingProgress.total && (
                <span className="text-xs text-content-muted whitespace-nowrap animate-pulse">
                  {loadingProgress.loaded}/{loadingProgress.total}
                </span>
              )}
              
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.uniprot.org/uniprotkb/${proteinData?.primary_accession}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-content-secondary hover:text-info hover:bg-info-subtle rounded-full transition-colors"
                  title="Open in UniProt"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-2 text-content-secondary hover:text-err hover:bg-err-subtle 
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
          <div className="bg-surface-inset/60 border-b border-brd/70">
            <div className="flex divide-x divide-brd/70">
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "visualization" 
                    ? "text-brand border-b-2 border-brand" 
                    : "text-content-secondary hover:text-content"
                }`}
                onClick={() => setActiveTab("visualization")}
              >
                Visualization
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium ${
                  activeTab === "domains" 
                    ? "text-brand border-b-2 border-brand" 
                    : "text-content-secondary hover:text-content"
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
                    <h3 className="font-medium text-content text-lg">Protein Structure</h3>
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
                  <h3 className="font-medium text-content text-lg">Domain Information</h3>
                  <span className="text-xs text-content-secondary bg-surface-inset/60 px-2 py-1 rounded">
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